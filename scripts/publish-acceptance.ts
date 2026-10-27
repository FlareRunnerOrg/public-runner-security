import { appendFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
	assessAcceptance,
	assertAnchor,
	type AcceptanceRun,
	type RunPage,
} from "./acceptance.ts";
import { repository } from "./contracts.ts";
import { gh } from "./github.ts";
import { productionVersion } from "./production-version.ts";
import { renderReport, type AcceptanceReport } from "./report.ts";
import { verifyRun, type VerifiedRun } from "./verification.ts";

const runId = Bun.argv[2];
assert(runId && /^\d+$/.test(runId), "A Fixture checks run ID is required");
assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(
	process.env.GITHUB_REF,
	"refs/heads/main",
	"Publisher must use protected main",
);
assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
const details = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const readRun = async (id: number): Promise<AcceptanceRun> =>
	JSON.parse(await gh(["api", `repos/${repository}/actions/runs/${id}`]));
const anchor = await readRun(Number(runId));
assertAnchor(anchor);
const check: { id: number } = JSON.parse(
	await gh(
		[
			"api",
			"--method",
			"POST",
			`repos/${repository}/check-runs`,
			"--input",
			"-",
		],
		JSON.stringify({
			name: "Security acceptance",
			head_sha: anchor.head_sha,
			external_id: `security-acceptance:${anchor.id}:${anchor.run_attempt}:${process.env.GITHUB_RUN_ID}`,
			status: "in_progress",
			details_url: details,
			output: {
				title: "Security acceptance in progress",
				summary: "Waiting for the complete required suite on this revision.",
			},
		}),
	),
);
assert(Number.isSafeInteger(check.id) && check.id > 0);

let report: AcceptanceReport = {
	state: "pending",
	sha: anchor.head_sha,
	scope: "Required suite for this trigger",
	checkedAt: new Date().toISOString(),
	productionSha: null,
	rows: [],
};
async function publish(final: boolean): Promise<void> {
	const markdown = renderReport(report);
	await gh(
		[
			"api",
			"--method",
			"PATCH",
			`repos/${repository}/check-runs/${check.id}`,
			"--input",
			"-",
		],
		JSON.stringify({
			status: final ? "completed" : "in_progress",
			...(final
				? {
						conclusion:
							report.state === "passed"
								? "success"
								: report.state === "not_run"
									? "action_required"
									: "failure",
					}
				: {}),
			output: {
				title: markdown.split("\n")[0].replace("## ", ""),
				summary: markdown,
			},
		}),
	);
	if (final && process.env.GITHUB_STEP_SUMMARY)
		await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}

const verified = new Map<string, VerifiedRun>();
try {
	const enabled = process.env.FR_SECURITY_TEST_ENABLED === "true";
	const version = enabled ? await productionVersion() : null;
	report.productionSha = version;
	const deadline = Date.now() + 20 * 60_000;
	const reader = {
		readRun,
		async listRuns(sha: string): Promise<RunPage> {
			return JSON.parse(
				await gh([
					"api",
					`repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`,
				]),
			);
		},
		async listCompletions(since: string): Promise<RunPage> {
			const query = new URLSearchParams({
				event: "workflow_run",
				created: `>=${since}`,
				per_page: "100",
			});
			return JSON.parse(
				await gh([
					"api",
					`repos/${repository}/actions/workflows/deny-workflow-run.yml/runs?${query}`,
				]),
			);
		},
		async verify(run: AcceptanceRun): Promise<VerifiedRun> {
			const key = JSON.stringify([
				run.id,
				run.run_attempt,
				run.head_sha,
				run.path,
				run.event,
				run.repository.full_name,
				run.head_repository.full_name,
				run.head_branch,
				run.created_at,
				run.display_title,
				run.name,
				run.status,
				run.conclusion,
			]);
			const prior = verified.get(key);
			if (prior) return prior;
			const result = await verifyRun(run);
			verified.set(key, result);
			return result;
		},
	};
	while (true) {
		report = await assessAcceptance(anchor, reader, {
			enabled,
			productionSha: version,
			checkedAt: new Date().toISOString(),
			expired: Date.now() >= deadline,
		});
		if (report.state !== "pending") break;
		await publish(false);
		await Bun.sleep(20_000);
	}
	if (report.state === "passed" && (await productionVersion()) !== version) {
		report.state = "failed";
		report.rows.push({
			test: "Production release consistency",
			state: "failed",
			detail: "Production changed during testing; run the suite again",
		});
	}
} catch {
	report.state = "failed";
	report.rows.push({
		test: "Evidence collection",
		state: "failed",
		detail:
			"Evidence or release identity could not be verified; no passing result was published",
	});
}
await publish(true);
if (report.state !== "passed") process.exitCode = 1;

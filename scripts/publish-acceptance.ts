import { appendFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { publishAcceptanceStatus } from "./acceptance-publication.ts";
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

let report: AcceptanceReport = {
	state: "pending",
	sha: anchor.head_sha,
	scope: "Required suite for this trigger",
	checkedAt: new Date().toISOString(),
	productionSha: null,
	rows: [],
};
let statusPublished = false;
async function publish(final: boolean): Promise<void> {
	const markdown = renderReport(report);
	if (!statusPublished || final) {
		await publishAcceptanceStatus(report, details, final);
		statusPublished = true;
	}
	if (final && process.env.GITHUB_STEP_SUMMARY)
		await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}
await publish(false);

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

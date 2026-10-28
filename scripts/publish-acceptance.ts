import { appendFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { publishAcceptanceStatus } from "./acceptance-publication.ts";
import { assessAcceptance, assertAnchor } from "./acceptance.ts";
import { repository } from "./contracts.ts";
import { acceptanceReader, readRun } from "./evidence-reader.ts";
import { assertSuiteContext } from "./suite.ts";
import { productionVersion } from "./production-version.ts";
import { renderReport, type AcceptanceReport } from "./report.ts";

const runId = Bun.argv[2];
assert(runId && /^\d+$/.test(runId), "A Fixture checks run ID is required");
assertSuiteContext(process.env.GITHUB_REPOSITORY);
assert.equal(
	process.env.GITHUB_REF,
	"refs/heads/main",
	"Publisher must use protected main",
);
assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
const details = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
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

try {
	const enabled = process.env.FR_SECURITY_TEST_ENABLED === "true";
	const version = enabled ? await productionVersion() : null;
	report.productionSha = version;
	const deadline = Date.now() + 20 * 60_000;
	const reader = acceptanceReader();
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

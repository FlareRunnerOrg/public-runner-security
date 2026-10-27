import { appendFile } from "node:fs/promises";
import { contractFor, repository, type FixtureRun } from "./contracts.ts";
import { gh } from "./github.ts";
import { verifyRun } from "./verification.ts";
import { verifiedRows, renderReport } from "./report.ts";

const [runId, kind] = Bun.argv.slice(2);
if (!runId || !/^\d+$/.test(runId))
	throw new Error(
		"Usage: bun run verify <run-id> <auto|baseline|denied|cancelled>",
	);
if (!["auto", "baseline", "denied", "cancelled"].includes(kind))
	throw new Error("An explicit expected outcome is required");

const run: FixtureRun = JSON.parse(
	await gh(["api", `repos/${repository}/actions/runs/${runId}`]),
);
if (String(run.id) !== runId) throw new Error("Run identity changed");
const contract = contractFor(run);
if (kind !== "auto" && kind !== contract.kind)
	throw new Error("Workflow does not match the expected evidence kind");
const result = await verifyRun(run);
console.log(JSON.stringify(result, null, 2));

console.log(`FR_SECURITY_VERDICT_PASS run=${runId} attempt=${run.run_attempt}`);
if (process.env.GITHUB_STEP_SUMMARY)
	await appendFile(
		process.env.GITHUB_STEP_SUMMARY,
		renderReport(
			{
				state: "passed",
				sha: run.head_sha,
				scope: "Individual workflow evidence: " + run.name,
				checkedAt: new Date().toISOString(),
				productionSha: null,
				rows: verifiedRows(result),
			},
			"Workflow verification",
		),
	);

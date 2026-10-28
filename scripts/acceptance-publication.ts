import assert from "node:assert/strict";
import { repository } from "./contracts.ts";
import { gh } from "./github.ts";
import type { AcceptanceReport } from "./report.ts";

export async function publishAcceptanceStatus(
	report: AcceptanceReport,
	details: string,
	final: boolean,
	request: typeof gh = gh,
): Promise<void> {
	assert.match(report.sha, /^[a-f0-9]{40}$/);
	const prefix = `https://github.com/${repository}/actions/runs/`;
	assert(
		details.startsWith(prefix),
		"Report URL belongs to another repository",
	);
	assert.match(
		details.slice(prefix.length),
		/^[1-9][0-9]*$/,
		"Invalid report run URL",
	);
	const state = final
		? report.state === "passed"
			? "success"
			: "failure"
		: "pending";
	const description = final
		? {
				passed: "Security acceptance passed",
				pending: "Security acceptance incomplete",
				failed: "Security acceptance failed",
				not_run: "Security acceptance not run",
			}[report.state]
		: "Security acceptance in progress";
	// An Actions-owned check run can appear in the source workflow's jobs API.
	// A commit status reports acceptance without modifying the evidence we read.
	await request(
		[
			"api",
			"--method",
			"POST",
			`repos/${repository}/statuses/${report.sha}`,
			"--input",
			"-",
		],
		JSON.stringify({
			context: "Security acceptance",
			state,
			description,
			target_url: details,
		}),
	);
}

import { expect, test } from "bun:test";
import {
	renderReport,
	verifiedRows,
	type AcceptanceReport,
} from "../scripts/report.ts";
import {
	assertJobCoverage,
	attackJobPrefix,
	type WorkflowJob,
} from "../scripts/outcome.ts";

const report: AcceptanceReport = {
	state: "passed",
	sha: "a".repeat(40),
	scope: "PR controls and rejection probes",
	checkedAt: "2026-10-27T12:00:00Z",
	productionSha: "b".repeat(40),
	rows: [
		{
			test: "oidc",
			state: "passed",
			detail: "Blocked before execution: untrusted_oidc",
		},
	],
};
test("the summary identifies the exact revision, date, observed production release, and evidence scope", () => {
	const output = renderReport(report);
	expect(output).toContain(report.sha);
	expect(output).toContain(report.productionSha!);
	expect(output).toContain(report.checkedAt);
	expect(output).toContain(report.scope);
	expect(output).toContain("GitHub does not attest the runner image digest");
});
test("unresolved and disabled coverage is never presented as a passing suite", () => {
	for (const state of ["failed", "pending", "not_run"] as const) {
		const output = renderReport({ ...report, state });
		expect(output.split("\n")[0]).not.toContain("passed");
	}
});
test("metadata cannot inject a second table row, link, or HTML into the summary", () => {
	const output = renderReport({
		...report,
		scope: "<img>\n| [fake](https://bad.test)",
		rows: [],
	});
	expect(output).not.toContain("<img>");
	expect(output).not.toContain("\n| [fake]");
});
test("verified denials link to the exact job and distinguish cancellation evidence", () => {
	const run = {
		run: "https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/123",
		head_sha: report.sha,
		event: "pull_request",
		expected: "denied" as const,
		attempt: 2,
		result: "passed" as const,
		jobs: [
			{
				id: 456,
				name: "oidc",
				conclusion: "failure",
				runner_name: null,
				reason: "untrusted_oidc",
			},
		],
	};
	expect(verifiedRows(run)[0]).toMatchObject({
		state: "passed",
		detail: "Blocked before execution: untrusted_oidc",
		url: `${run.run}/job/456`,
	});
	expect(
		verifiedRows({
			...run,
			expected: "cancelled",
			jobs: [{ ...run.jobs[0], reason: null }],
		})[0].detail,
	).toContain("provider teardown is checked separately");
});
test("new probe labels preserve historical evidence and cannot conceal duplicates", () => {
	const job: WorkflowJob = {
		id: 1,
		name: "oidc",
		status: "completed",
		conclusion: "failure",
		runner_name: null,
		steps: [],
		html_url: "",
	};
	expect(
		assertJobCoverage([{ ...job, name: attackJobPrefix + "oidc" }], ["oidc"])[0]
			.name,
	).toBe("oidc");
	expect(assertJobCoverage([job], ["oidc"])[0].name).toBe("oidc");
	expect(() =>
		assertJobCoverage(
			[job, { ...job, name: attackJobPrefix + "oidc" }],
			["oidc"],
		),
	).toThrow();
});

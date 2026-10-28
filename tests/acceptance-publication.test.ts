import { repository } from "../scripts/contracts.ts";
import { expect, test } from "bun:test";
import { publishAcceptanceStatus } from "../scripts/acceptance-publication.ts";
import type { AcceptanceReport } from "../scripts/report.ts";

const details = `https://github.com/${repository}/actions/runs/42`;
const report: AcceptanceReport = {
	state: "passed",
	sha: "a".repeat(40),
	scope: "PR controls and rejection probes",
	checkedAt: "2026-10-27T12:00:00Z",
	productionSha: "b".repeat(40),
	rows: [],
};
interface CommitStatus {
	context: string;
	state: string;
	description: string;
	target_url: string;
}

test.each([
	["passed", "success"],
	["pending", "failure"],
	["failed", "failure"],
	["not_run", "failure"],
] as const)(
	"final %s acceptance publishes %s without modifying Actions jobs",
	async (state, expected) => {
		let writes = 0;
		await publishAcceptanceStatus(
			{ ...report, state },
			details,
			true,
			async (args, input) => {
				writes++;
				// GitHub can insert an Actions-owned check into a source workflow's job list.
				// Status publication must never create or modify such a check.
				expect(args).toEqual([
					"api",
					"--method",
					"POST",
					`repos/${repository}/statuses/${report.sha}`,
					"--input",
					"-",
				]);
				const body: CommitStatus = JSON.parse(input ?? "null");
				expect(body.context).toBe("Security acceptance");
				expect(body.state).toBe(expected);
				expect(body.target_url).toBe(details);
				expect(body.description.length).toBeLessThanOrEqual(140);
				return "{}";
			},
		);
		expect(writes).toBe(1);
	},
);

test("a provisional publication never marks the suite successful", async () => {
	await publishAcceptanceStatus(
		report,
		details,
		false,
		async (_args, input) => {
			const body: CommitStatus = JSON.parse(input ?? "null");
			expect(body.state).toBe("pending");
			return "{}";
		},
	);
});
test("a failed status write is not swallowed", async () => {
	await expect(
		publishAcceptanceStatus(report, details, true, async () => {
			throw Error("Status publication unavailable");
		}),
	).rejects.toThrow("Status publication unavailable");
});
test.each([
	{ sha: "not-a-sha", details },
	{ sha: report.sha, details: "https://attacker.test/report" },
	{
		sha: report.sha,
		details: "https://github.com/other/repository/actions/runs/42",
	},
	{ sha: report.sha, details: `${details}?run=another` },
	{ sha: report.sha, details: `${details}/../43` },
])(
	"invalid publication identities cannot reach the API %#",
	async (identity) => {
		let writes = 0;
		await expect(
			publishAcceptanceStatus(
				{ ...report, sha: identity.sha },
				identity.details,
				true,
				async () => {
					writes++;
					return "{}";
				},
			),
		).rejects.toThrow();
		expect(writes).toBe(0);
	},
);

import { describe, expect, test } from "bun:test";
import {
	assertDenied,
	assertJobCoverage,
	assertPassed,
	type WorkflowJob,
} from "../scripts/outcome.ts";

const denial = "FlareRunner did not authorize job execution.";
const assigned: WorkflowJob = {
	id: 1,
	name: "deny-secret",
	status: "completed",
	conclusion: "failure",
	runner_name: "flarerunner-fixture",
	steps: [],
	html_url:
		"https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/1",
};
describe("deployed denial evidence", () => {
	test("accepts only an assigned runner's explicit pre-step denial", () =>
		expect(() => assertDenied(assigned, denial)).not.toThrow());
	test.each([
		{ ...assigned, conclusion: "cancelled" },
		{ ...assigned, runner_name: null },
		{ ...assigned, runner_name: "GitHub Actions" },
		{
			...assigned,
			steps: [
				{
					name: "Must never execute",
					status: "completed",
					conclusion: "failure",
				},
			],
		},
	])(
		"does not confuse cancellation, routing failure, or executed customer code with protection %#",
		(job) => expect(() => assertDenied(job, denial)).toThrow(),
	);
	test("rejects an unrelated failure", () =>
		expect(() => assertDenied(assigned, "checkout failed")).toThrow());
	test("rejects a breach even if denial text also exists", () =>
		expect(() =>
			assertDenied(assigned, `${denial}\nFR_SECURITY_BOUNDARY_BREACH`),
		).toThrow());
	test("requires workload assertions for positive controls", () =>
		expect(() =>
			assertPassed(
				{ ...assigned, conclusion: "success" },
				"",
				"FR_SECURITY_BASELINE_PASS",
			),
		).toThrow());
});

describe("complete workflow evidence", () => {
	const job = (name: string, conclusion = "success"): WorkflowJob => ({
		...assigned,
		name,
		conclusion,
	});
	test("requires every expected job", () => {
		expect(() =>
			assertJobCoverage([job("baseline")], ["baseline", "isolation"]),
		).toThrow();
	});
	test("rejects partial skips", () => {
		expect(() =>
			assertJobCoverage(
				[job("baseline"), job("isolation", "skipped")],
				["baseline", "isolation"],
			),
		).toThrow();
	});
	test("rejects duplicate or unexpected jobs", () => {
		expect(() =>
			assertJobCoverage([job("baseline"), job("baseline")], ["baseline"]),
		).toThrow();
		expect(() =>
			assertJobCoverage([job("baseline"), job("other")], ["baseline"]),
		).toThrow();
	});
	test("allows only the intentionally omitted PR masking job", () => {
		expect(
			assertJobCoverage(
				[job("baseline"), job("mask", "skipped")],
				["baseline"],
				["mask"],
			),
		).toHaveLength(1);
		expect(() =>
			assertJobCoverage([job("baseline"), job("mask")], ["baseline"], ["mask"]),
		).toThrow();
	});
});

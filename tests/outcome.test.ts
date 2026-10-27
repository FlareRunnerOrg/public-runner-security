import { describe, expect, test } from "bun:test";
import {
	assertDenied,
	assertJobCoverage,
	assertPassed,
	type WorkflowJob,
} from "../scripts/outcome.ts";

const denial =
	"FlareRunner did not authorize job execution.\nFR_ADMISSION_DENIED reason=untrusted_secrets";
const assigned: WorkflowJob = {
	id: 1,
	name: "deny-secret",
	status: "completed",
	conclusion: "failure",
	runner_name: `flarerunner-${"a".repeat(40)}`,
	steps: [
		{
			name: "FlareRunner admission",
			status: "completed",
			conclusion: "failure",
		},
	],
	html_url:
		"https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/1",
};
describe("deployed denial evidence", () => {
	test("accepts only an assigned runner's explicit pre-step denial", () =>
		expect(() =>
			assertDenied(assigned, denial, "untrusted_secrets"),
		).not.toThrow());
	test.each([
		{ ...assigned, conclusion: "success" },
		{ ...assigned, conclusion: "skipped" },
		{ ...assigned, conclusion: "timed_out" },
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
		(job) =>
			expect(() => assertDenied(job, denial, "untrusted_secrets")).toThrow(),
	);
	test("rejects an unrelated failure", () =>
		expect(() =>
			assertDenied(assigned, "checkout failed", "untrusted_secrets"),
		).toThrow());
	test("rejects missing platform evidence", () => {
		expect(() =>
			assertDenied({ ...assigned, steps: [] }, denial, "untrusted_secrets"),
		).toThrow();
	});
	test("customer output cannot impersonate the platform denial", () => {
		const steps = [
			{
				name: "FlareRunner admission",
				status: "completed",
				conclusion: "success",
			},
			{
				name: "Impersonate denial",
				status: "completed",
				conclusion: "failure",
			},
		];
		expect(() =>
			assertDenied({ ...assigned, steps }, denial, "untrusted_secrets"),
		).toThrow();
	});
	test("denial cannot be followed by action setup", () => {
		const steps = [
			...assigned.steps,
			{ name: "Set up job", status: "completed", conclusion: "success" },
		];
		expect(() =>
			assertDenied({ ...assigned, steps }, denial, "untrusted_secrets"),
		).toThrow();
	});
	test("rejects a breach even if denial text also exists", () =>
		expect(() =>
			assertDenied(
				assigned,
				`${denial}\nFR_SECURITY_BOUNDARY_BREACH`,
				"untrusted_secrets",
			),
		).toThrow());
	test("requires workload assertions for positive controls", () =>
		expect(() =>
			assertPassed(
				{
					...assigned,
					conclusion: "success",
					steps: [
						{
							name: "FlareRunner admission",
							status: "completed",
							conclusion: "success",
						},
					],
				},
				"",
				"FR_SECURITY_BASELINE_PASS",
			),
		).toThrow());
	test("accepts a managed positive control only with admission and workload evidence", () => {
		expect(() =>
			assertPassed(
				{
					...assigned,
					conclusion: "success",
					steps: [
						{
							name: "FlareRunner admission",
							status: "completed",
							conclusion: "success",
						},
					],
				},
				"FR_SECURITY_BASELINE_PASS",
				"FR_SECURITY_BASELINE_PASS",
			),
		).not.toThrow();
	});
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

describe("specific policy evidence", () => {
	test.each([
		"FlareRunner did not authorize job execution.",
		denial.replace("untrusted_secrets", "untrusted_oidc"),
		denial.replace("untrusted_secrets", "unknown"),
		denial + "\nFR_ADMISSION_DENIED reason=untrusted_secrets",
		denial + "\nFR_ADMISSION_DENIED reason=privileged_event",
	])("rejects missing, unrelated, or ambiguous classifications %#", (log) => {
		expect(() => assertDenied(assigned, log, "untrusted_secrets")).toThrow();
	});
	test.each([
		"flarerunner-fixture",
		`flarerunner-${"a".repeat(41)}`,
		`flarerunner-${"A".repeat(40)}`,
	])("requires a real managed instance name %s", (runner_name) => {
		expect(() =>
			assertDenied({ ...assigned, runner_name }, denial, "untrusted_secrets"),
		).toThrow();
	});
	test("a pending positive control is never accepted", () => {
		expect(() =>
			assertPassed(
				{ ...assigned, status: "in_progress", conclusion: "success" },
				"FR_SECURITY_BASELINE_PASS",
				"FR_SECURITY_BASELINE_PASS",
			),
		).toThrow();
	});
});

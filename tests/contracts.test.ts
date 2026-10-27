import { describe, expect, test } from "bun:test";
import { contractFor, type FixtureRun } from "../scripts/contracts.ts";
const run: FixtureRun = {
	id: 42,
	status: "completed",
	conclusion: "failure",
	html_url:
		"https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/42",
	head_sha: "a".repeat(40),
	head_branch: "fixture",
	event: "pull_request",
	name: "Reject container and token escalation",
	path: ".github/workflows/deny-escalation.yml",
	run_attempt: 1,
	repository: { full_name: "FlareRunnerOrg/public-runner-security" },
};
describe("trusted verifier contract", () => {
	test("requires all six escalation probes and their intended policy", () => {
		const c = contractFor(run);
		expect(c.expected).toHaveLength(6);
		expect(c.reasons).toEqual({
			"empty-token-secret": "untrusted_secrets",
			"artifact-read": "untrusted_token_permissions",
			"checks-write": "untrusted_token_permissions",
			"job-container-secret": "untrusted_secrets",
			"service-container-secret": "untrusted_secrets",
			"docker-action-write-token": "untrusted_token_permissions",
		});
	});
	test.each([
		{ status: "queued" },
		{ conclusion: "success" },
		{ conclusion: "skipped" },
		{ conclusion: "cancelled" },
		{ conclusion: "timed_out" },
		{ path: ".github/workflows/attacker.yml" },
		{ name: "Security verdict" },
		{ event: "workflow_run" },
		{ head_sha: "bad" },
		{ run_attempt: 0 },
		{ run_attempt: 1.5 },
		{ repository: { full_name: "attacker/public-runner-security" } },
		{ event: "workflow_dispatch", head_branch: "main" },
	])(
		"rejects substituted, unexecuted, or unrelated run evidence %#",
		(change) => {
			expect(() => contractFor({ ...run, ...change })).toThrow();
		},
	);
	test("requires every positive control; only PR masking is intentionally skipped", () => {
		const baseline = {
			...run,
			name: "Public runner security",
			path: ".github/workflows/public-security.yml",
			conclusion: "success",
		};
		expect(contractFor(baseline).expected).toEqual(["baseline", "isolation"]);
		expect(contractFor(baseline).allowedSkipped).toEqual(["mask"]);
		expect(
			contractFor({
				...baseline,
				event: "workflow_dispatch",
				head_branch: "main",
			}).expected,
		).toEqual(["baseline", "isolation", "mask"]);
		expect(() => contractFor({ ...baseline, conclusion: "failure" })).toThrow();
	});
	test("privileged trigger fixtures cannot be substituted with an ordinary PR", () => {
		for (const [name, path, event] of [
			[
				"Reject privileged PR trigger",
				"deny-privileged.yml",
				"pull_request_target",
			],
			[
				"Reject privileged workflow completion trigger",
				"deny-workflow-run.yml",
				"workflow_run",
			],
		]) {
			const fixture = {
				...run,
				name,
				path: `.github/workflows/${path}`,
				event,
			};
			expect(contractFor(fixture).reasons).toEqual(
				event === "workflow_run"
					? { "workflow-run": "privileged_event" }
					: { "pull-request-target": "privileged_event" },
			);
			expect(() =>
				contractFor({ ...fixture, event: "pull_request" }),
			).toThrow();
		}
	});
});

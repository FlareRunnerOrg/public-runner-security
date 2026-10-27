import assert from "node:assert/strict";

export const repository = "FlareRunnerOrg/public-runner-security";
export type DenialReason =
	| "untrusted_secrets"
	| "untrusted_oidc"
	| "untrusted_token_permissions"
	| "privileged_event";
export interface FixtureRun {
	id: number;
	status: string;
	conclusion: string | null;
	html_url: string;
	head_sha: string;
	head_branch: string;
	event: string;
	name: string;
	path: string;
	run_attempt: number;
	repository: { full_name: string };
}
export interface Contract {
	kind: "baseline" | "denied" | "cancelled";
	expected: string[];
	allowedSkipped: string[];
	reasons: { [name: string]: DenialReason };
}
export function contractFor(run: FixtureRun): Contract {
	assert.equal(
		run.repository.full_name,
		repository,
		"Evidence belongs to another repository",
	);
	assert.equal(run.status, "completed", "Evidence is not terminal");
	assert(Number.isSafeInteger(run.id) && run.id > 0, "Invalid run identity");
	assert.equal(
		run.html_url,
		`https://github.com/${repository}/actions/runs/${run.id}`,
	);
	assert(
		Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0,
		"Invalid attempt identity",
	);
	assert.match(run.head_sha, /^[a-f0-9]{40}$/);
	let file: string;
	let contract: Contract;
	switch (run.path) {
		case ".github/workflows/public-security.yml":
			file = "public-security.yml";
			assert(["push", "pull_request", "workflow_dispatch"].includes(run.event));
			if (run.event !== "pull_request") assert.equal(run.head_branch, "main");
			contract = {
				kind: "baseline",
				expected: ["baseline", "isolation", "guest-root"],
				allowedSkipped: run.event === "pull_request" ? ["mask"] : [],
				reasons: {},
			};
			if (run.event !== "pull_request") contract.expected.push("mask");
			assert.equal(
				run.conclusion,
				"success",
				"Positive control did not succeed",
			);
			break;
		case ".github/workflows/deny-untrusted.yml":
			file = "deny-untrusted.yml";
			contract = {
				kind: "denied",
				expected: ["project-secret", "write-token", "oidc"],
				allowedSkipped: [],
				reasons: {
					"project-secret": "untrusted_secrets",
					"write-token": "untrusted_token_permissions",
					oidc: "untrusted_oidc",
				},
			};
			break;
		case ".github/workflows/deny-escalation.yml":
			file = "deny-escalation.yml";
			contract = {
				kind: "denied",
				expected: [
					"empty-token-secret",
					"artifact-read",
					"checks-write",
					"job-container-secret",
					"service-container-secret",
					"docker-action-write-token",
				],
				allowedSkipped: [],
				reasons: {
					"empty-token-secret": "untrusted_secrets",
					"artifact-read": "untrusted_token_permissions",
					"checks-write": "untrusted_token_permissions",
					"job-container-secret": "untrusted_secrets",
					"service-container-secret": "untrusted_secrets",
					"docker-action-write-token": "untrusted_token_permissions",
				},
			};
			break;
		case ".github/workflows/deny-privileged.yml":
			file = "deny-privileged.yml";
			assert.equal(run.event, "pull_request_target");
			contract = {
				kind: "denied",
				expected: ["pull-request-target"],
				allowedSkipped: [],
				reasons: { "pull-request-target": "privileged_event" },
			};
			break;
		case ".github/workflows/deny-workflow-run.yml":
			file = "deny-workflow-run.yml";
			assert.equal(run.event, "workflow_run");
			contract = {
				kind: "denied",
				expected: ["workflow-run"],
				allowedSkipped: [],
				reasons: { "workflow-run": "privileged_event" },
			};
			break;
		case ".github/workflows/lifetime.yml":
			file = "lifetime.yml";
			assert.equal(run.event, "workflow_dispatch");
			contract = {
				kind: "cancelled",
				expected: ["lifetime"],
				allowedSkipped: [],
				reasons: {},
			};
			break;
		default:
			throw new Error("Unknown fixture workflow");
	}
	assert.equal(
		run.path,
		`.github/workflows/${file}`,
		"Workflow name does not match its registered path",
	);
	if (file === "deny-untrusted.yml" || file === "deny-escalation.yml") {
		assert(["pull_request", "workflow_dispatch"].includes(run.event));
		if (run.event === "workflow_dispatch")
			assert.notEqual(run.head_branch, "main");
	}
	if (contract.kind === "denied")
		assert.equal(run.conclusion, "failure", "Attack was not rejected");
	if (contract.kind === "cancelled") assert.equal(run.conclusion, "cancelled");
	return contract;
}

import assert from "node:assert/strict";

export interface VerifierStep {
	uses?: string;
	run?: string;
	with?: {
		repository?: string;
		ref?: string;
		"persist-credentials"?: boolean;
		"bun-version"?: string;
		"no-cache"?: boolean;
	};
	env?: { GH_TOKEN?: string; FIXTURE_RUN_ID?: string };
}
export interface VerifierWorkflow {
	permissions: { contents: string; actions: string };
	jobs: { verify: { if: string; "runs-on": string; steps: VerifierStep[] } };
}

// This is a security contract for the privileged workflow_run boundary.
export function assertTrustedVerifier(workflow: VerifierWorkflow): void {
	assert.deepEqual(Object.keys(workflow).sort(), [
		"jobs",
		"name",
		"on",
		"permissions",
		"run-name",
	]);
	assert.deepEqual(workflow.permissions, { contents: "read", actions: "read" });
	assert.deepEqual(Object.keys(workflow.jobs), ["verify"]);
	const job = workflow.jobs.verify;
	assert.deepEqual(Object.keys(job).sort(), [
		"if",
		"runs-on",
		"steps",
		"timeout-minutes",
	]);
	assert.equal(job["runs-on"], "ubuntu-24.04");
	assert.equal(
		job.if,
		"${{ github.ref == 'refs/heads/main' && vars.FR_SECURITY_TEST_ENABLED == 'true' && (github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion != 'skipped') }}",
	);
	assert.equal(job.steps.length, 3);
	const [checkout, runtime, verify] = job.steps;
	assert.match(checkout.uses ?? "", /^actions\/checkout@[a-f0-9]{40}$/);
	assert.deepEqual(checkout.with, {
		repository: "FlareRunnerOrg/public-runner-security",
		ref: "${{ github.workflow_sha }}",
		"persist-credentials": false,
	});
	assert.equal(checkout.run, undefined);
	assert.equal(checkout.env, undefined);
	assert.match(runtime.uses ?? "", /^oven-sh\/setup-bun@[a-f0-9]{40}$/);
	assert.deepEqual(runtime.with, { "bun-version": "1.4.4", "no-cache": true });
	assert.equal(runtime.run, undefined);
	assert.equal(runtime.env, undefined);
	assert.equal(verify.uses, undefined);
	assert.equal(verify.run, 'bun scripts/verify-run.ts "$FIXTURE_RUN_ID" auto');
	assert.deepEqual(verify.env, {
		GH_TOKEN: "${{ github.token }}",
		FIXTURE_RUN_ID: "${{ github.event.workflow_run.id || inputs.run_id }}",
	});
}

export interface PublisherWorkflow {
	permissions: { contents: string; actions: string; checks: string };
	on: {
		workflow_run: { workflows: string[]; types: string[] };
		workflow_dispatch: {
			inputs: {
				fixture_run_id: {
					description: string;
					required: boolean;
					type: string;
				};
			};
		};
	};
	jobs: {
		acceptance: {
			if: string;
			"runs-on": string;
			"timeout-minutes": number;
			steps: (Omit<VerifierStep, "env"> & {
				env?: {
					GH_TOKEN?: string;
					FIXTURE_RUN_ID?: string;
					FR_SECURITY_TEST_ENABLED?: string;
				};
			})[];
		};
	};
}

export function assertTrustedPublisher(workflow: PublisherWorkflow): void {
	assert.deepEqual(Object.keys(workflow).sort(), [
		"jobs",
		"name",
		"on",
		"permissions",
		"run-name",
	]);
	assert.deepEqual(workflow.permissions, {
		contents: "read",
		actions: "read",
		checks: "write",
	});
	assert.deepEqual(workflow.on.workflow_run, {
		workflows: ["Fixture checks"],
		types: ["completed"],
	});
	assert.equal(
		workflow.on.workflow_dispatch.inputs.fixture_run_id.required,
		true,
	);
	assert.equal(
		workflow.on.workflow_dispatch.inputs.fixture_run_id.type,
		"string",
	);
	assert.deepEqual(Object.keys(workflow.jobs), ["acceptance"]);
	const job = workflow.jobs.acceptance;
	assert.deepEqual(Object.keys(job).sort(), [
		"if",
		"runs-on",
		"steps",
		"timeout-minutes",
	]);
	// Do not gate the publisher on the opt-in: disabled testing must be reported, not silently skipped.
	assert.equal(job.if, "${{ github.ref == 'refs/heads/main' }}");
	assert.equal(job["runs-on"], "ubuntu-24.04");
	assert.equal(job["timeout-minutes"], 25);
	assert.equal(job.steps.length, 3);
	const [checkout, runtime, publish] = job.steps;
	assert.deepEqual(Object.keys(checkout).sort(), ["name", "uses", "with"]);
	assert.match(checkout.uses ?? "", /^actions\/checkout@[a-f0-9]{40}$/);
	assert.deepEqual(checkout.with, {
		repository: "FlareRunnerOrg/public-runner-security",
		ref: "${{ github.workflow_sha }}",
		"persist-credentials": false,
	});
	assert.deepEqual(Object.keys(runtime).sort(), ["uses", "with"]);
	assert.match(runtime.uses ?? "", /^oven-sh\/setup-bun@[a-f0-9]{40}$/);
	assert.deepEqual(runtime.with, { "bun-version": "1.4.4", "no-cache": true });
	assert.deepEqual(Object.keys(publish).sort(), ["env", "name", "run"]);
	assert.equal(
		publish.run,
		'bun scripts/publish-acceptance.ts "$FIXTURE_RUN_ID"',
	);
	assert.deepEqual(publish.env, {
		GH_TOKEN: "${{ github.token }}",
		FIXTURE_RUN_ID:
			"${{ github.event.workflow_run.id || inputs.fixture_run_id }}",
		FR_SECURITY_TEST_ENABLED: "${{ vars.FR_SECURITY_TEST_ENABLED }}",
	});
}

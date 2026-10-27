import { expect, test } from "bun:test";

interface FixtureWorkflow {
	name: string;
	jobs: { [name: string]: { "runs-on": { group: string; labels: string[] } } };
}
interface VerdictTriggers {
	on: { workflow_run: { workflows: string[]; types: string[] } };
}
interface AttackJob {
	permissions?: { [scope: string]: string };
	environment?: { name: string; deployment: boolean };
	env?: { SECURITY_CANARY?: string };
	container?: { image: string; env: { SECURITY_CANARY: string } };
	services?: { untrusted: { image: string; env: { SECURITY_CANARY: string } } };
	steps: {
		name: string;
		run?: string;
		uses?: string;
		with?: { entrypoint: string; args: string };
	}[];
}

interface AttackWorkflow {
	permissions: { contents: string };
	jobs: { [name: string]: AttackJob };
}

async function attackWorkflow(file: string): Promise<AttackWorkflow> {
	return Bun.YAML.parse(
		await Bun.file(
			new URL(`../.github/workflows/${file}`, import.meta.url),
		).text(),
	) as AttackWorkflow;
}
const fixtures = [
	{
		file: "public-security.yml",
		name: "Public runner security",
		jobs: ["baseline", "isolation", "guest-root", "mask"],
	},
	{
		file: "deny-untrusted.yml",
		name: "Reject credential-bearing untrusted jobs",
		jobs: ["project-secret", "write-token", "oidc"],
	},
	{
		file: "deny-escalation.yml",
		name: "Reject container and token escalation",
		jobs: [
			"empty-token-secret",
			"artifact-read",
			"checks-write",
			"job-container-secret",
			"service-container-secret",
			"docker-action-write-token",
		],
	},
	{
		file: "deny-privileged.yml",
		name: "Reject privileged PR trigger",
		jobs: ["pull-request-target"],
	},
	{
		file: "deny-workflow-run.yml",
		name: "Reject privileged workflow completion trigger",
		jobs: ["workflow-run"],
	},
	{ file: "lifetime.yml", name: "Runner cancellation", jobs: ["lifetime"] },
];

test.each(fixtures)(
	"$file keeps every required managed-runner probe",
	async (fixture) => {
		const source = await Bun.file(
			new URL(`../.github/workflows/${fixture.file}`, import.meta.url),
		).text();
		const workflow = Bun.YAML.parse(source) as FixtureWorkflow;
		expect(workflow.name).toBe(fixture.name);
		expect(Object.keys(workflow.jobs).sort()).toEqual([...fixture.jobs].sort());
		for (const job of Object.values(workflow.jobs)) {
			expect(job["runs-on"].labels).toEqual(["self-hosted", "flarerunner-1x"]);
			expect([
				"${{ vars.FLARERUNNER_RUNNER_GROUP }}",
				"flarerunner-frg-07f27f39f72bfbc1",
			]).toContain(job["runs-on"].group);
		}
	},
);

test("every automatic attack/control workflow starts a trusted security verdict", async () => {
	const source = await Bun.file(
		new URL("../.github/workflows/security-verdict.yml", import.meta.url),
	).text();
	const workflow = Bun.YAML.parse(source) as VerdictTriggers;
	expect([...workflow.on.workflow_run.workflows].sort()).toEqual(
		fixtures
			.filter((fixture) => fixture.file !== "lifetime.yml")
			.map((fixture) => fixture.name)
			.sort(),
	);
	expect(workflow.on.workflow_run.types).toEqual(["completed"]);
});

test("credential probes retain distinct secret, write-token and OIDC attack inputs", async () => {
	const workflow = await attackWorkflow("deny-untrusted.yml");
	expect(workflow.permissions).toEqual({ contents: "read" });
	expect(workflow.jobs["project-secret"].environment).toEqual({
		name: "security-canary",
		deployment: false,
	});
	expect(workflow.jobs["project-secret"].env).toEqual({
		SECURITY_CANARY: "${{ secrets.FR_SECURITY_CANARY }}",
	});
	expect(workflow.jobs["write-token"].permissions).toEqual({
		contents: "write",
	});
	expect(workflow.jobs.oidc.permissions).toEqual({
		contents: "read",
		"id-token": "write",
	});
});

test("escalation probes cannot substitute a different permission or remove a container secret", async () => {
	const workflow = await attackWorkflow("deny-escalation.yml");
	const jobs = workflow.jobs;
	expect(workflow.permissions).toEqual({ contents: "read" });
	expect(jobs["empty-token-secret"].permissions).toEqual({});
	expect(jobs["empty-token-secret"].environment).toEqual({
		name: "security-canary",
		deployment: false,
	});
	expect(jobs["empty-token-secret"].env).toEqual({
		SECURITY_CANARY: "${{ secrets.FR_SECURITY_CANARY }}",
	});
	expect(jobs["artifact-read"].permissions).toEqual({
		actions: "read",
		contents: "read",
	});
	expect(jobs["checks-write"].permissions).toEqual({
		checks: "write",
		contents: "read",
	});
	expect(jobs["docker-action-write-token"].permissions).toEqual({
		contents: "write",
	});
	for (const name of ["job-container-secret", "service-container-secret"]) {
		expect(jobs[name].environment).toEqual({
			name: "security-canary",
			deployment: false,
		});
		const container =
			name === "job-container-secret"
				? jobs[name].container
				: jobs[name].services?.untrusted;
		expect(container?.image).toMatch(/^ubuntu:24\.04@sha256:[a-f0-9]{64}$/);
		expect(container?.env).toEqual({
			SECURITY_CANARY: "${{ secrets.FR_SECURITY_CANARY }}",
		});
	}
});

test.each([
	"deny-untrusted.yml",
	"deny-escalation.yml",
	"deny-privileged.yml",
	"deny-workflow-run.yml",
])("%s makes every executed attack fail visibly", async (file) => {
	const workflow = await attackWorkflow(file);
	for (const [name, job] of Object.entries(workflow.jobs)) {
		expect(job.steps).toHaveLength(1);
		const [step] = job.steps;
		expect(step.name).toBe("Must never execute");
		if (name === "docker-action-write-token") {
			expect(step.uses).toMatch(
				/^docker:\/\/ubuntu:24\.04@sha256:[a-f0-9]{64}$/,
			);
			expect(step.with).toEqual({
				entrypoint: "/bin/sh",
				args: "-c 'echo FR_SECURITY_BOUNDARY_BREACH; exit 1'",
			});
		} else {
			expect(step.uses).toBeUndefined();
			expect(step.run).toBe("echo FR_SECURITY_BOUNDARY_BREACH; exit 1");
		}
	}
});

test.each([
	{
		file: "deny-untrusted.yml",
		jobs: ["project-secret", "write-token", "oidc"],
	},
	{
		file: "deny-escalation.yml",
		jobs: [
			"empty-token-secret",
			"artifact-read",
			"checks-write",
			"job-container-secret",
			"service-container-secret",
			"docker-action-write-token",
		],
	},
])(
	"$file runs every expected rejection without exceeding one active probe",
	async (fixture) => {
		const source = await Bun.file(
			new URL(`../.github/workflows/${fixture.file}`, import.meta.url),
		).text();
		const workflow = Bun.YAML.parse(source) as {
			jobs: { [name: string]: { needs?: string; if: string } };
		};
		for (const [index, name] of fixture.jobs.entries()) {
			expect(workflow.jobs[name].needs).toBe(
				index === 0 ? undefined : fixture.jobs[index - 1],
			);
			// Expected failure must not skip the next attack or weaken its explicit opt-in.
			expect(workflow.jobs[name].if).toContain(
				"always() && vars.FR_SECURITY_TEST_ENABLED == 'true'",
			);
		}
	},
);

import { expect, test } from "bun:test";

interface FixtureWorkflow {
	name: string;
	jobs: { [name: string]: { "runs-on": { group: string; labels: string[] } } };
}
interface VerdictTriggers {
	on: { workflow_run: { workflows: string[]; types: string[] } };
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

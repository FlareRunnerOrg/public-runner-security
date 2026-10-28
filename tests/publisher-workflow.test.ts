import { expect, test } from "bun:test";
import {
	assertTrustedPublisher,
	type PublisherWorkflow,
} from "../scripts/trusted-workflow.ts";

const source = await Bun.file(
	new URL("../.github/workflows/security-acceptance.yml", import.meta.url),
).text();
function fixture(): PublisherWorkflow {
	return Bun.YAML.parse(source) as PublisherWorkflow;
}

test("the reporting workflow uses protected source, a hosted runner and only commit-status write authority", () => {
	expect(() => assertTrustedPublisher(fixture())).not.toThrow();
});
test.each([
	"FlareRunnerOrg/public-runner-security",
	"${{ github.event.workflow_run.head_repository.full_name }}",
])(
	"the publisher cannot select another source repository: %s",
	(repository) => {
		const workflow = fixture();
		workflow.jobs.acceptance.steps[0].with!.repository = repository;
		expect(() => assertTrustedPublisher(workflow)).toThrow();
	},
);
test("the reporter cannot create Actions-owned checks that contaminate workflow evidence", () => {
	const workflow = fixture();
	Object.assign(workflow.permissions, { checks: "write" });
	expect(() => assertTrustedPublisher(workflow)).toThrow();
});
test.each([
	"${{ github.event.workflow_run.head_sha }}",
	"${{ github.event.pull_request.head.sha }}",
	"main",
])(
	"the reporter cannot execute the triggering or a mutable revision: %s",
	(ref) => {
		const workflow = fixture();
		workflow.jobs.acceptance.steps[0].with!.ref = ref;
		expect(() => assertTrustedPublisher(workflow)).toThrow();
	},
);
test.each(["contents", "actions"] as const)(
	"the reporter cannot acquire %s write authority",
	(scope) => {
		const workflow = fixture();
		workflow.permissions[scope] = "write";
		expect(() => assertTrustedPublisher(workflow)).toThrow();
	},
);
test("disabled tests cannot silently skip publication", () => {
	const workflow = fixture();
	workflow.jobs.acceptance.if += " && vars.FR_SECURITY_TEST_ENABLED == 'true'";
	expect(() => assertTrustedPublisher(workflow)).toThrow();
});
test("acceptance failures cannot be made non-fatal", () => {
	const workflow = fixture();
	Object.assign(workflow.jobs.acceptance, { "continue-on-error": true });
	expect(() => assertTrustedPublisher(workflow)).toThrow();
});
test("untrusted expressions cannot be interpolated into the publisher shell", () => {
	const workflow = fixture();
	workflow.jobs.acceptance.steps[2].run =
		'bun scripts/publish-acceptance.ts "${{ inputs.fixture_run_id }}"';
	expect(() => assertTrustedPublisher(workflow)).toThrow();
});
test("a managed runner or an artifact-processing step cannot be added to the publisher", () => {
	const workflow = fixture();
	workflow.jobs.acceptance["runs-on"] = "self-hosted";
	expect(() => assertTrustedPublisher(workflow)).toThrow();
	const artifact = fixture();
	artifact.jobs.acceptance.steps.push({
		uses: `actions/download-artifact@${"a".repeat(40)}`,
	});
	expect(() => assertTrustedPublisher(artifact)).toThrow();
});

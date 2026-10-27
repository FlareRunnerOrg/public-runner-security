import { expect, test } from "bun:test";
import {
	assertTrustedVerifier,
	type VerifierWorkflow,
} from "../scripts/trusted-workflow.ts";

const source = await Bun.file(
	new URL("../.github/workflows/security-verdict.yml", import.meta.url),
).text();
function fixture(): VerifierWorkflow {
	return Bun.YAML.parse(source) as VerifierWorkflow;
}

test("the actual workflow keeps the verifier on trusted, read-only GitHub-hosted infrastructure", () => {
	expect(() => assertTrustedVerifier(fixture())).not.toThrow();
});
test.each([
	"${{ github.event.workflow_run.head_sha }}",
	"${{ github.event.pull_request.head.sha }}",
	"main",
])(
	"a triggering or mutable checkout ref cannot replace the trusted revision: %s",
	(ref) => {
		const workflow = fixture();
		workflow.jobs.verify.steps[0].with!.ref = ref;
		expect(() => assertTrustedVerifier(workflow)).toThrow();
	},
);
test("write permissions cannot be added to the verifier", () => {
	const workflow = fixture();
	workflow.permissions.actions = "write";
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});
test("verification failures cannot be made non-fatal", () => {
	const workflow = fixture();
	Object.assign(workflow.jobs.verify, { "continue-on-error": true });
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});
test("artifact execution cannot be added to the verifier", () => {
	const workflow = fixture();
	workflow.jobs.verify.steps.push({
		uses: `actions/download-artifact@${"a".repeat(40)}`,
	});
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});
test("a self-hosted runner cannot replace the trusted verifier runner", () => {
	const workflow = fixture();
	workflow.jobs.verify["runs-on"] = "self-hosted";
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});
test("manual dispatch cannot run a verifier from an untrusted branch", () => {
	const workflow = fixture();
	workflow.jobs.verify.if = "${{ always() }}";
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});
test("untrusted expressions cannot be interpolated into verifier shell commands", () => {
	const workflow = fixture();
	workflow.jobs.verify.steps[2].run =
		'bun scripts/verify-run.ts "${{ inputs.run_id }}" auto';
	expect(() => assertTrustedVerifier(workflow)).toThrow();
});

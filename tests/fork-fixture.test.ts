import { expect, test } from "bun:test";
import { prepareForkWorkflow } from "../scripts/fork-fixture.ts";
const source = await Bun.file(
	new URL("../.github/workflows/public-security.yml", import.meta.url),
).text();
interface ControlWorkflow {
	permissions: { contents: string };
	jobs: {
		[name: string]: {
			if?: string;
			"runs-on": { group: string };
			steps: { uses?: string; with?: { key?: string } }[];
		};
	};
}

test("fork preparation pins nonsecret routing and the same campaign key without changing privileges or action pins", () => {
	const prepared = prepareForkWorkflow(
		source,
		"flarerunner-frg-0123456789abcdef",
		"audit-20261027",
	);
	const before = Bun.YAML.parse(source) as ControlWorkflow;
	const after = Bun.YAML.parse(prepared) as ControlWorkflow;
	for (const job of Object.values(after.jobs) as {
		"runs-on": { group: string };
	}[])
		expect(job["runs-on"].group).toBe("flarerunner-frg-0123456789abcdef");
	expect(after.jobs.baseline.if).toBe(
		"${{ github.event_name == 'pull_request' }}",
	);
	expect(after.jobs.baseline.steps[2].with?.key).toBe(
		"public-security-audit-20261027",
	);
	expect(after.permissions).toEqual(before.permissions);
	expect(after.jobs.mask.if).toBe(before.jobs.mask.if);
	for (const name of ["baseline", "isolation", "guest-root", "mask"])
		expect(
			after.jobs[name].steps.map((s: { uses?: string }) => s.uses),
		).toEqual(before.jobs[name].steps.map((s: { uses?: string }) => s.uses));
});
test.each([
	["group\npermissions: write-all", "audit"],
	["flarerunner-frg-0123456789abcdef", "bad\nvalue"],
])("fork arguments cannot inject YAML", ([group, epoch]) => {
	expect(() => prepareForkWorkflow(source, group, epoch)).toThrow();
});
test("changed or previously prepared fork input requires review instead of another blind rewrite", () => {
	const prepared = prepareForkWorkflow(
		source,
		"flarerunner-frg-0123456789abcdef",
		"audit",
	);
	expect(() =>
		prepareForkWorkflow(prepared, "flarerunner-frg-0123456789abcdef", "audit"),
	).toThrow();
});

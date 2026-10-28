import { expect, test } from "bun:test";
import { reviewAcceptance } from "../scripts/review.ts";
import { anchor, fixture } from "./acceptance-fixture.ts";
const version = async () => "f".repeat(40);

test("a read-only assessor verifies all fifteen PR assertions from raw evidence", async () => {
	const report = await reviewAcceptance(anchor, fixture().reader, version);
	expect(report.state).toBe("passed");
	expect(report.rows).toHaveLength(15);
});
test.each(["missing", "running", "executed", "wrong-policy", "rerun"])(
	"a read-only review fails closed for %s evidence",
	async (mode) => {
		const f = fixture();
		if (mode === "missing") f.all.pop();
		if (mode === "running") f.all[2].status = "in_progress";
		if (mode === "executed") f.jobs.get(40)![0].conclusion = "success";
		if (mode === "wrong-policy")
			f.logs.set(
				400,
				"FlareRunner did not authorize job execution.\nFR_ADMISSION_DENIED reason=untrusted_oidc",
			);
		if (mode === "rerun") f.changed.set(40, { ...f.all[2], run_attempt: 2 });
		expect((await reviewAcceptance(anchor, f.reader, version)).state).toBe(
			"failed",
		);
	},
);
test("a production change during independent review cannot pass", async () => {
	let n = 0;
	const report = await reviewAcceptance(anchor, fixture().reader, async () =>
		(++n === 1 ? "f" : "e").repeat(40),
	);
	expect(report.state).toBe("failed");
	expect(report.rows.at(-1)?.test).toBe("Production release consistency");
});
test("unavailable evidence and release identity produce errors, never a pass", async () => {
	const f = fixture();
	f.reader.listRuns = async () => {
		throw Error("GitHub unavailable");
	};
	await expect(reviewAcceptance(anchor, f.reader, version)).rejects.toThrow();
	await expect(
		reviewAcceptance(anchor, fixture().reader, async () => {
			throw Error("Version unavailable");
		}),
	).rejects.toThrow();
});

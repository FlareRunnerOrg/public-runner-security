import { describe, expect, test } from "bun:test";
import {
	assessAcceptance,
	assertAnchor,
	completionTitle,
	requiredPaths,
	selectCohort,
} from "../scripts/acceptance.ts";
import { anchor, fixture, options } from "./acceptance-fixture.ts";

describe("complete PR acceptance", () => {
	test("ordinary completion while a pending snapshot is read reconciles on the next read", async () => {
		const f = fixture();
		f.all[0].status = "in_progress";
		f.changed.set(20, { ...f.all[0], status: "completed" });
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"pending",
		);
		f.all[0].status = "completed";
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"passed",
		);
	});
	test("publishes passing assertions for all eleven real rejections and the positive controls", async () => {
		const report = await assessAcceptance(anchor, fixture().reader, options);
		expect(report.state).toBe("passed");
		expect(report.rows).toHaveLength(15);
		expect(
			report.rows.filter((row) =>
				row.detail.startsWith("Blocked before execution"),
			),
		).toHaveLength(11);
		expect(report.rows.every((row) => row.state === "passed")).toBe(true);
	});
	test("disabled testing is explicitly not run and does not read or verify attack evidence", async () => {
		const f = fixture();
		f.reader.listRuns = async () => {
			throw Error("Should not read evidence");
		};
		const report = await assessAcceptance(anchor, f.reader, {
			...options,
			enabled: false,
		});
		expect(report.state).toBe("not_run");
		expect(report.rows[0].state).toBe("not_run");
	});
	test.each(["queued", "in_progress"])(
		"%s remains pending and expires as a failure",
		async (status) => {
			const f = fixture();
			f.all[0].status = status;
			expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
				"pending",
			);
			expect(
				(
					await assessAcceptance(anchor, f.reader, {
						...options,
						expired: true,
					})
				).state,
			).toBe("failed");
		},
	);
	test("a missing workflow cannot become green even when all observed jobs passed", async () => {
		const f = fixture();
		f.all.pop();
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"pending",
		);
		const report = await assessAcceptance(anchor, f.reader, {
			...options,
			expired: true,
		});
		expect(report.state).toBe("failed");
		expect(
			report.rows.some((row) => row.detail.startsWith("Incomplete:")),
		).toBe(true);
	});
	test("the completion probe must name this exact baseline source run", async () => {
		const f = fixture();
		f.child.display_title = completionTitle(999);
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"pending",
		);
	});
	test("duplicate workflow executions are ambiguous, not interchangeable passing evidence", async () => {
		const f = fixture();
		f.all.push({ ...f.all[0], id: 21 });
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"failed",
		);
	});
	test("successful attack workflow wrappers pass only with all eleven verified admission failures", async () => {
		const f = fixture();
		for (const run of [...f.all, f.child]) run.conclusion = "success";
		const report = await assessAcceptance(anchor, f.reader, options);
		expect(report.state).toBe("passed");
		expect(
			report.rows.filter((row) =>
				row.detail.startsWith("Blocked before execution"),
			),
		).toHaveLength(11);
	});
	test.each(["skipped", "cancelled", "timed_out", "neutral", null])(
		"an attack workflow with %s is a real failure",
		async (conclusion) => {
			const f = fixture();
			f.all[2].conclusion = conclusion;
			expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
				"failed",
			);
		},
	);
	test.each(["success", "skipped", "cancelled", "timed_out"])(
		"a green workflow wrapper never accepts an attack job with %s",
		async (conclusion) => {
			const f = fixture();
			f.all[2].conclusion = "success";
			f.jobs.get(40)![0].conclusion = conclusion;
			expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
				"failed",
			);
		},
	);
	test("missing or duplicate jobs fail complete coverage", async () => {
		for (const duplicate of [false, true]) {
			const f = fixture();
			const probes = f.jobs.get(40)!;
			if (duplicate) probes.push(probes[0]);
			else probes.pop();
			expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
				"failed",
			);
		}
	});
	test("a partial paginated listing cannot pass", async () => {
		const f = fixture();
		f.reader.listRuns = async () => ({
			total_count: 101,
			workflow_runs: f.all,
		});
		await expect(assessAcceptance(anchor, f.reader, options)).rejects.toThrow(
			"Incomplete workflow listing",
		);
	});
	test.each([
		"checkout failed",
		"FR_ADMISSION_DENIED reason=untrusted_oidc",
		"FR_SECURITY_BOUNDARY_BREACH",
	])("incorrect rejection evidence fails: %s", async (log) => {
		const f = fixture();
		f.all[2].conclusion = "success";
		f.logs.set(400, log);
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"failed",
		);
	});
	test("customer execution cannot pass by printing the expected denial", async () => {
		const f = fixture();
		f.all[2].conclusion = "success";
		f.jobs.get(40)![0].steps = [
			{
				name: "FlareRunner admission",
				status: "completed",
				conclusion: "success",
			},
			{
				name: "Must never execute",
				status: "completed",
				conclusion: "failure",
			},
		];
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"failed",
		);
	});
	test("a rerun started during verification invalidates earlier successful evidence", async () => {
		const f = fixture();
		f.changed.set(40, { ...f.all[2], run_attempt: 2 });
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"failed",
		);
	});
	test("a rerun of the fixture anchor also invalidates the cohort", async () => {
		const f = fixture();
		f.changed.set(anchor.id, { ...anchor, run_attempt: 2 });
		expect((await assessAcceptance(anchor, f.reader, options)).state).toBe(
			"failed",
		);
	});
	test("read failures cannot be interpreted as no failed tests", async () => {
		const f = fixture();
		f.reader.listRuns = async () => {
			throw Error("Unavailable");
		};
		await expect(assessAcceptance(anchor, f.reader, options)).rejects.toThrow();
	});
});

describe("trigger and revision scope", () => {
	test.each([
		{ head_sha: "d".repeat(40) },
		{ head_branch: "another-pr" },
		{ head_repository: { full_name: "other/fork" } },
		{ created_at: "2026-10-26T12:00:00Z" },
	])(
		"another revision, branch, fork or earlier trigger is not reused %#",
		(change) => {
			const candidate = { ...fixture().all[0], ...change };
			expect(
				selectCohort(anchor, { total_count: 1, workflow_runs: [candidate] }),
			).toEqual([]);
		},
	);
	test.each([
		{ repository: { full_name: "other/project" } },
		{ head_sha: "invalid" },
		{ path: ".github/workflows/attacker.yml" },
		{ event: "workflow_dispatch" },
		{ created_at: "invalid" },
	])(
		"an unrelated or malformed anchor cannot publish a passing check %#",
		(change) => {
			expect(() => assertAnchor({ ...anchor, ...change })).toThrow();
		},
	);
	test("fork coverage explicitly excludes unavailable credential matrices", async () => {
		const fork = { ...anchor, head_repository: { full_name: "owned/fork" } };
		expect(requiredPaths(fork)).toHaveLength(2);
		const report = await assessAcceptance(fork, fixture(fork).reader, options);
		expect(report.state).toBe("passed");
		expect(report.scope).toContain("credential matrices excluded on forks");
		expect(report.rows).toHaveLength(6);
	});
	test("main coverage requires masking and the completion rejection", async () => {
		const main = { ...anchor, event: "push", head_branch: "main" };
		const report = await assessAcceptance(main, fixture(main).reader, options);
		expect(report.state).toBe("passed");
		expect(report.rows.map((row) => row.test)).toContain("mask");
		expect(report.rows).toHaveLength(6);
	});
	test("failed fixture checks and an expired anchor cannot pass", async () => {
		expect(
			(
				await assessAcceptance(
					{ ...anchor, conclusion: "failure" },
					fixture().reader,
					options,
				)
			).state,
		).toBe("failed");
		expect(
			(
				await assessAcceptance(
					{ ...anchor, status: "queued" },
					fixture().reader,
					{ ...options, expired: true },
				)
			).state,
		).toBe("failed");
	});
});

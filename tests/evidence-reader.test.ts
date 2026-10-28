import { expect, test } from "bun:test";
import { acceptanceReader } from "../scripts/evidence-reader.ts";
import { repository } from "../scripts/contracts.ts";
import { anchor } from "./acceptance-fixture.ts";

test("the shared reader issues only scoped reads and caches only the same execution snapshot", async () => {
	const calls: string[][] = [];
	let verified = 0;
	const reader = acceptanceReader(
		async (args) => {
			calls.push(args);
			return JSON.stringify(
				args[1].includes("/runs/10")
					? anchor
					: { total_count: 0, workflow_runs: [] },
			);
		},
		async (run) => {
			verified++;
			return {
				run: run.html_url,
				head_sha: run.head_sha,
				event: run.event,
				expected: "baseline",
				attempt: run.run_attempt,
				result: "passed",
				jobs: [],
			};
		},
	);
	await reader.readRun(10);
	await reader.listRuns(anchor.head_sha);
	await reader.listCompletions(anchor.created_at);
	expect(calls).toHaveLength(3);
	for (const args of calls) {
		expect(args[0]).toBe("api");
		expect(args).toHaveLength(2);
		expect(args[1].startsWith(`repos/${repository}/actions/`)).toBe(true);
	}
	await reader.verify(anchor);
	await reader.verify({ ...anchor });
	expect(verified).toBe(1);
	await reader.verify({ ...anchor, run_attempt: 2 });
	await reader.verify({ ...anchor, status: "in_progress" });
	expect(verified).toBe(3);
});

import { appendFile } from "node:fs/promises";
import { contractFor, repository, type FixtureRun } from "./contracts.ts";
import {
	assertDenied,
	assertJobCoverage,
	assertPassed,
	type WorkflowJob,
} from "./outcome.ts";

const [runId, kind] = Bun.argv.slice(2);
if (!runId || !/^\d+$/.test(runId))
	throw new Error(
		"Usage: bun run verify <run-id> <auto|baseline|denied|cancelled>",
	);
if (!["auto", "baseline", "denied", "cancelled"].includes(kind))
	throw new Error("An explicit expected outcome is required");

async function gh(args: string[]): Promise<string> {
	const child = Bun.spawn(["gh", ...args], {
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
		timeout: 30_000,
	});
	const [exit, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exit !== 0)
		throw new Error(
			`GitHub evidence read failed (${exit}): ${stderr.slice(0, 300)}`,
		);
	return stdout;
}

const run: FixtureRun = JSON.parse(
	await gh(["api", `repos/${repository}/actions/runs/${runId}`]),
);
if (String(run.id) !== runId) throw new Error("Run identity changed");
const contract = contractFor(run);
if (kind !== "auto" && kind !== contract.kind)
	throw new Error("Workflow does not match the expected evidence kind");
const data: { jobs: WorkflowJob[]; total_count: number } = JSON.parse(
	await gh([
		"api",
		`repos/${repository}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100`,
	]),
);
if (data.total_count !== data.jobs.length)
	throw new Error("Incomplete job listing");
const jobs = assertJobCoverage(
	data.jobs,
	contract.expected,
	contract.allowedSkipped,
);
for (const job of jobs) {
	const log = await gh([
		"run",
		"view",
		runId,
		"--repo",
		repository,
		"--job",
		String(job.id),
		"--log",
	]);
	if (log.includes("fr-public-canary-"))
		throw new Error("An unmasked dummy canary appeared in GitHub logs");
	if (contract.kind === "denied")
		assertDenied(job, log, contract.reasons[job.name]);
	else if (contract.kind === "cancelled") {
		if (job.conclusion !== "cancelled")
			throw new Error("Cancellation has not reached the assigned job");
		if (!/^flarerunner-[a-f0-9]{40}$/.test(job.runner_name ?? ""))
			throw new Error("Cancellation did not exercise a managed runner");
		if (!log.includes("FR_SECURITY_LIFETIME_STARTED"))
			throw new Error("The workload had not started before cancellation");
	} else {
		const marker =
			job.name === "isolation"
				? "FR_SECURITY_ISOLATION_PASS"
				: job.name === "mask"
					? "FR_SECURITY_MASK_PASS"
					: job.name === "guest-root"
						? "FR_SECURITY_GUEST_ROOT_PASS"
						: "FR_SECURITY_BASELINE_PASS";
		assertPassed(job, log, marker);
		if (job.name === "mask" && !log.includes("FR_SECURITY_MASK ***"))
			throw new Error("The masked dummy-canary marker is missing");
	}
}
console.log(
	JSON.stringify(
		{
			run: run.html_url,
			head_sha: run.head_sha,
			event: run.event,
			expected: contract.kind,
			attempt: run.run_attempt,
			result: "passed",
			jobs: jobs.map(({ id, name, conclusion, runner_name }) => ({
				id,
				name,
				conclusion,
				runner_name,
				reason: contract.reasons[name] ?? null,
			})),
		},
		null,
		2,
	),
);

console.log(`FR_SECURITY_VERDICT_PASS run=${runId} attempt=${run.run_attempt}`);
if (process.env.GITHUB_STEP_SUMMARY)
	await appendFile(
		process.env.GITHUB_STEP_SUMMARY,
		`## Security test passed\n\n[Fixture run #${runId}](https://github.com/${repository}/actions/runs/${runId}/attempts/${run.run_attempt})\n\n` +
			jobs
				.map(
					(job) =>
						`- ${job.name}: ${contract.reasons[job.name] ?? "positive control passed"}`,
				)
				.join("\n") +
			"\n",
	);

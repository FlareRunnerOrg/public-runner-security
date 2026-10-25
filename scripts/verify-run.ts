import { assertDenied, assertPassed, type WorkflowJob } from "./outcome.ts";

const repository = "FlareRunnerOrg/public-runner-security";
const [runId, kind] = Bun.argv.slice(2);
if (!runId || !/^\d+$/.test(runId))
	throw new Error("Usage: bun run verify <run-id> <baseline|denied|cancelled>");
if (!["baseline", "denied", "cancelled"].includes(kind))
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

const run: {
	status: string;
	conclusion: string | null;
	html_url: string;
	head_sha: string;
	event: string;
} = JSON.parse(await gh(["api", `repos/${repository}/actions/runs/${runId}`]));
if (run.status !== "completed")
	throw new Error("Evidence is not terminal; inspect the run and retry later");
const data: { jobs: WorkflowJob[] } = JSON.parse(
	await gh([
		"api",
		`repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
	]),
);
const jobs = data.jobs.filter((job) => job.conclusion !== "skipped");
if (!jobs.length)
	throw new Error(
		"No executed fixture jobs; a disabled gate is not a passing test",
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
	if (kind === "denied") assertDenied(job, log);
	else if (kind === "cancelled") {
		if (job.conclusion !== "cancelled")
			throw new Error("Cancellation has not reached the assigned job");
		if (!job.runner_name?.startsWith("flarerunner-"))
			throw new Error("Cancellation did not exercise a managed runner");
		if (!log.includes("FR_SECURITY_LIFETIME_STARTED"))
			throw new Error("The workload had not started before cancellation");
	} else {
		const marker =
			job.name === "isolation"
				? "FR_SECURITY_ISOLATION_PASS"
				: job.name === "mask"
					? "FR_SECURITY_MASK_PASS"
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
			expected: kind,
			result: "passed",
			jobs: jobs.map(({ id, name, conclusion, runner_name }) => ({
				id,
				name,
				conclusion,
				runner_name,
			})),
		},
		null,
		2,
	),
);

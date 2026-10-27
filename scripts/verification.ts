import { contractFor, type FixtureRun } from "./contracts.ts";
import { gh } from "./github.ts";
import {
	assertDenied,
	assertJobCoverage,
	assertPassed,
	type WorkflowJob,
} from "./outcome.ts";

export interface ProbeResult {
	id: number;
	name: string;
	conclusion: string | null;
	runner_name: string | null;
	reason: string | null;
}
export interface VerifiedRun {
	run: string;
	head_sha: string;
	event: string;
	expected: "baseline" | "denied" | "cancelled";
	attempt: number;
	result: "passed";
	jobs: ProbeResult[];
}

export async function verifyEvidence(
	run: FixtureRun,
	data: { jobs: WorkflowJob[]; total_count: number },
	readLog: (job: WorkflowJob) => Promise<string>,
): Promise<VerifiedRun> {
	const contract = contractFor(run);
	if (data.total_count !== data.jobs.length)
		throw new Error("Incomplete job listing");
	const jobs = assertJobCoverage(
		data.jobs,
		contract.expected,
		contract.allowedSkipped,
	);
	for (const job of jobs) {
		const log = await readLog(job);
		if (log.includes("fr-public-canary-"))
			throw new Error("An unmasked dummy canary appeared in GitHub logs");
		if (contract.kind === "denied") {
			assertDenied(job, log, contract.reasons[job.name]);
		} else if (contract.kind === "cancelled") {
			if (job.conclusion !== "cancelled")
				throw new Error("Cancellation has not reached the assigned job");
			if (!/^flarerunner-[a-f0-9]{40}$/.test(job.runner_name ?? ""))
				throw new Error("Cancellation did not exercise a managed runner");
			if (!log.includes("FR_SECURITY_LIFETIME_STARTED"))
				throw new Error("The workload had not started before cancellation");
		} else {
			const markers: { [probe: string]: string } = {
				baseline: "FR_SECURITY_BASELINE_PASS",
				isolation: "FR_SECURITY_ISOLATION_PASS",
				"guest-root": "FR_SECURITY_GUEST_ROOT_PASS",
				mask: "FR_SECURITY_MASK_PASS",
			};
			assertPassed(job, log, markers[job.name]);
			if (job.name === "mask" && !log.includes("FR_SECURITY_MASK ***"))
				throw new Error("The masked dummy-canary marker is missing");
		}
	}
	return {
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
	};
}

export async function verifyRun(run: FixtureRun): Promise<VerifiedRun> {
	contractFor(run);
	const data: { jobs: WorkflowJob[]; total_count: number } = JSON.parse(
		await gh([
			"api",
			`repos/${run.repository.full_name}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
		]),
	);
	return verifyEvidence(run, data, (job) =>
		gh([
			"run",
			"view",
			String(run.id),
			"--repo",
			run.repository.full_name,
			"--job",
			String(job.id),
			"--attempt",
			String(run.run_attempt),
			"--log",
		]),
	);
}

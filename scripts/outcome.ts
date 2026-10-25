export interface JobStep {
	name: string;
	status: string;
	conclusion: string | null;
}
export interface WorkflowJob {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	runner_name: string | null;
	steps: JobStep[];
	html_url: string;
}

export function assertJobCoverage(
	jobs: WorkflowJob[],
	expected: string[],
	allowedSkipped: string[] = [],
): WorkflowJob[] {
	for (const name of expected) {
		const matches = jobs.filter((job) => job.name === name);
		if (matches.length !== 1)
			throw new Error(`Expected exactly one fixture job: ${name}`);
		if (matches[0].conclusion === "skipped")
			throw new Error(`Required fixture job was skipped: ${name}`);
	}
	for (const job of jobs) {
		if (expected.includes(job.name)) continue;
		if (allowedSkipped.includes(job.name) && job.conclusion === "skipped")
			continue;
		throw new Error(`Unexpected fixture job or outcome: ${job.name}`);
	}
	return jobs.filter((job) => expected.includes(job.name));
}

export function assertManaged(job: WorkflowJob): void {
	if (!job.runner_name?.startsWith("flarerunner-"))
		throw new Error(`No managed-runner assignment: ${job.name}`);
}

export function assertDenied(job: WorkflowJob, log: string): void {
	assertManaged(job);
	if (job.status !== "completed")
		throw new Error(`Job is not terminal: ${job.name}`);
	if (job.conclusion !== "failure")
		throw new Error(`Expected admission failure: ${job.name}`);
	if (!log.includes("FlareRunner did not authorize job execution."))
		throw new Error(`Missing authoritative admission denial: ${job.name}`);
	if (log.includes("FR_SECURITY_BOUNDARY_BREACH"))
		throw new Error(`Customer steps executed in a denied job: ${job.name}`);
	const probe = job.steps.find((step) => step.name === "Must never execute");
	if (probe && probe.conclusion !== "skipped")
		throw new Error(`Denied job initialized the probe step: ${job.name}`);
}

export function assertPassed(
	job: WorkflowJob,
	log: string,
	marker: string,
): void {
	assertManaged(job);
	if (job.conclusion !== "success")
		throw new Error(`Positive control failed: ${job.name}`);
	if (!log.includes(marker))
		throw new Error(`Missing workload assertion: ${job.name}`);
}

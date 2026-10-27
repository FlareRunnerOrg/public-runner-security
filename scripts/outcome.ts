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
	steps: readonly JobStep[];
	html_url: string;
}

export const attackJobPrefix = "Attack probe — expected rejection: ";

// Historical evidence used the probe ID directly. Both forms identify the same contract.
export function probeId(name: string): string {
	return name.startsWith(attackJobPrefix)
		? name.slice(attackJobPrefix.length)
		: name;
}

export function assertJobCoverage(
	jobs: WorkflowJob[],
	expected: string[],
	allowedSkipped: string[] = [],
): WorkflowJob[] {
	jobs = jobs.map((job) => ({ ...job, name: probeId(job.name) }));
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
	if (!/^flarerunner-[a-f0-9]{40}$/.test(job.runner_name ?? ""))
		throw new Error(`No managed-runner assignment: ${job.name}`);
}

function assertAdmissionStep(job: WorkflowJob, conclusion: string): void {
	const admission = job.steps[0];
	if (admission?.name !== "FlareRunner admission")
		throw new Error(`Missing platform admission step: ${job.name}`);
	if (admission.status !== "completed" || admission.conclusion !== conclusion)
		throw new Error(`Unexpected platform admission result: ${job.name}`);
}

export function assertDenied(
	job: WorkflowJob,
	log: string,
	reason: string,
): void {
	assertManaged(job);
	if (job.status !== "completed")
		throw new Error(`Job is not terminal: ${job.name}`);
	if (job.conclusion !== "failure")
		throw new Error(`Expected admission failure: ${job.name}`);
	assertAdmissionStep(job, "failure");
	if (job.steps.slice(1).some((step) => step.conclusion !== "skipped"))
		throw new Error(`A step initialized after admission denial: ${job.name}`);
	if (!log.includes("FlareRunner did not authorize job execution."))
		throw new Error(`Missing authoritative admission denial: ${job.name}`);
	if (log.includes("FR_SECURITY_BOUNDARY_BREACH"))
		throw new Error(`Customer steps executed in a denied job: ${job.name}`);
	const reasons = [
		...log.matchAll(/FR_ADMISSION_DENIED reason=([a-z_]+)\b/g),
	].map((match) => match[1]);
	if (reasons.length !== 1 || reasons[0] !== reason)
		throw new Error(`Missing or incorrect policy denial: ${job.name}`);
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
	if (job.status !== "completed")
		throw new Error(`Positive control is not terminal: ${job.name}`);
	assertAdmissionStep(job, "success");
	if (job.conclusion !== "success")
		throw new Error(`Positive control failed: ${job.name}`);
	if (!log.includes(marker))
		throw new Error(`Missing workload assertion: ${job.name}`);
}

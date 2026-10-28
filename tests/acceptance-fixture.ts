import {
	completionTitle,
	type AcceptanceReader,
	type AcceptanceRun,
} from "../scripts/acceptance.ts";
import { contractFor, repository } from "../scripts/contracts.ts";
import { attackJobPrefix, type WorkflowJob } from "../scripts/outcome.ts";
import { verifyEvidence } from "../scripts/verification.ts";

const sha = "a".repeat(40);
export const anchor: AcceptanceRun = {
	id: 10,
	name: "Fixture checks",
	path: ".github/workflows/fixture-check.yml",
	status: "completed",
	conclusion: "success",
	event: "pull_request",
	head_sha: sha,
	head_branch: "test/report",
	created_at: "2026-10-27T12:00:00Z",
	head_repository: { full_name: repository },
	repository: { full_name: repository },
	run_attempt: 1,
	html_url: `https://github.com/${repository}/actions/runs/10`,
	display_title: "Test reporting",
};
export const options = {
	enabled: true,
	productionSha: "f".repeat(40),
	checkedAt: "2026-10-27T12:10:00Z",
};

export function fixture(source = anchor) {
	const run = (
		id: number,
		file: string,
		name: string,
		event = source.event,
	): AcceptanceRun => ({
		...source,
		id,
		path: `.github/workflows/${file}.yml`,
		name,
		event,
		conclusion: file === "public-security" ? "success" : "failure",
		html_url: `https://github.com/${repository}/actions/runs/${id}`,
	});
	const baseline = run(20, "public-security", "Public runner security");
	const all = [
		baseline,
		run(
			30,
			"deny-privileged",
			"Reject privileged PR trigger",
			"pull_request_target",
		),
		run(
			40,
			"deny-untrusted",
			"Reject credential-bearing untrusted jobs",
			"pull_request",
		),
		run(
			50,
			"deny-escalation",
			"Reject container and token escalation",
			"pull_request",
		),
	];
	const child = {
		...run(
			60,
			"deny-workflow-run",
			"Reject privileged workflow completion trigger",
			"workflow_run",
		),
		head_branch: "main",
		head_sha: "b".repeat(40),
		display_title: completionTitle(baseline.id),
		name: completionTitle(baseline.id),
	};
	const logs = new Map<number, string>();
	const jobs = new Map<number, WorkflowJob[]>();
	for (const execution of [...all, child]) {
		const contract = contractFor(execution);
		const probes = [...contract.expected, ...contract.allowedSkipped].map(
			(name, index): WorkflowJob => {
				const id = execution.id * 10 + index;
				const reason = contract.reasons[name];
				logs.set(
					id,
					reason
						? `FlareRunner did not authorize job execution.\nFR_ADMISSION_DENIED reason=${reason}`
						: `FR_SECURITY_${name === "guest-root" ? "GUEST_ROOT" : name.toUpperCase()}_PASS\nFR_SECURITY_MASK ***`,
				);
				return {
					id,
					name: reason ? attackJobPrefix + name : name,
					status: "completed",
					conclusion: contract.allowedSkipped.includes(name)
						? "skipped"
						: reason
							? "failure"
							: "success",
					runner_name: `flarerunner-${"c".repeat(40)}`,
					html_url: execution.html_url,
					steps: [
						{
							name: "FlareRunner admission",
							status: "completed",
							conclusion: reason ? "failure" : "success",
						},
					],
				};
			},
		);
		jobs.set(execution.id, probes);
	}
	const changed = new Map<number, AcceptanceRun>();
	const reader: AcceptanceReader = {
		async listRuns() {
			return { total_count: all.length, workflow_runs: all };
		},
		async listCompletions() {
			return { total_count: 1, workflow_runs: [child] };
		},
		async readRun(id) {
			const found =
				changed.get(id) ??
				[source, ...all, child].find((candidate) => candidate.id === id);
			if (!found) throw new Error("Missing fake run");
			return found;
		},
		async verify(execution) {
			const probes = jobs.get(execution.id)!;
			return verifyEvidence(
				execution,
				{ jobs: probes, total_count: probes.length },
				async (job) => logs.get(job.id)!,
			);
		},
	};
	return { all, child, reader, logs, jobs, changed };
}

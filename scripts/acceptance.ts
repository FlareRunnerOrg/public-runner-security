import assert from "node:assert/strict";
import { repository, type FixtureRun } from "./contracts.ts";
import type { AcceptanceReport, ReportRow } from "./report.ts";
import { verifiedRows } from "./report.ts";
import type { VerifiedRun } from "./verification.ts";

export interface AcceptanceRun extends FixtureRun {
	created_at: string;
	display_title: string;
	head_repository: { full_name: string };
}
export interface RunPage {
	total_count: number;
	workflow_runs: AcceptanceRun[];
}
export interface AcceptanceReader {
	readRun(id: number): Promise<AcceptanceRun>;
	listRuns(sha: string): Promise<RunPage>;
	listCompletions(since: string): Promise<RunPage>;
	verify(run: AcceptanceRun): Promise<VerifiedRun>;
}

const workflow = (file: string) => `.github/workflows/${file}.yml`;
const fixturePath = workflow("fixture-check");
const baselinePath = workflow("public-security");
const completionPath = workflow("deny-workflow-run");
const cohortWindowMs = 90_000;

export function assertAnchor(run: AcceptanceRun): void {
	assert.equal(run.repository.full_name, repository);
	assert.equal(run.path, fixturePath, "Anchor must be Fixture checks");
	assert(
		["push", "pull_request"].includes(run.event),
		"Anchor must be a push or PR",
	);
	if (run.event === "push") assert.equal(run.head_branch, "main");
	assert.match(run.head_sha, /^[a-f0-9]{40}$/);
	assert.match(
		run.head_repository.full_name,
		/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
	);
	assert(Number.isSafeInteger(run.id) && run.id > 0);
	assert(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
	assert(
		Number.isFinite(Date.parse(run.created_at)),
		"Missing trigger timestamp",
	);
}

export function completionTitle(sourceId: number): string {
	return `Attack probe — expected rejection: workflow completion / source ${sourceId}`;
}

export function requiredPaths(anchor: AcceptanceRun): string[] {
	assertAnchor(anchor);
	const paths = [baselinePath];
	if (anchor.event === "pull_request") {
		paths.push(workflow("deny-privileged"));
		if (anchor.head_repository.full_name === repository) {
			paths.push(workflow("deny-untrusted"), workflow("deny-escalation"));
		}
	}
	return paths;
}

function completePage(page: RunPage): AcceptanceRun[] {
	assert.equal(
		page.total_count,
		page.workflow_runs.length,
		"Incomplete workflow listing",
	);
	return page.workflow_runs;
}

export function selectCohort(
	anchor: AcceptanceRun,
	page: RunPage,
): AcceptanceRun[] {
	assertAnchor(anchor);
	return completePage(page).filter((run) => {
		assert.equal(run.repository.full_name, repository);
		assert.match(run.head_sha, /^[a-f0-9]{40}$/);
		assert(
			Number.isFinite(Date.parse(run.created_at)),
			"Invalid workflow timestamp",
		);
		if (run.head_sha !== anchor.head_sha) return false;
		if (run.head_branch !== anchor.head_branch) return false;
		if (run.head_repository.full_name !== anchor.head_repository.full_name)
			return false;
		return (
			Math.abs(Date.parse(run.created_at) - Date.parse(anchor.created_at)) <=
			cohortWindowMs
		);
	});
}

function assertSameAttempt(
	current: AcceptanceRun,
	expected: AcceptanceRun,
): void {
	assert.equal(current.repository.full_name, repository);
	assert.equal(current.id, expected.id);
	assert.equal(current.head_sha, expected.head_sha);
	assert.equal(
		current.head_repository.full_name,
		expected.head_repository.full_name,
	);
	assert.equal(current.head_branch, expected.head_branch);
	assert.equal(current.path, expected.path);
	assert.equal(current.name, expected.name);
	assert.equal(current.event, expected.event);
	assert.equal(current.created_at, expected.created_at);
	assert.equal(current.display_title, expected.display_title);
	assert.equal(current.run_attempt, expected.run_attempt);
	if (expected.status === "completed") {
		assert.equal(current.status, expected.status);
		assert.equal(current.conclusion, expected.conclusion);
	}
}

function pending(test: string, detail: string): ReportRow {
	return { test, state: "pending", detail };
}

export async function assessAcceptance(
	anchor: AcceptanceRun,
	reader: AcceptanceReader,
	options: {
		enabled: boolean;
		productionSha: string | null;
		checkedAt: string;
		expired?: boolean;
	},
): Promise<AcceptanceReport> {
	assertAnchor(anchor);
	const fork = anchor.head_repository.full_name !== repository;
	const scope =
		anchor.event === "push"
			? "Main controls and privileged completion rejection"
			: fork
				? "Fork PR controls and privileged-trigger rejections; credential matrices excluded on forks"
				: "Same-repository PR controls and all eleven admission rejection probes";
	const report: AcceptanceReport = {
		state: "pending",
		sha: anchor.head_sha,
		scope,
		checkedAt: options.checkedAt,
		productionSha: options.productionSha,
		rows: [],
	};
	if (!options.enabled) {
		report.state = "not_run";
		report.rows.push({
			test: "Suite enabled",
			state: "not_run",
			detail: "FR_SECURITY_TEST_ENABLED is not true",
		});
		return report;
	}
	if (anchor.status !== "completed") {
		report.state = options.expired ? "failed" : "pending";
		report.rows.push({
			test: "Fixture checks",
			state: report.state,
			detail: options.expired
				? "Fixture validation did not finish before the deadline"
				: "Waiting for fixture validation",
		});
		return report;
	}
	if (anchor.conclusion !== "success") {
		report.state = "failed";
		report.rows.push({
			test: "Fixture checks",
			state: "failed",
			detail: "Fixture validation did not pass",
		});
		return report;
	}
	report.rows.push({
		test: "Fixture checks",
		state: "passed",
		detail: "Fixture validation passed",
	});
	const cohort = selectCohort(anchor, await reader.listRuns(anchor.head_sha));
	const executions: AcceptanceRun[] = [];
	const candidates = requiredPaths(anchor).map((path) => ({
		path,
		runs: cohort.filter(
			(run) =>
				run.path === path &&
				run.event ===
					(path === workflow("deny-privileged")
						? "pull_request_target"
						: anchor.event),
		),
	}));
	const baseline = candidates.find(
		(candidate) => candidate.path === baselinePath,
	)?.runs;
	if (baseline?.length === 1) {
		const completions = completePage(
			await reader.listCompletions(anchor.created_at),
		);
		candidates.push({
			path: completionPath,
			runs: completions.filter(
				(run) =>
					run.repository.full_name === repository &&
					run.path === completionPath &&
					run.event === "workflow_run" &&
					run.head_branch === "main" &&
					run.display_title === completionTitle(baseline[0].id) &&
					Date.parse(run.created_at) >= Date.parse(baseline[0].created_at),
			),
		});
	} else {
		candidates.push({ path: completionPath, runs: [] });
	}
	for (const candidate of candidates) {
		const label = candidate.path.replace(".github/workflows/", "");
		if (candidate.runs.length === 0) {
			report.rows.push(pending(label, "Required workflow has not arrived"));
			continue;
		}
		if (candidate.runs.length !== 1) {
			report.rows.push({
				test: label,
				state: "failed",
				detail: "Ambiguous workflow executions for this trigger",
			});
			continue;
		}
		const run = candidate.runs[0];
		executions.push(run);
		if (run.status !== "completed") {
			report.rows.push(pending(label, "Waiting for all probe jobs to finish"));
			continue;
		}
		try {
			report.rows.push(...verifiedRows(await reader.verify(run)));
		} catch {
			report.rows.push({
				test: label,
				state: "failed",
				detail:
					"Required job coverage, admission policy or workload evidence did not pass",
				url: `https://github.com/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}`,
			});
		}
	}
	// Re-read every immutable run identity before publishing; reruns must not reuse an older attempt's evidence.
	for (const run of [anchor, ...executions]) {
		const current = await reader.readRun(run.id);
		try {
			assertSameAttempt(current, run);
		} catch {
			report.rows.push({
				test: "Run attempt consistency",
				state: "failed",
				detail: "A run changed while its evidence was read; re-run acceptance",
			});
		}
	}
	if (options.expired) {
		for (const row of report.rows) {
			if (row.state === "pending") {
				row.state = "failed";
				row.detail =
					"Incomplete: required evidence did not finish before the deadline";
			}
		}
	}
	if (report.rows.some((row) => row.state === "failed"))
		report.state = "failed";
	else if (report.rows.some((row) => row.state === "pending"))
		report.state = "pending";
	else report.state = "passed";
	return report;
}

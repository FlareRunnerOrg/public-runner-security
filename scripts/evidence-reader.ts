import { repository } from "./contracts.ts";
import { gh } from "./github.ts";
import type { AcceptanceReader, AcceptanceRun, RunPage } from "./acceptance.ts";
import { verifyRun, type VerifiedRun } from "./verification.ts";

export async function readRun(
	id: number,
	request: typeof gh = gh,
): Promise<AcceptanceRun> {
	return JSON.parse(
		await request(["api", `repos/${repository}/actions/runs/${id}`]),
	);
}

export function acceptanceReader(
	request: typeof gh = gh,
	verify: typeof verifyRun = verifyRun,
): AcceptanceReader {
	const verified = new Map<string, VerifiedRun>();
	return {
		readRun: (id) => readRun(id, request),
		async listRuns(sha: string): Promise<RunPage> {
			return JSON.parse(
				await request([
					"api",
					`repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`,
				]),
			);
		},
		async listCompletions(since: string): Promise<RunPage> {
			const query = new URLSearchParams({
				event: "workflow_run",
				created: `>=${since}`,
				per_page: "100",
			});
			return JSON.parse(
				await request([
					"api",
					`repos/${repository}/actions/workflows/deny-workflow-run.yml/runs?${query}`,
				]),
			);
		},
		async verify(run: AcceptanceRun): Promise<VerifiedRun> {
			const key = JSON.stringify([
				run.id,
				run.run_attempt,
				run.head_sha,
				run.path,
				run.event,
				run.repository.full_name,
				run.head_repository.full_name,
				run.head_branch,
				run.created_at,
				run.display_title,
				run.name,
				run.status,
				run.conclusion,
			]);
			const prior = verified.get(key);
			if (prior) return prior;
			const result = await verify(run);
			verified.set(key, result);
			return result;
		},
	};
}

import {
	assessAcceptance,
	type AcceptanceReader,
	type AcceptanceRun,
} from "./acceptance.ts";
import type { AcceptanceReport } from "./report.ts";

export async function reviewAcceptance(
	anchor: AcceptanceRun,
	reader: AcceptanceReader,
	observeVersion: () => Promise<string>,
): Promise<AcceptanceReport> {
	const version = await observeVersion();
	const report = await assessAcceptance(anchor, reader, {
		enabled: true,
		productionSha: version,
		checkedAt: new Date().toISOString(),
		// This read-only review evaluates evidence available now, without publishing or waiting.
		expired: true,
	});
	for (const row of report.rows) {
		if (
			row.detail ===
			"Incomplete: required evidence did not finish before the deadline"
		)
			row.detail =
				"Incomplete: required evidence was unavailable at review time";
	}
	if ((await observeVersion()) !== version) {
		report.state = "failed";
		report.rows.push({
			test: "Production release consistency",
			state: "failed",
			detail:
				"Production changed during review; review the completed cohort again",
		});
	}
	return report;
}

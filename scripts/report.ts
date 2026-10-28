import type { VerifiedRun } from "./verification.ts";
import { repository } from "./contracts.ts";

export interface ReportRow {
	test: string;
	state: "passed" | "pending" | "failed" | "not_run";
	detail: string;
	url?: string;
}
export interface AcceptanceReport {
	state: "passed" | "pending" | "failed" | "not_run";
	sha: string;
	scope: string;
	checkedAt: string;
	productionSha: string | null;
	rows: ReportRow[];
}

function text(value: string): string {
	return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]()<>|!]/g, "\\$&");
}

export function verifiedRows(run: VerifiedRun): ReportRow[] {
	return run.jobs.map((job) => ({
		test: job.name,
		state: "passed",
		detail: job.reason
			? `Blocked before execution: ${job.reason}`
			: run.expected === "cancelled"
				? "Started workload cancelled; provider teardown is checked separately"
				: "Completed successfully",
		url: `${run.run}/job/${job.id}`,
	}));
}

export function renderReport(
	report: AcceptanceReport,
	label = "Security acceptance",
): string {
	const title = {
		passed: `${label} passed`,
		pending: `${label} in progress`,
		failed: `${label} failed`,
		not_run: `${label} not run`,
	}[report.state];
	const icons = { passed: "✅", pending: "⏳", failed: "❌", not_run: "⚪" };
	const rows = report.rows.map((row) => {
		const label = row.url ? `[${text(row.test)}](${row.url})` : text(row.test);
		return `| ${label} | ${icons[row.state]} ${text(row.detail)} |`;
	});
	return [
		`## ${title}`,
		"",
		`**Repository:** ${text(repository)}  `,
		`**Tested commit:** \`${report.sha}\`  `,
		`**Scope:** ${text(report.scope)}  `,
		`**Checked:** ${text(report.checkedAt)}  `,
		`**Production release observed:** ${report.productionSha ? `\`${report.productionSha}\`` : "Unavailable"}`,
		"",
		"| Test | Result |",
		"| --- | --- |",
		...rows,
		"",
		"Raw attack jobs remain red when admission blocks them. A passing row requires the exact policy denial before any customer code or container setup.",
		"",
		"This report verifies GitHub job evidence. The production release above is observed during verification; it does not attest the release or image used by historical jobs. Retained-log masking and provider teardown also need separate operator evidence. [FlareRunner's historical qualification record](https://github.com/FlareRunnerOrg/public-runner-security/blob/main/QUALIFICATION.md) is upstream evidence, not qualification of another workspace. Use the assessor guide and assessment template in your reviewed suite checkout for a new campaign.",
		"",
	].join("\n");
}

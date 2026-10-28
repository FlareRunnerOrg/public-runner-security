import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { repository } from "./contracts.ts";
import { acceptanceReader, readRun } from "./evidence-reader.ts";
import { productionVersion } from "./production-version.ts";
import { renderReport } from "./report.ts";
import { reviewAcceptance } from "./review.ts";

const [id, flag, directory, ...extra] = Bun.argv.slice(2);
assert(
	id && /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)),
	"Usage: bun run review <fixture-run-id> [--output DIRECTORY]",
);
assert(
	(flag === undefined && directory === undefined) ||
		(flag === "--output" && directory),
	"Use --output DIRECTORY",
);
assert.equal(extra.length, 0);
const report = await reviewAcceptance(
	await readRun(Number(id)),
	acceptanceReader(),
	productionVersion,
);
const evidence = { repository, fixtureRunId: Number(id), report };
if (directory) {
	await mkdir(directory, { recursive: true });
	await writeFile(
		`${directory}/acceptance.json`,
		JSON.stringify(evidence, null, 2) + "\n",
		{ flag: "wx" },
	);
	await writeFile(`${directory}/acceptance.md`, renderReport(report), {
		flag: "wx",
	});
}
console.log(JSON.stringify(evidence, null, 2));
if (report.state !== "passed") process.exitCode = 1;

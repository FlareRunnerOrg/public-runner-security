import { prepareForkWorkflow } from "./fork-fixture.ts";
const [groupFlag, group, epochFlag, epoch, ...extra] = Bun.argv.slice(2);
if (
	groupFlag !== "--runner-group" ||
	!group ||
	epochFlag !== "--cache-epoch" ||
	!epoch ||
	extra.length
)
	throw Error(
		"Usage: bun run prepare-fork --runner-group GROUP --cache-epoch EPOCH",
	);
const path = new URL(
	"../.github/workflows/public-security.yml",
	import.meta.url,
);
const source = await Bun.file(path).text();
await Bun.write(path, prepareForkWorkflow(source, group, epoch));
console.log(
	"Prepared the disposable fork's public-security.yml. Review the diff; do not merge this routing override into main.",
);

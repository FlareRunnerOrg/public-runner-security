import { validateConfiguration } from "./suite.ts";
const [flag, repository, ...extra] = Bun.argv.slice(2);
if (flag !== "--repo" || !repository || extra.length)
	throw Error("Usage: bun run configure --repo OWNER/REPOSITORY");
const config = validateConfiguration({ repository });
await Bun.write(
	new URL("../security-suite.json", import.meta.url),
	JSON.stringify(config, null, "\t") + "\n",
);
console.log(
	"Configured suite repository: " +
		config.repository +
		". Review and commit security-suite.json on main before running probes.",
);

import { configureCanary } from "./canary.ts";
const [flag, repository, ...extra] = Bun.argv.slice(2);
if (flag !== "--repo" || !repository || extra.length)
	throw Error("Usage: bun run configure-canary --repo OWNER/REPOSITORY");
await configureCanary(repository);
console.log(
	"Configured a random fixture-only canary and its SHA-256. No secret value was printed.",
);

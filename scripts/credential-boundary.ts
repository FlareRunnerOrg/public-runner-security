import assert from "node:assert/strict";

const platformCredentialNames = [
	"CLOUDFLARE_API_TOKEN",
	"GITHUB_APP_PRIVATE_KEY_PKCS8_BASE64",
	"GITHUB_APP_CLIENT_SECRET",
	"GITHUB_WEBHOOK_SECRET",
	"WORKSPACE_CONTROL_TOKEN",
	"RUNNER_OPERATIONS_TOKEN",
	"PRODUCTION_RELAY_TOKEN",
	"WORKLOAD_TOKEN",
	"FLARERUNNER_WORKLOAD_TOKEN",
	"STRIPE_TEST_RESTRICTED_API_KEY",
	"STRIPE_LIVE_RESTRICTED_API_KEY",
	"SECURITY_CANARY",
];
export function assertNoPlatformCredentials(
	environment: NodeJS.ProcessEnv,
): void {
	for (const name of platformCredentialNames) {
		// Never give assertion libraries the credential value: failure logs are public.
		assert(
			environment[name] === undefined,
			`Platform credential entered the job environment: ${name}`,
		);
	}
}

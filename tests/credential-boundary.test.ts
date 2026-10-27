import { expect, test } from "bun:test";
import { assertNoPlatformCredentials } from "../scripts/credential-boundary.ts";

test("the public job may carry its own scoped GitHub token", () => {
	expect(() =>
		assertNoPlatformCredentials({ GH_JOB_TOKEN: "dummy-job-token" }),
	).not.toThrow();
});
test.each([
	"CLOUDFLARE_API_TOKEN",
	"GITHUB_APP_PRIVATE_KEY_PKCS8_BASE64",
	"WORKLOAD_TOKEN",
	"SECURITY_CANARY",
])("detected %s cannot be reflected into public assertion logs", (name) => {
	const value = "dummy-sensitive-value-do-not-reflect";
	try {
		assertNoPlatformCredentials({ [name]: value });
	} catch (error) {
		expect(String(error)).toContain(name);
		expect(String(error)).not.toContain(value);
		expect(JSON.stringify(error)).not.toContain(value);
		return;
	}
	throw new Error("The credential probe did not reject its dummy secret");
});

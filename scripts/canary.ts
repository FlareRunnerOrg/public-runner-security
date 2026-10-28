import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { gh } from "./github.ts";
import { repository } from "./contracts.ts";

export async function configureCanary(
	target: string,
	request: typeof gh = gh,
): Promise<void> {
	assert.equal(
		target,
		repository,
		"Configure security-suite.json for this repository first",
	);
	// Require the operator to create and review the fixture-only environment first.
	await request(["api", `repos/${repository}/environments/security-canary`]);
	const value = "fr-public-canary-" + randomBytes(32).toString("hex");
	const hash = new Bun.CryptoHasher("sha256").update(value).digest("hex");
	// Use stdin so the dummy secret never appears in command arguments or console output.
	await request(
		[
			"secret",
			"set",
			"FR_SECURITY_CANARY",
			"--repo",
			repository,
			"--env",
			"security-canary",
		],
		value,
	);
	await request([
		"variable",
		"set",
		"FR_SECURITY_CANARY_SHA256",
		"--repo",
		repository,
		"--body",
		hash,
	]);
}

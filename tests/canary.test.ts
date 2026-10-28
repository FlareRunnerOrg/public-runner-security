import { expect, test } from "bun:test";
import { repository } from "../scripts/contracts.ts";
import { configureCanary } from "../scripts/canary.ts";

test("canary setup binds the selected repo, uses only the dummy environment and passes its random value on stdin", async () => {
	const calls: { args: string[]; input?: string }[] = [];
	await configureCanary(repository, async (args, input) => {
		calls.push({ args, input });
		return "{}";
	});
	expect(calls).toHaveLength(3);
	expect(calls[0].args).toEqual([
		"api",
		`repos/${repository}/environments/security-canary`,
	]);
	expect(calls[1].args).toEqual([
		"secret",
		"set",
		"FR_SECURITY_CANARY",
		"--repo",
		repository,
		"--env",
		"security-canary",
	]);
	expect(calls[1].input).toMatch(/^fr-public-canary-[a-f0-9]{64}$/);
	const hash = new Bun.CryptoHasher("sha256")
		.update(calls[1].input!)
		.digest("hex");
	expect(calls[2].args).toEqual([
		"variable",
		"set",
		"FR_SECURITY_CANARY_SHA256",
		"--repo",
		repository,
		"--body",
		hash,
	]);
});
test("a mismatched repo or unavailable environment cannot write any canary", async () => {
	let calls = 0;
	const request = async () => {
		calls++;
		throw Error("Environment unavailable");
	};
	await expect(
		configureCanary("attacker/unrelated", request),
	).rejects.toThrow();
	expect(calls).toBe(0);
	await expect(configureCanary(repository, request)).rejects.toThrow();
	expect(calls).toBe(1);
});

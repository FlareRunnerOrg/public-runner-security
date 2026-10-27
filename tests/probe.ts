import assert from "node:assert/strict";
import { assertNoPlatformCredentials } from "../scripts/credential-boundary.ts";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

const repository = "FlareRunnerOrg/public-runner-security";
const sentinels = [
	"/tmp/fr-security-persistence-canary",
	"/home/runner/.fr-security-persistence-canary",
];
const rootSentinel = "/root/.fr-security-persistence-canary";
const mode = Bun.argv[2];
async function guestRoot(): Promise<void> {
	await assertFreshFilesystem();
	const script = `set -euo pipefail
 test "$(sudo -n id -u)" = 0
 sudo -n bash -c '
 for file in /proc/[0-9]*/environ; do
 if grep -azqE "^(FLARERUNNER_WORKLOAD_TOKEN|WORKLOAD_TOKEN|RUNNER_OPERATIONS_TOKEN|CLOUDFLARE_API_TOKEN|GITHUB_APP_PRIVATE_KEY_PKCS8_BASE64)=" "$file" 2>/dev/null; then
 echo "Platform authority found in a guest process" >&2
 exit 1
 fi
 done
 '
 for route in /internal/v1/runner-instances /internal/v1/runner-instances/rni_0000000000000000000000000000000000000000/terminate; do
 status=$(sudo -n curl --noproxy '*' --silent --show-error --connect-timeout 5 --max-time 10 \
 --output /dev/null --write-out '%{http_code}' --request POST \
 --header 'content-type: application/json' --data '{}' \
 "http://flarerunner-control.internal$route")
 test "$status" = 403
 done
 `;
	const child = Bun.spawn(["bash", "-c", script], {
		stdin: "ignore",
		stdout: "inherit",
		stderr: "inherit",
		timeout: 30_000,
	});
	assert.equal(
		await child.exited,
		0,
		"Guest root crossed the platform authority boundary",
	);
	console.log("FR_SECURITY_GUEST_ROOT_PASS");
}

function required(name: string): string {
	const value = process.env[name];
	assert(value, `Required fixture setting is missing: ${name}`);
	return value;
}

async function assertFreshFilesystem(): Promise<void> {
	for (const path of sentinels) {
		const present = await access(path).then(
			() => true,
			() => false,
		);
		assert.equal(present, false, "A previous job's fixture file survived");
	}
	const child = Bun.spawn(
		[
			"sudo",
			"-n",
			"sh",
			"-c",
			'test ! -e "$1" && test ! -L "$1"',
			"root-persistence",
			rootSentinel,
		],
		{ stdin: "ignore", stdout: "ignore", stderr: "inherit", timeout: 10_000 },
	);
	assert.equal(
		await child.exited,
		0,
		"A previous job left a root-owned file or symlink",
	);
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
	return await fetch(url, {
		...init,
		redirect: "error",
		signal: AbortSignal.timeout(10_000),
	});
}

async function baseline(): Promise<void> {
	assert.equal(required("GITHUB_REPOSITORY"), repository);
	await assertFreshFilesystem();
	assertNoPlatformCredentials(process.env);
	const privateProduct = await request("https://flarerunner.com/v1/product");
	assert.equal(
		privateProduct.status,
		401,
		"The product API allowed an unauthenticated request",
	);

	const tokenProduct = await request("https://flarerunner.com/v1/product", {
		headers: { authorization: `Bearer ${required("GH_JOB_TOKEN")}` },
	});
	assert.equal(
		tokenProduct.status,
		401,
		"A GitHub job token authenticated to the private product API",
	);
	const runId = required("GITHUB_RUN_ID");
	const attempt = required("GITHUB_RUN_ATTEMPT");
	assert.match(runId, /^\d+$/);
	assert.match(attempt, /^\d+$/);
	const refName = `fr-security-readonly-${runId}-${attempt}`;
	const headers = {
		authorization: `Bearer ${required("GH_JOB_TOKEN")}`,
		accept: "application/vnd.github+json",
		"content-type": "application/json",
	};
	const internet = await request(`https://api.github.com/repos/${repository}`, {
		headers,
	});
	assert.equal(internet.status, 200, "Public GitHub read over HTTPS failed");
	const visibleRepository: { full_name: string; private: boolean } = JSON.parse(
		await internet.text(),
	);
	assert.equal(visibleRepository.full_name, repository);
	assert.equal(visibleRepository.private, false);
	const mutation = await request(
		`https://api.github.com/repos/${repository}/git/refs`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				ref: `refs/heads/${refName}`,
				sha: required("GITHUB_SHA"),
			}),
		},
	);
	if (mutation.status === 201) {
		await request(
			`https://api.github.com/repos/${repository}/git/refs/heads/${refName}`,
			{ method: "DELETE", headers },
		);
	}
	assert.equal(
		mutation.status,
		403,
		"The read-only job token could create a branch in the disposable fixture repo",
	);

	const event: { number?: number } = JSON.parse(
		await readFile(required("GITHUB_EVENT_PATH"), "utf8"),
	);
	const pullRequest = required("GITHUB_EVENT_NAME") === "pull_request";
	if (pullRequest)
		assert(Number.isSafeInteger(event.number), "The PR identity is missing");
	const expected = pullRequest
		? `untrusted-pr-${event.number}`
		: "trusted-default-branch";
	const hit = process.env.CACHE_HIT === "true";
	if (hit) {
		assert.equal(
			await readFile(".security-cache/provenance.txt", "utf8"),
			expected,
			"A cache crossed the trusted/PR or cross-PR boundary",
		);
	} else {
		await mkdir(".security-cache", { recursive: true });
		await writeFile(".security-cache/provenance.txt", expected);
	}
	for (const path of sentinels) await writeFile(path, `${runId}:${attempt}`);
	const child = Bun.spawn(["sudo", "-n", "tee", rootSentinel], {
		stdin: new Blob([`${runId}:${attempt}`]),
		stdout: "ignore",
		stderr: "inherit",
		timeout: 10_000,
	});
	assert.equal(
		await child.exited,
		0,
		"Could not create the root persistence canary",
	);
	console.log(`FR_SECURITY_CACHE ${JSON.stringify({ hit, scope: expected })}`);
	console.log("FR_SECURITY_BASELINE_PASS");
}

async function mask(): Promise<void> {
	const canary = required("SECURITY_CANARY");
	assert.equal(
		new Bun.CryptoHasher("sha256").update(canary).digest("hex"),
		required("SECURITY_CANARY_SHA256"),
	);
	// This is a generated, fixture-only canary. The driver checks that both log sinks mask it.
	console.log(`FR_SECURITY_MASK ${canary}`);
	console.log("FR_SECURITY_MASK_PASS");
}

if (mode === "guest-root") await guestRoot();
else if (mode === "baseline") await baseline();
else if (mode === "isolation") {
	await assertFreshFilesystem();
	console.log("FR_SECURITY_ISOLATION_PASS");
} else if (mode === "mask") await mask();
else if (mode === "lifetime") {
	console.log("FR_SECURITY_LIFETIME_STARTED");
	await new Promise((resolve) => setTimeout(resolve, 180_000));
	throw new Error(
		"The cancellation fixture was not cancelled before its deadline",
	);
} else throw new Error("Unsupported fixture mode");

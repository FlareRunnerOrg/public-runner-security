import assert from "node:assert/strict";

export function prepareForkWorkflow(
	source: string,
	runnerGroup: string,
	epoch: string,
): string {
	assert.match(
		runnerGroup,
		/^flarerunner-frg-[a-f0-9]{16}$/,
		"Use the nonsecret FlareRunner workspace runner group",
	);
	assert.match(
		epoch,
		/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
		"Use a short nonsecret campaign identifier",
	);
	const optIn = "    if: ${{ vars.FR_SECURITY_TEST_ENABLED == 'true' }}";
	const forkOnly = "    if: ${{ github.event_name == 'pull_request' }}";
	const route = "group: ${{ vars.FLARERUNNER_RUNNER_GROUP }}";
	const key = "key: public-security-${{ vars.FR_SECURITY_CACHE_EPOCH }}";
	assert.equal(
		source.split(optIn).length,
		2,
		"Expected the unmodified baseline opt-in",
	);
	assert.equal(
		source.split(route).length,
		5,
		"Expected all four managed runner routes",
	);
	assert.equal(source.split(key).length, 2, "Expected one campaign cache key");
	return source
		.replace(optIn, forkOnly)
		.replaceAll(route, "group: " + runnerGroup)
		.replace(key, "key: public-security-" + epoch);
}

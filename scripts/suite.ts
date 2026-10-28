import assert from "node:assert/strict";

export interface SuiteConfiguration {
	repository: string;
}

export function validateConfiguration(
	value: SuiteConfiguration,
): SuiteConfiguration {
	assert.deepEqual(
		Object.keys(value),
		["repository"],
		"Unknown suite configuration fields",
	);
	assert.equal(typeof value.repository, "string");
	assert.match(
		value.repository,
		/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
		"Use a GitHub owner/repository name",
	);
	for (const part of value.repository.split("/"))
		assert(part !== "." && part !== "..", "Invalid repository path");
	return Object.freeze({ repository: value.repository });
}

// Loaded from the reviewed verifier checkout, never from run evidence or PR artifacts.
export const suite = validateConfiguration(
	await Bun.file(new URL("../security-suite.json", import.meta.url)).json(),
);

export function assertSuiteContext(actual: string | undefined): void {
	assert.equal(
		actual,
		suite.repository,
		"The GitHub context differs from the reviewed suite repository",
	);
}

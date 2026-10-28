import { expect, test } from "bun:test";
import { repository } from "../scripts/contracts.ts";
import { assertSuiteContext, validateConfiguration } from "../scripts/suite.ts";

test.each([
	"",
	"../repo",
	"owner/..",
	"owner/../repo",
	"https://github.com/owner/repo",
	"owner/repo?x",
	"owner/repo\n",
])("configuration rejects unsafe repository identity %j", (value) => {
	expect(() => validateConfiguration({ repository: value })).toThrow();
});
test("repository context cannot silently select evidence from a different repository", () => {
	expect(
		validateConfiguration({ repository: "ExternalAudit/runner-security" })
			.repository,
	).toBe("ExternalAudit/runner-security");
	expect(() => assertSuiteContext(repository)).not.toThrow();
	expect(() => assertSuiteContext("attacker/unrelated")).toThrow();
	expect(() => assertSuiteContext(undefined)).toThrow();
	expect(() =>
		validateConfiguration({ repository, unreviewed: true } as {
			repository: string;
		}),
	).toThrow();
});

import { expect, test } from "bun:test";
import { assertDummyCanary } from "../scripts/dummy-canary.ts";

test("the generated dummy canary is eligible for the intentional masking output", () => {
	expect(() =>
		assertDummyCanary("fr-public-canary-" + "a".repeat(64)),
	).not.toThrow();
});
test.each([
	"sk-live-do-not-print-this",
	"",
	"real-platform-token",
	"fr-public-canary-short",
])("a nonfixture value is refused without reflecting it", (value) => {
	let message = "";
	try {
		assertDummyCanary(value);
	} catch (error) {
		message = error instanceof Error ? error.message : "Unexpected error";
	}
	expect(message).toBe(
		"The masking probe requires a generated fixture-only canary",
	);
	if (value) expect(message).not.toContain(value);
});

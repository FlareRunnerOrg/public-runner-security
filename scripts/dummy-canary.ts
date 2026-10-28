export function assertDummyCanary(value: string): void {
	if (!/^fr-public-canary-[A-Za-z0-9_-]{16,128}$/.test(value)) {
		// Assertion libraries can echo their actual argument on failure. Never
		// include a value supplied as a secret in the error or console output.
		throw new Error(
			"The masking probe requires a generated fixture-only canary",
		);
	}
}

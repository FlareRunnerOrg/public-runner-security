export async function gh(args: string[], input?: string): Promise<string> {
	const child = Bun.spawn(["gh", ...args], {
		env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_HTTP_TIMEOUT: "20" },
		stdout: "pipe",
		stderr: "pipe",
		stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
		timeout: 30_000,
	});
	const [exit, stdout] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exit !== 0) throw new Error(`GitHub evidence request failed (${exit})`);
	return stdout;
}

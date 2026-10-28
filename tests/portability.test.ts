import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("an independently configured copy passes every verifier regression without FlareRunner's repository identity", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "fr-independent-suite-"));
	const root = new URL("../", import.meta.url);
	try {
		for (const directory of ["scripts", "tests", ".github/workflows"]) {
			await mkdir(join(scratch, directory), { recursive: true });
			const glob = new Bun.Glob(directory + "/*");
			for await (const path of glob.scan({
				cwd: root.pathname,
				onlyFiles: true,
			})) {
				if (path === "tests/portability.test.ts") continue;
				await Bun.write(join(scratch, path), Bun.file(new URL(path, root)));
			}
		}
		await Bun.write(
			join(scratch, "security-suite.json"),
			Bun.file(new URL("security-suite.json", root)),
		);
		async function run(args: string[]) {
			const child = Bun.spawn([process.execPath, ...args], {
				cwd: scratch,
				env: { TMPDIR: scratch },
				stdin: "ignore",
				stdout: "pipe",
				stderr: "pipe",
				timeout: 30000,
			});
			const [code, out, err] = await Promise.all([
				child.exited,
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
			]);
			expect(code, out + err).toBe(0);
		}
		await run([
			"scripts/configure.ts",
			"--repo",
			"ExternalAudit/runner-security",
		]);
		expect(
			(await Bun.file(join(scratch, "security-suite.json")).json()).repository,
		).toBe("ExternalAudit/runner-security");
		await run(["test", "tests"]);
	} finally {
		await rm(scratch, { recursive: true, force: true });
	}
}, 40000);

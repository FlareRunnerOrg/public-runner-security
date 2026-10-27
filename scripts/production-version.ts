export async function productionVersion(): Promise<string> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket("wss://flarerunner.com/v1/product/events", {
			headers: { Origin: "https://flarerunner.com" },
		});
		let done = false;
		const timer = setTimeout(() => finish(), 15_000);
		function finish(sha?: string) {
			if (done) return;
			done = true;
			clearTimeout(timer);
			ws.close();
			if (sha) resolve(sha);
			else reject(new Error("Production release identity could not be read"));
		}
		ws.addEventListener("open", () =>
			ws.send(
				JSON.stringify({
					kind: "request",
					request_id: "req_1",
					request: { kind: "github_frontend_version" },
				}),
			),
		);
		ws.addEventListener("message", (event) => {
			try {
				const frame: {
					kind: string;
					request_id?: string;
					data?: { commit_sha: string; timestamp_utc: string };
				} = JSON.parse(String(event.data));
				if (frame.kind === "ready") return;
				if (
					frame.kind !== "response" ||
					frame.request_id !== "req_1" ||
					typeof frame.data?.commit_sha !== "string" ||
					!/^[a-f0-9]{40}$/.test(frame.data.commit_sha)
				) {
					finish();
					return;
				}
				finish(frame.data.commit_sha);
			} catch {
				finish();
			}
		});
		ws.addEventListener("error", () => finish());
		ws.addEventListener("close", () => {
			if (!done) finish();
		});
	});
}

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type AppServer, createAppServer } from "../src/server.ts";

const TEST_PORT = 0; // Let OS assign a random available port

const getBaseUrl = (app: AppServer): string => {
	const addr = app.server.address();
	if (typeof addr === "string" || addr === null) {
		throw new Error("Unexpected server address format");
	}
	return `http://localhost:${addr.port}`;
};

const fetchJson = async (url: string, options?: RequestInit) => {
	const res = await fetch(url, options);
	const body = await res.json();
	return { status: res.status, headers: res.headers, body };
};

describe("API routes", () => {
	let app: AppServer;
	let baseUrl: string;

	beforeEach(async () => {
		app = createAppServer(":memory:");
		await app.start(TEST_PORT);
		baseUrl = getBaseUrl(app);
	});

	afterEach(async () => {
		await app.stop();
	});

	describe("GET /api/health", () => {
		it("should return 200 with status ok", async () => {
			const { status, headers, body } = await fetchJson(`${baseUrl}/api/health`);

			assert.equal(status, 200);
			assert.equal(headers.get("content-type"), "application/json");
			assert.deepEqual(body, { status: "ok" });
		});
	});

	describe("POST /api/sessions", () => {
		it("should return 201 with a new session", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			assert.equal(status, 201);
			assert.ok(typeof body.id === "string");
			assert.ok(body.id.length > 0);
			assert.ok(typeof body.created_at === "string");
			assert.equal(body.status, "active");
		});

		it("should create a session with a title", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Test Session" }),
			});

			assert.equal(status, 201);
			assert.equal(body.title, "Test Session");
		});
	});

	describe("GET /api/sessions", () => {
		it("should return 200 with empty sessions list initially", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`);

			assert.equal(status, 200);
			assert.deepEqual(body, { sessions: [] });
		});

		it("should return created sessions", async () => {
			await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Session 1" }),
			});
			await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Session 2" }),
			});

			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`);

			assert.equal(status, 200);
			assert.equal(body.sessions.length, 2);
		});
	});

	describe("GET /api/sessions/:id", () => {
		it("should return a created session by id", async () => {
			const { body: created } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "My Session" }),
			});

			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/${created.id}`);

			assert.equal(status, 200);
			assert.equal(body.id, created.id);
			assert.equal(body.title, "My Session");
			assert.equal(body.status, "active");
		});

		it("should return 404 for non-existent session", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/non-existent-id`);

			assert.equal(status, 404);
			assert.deepEqual(body, { error: "Session not found" });
		});
	});

	describe("POST /api/sessions/:id/messages", () => {
		it("should return SSE stream with correct content type", async () => {
			const { body: session } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const res = await fetch(`${baseUrl}/api/sessions/${session.id}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "Hello agent" }),
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get("content-type"), "text/event-stream");
			assert.equal(res.headers.get("cache-control"), "no-cache");

			const text = await res.text();
			assert.ok(text.includes("event: message_saved"));
			// Without a running LLM, the conversation loop emits an error event
			assert.ok(text.includes("event: error") || text.includes("event: content"));
			assert.ok(text.includes("event: done"));
		});

		it("should persist user message", async () => {
			const { body: session } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			await fetch(`${baseUrl}/api/sessions/${session.id}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "Hello agent" }),
			});

			const { body } = await fetchJson(`${baseUrl}/api/sessions/${session.id}/messages`);

			// At minimum, the user message is always persisted
			assert.ok(body.messages.length >= 1);
			assert.equal(body.messages[0].role, "user");
			assert.equal(body.messages[0].content, "Hello agent");
		});

		it("should return 404 for non-existent session", async () => {
			const res = await fetch(`${baseUrl}/api/sessions/non-existent/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: "Hello" }),
			});

			assert.equal(res.status, 404);
			const body = await res.json();
			assert.deepEqual(body, { error: "Session not found" });
		});
	});

	describe("GET /api/sessions/:id/messages", () => {
		it("should return empty messages for session with no messages", async () => {
			const { body: session } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/${session.id}/messages`);

			assert.equal(status, 200);
			assert.deepEqual(body, { messages: [] });
		});

		it("should return 404 for non-existent session", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/non-existent/messages`);

			assert.equal(status, 404);
			assert.deepEqual(body, { error: "Session not found" });
		});
	});

	describe("GET /api/skills", () => {
		it("should return 200 with loaded skills", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/skills`);

			assert.equal(status, 200);
			assert.ok(Array.isArray(body.skills));
			assert.ok(body.skills.length > 0);

			const names = body.skills.map((s: { name: string }) => s.name);
			assert.ok(names.includes("file-read"));
			assert.ok(names.includes("file-write"));
			assert.ok(names.includes("shell-execute"));
		});
	});

	describe("404 handling", () => {
		it("should return 404 for unknown routes", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/unknown`);

			assert.equal(status, 404);
			assert.deepEqual(body, { error: "Not Found" });
		});
	});
});

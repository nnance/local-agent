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
		app = createAppServer();
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
		it("should return 201 with a new session containing an id", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`, {
				method: "POST",
			});

			assert.equal(status, 201);
			assert.ok(typeof body.id === "string");
			assert.ok(body.id.length > 0);
			assert.ok(typeof body.createdAt === "string");
		});
	});

	describe("GET /api/sessions", () => {
		it("should return 200 with empty sessions list", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions`);

			assert.equal(status, 200);
			assert.deepEqual(body, { sessions: [] });
		});
	});

	describe("GET /api/sessions/:id", () => {
		it("should return 200 with mock session containing the id", async () => {
			const testId = "test-session-id";
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/${testId}`);

			assert.equal(status, 200);
			assert.equal(body.id, testId);
			assert.ok(typeof body.createdAt === "string");
			assert.ok(Array.isArray(body.messages));
		});
	});

	describe("POST /api/sessions/:id/messages", () => {
		it("should return SSE stream with correct content type", async () => {
			const testId = "test-session-id";
			const res = await fetch(`${baseUrl}/api/sessions/${testId}/messages`, {
				method: "POST",
			});

			assert.equal(res.status, 200);
			assert.equal(res.headers.get("content-type"), "text/event-stream");
			assert.equal(res.headers.get("cache-control"), "no-cache");

			const text = await res.text();
			assert.ok(text.includes("event: content"));
			assert.ok(text.includes("event: done"));
			assert.ok(text.includes(`"sessionId":"${testId}"`));
		});
	});

	describe("GET /api/sessions/:id/messages", () => {
		it("should return 200 with empty messages list", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/sessions/test-id/messages`);

			assert.equal(status, 200);
			assert.deepEqual(body, { messages: [] });
		});
	});

	describe("GET /api/skills", () => {
		it("should return 200 with empty skills list", async () => {
			const { status, body } = await fetchJson(`${baseUrl}/api/skills`);

			assert.equal(status, 200);
			assert.deepEqual(body, { skills: [] });
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

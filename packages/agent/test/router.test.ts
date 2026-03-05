import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";
import { createRouter, sendJson } from "../src/router.ts";

const createMockReq = (method: string, url: string): IncomingMessage =>
	({
		method,
		url,
		headers: { host: "localhost:3000" },
	}) as unknown as IncomingMessage;

const createMockRes = (): ServerResponse & {
	_statusCode: number;
	_headers: Record<string, string | number>;
	_body: string;
	_ended: boolean;
} => {
	let body = "";
	let statusCode = 200;
	const headers: Record<string, string | number> = {};
	let ended = false;

	return {
		get _statusCode() {
			return statusCode;
		},
		get _headers() {
			return headers;
		},
		get _body() {
			return body;
		},
		get _ended() {
			return ended;
		},
		writeHead(code: number, hdrs?: Record<string, string | number>) {
			statusCode = code;
			if (hdrs) {
				for (const [k, v] of Object.entries(hdrs)) {
					headers[k] = v;
				}
			}
			return this;
		},
		write(chunk: string) {
			body += chunk;
			return true;
		},
		end(chunk?: string) {
			if (chunk) body += chunk;
			ended = true;
			return this;
		},
	} as unknown as ServerResponse & {
		_statusCode: number;
		_headers: Record<string, string | number>;
		_body: string;
		_ended: boolean;
	};
};

describe("createRouter", () => {
	it("should route GET requests to registered handlers", () => {
		const router = createRouter();
		let called = false;

		router.get("/test", (_req, _res, _params) => {
			called = true;
		});

		const req = createMockReq("GET", "/test");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(called, true);
	});

	it("should route POST requests to registered handlers", () => {
		const router = createRouter();
		let called = false;

		router.post("/test", (_req, _res, _params) => {
			called = true;
		});

		const req = createMockReq("POST", "/test");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(called, true);
	});

	it("should extract path parameters", () => {
		const router = createRouter();
		let capturedParams: Record<string, string> = {};

		router.get("/items/:id", (_req, _res, params) => {
			capturedParams = params;
		});

		const req = createMockReq("GET", "/items/abc-123");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(capturedParams.id, "abc-123");
	});

	it("should extract multiple path parameters", () => {
		const router = createRouter();
		let capturedParams: Record<string, string> = {};

		router.get("/sessions/:sessionId/messages/:messageId", (_req, _res, params) => {
			capturedParams = params;
		});

		const req = createMockReq("GET", "/sessions/s1/messages/m2");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(capturedParams.sessionId, "s1");
		assert.equal(capturedParams.messageId, "m2");
	});

	it("should return 404 for unmatched routes", () => {
		const router = createRouter();
		router.get("/exists", (_req, _res) => {});

		const req = createMockReq("GET", "/does-not-exist");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(res._statusCode, 404);
		const body = JSON.parse(res._body);
		assert.deepEqual(body, { error: "Not Found" });
	});

	it("should return 404 when method does not match", () => {
		const router = createRouter();
		router.get("/test", (_req, _res) => {});

		const req = createMockReq("POST", "/test");
		const res = createMockRes();
		router.handle(req, res);

		assert.equal(res._statusCode, 404);
	});
});

describe("sendJson", () => {
	it("should set correct status code, content type, and body", () => {
		const res = createMockRes();
		const data = { hello: "world" };

		sendJson(res, 200, data);

		assert.equal(res._statusCode, 200);
		assert.equal(res._headers["Content-Type"], "application/json");
		assert.deepEqual(JSON.parse(res._body), data);
		assert.equal(res._ended, true);
	});

	it("should handle different status codes", () => {
		const res = createMockRes();
		sendJson(res, 201, { id: "test" });

		assert.equal(res._statusCode, 201);
		assert.deepEqual(JSON.parse(res._body), { id: "test" });
	});
});

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { initDatabase } from "../src/db/init.ts";
import { createMessage, getMessages } from "../src/db/messages.ts";
import { createSession } from "../src/db/sessions.ts";
import type { Message } from "../src/db/types.ts";
import { dbMessageToChatMessage, runConversationLoop } from "../src/llm/conversation.ts";
import type { ConversationDeps } from "../src/llm/conversation.ts";
import type { LlmConfig, SseEvent } from "../src/llm/types.ts";
import { createSkillRegistry } from "../src/skills/registry.ts";
import type { SkillRegistry } from "../src/skills/registry.ts";

const SKILLS_DIR = join(import.meta.dirname ?? "", "../skills");

describe("dbMessageToChatMessage", () => {
	it("should convert a user message", () => {
		const msg: Message = {
			id: "1",
			session_id: "s1",
			role: "user",
			content: "Hello",
			tool_call_id: null,
			timestamp: new Date().toISOString(),
			metadata: null,
		};

		const result = dbMessageToChatMessage(msg);
		assert.deepEqual(result, { role: "user", content: "Hello" });
	});

	it("should convert a system message", () => {
		const msg: Message = {
			id: "2",
			session_id: "s1",
			role: "system",
			content: "You are helpful",
			tool_call_id: null,
			timestamp: new Date().toISOString(),
			metadata: null,
		};

		const result = dbMessageToChatMessage(msg);
		assert.deepEqual(result, { role: "system", content: "You are helpful" });
	});

	it("should convert a tool result message", () => {
		const msg: Message = {
			id: "3",
			session_id: "s1",
			role: "tool",
			content: "file contents",
			tool_call_id: "call_1",
			timestamp: new Date().toISOString(),
			metadata: null,
		};

		const result = dbMessageToChatMessage(msg);
		assert.deepEqual(result, {
			role: "tool",
			tool_call_id: "call_1",
			content: "file contents",
		});
	});

	it("should convert an assistant text message", () => {
		const msg: Message = {
			id: "4",
			session_id: "s1",
			role: "assistant",
			content: "Sure, I can help.",
			tool_call_id: null,
			timestamp: new Date().toISOString(),
			metadata: null,
		};

		const result = dbMessageToChatMessage(msg);
		assert.deepEqual(result, { role: "assistant", content: "Sure, I can help." });
	});

	it("should convert an assistant message with tool_calls in metadata", () => {
		const toolCalls = [
			{
				id: "call_1",
				type: "function",
				function: {
					name: "file-read__read",
					arguments: '{"file_path":"/tmp/test"}',
				},
			},
		];
		const msg: Message = {
			id: "5",
			session_id: "s1",
			role: "assistant",
			content: "",
			tool_call_id: null,
			timestamp: new Date().toISOString(),
			metadata: JSON.stringify({ tool_calls: toolCalls }),
		};

		const result = dbMessageToChatMessage(msg);
		assert.equal(result.role, "assistant");
		if (result.role === "assistant") {
			assert.equal(result.content, null);
			assert.ok(result.tool_calls);
			assert.equal(result.tool_calls?.length, 1);
			assert.equal(result.tool_calls?.[0].function.name, "file-read__read");
		}
	});

	it("should handle assistant message with empty content as null", () => {
		const msg: Message = {
			id: "6",
			session_id: "s1",
			role: "assistant",
			content: "",
			tool_call_id: null,
			timestamp: new Date().toISOString(),
			metadata: null,
		};

		const result = dbMessageToChatMessage(msg);
		assert.equal(result.role, "assistant");
		if (result.role === "assistant") {
			assert.equal(result.content, null);
		}
	});
});

describe("runConversationLoop", () => {
	let server: Server | null = null;
	let port: number;
	let db: Database.Database;
	let registry: SkillRegistry;

	const startMockServer = (
		handler: (req: IncomingMessage, res: ServerResponse) => void,
	): Promise<void> =>
		new Promise((resolve) => {
			const srv = createServer(handler);
			server = srv;
			srv.listen(0, () => {
				const addr = srv.address();
				port = typeof addr === "object" && addr ? addr.port : 0;
				resolve();
			});
		});

	const stopServer = (): Promise<void> =>
		new Promise((resolve, reject) => {
			if (server) {
				server.close((err) => (err ? reject(err) : resolve()));
				server = null;
			} else {
				resolve();
			}
		});

	beforeEach(async () => {
		db = initDatabase(":memory:");
		registry = createSkillRegistry();
		await registry.loadAll(SKILLS_DIR);
	});

	afterEach(async () => {
		db.close();
		await stopServer();
	});

	const collectEvents = async (gen: AsyncGenerator<SseEvent>): Promise<SseEvent[]> => {
		const events: SseEvent[] = [];
		for await (const event of gen) {
			events.push(event);
		}
		return events;
	};

	it("should handle a simple text response from LLM", async () => {
		await startMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello!"},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const session = createSession(db, "test");
		createMessage(db, session.id, "user", "Hi");

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const deps: ConversationDeps = {
			db,
			registry,
			config,
			systemPrompt: "You are helpful.",
		};

		const events = await collectEvents(runConversationLoop(deps, session.id));

		assert.ok(events.length >= 1);
		const contentEvent = events.find((e) => e.type === "content");
		assert.ok(contentEvent);
		if (contentEvent?.type === "content") {
			assert.equal(contentEvent.text, "Hello!");
		}
	});

	it("should emit error event when LLM is unreachable", async () => {
		const session = createSession(db, "test");
		createMessage(db, session.id, "user", "Hi");

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: "http://localhost:1", // Port that won't be listening
			model: "test-model",
		};

		const deps: ConversationDeps = {
			db,
			registry,
			config,
			systemPrompt: "You are helpful.",
		};

		const events = await collectEvents(runConversationLoop(deps, session.id));

		const errorEvent = events.find((e) => e.type === "error");
		assert.ok(errorEvent, "Should have an error event");
	});

	it("should execute tool calls and loop back to LLM", async () => {
		let callCount = 0;
		await startMockServer((_req, res) => {
			callCount++;
			res.writeHead(200, { "Content-Type": "text/event-stream" });

			if (callCount === 1) {
				// First call: LLM makes a tool call
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"shell-execute__exec","arguments":"{\\"command\\":\\"echo hello\\"}"}}]},"finish_reason":null}]}\n\n',
				);
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
				);
			} else {
				// Second call: LLM returns text
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"The command output: hello"},"finish_reason":null}]}\n\n',
				);
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
				);
			}
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const session = createSession(db, "test");
		createMessage(db, session.id, "user", "Run echo hello");

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const deps: ConversationDeps = {
			db,
			registry,
			config,
			systemPrompt: "You are helpful.",
		};

		const events = await collectEvents(runConversationLoop(deps, session.id));

		// Should have: tool_call, tool_result, content
		const toolCallEvent = events.find((e) => e.type === "tool_call");
		assert.ok(toolCallEvent, "Should have a tool_call event");
		if (toolCallEvent?.type === "tool_call") {
			assert.equal(toolCallEvent.name, "shell-execute__exec");
		}

		const toolResultEvent = events.find((e) => e.type === "tool_result");
		assert.ok(toolResultEvent, "Should have a tool_result event");
		if (toolResultEvent?.type === "tool_result") {
			assert.ok(toolResultEvent.result.includes("hello"));
		}

		const contentEvent = events.find((e) => e.type === "content");
		assert.ok(contentEvent, "Should have a content event");

		assert.equal(callCount, 2, "LLM should have been called twice");
	});

	it("should persist messages to the database", async () => {
		await startMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"Response text"},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const session = createSession(db, "test");
		createMessage(db, session.id, "user", "Hello");

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const deps: ConversationDeps = {
			db,
			registry,
			config,
			systemPrompt: "You are helpful.",
		};

		await collectEvents(runConversationLoop(deps, session.id));

		// Check that the assistant message was persisted
		const messages = getMessages(db, session.id);

		// Should have: user message + assistant message
		assert.equal(messages.length, 2);
		assert.equal(messages[0].role, "user");
		assert.equal(messages[1].role, "assistant");
		assert.equal(messages[1].content, "Response text");
	});

	it("should handle unknown tool gracefully", async () => {
		let callCount = 0;
		await startMockServer((_req, res) => {
			callCount++;
			res.writeHead(200, { "Content-Type": "text/event-stream" });

			if (callCount === 1) {
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"nonexistent__tool","arguments":"{\\"arg\\":\\"val\\"}"}}]},"finish_reason":null}]}\n\n',
				);
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
				);
			} else {
				res.write(
					'data: {"id":"test","choices":[{"index":0,"delta":{"content":"I see the tool failed."},"finish_reason":"stop"}]}\n\n',
				);
			}
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const session = createSession(db, "test");
		createMessage(db, session.id, "user", "Use a fake tool");

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const deps: ConversationDeps = {
			db,
			registry,
			config,
			systemPrompt: "You are helpful.",
		};

		const events = await collectEvents(runConversationLoop(deps, session.id));

		const toolResult = events.find((e) => e.type === "tool_result");
		assert.ok(toolResult);
		if (toolResult?.type === "tool_result") {
			assert.ok(toolResult.result.includes("Unknown tool"));
		}
	});
});

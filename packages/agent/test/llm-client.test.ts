import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { afterEach, describe, it } from "node:test";
import {
	accumulateToolCallDelta,
	buildRequestBody,
	finalizeToolCalls,
	loadLlmConfig,
	parseSseLine,
	streamChatCompletion,
} from "../src/llm/client.ts";
import type { DeltaToolCall, LlmConfig } from "../src/llm/types.ts";

describe("loadLlmConfig", () => {
	it("should return defaults when env vars are not set", () => {
		const original = {
			key: process.env.LLM_API_KEY,
			url: process.env.LLM_API_BASE_URL,
			model: process.env.LLM_MODEL,
		};
		Reflect.deleteProperty(process.env, "LLM_API_KEY");
		Reflect.deleteProperty(process.env, "LLM_API_BASE_URL");
		Reflect.deleteProperty(process.env, "LLM_MODEL");

		const config = loadLlmConfig();
		assert.equal(config.apiKey, "");
		assert.equal(config.baseUrl, "http://localhost:11434/v1");
		assert.equal(config.model, "llama3");

		// Restore
		if (original.key !== undefined) process.env.LLM_API_KEY = original.key;
		if (original.url !== undefined) process.env.LLM_API_BASE_URL = original.url;
		if (original.model !== undefined) process.env.LLM_MODEL = original.model;
	});

	it("should use env vars when set", () => {
		const original = {
			key: process.env.LLM_API_KEY,
			url: process.env.LLM_API_BASE_URL,
			model: process.env.LLM_MODEL,
		};

		process.env.LLM_API_KEY = "test-key";
		process.env.LLM_API_BASE_URL = "http://test:8080/v1";
		process.env.LLM_MODEL = "test-model";

		const config = loadLlmConfig();
		assert.equal(config.apiKey, "test-key");
		assert.equal(config.baseUrl, "http://test:8080/v1");
		assert.equal(config.model, "test-model");

		// Restore
		if (original.key !== undefined) process.env.LLM_API_KEY = original.key;
		else Reflect.deleteProperty(process.env, "LLM_API_KEY");
		if (original.url !== undefined) process.env.LLM_API_BASE_URL = original.url;
		else Reflect.deleteProperty(process.env, "LLM_API_BASE_URL");
		if (original.model !== undefined) process.env.LLM_MODEL = original.model;
		else Reflect.deleteProperty(process.env, "LLM_MODEL");
	});
});

describe("parseSseLine", () => {
	it("should return null for empty lines", () => {
		assert.equal(parseSseLine(""), null);
		assert.equal(parseSseLine("   "), null);
	});

	it("should return null for non-data lines", () => {
		assert.equal(parseSseLine("event: message"), null);
		assert.equal(parseSseLine(": comment"), null);
	});

	it("should return DONE for [DONE] signal", () => {
		assert.equal(parseSseLine("data: [DONE]"), "DONE");
	});

	it("should parse valid JSON data lines", () => {
		const chunk = {
			id: "chatcmpl-test",
			choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
		};
		const result = parseSseLine(`data: ${JSON.stringify(chunk)}`);
		assert.deepEqual(result, chunk);
	});

	it("should return null for invalid JSON", () => {
		assert.equal(parseSseLine("data: {invalid json}"), null);
	});
});

describe("accumulateToolCallDelta", () => {
	it("should initialize a new tool call accumulator", () => {
		const accumulators: {
			id: string;
			type: "function";
			functionName: string;
			argumentChunks: string[];
		}[] = [];
		const deltas: DeltaToolCall[] = [
			{
				index: 0,
				id: "call_1",
				type: "function",
				function: { name: "file-read__read", arguments: "" },
			},
		];

		accumulateToolCallDelta(accumulators, deltas);

		assert.equal(accumulators.length, 1);
		assert.equal(accumulators[0].id, "call_1");
		assert.equal(accumulators[0].functionName, "file-read__read");
	});

	it("should accumulate argument chunks", () => {
		const accumulators: {
			id: string;
			type: "function";
			functionName: string;
			argumentChunks: string[];
		}[] = [
			{
				id: "call_1",
				type: "function",
				functionName: "file-read__read",
				argumentChunks: ['{"file'],
			},
		];

		accumulateToolCallDelta(accumulators, [
			{ index: 0, function: { arguments: '_path":"/tmp/test"}' } },
		]);

		assert.deepEqual(accumulators[0].argumentChunks, ['{"file', '_path":"/tmp/test"}']);
	});

	it("should handle multiple parallel tool calls", () => {
		const accumulators: {
			id: string;
			type: "function";
			functionName: string;
			argumentChunks: string[];
		}[] = [];

		accumulateToolCallDelta(accumulators, [
			{ index: 0, id: "call_1", type: "function", function: { name: "tool_a", arguments: "" } },
			{ index: 1, id: "call_2", type: "function", function: { name: "tool_b", arguments: "" } },
		]);

		assert.equal(accumulators.length, 2);
		assert.equal(accumulators[0].id, "call_1");
		assert.equal(accumulators[1].id, "call_2");
	});
});

describe("finalizeToolCalls", () => {
	it("should join argument chunks and produce ToolCall objects", () => {
		const accumulators = [
			{
				id: "call_1",
				type: "function" as const,
				functionName: "file-read__read",
				argumentChunks: ['{"file_path":', '"/tmp/test"}'],
			},
		];

		const result = finalizeToolCalls(accumulators);
		assert.equal(result.length, 1);
		assert.equal(result[0].id, "call_1");
		assert.equal(result[0].type, "function");
		assert.equal(result[0].function.name, "file-read__read");
		assert.equal(result[0].function.arguments, '{"file_path":"/tmp/test"}');
	});
});

describe("buildRequestBody", () => {
	it("should build a valid request body", () => {
		const messages = [{ role: "user" as const, content: "Hello" }];
		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test",
					description: "A test tool",
					parameters: {
						type: "object" as const,
						properties: {},
					},
				},
			},
		];

		const body = buildRequestBody("llama3", messages, tools);

		assert.equal(body.model, "llama3");
		assert.equal(body.stream, true);
		assert.deepEqual(body.messages, messages);
		assert.deepEqual(body.tools, tools);
	});

	it("should omit tools when array is empty", () => {
		const messages = [{ role: "user" as const, content: "Hello" }];
		const body = buildRequestBody("llama3", messages, []);

		assert.equal(body.tools, undefined);
	});

	it("should omit tools when undefined", () => {
		const messages = [{ role: "user" as const, content: "Hello" }];
		const body = buildRequestBody("llama3", messages);

		assert.equal(body.tools, undefined);
	});
});

describe("streamChatCompletion", () => {
	let server: Server;
	let port: number;

	const startMockServer = (
		handler: (req: IncomingMessage, res: ServerResponse) => void,
	): Promise<void> =>
		new Promise((resolve) => {
			server = createServer(handler);
			server.listen(0, () => {
				const addr = server.address();
				port = typeof addr === "object" && addr ? addr.port : 0;
				resolve();
			});
		});

	afterEach((): Promise<void> => {
		return new Promise((resolve, reject) => {
			if (server) {
				server.close((err) => (err ? reject(err) : resolve()));
			} else {
				resolve();
			}
		});
	});

	it("should stream a simple text response", async () => {
		await startMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const config: LlmConfig = {
			apiKey: "test",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const deltas: string[] = [];
		const result = await streamChatCompletion(
			config,
			[{ role: "user", content: "Hi" }],
			undefined,
			(delta) => {
				if (delta.content) deltas.push(delta.content);
			},
		);

		assert.equal(result.content, "Hello world");
		assert.equal(result.finishReason, "stop");
		assert.equal(result.toolCalls.length, 0);
		assert.deepEqual(deltas, ["Hello", " world"]);
	});

	it("should stream a tool call response", async () => {
		await startMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"file-read__read","arguments":""}}]},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"file_path\\":\\"/tmp/test\\"}"}}]},"finish_reason":null}]}\n\n',
			);
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		const result = await streamChatCompletion(
			config,
			[{ role: "user", content: "Read /tmp/test" }],
			undefined,
			() => {},
		);

		assert.equal(result.content, "");
		assert.equal(result.finishReason, "tool_calls");
		assert.equal(result.toolCalls.length, 1);
		assert.equal(result.toolCalls[0].id, "call_1");
		assert.equal(result.toolCalls[0].function.name, "file-read__read");
		assert.equal(result.toolCalls[0].function.arguments, '{"file_path":"/tmp/test"}');
	});

	it("should throw on HTTP error", async () => {
		await startMockServer((_req, res) => {
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end("Internal Server Error");
		});

		const config: LlmConfig = {
			apiKey: "",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		await assert.rejects(
			() => streamChatCompletion(config, [{ role: "user", content: "Hi" }], undefined, () => {}),
			(err: Error) => {
				assert.ok(err.message.includes("500"));
				return true;
			},
		);
	});

	it("should send Authorization header when apiKey is set", async () => {
		let receivedAuth = "";
		await startMockServer((req, res) => {
			receivedAuth = req.headers.authorization ?? "";
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.write(
				'data: {"id":"test","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		const config: LlmConfig = {
			apiKey: "sk-test-key",
			baseUrl: `http://localhost:${port}`,
			model: "test-model",
		};

		await streamChatCompletion(config, [{ role: "user", content: "Hi" }], undefined, () => {});

		assert.equal(receivedAuth, "Bearer sk-test-key");
	});
});

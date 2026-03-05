import type { OpenAIToolDefinition } from "../skills/types.ts";
import type {
	ChatCompletionRequest,
	ChatMessage,
	Delta,
	DeltaToolCall,
	LlmConfig,
	StreamChunk,
	ToolCall,
} from "./types.ts";

// --- Config ---

export const loadLlmConfig = (): LlmConfig => ({
	apiKey: process.env.LLM_API_KEY ?? "",
	baseUrl: process.env.LLM_API_BASE_URL ?? "http://localhost:11434/v1",
	model: process.env.LLM_MODEL ?? "llama3",
});

// --- Accumulated state for streaming tool calls ---

type ToolCallAccumulator = {
	id: string;
	type: "function";
	functionName: string;
	argumentChunks: string[];
};

// --- SSE line parser ---

export const parseSseLine = (line: string): StreamChunk | "DONE" | null => {
	const trimmed = line.trim();
	if (trimmed === "") return null;
	if (!trimmed.startsWith("data: ")) return null;

	const payload = trimmed.slice(6);
	if (payload === "[DONE]") return "DONE";

	try {
		return JSON.parse(payload) as StreamChunk;
	} catch {
		return null;
	}
};

// --- Accumulate tool call deltas ---

export const accumulateToolCallDelta = (
	accumulators: ToolCallAccumulator[],
	deltaToolCalls: readonly DeltaToolCall[],
): void => {
	for (const dtc of deltaToolCalls) {
		const idx = dtc.index;

		// Initialize accumulator for new index
		if (!accumulators[idx]) {
			accumulators[idx] = {
				id: dtc.id ?? "",
				type: "function",
				functionName: dtc.function?.name ?? "",
				argumentChunks: [],
			};
		}

		const acc = accumulators[idx];

		// Update id if provided
		if (dtc.id) {
			acc.id = dtc.id;
		}

		// Update function name if provided
		if (dtc.function?.name) {
			acc.functionName = dtc.function.name;
		}

		// Accumulate argument chunks
		if (dtc.function?.arguments) {
			acc.argumentChunks.push(dtc.function.arguments);
		}
	}
};

// --- Finalize accumulated tool calls ---

export const finalizeToolCalls = (accumulators: readonly ToolCallAccumulator[]): ToolCall[] =>
	accumulators.map((acc) => ({
		id: acc.id,
		type: "function" as const,
		function: {
			name: acc.functionName,
			arguments: acc.argumentChunks.join(""),
		},
	}));

// --- Stream response callback type ---

export type StreamDeltaCallback = (delta: Delta, finishReason: string | null) => void;

// --- Build request body ---

export const buildRequestBody = (
	model: string,
	messages: readonly ChatMessage[],
	tools?: readonly OpenAIToolDefinition[],
): ChatCompletionRequest => {
	const body: ChatCompletionRequest = {
		model,
		stream: true,
		messages,
		...(tools && tools.length > 0 ? { tools } : {}),
	};
	return body;
};

// --- Send streaming request to LLM ---

export type StreamResult = {
	readonly content: string;
	readonly toolCalls: readonly ToolCall[];
	readonly finishReason: string | null;
};

export const streamChatCompletion = async (
	config: LlmConfig,
	messages: readonly ChatMessage[],
	tools: readonly OpenAIToolDefinition[] | undefined,
	onDelta: StreamDeltaCallback,
): Promise<StreamResult> => {
	const body = buildRequestBody(config.model, messages, tools);

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`LLM API error ${response.status}: ${errorText}`);
	}

	if (!response.body) {
		throw new Error("LLM API returned no response body");
	}

	const contentChunks: string[] = [];
	const toolCallAccumulators: ToolCallAccumulator[] = [];
	let lastFinishReason: string | null = null;

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		const lines = buffer.split("\n");
		// Keep the last incomplete line in the buffer
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const parsed = parseSseLine(line);
			if (parsed === null) continue;
			if (parsed === "DONE") break;

			const choice = parsed.choices[0];
			if (!choice) continue;

			const { delta, finish_reason } = choice;

			if (finish_reason) {
				lastFinishReason = finish_reason;
			}

			if (delta.content) {
				contentChunks.push(delta.content);
			}

			if (delta.tool_calls) {
				accumulateToolCallDelta(toolCallAccumulators, delta.tool_calls);
			}

			onDelta(delta, finish_reason);
		}
	}

	// Process any remaining buffer
	if (buffer.trim()) {
		const parsed = parseSseLine(buffer);
		if (parsed && parsed !== "DONE") {
			const choice = parsed.choices[0];
			if (choice) {
				if (choice.finish_reason) {
					lastFinishReason = choice.finish_reason;
				}
				if (choice.delta.content) {
					contentChunks.push(choice.delta.content);
				}
				if (choice.delta.tool_calls) {
					accumulateToolCallDelta(toolCallAccumulators, choice.delta.tool_calls);
				}
				onDelta(choice.delta, choice.finish_reason);
			}
		}
	}

	return {
		content: contentChunks.join(""),
		toolCalls: finalizeToolCalls(toolCallAccumulators),
		finishReason: lastFinishReason,
	};
};

import type { OpenAIToolDefinition } from "../skills/types.ts";

// --- LLM Config ---

export type LlmConfig = {
	readonly apiKey: string;
	readonly baseUrl: string;
	readonly model: string;
};

// --- OpenAI Chat Completion message types ---

export type ToolCallFunction = {
	readonly name: string;
	readonly arguments: string;
};

export type ToolCall = {
	readonly id: string;
	readonly type: "function";
	readonly function: ToolCallFunction;
};

export type ChatMessageUser = {
	readonly role: "user";
	readonly content: string;
};

export type ChatMessageSystem = {
	readonly role: "system";
	readonly content: string;
};

export type ChatMessageAssistant = {
	readonly role: "assistant";
	readonly content: string | null;
	readonly tool_calls?: readonly ToolCall[];
};

export type ChatMessageTool = {
	readonly role: "tool";
	readonly tool_call_id: string;
	readonly content: string;
};

export type ChatMessage =
	| ChatMessageUser
	| ChatMessageSystem
	| ChatMessageAssistant
	| ChatMessageTool;

// --- LLM request ---

export type ChatCompletionRequest = {
	readonly model: string;
	readonly stream: true;
	readonly messages: readonly ChatMessage[];
	readonly tools?: readonly OpenAIToolDefinition[];
};

// --- SSE delta types from the LLM ---

export type DeltaToolCall = {
	readonly index: number;
	readonly id?: string;
	readonly type?: "function";
	readonly function?: {
		readonly name?: string;
		readonly arguments?: string;
	};
};

export type Delta = {
	readonly role?: string;
	readonly content?: string | null;
	readonly tool_calls?: readonly DeltaToolCall[];
};

export type StreamChoice = {
	readonly index: number;
	readonly delta: Delta;
	readonly finish_reason: string | null;
};

export type StreamChunk = {
	readonly id: string;
	readonly choices: readonly StreamChoice[];
};

// --- SSE events emitted to the client ---

export type SseContentEvent = {
	readonly type: "content";
	readonly text: string;
};

export type SseToolCallEvent = {
	readonly type: "tool_call";
	readonly id: string;
	readonly name: string;
	readonly params: Record<string, unknown>;
};

export type SseToolResultEvent = {
	readonly type: "tool_result";
	readonly id: string;
	readonly result: string;
};

export type SseDoneEvent = {
	readonly type: "done";
};

export type SseErrorEvent = {
	readonly type: "error";
	readonly message: string;
};

export type SseEvent =
	| SseContentEvent
	| SseToolCallEvent
	| SseToolResultEvent
	| SseDoneEvent
	| SseErrorEvent;

import type Database from "better-sqlite3";
import { createMessage, getMessages } from "../db/messages.ts";
import type { Message } from "../db/types.ts";
import { executeScript } from "../skills/executor.ts";
import {
	executeLoadReference,
	executeLoadTemplate,
	getMetaToolDefinitions,
} from "../skills/meta-tools.ts";
import type { SkillRegistry } from "../skills/registry.ts";
import type { OpenAIToolDefinition } from "../skills/types.ts";
import { type StreamResult, loadLlmConfig, streamChatCompletion } from "./client.ts";
import { loadSystemPrompt } from "./prompt.ts";
import type { ChatMessage, ChatMessageAssistant, LlmConfig, SseEvent, ToolCall } from "./types.ts";

// --- Convert DB messages to OpenAI chat format ---

export const dbMessageToChatMessage = (msg: Message): ChatMessage => {
	if (msg.role === "user") {
		return { role: "user", content: msg.content };
	}

	if (msg.role === "system") {
		return { role: "system", content: msg.content };
	}

	if (msg.role === "tool") {
		return {
			role: "tool",
			tool_call_id: msg.tool_call_id ?? "",
			content: msg.content,
		};
	}

	// Assistant message — may have tool_calls in metadata
	const assistantMsg: ChatMessageAssistant = {
		role: "assistant",
		content: msg.content || null,
	};

	if (msg.metadata) {
		try {
			const meta = JSON.parse(msg.metadata) as { tool_calls?: ToolCall[] };
			if (meta.tool_calls && meta.tool_calls.length > 0) {
				return { ...assistantMsg, tool_calls: meta.tool_calls };
			}
		} catch {
			// Ignore parse errors
		}
	}

	return assistantMsg;
};

// --- Build the system message with skill summaries ---

const buildSystemMessage = (systemPrompt: string, skillSummaries: string): ChatMessage => {
	const content = systemPrompt.replace("{skill_summaries}", skillSummaries);
	return { role: "system", content };
};

// --- Collect tool definitions (scripts + meta-tools) ---

const collectToolDefinitions = (registry: SkillRegistry): readonly OpenAIToolDefinition[] => {
	const scriptTools = registry.getToolDefinitions();
	const metaTools = getMetaToolDefinitions();
	return [...scriptTools, ...metaTools];
};

// --- Execute a single tool call ---

const executeToolCall = async (registry: SkillRegistry, toolCall: ToolCall): Promise<string> => {
	const { name, arguments: argsStr } = toolCall.function;

	let params: Record<string, unknown>;
	try {
		params = JSON.parse(argsStr) as Record<string, unknown>;
	} catch {
		return `Error: Failed to parse tool call arguments: ${argsStr}`;
	}

	// Handle meta-tools
	if (name === "load_skill_template") {
		const skillName = params.skill_name as string;
		const templateName = params.template_name as string;
		return executeLoadTemplate(registry, skillName, templateName);
	}

	if (name === "load_skill_reference") {
		const skillName = params.skill_name as string;
		const referenceName = params.reference_name as string;
		return executeLoadReference(registry, skillName, referenceName);
	}

	// Handle script tools
	const mapping = registry.getToolMapping(name);
	if (!mapping) {
		return `Error: Unknown tool "${name}".`;
	}

	try {
		const result = await executeScript(mapping, params);
		if (result.exitCode !== 0) {
			return result.stderr
				? `Error (exit ${result.exitCode}): ${result.stderr}`
				: `Error: Script exited with code ${result.exitCode}`;
		}
		return result.stdout;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return `Error executing tool: ${message}`;
	}
};

// --- Persist assistant message to DB ---

const persistAssistantMessage = (
	db: Database.Database,
	sessionId: string,
	content: string,
	toolCalls: readonly ToolCall[],
): Message => {
	const metadata = toolCalls.length > 0 ? JSON.stringify({ tool_calls: toolCalls }) : null;
	return createMessage(db, sessionId, "assistant", content || "", metadata);
};

// --- Persist tool result message to DB ---

const persistToolResultMessage = (
	db: Database.Database,
	sessionId: string,
	toolCallId: string,
	result: string,
): Message => {
	return createMessage(db, sessionId, "tool", result, null, toolCallId);
};

// --- Conversation loop dependencies (for testability) ---

export type ConversationDeps = {
	readonly db: Database.Database;
	readonly registry: SkillRegistry;
	readonly config: LlmConfig;
	readonly systemPrompt: string;
};

export const createConversationDeps = async (
	db: Database.Database,
	registry: SkillRegistry,
): Promise<ConversationDeps> => ({
	db,
	registry,
	config: loadLlmConfig(),
	systemPrompt: await loadSystemPrompt(),
});

// --- The conversation loop: async generator of SSE events ---

export async function* runConversationLoop(
	deps: ConversationDeps,
	sessionId: string,
): AsyncGenerator<SseEvent> {
	const { db, registry, config, systemPrompt } = deps;

	const maxIterations = 25;
	let iteration = 0;

	while (iteration < maxIterations) {
		iteration++;

		// Load session messages from DB
		const dbMessages = getMessages(db, sessionId);
		const chatMessages: ChatMessage[] = dbMessages.map(dbMessageToChatMessage);

		// Prepend system message
		const skillSummaries = registry.getSkillSummaries();
		const systemMessage = buildSystemMessage(systemPrompt, skillSummaries);
		const allMessages: ChatMessage[] = [systemMessage, ...chatMessages];

		// Collect tool definitions
		const tools = collectToolDefinitions(registry);

		// Stream LLM response
		let streamResult: StreamResult;
		try {
			streamResult = await streamChatCompletion(
				config,
				allMessages,
				tools.length > 0 ? tools : undefined,
				(delta, _finishReason) => {
					// We don't yield from within the callback — content is accumulated
					// and yielded below. But we could use this for real-time streaming
					// if we refactored to use a push model.
					void delta;
				},
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			yield { type: "error", message };
			return;
		}

		const { content, toolCalls, finishReason } = streamResult;

		// Emit content if present
		if (content) {
			yield { type: "content", text: content };
		}

		// Persist assistant message
		persistAssistantMessage(db, sessionId, content, toolCalls);

		// If no tool calls, we're done
		if (finishReason !== "tool_calls" || toolCalls.length === 0) {
			return;
		}

		// Execute tool calls and persist results
		for (const toolCall of toolCalls) {
			let params: Record<string, unknown> = {};
			try {
				params = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
			} catch {
				// Use empty params
			}

			yield {
				type: "tool_call",
				id: toolCall.id,
				name: toolCall.function.name,
				params,
			};

			const result = await executeToolCall(registry, toolCall);

			yield {
				type: "tool_result",
				id: toolCall.id,
				result,
			};

			// Persist tool result
			persistToolResultMessage(db, sessionId, toolCall.id, result);
		}

		// Loop continues — will re-send messages with tool results to LLM
	}

	yield {
		type: "error",
		message: "Maximum conversation iterations reached.",
	};
}

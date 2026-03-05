import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { parseJsonBody } from "../body.ts";
import { createMessage, getMessages } from "../db/index.ts";
import { getSession } from "../db/index.ts";
import type { ConversationDeps } from "../llm/conversation.ts";
import { createConversationDeps, runConversationLoop } from "../llm/conversation.ts";
import type { SseEvent } from "../llm/types.ts";
import { sendJson } from "../router.ts";
import type { SkillRegistry } from "../skills/registry.ts";

const formatSseEvent = (event: SseEvent): string => {
	switch (event.type) {
		case "content":
			return `event: content\ndata: ${JSON.stringify({ text: event.text })}\n\n`;
		case "tool_call":
			return `event: tool_call\ndata: ${JSON.stringify({ id: event.id, name: event.name, params: event.params })}\n\n`;
		case "tool_result":
			return `event: tool_result\ndata: ${JSON.stringify({ id: event.id, result: event.result })}\n\n`;
		case "done":
			return "event: done\ndata: {}\n\n";
		case "error":
			return `event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`;
	}
};

export const createMessageHandlers = (db: Database.Database, registry: SkillRegistry) => {
	let conversationDeps: ConversationDeps | null = null;

	const getDeps = async (): Promise<ConversationDeps> => {
		if (!conversationDeps) {
			conversationDeps = await createConversationDeps(db, registry);
		}
		return conversationDeps;
	};

	const handleCreateMessage = async (
		req: IncomingMessage,
		res: ServerResponse,
		params: Record<string, string>,
	): Promise<void> => {
		const { id } = params;

		const session = getSession(db, id);
		if (!session) {
			sendJson(res, 404, { error: "Session not found" });
			return;
		}

		const body = await parseJsonBody<{ content?: string; metadata?: string }>(req);
		const content = body.content ?? "";

		// Persist user message
		const userMessage = createMessage(
			db,
			id,
			"user",
			content,
			body.metadata ? JSON.stringify(body.metadata) : null,
		);

		// Start SSE stream
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		res.write(
			`event: message_saved\ndata: ${JSON.stringify({ id: userMessage.id, session_id: id })}\n\n`,
		);

		// Run conversation loop and stream events
		try {
			const deps = await getDeps();

			for await (const event of runConversationLoop(deps, id)) {
				res.write(formatSseEvent(event));
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			res.write(formatSseEvent({ type: "error", message }));
		}

		res.write(formatSseEvent({ type: "done" }));
		res.end();
	};

	const handleListMessages = (
		_req: IncomingMessage,
		res: ServerResponse,
		params: Record<string, string>,
	): void => {
		const { id } = params;

		const session = getSession(db, id);
		if (!session) {
			sendJson(res, 404, { error: "Session not found" });
			return;
		}

		const messages = getMessages(db, id);
		sendJson(res, 200, { messages });
	};

	return { handleCreateMessage, handleListMessages };
};

import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { parseJsonBody } from "../body.ts";
import { createMessage, getMessages } from "../db/index.ts";
import { getSession } from "../db/index.ts";
import { sendJson } from "../router.ts";

export const createMessageHandlers = (db: Database.Database) => {
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

		const userMessage = createMessage(
			db,
			id,
			"user",
			content,
			body.metadata ? JSON.stringify(body.metadata) : null,
		);

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		res.write(
			`event: message_saved\ndata: ${JSON.stringify({ id: userMessage.id, session_id: id })}\n\n`,
		);

		const stubContent = "This is a stub response from the agent.";
		const assistantMessage = createMessage(db, id, "assistant", stubContent);

		res.write(
			`event: content\ndata: ${JSON.stringify({ sessionId: id, content: stubContent, messageId: assistantMessage.id })}\n\n`,
		);
		res.write("event: done\ndata: {}\n\n");
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

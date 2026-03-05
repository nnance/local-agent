import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Message, MessageRole } from "./types.ts";

export const createMessage = (
	db: Database.Database,
	sessionId: string,
	role: MessageRole,
	content: string,
	metadata?: string | null,
): Message => {
	const id = randomUUID();
	const now = new Date().toISOString();
	const message: Message = {
		id,
		session_id: sessionId,
		role,
		content,
		tool_call_id: null,
		timestamp: now,
		metadata: metadata ?? null,
	};

	db.prepare(
		"INSERT INTO messages (id, session_id, role, content, tool_call_id, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
	).run(
		message.id,
		message.session_id,
		message.role,
		message.content,
		message.tool_call_id,
		message.timestamp,
		message.metadata,
	);

	return message;
};

export const getMessages = (db: Database.Database, sessionId: string): Message[] => {
	return db
		.prepare(
			"SELECT id, session_id, role, content, tool_call_id, timestamp, metadata FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
		)
		.all(sessionId) as Message[];
};

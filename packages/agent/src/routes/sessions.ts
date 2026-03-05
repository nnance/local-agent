import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { parseJsonBody } from "../body.ts";
import { createSession, getSession, listSessions } from "../db/index.ts";
import { sendJson } from "../router.ts";

export const createSessionHandlers = (db: Database.Database) => {
	const handleCreateSession = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const body = await parseJsonBody<{ title?: string }>(req);
		const session = createSession(db, body.title);
		sendJson(res, 201, session);
	};

	const handleListSessions = (_req: IncomingMessage, res: ServerResponse): void => {
		const sessions = listSessions(db);
		sendJson(res, 200, { sessions });
	};

	const handleGetSession = (
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
		sendJson(res, 200, session);
	};

	return { handleCreateSession, handleListSessions, handleGetSession };
};

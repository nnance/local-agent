import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../router.ts";

export const handleCreateSession = (_req: IncomingMessage, res: ServerResponse): void => {
	const id = randomUUID();
	sendJson(res, 201, { id, createdAt: new Date().toISOString() });
};

export const handleListSessions = (_req: IncomingMessage, res: ServerResponse): void => {
	sendJson(res, 200, { sessions: [] });
};

export const handleGetSession = (
	_req: IncomingMessage,
	res: ServerResponse,
	params: Record<string, string>,
): void => {
	const { id } = params;
	sendJson(res, 200, {
		id,
		createdAt: new Date().toISOString(),
		messages: [],
	});
};

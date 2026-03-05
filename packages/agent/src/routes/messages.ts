import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../router.ts";

export const handleCreateMessage = (
	_req: IncomingMessage,
	res: ServerResponse,
	params: Record<string, string>,
): void => {
	const { id } = params;

	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});

	const event = {
		sessionId: id,
		content: "This is a stub response from the agent.",
	};

	res.write(`event: content\ndata: ${JSON.stringify(event)}\n\n`);
	res.write("event: done\ndata: {}\n\n");
	res.end();
};

export const handleListMessages = (
	_req: IncomingMessage,
	res: ServerResponse,
	_params: Record<string, string>,
): void => {
	sendJson(res, 200, { messages: [] });
};

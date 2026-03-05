import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../router.ts";

export const handleListSkills = (_req: IncomingMessage, res: ServerResponse): void => {
	sendJson(res, 200, { skills: [] });
};

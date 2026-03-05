import type { ServerResponse } from "node:http";
import { sendJson } from "../router.ts";

export const handleHealthCheck = (_req: unknown, res: ServerResponse): void => {
	sendJson(res, 200, { status: "ok" });
};

import type { IncomingMessage } from "node:http";

export const readBody = (req: IncomingMessage): Promise<string> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		req.on("error", reject);
	});

export const parseJsonBody = async <T = unknown>(req: IncomingMessage): Promise<T> => {
	const raw = await readBody(req);
	if (raw.length === 0) {
		return {} as T;
	}
	return JSON.parse(raw) as T;
};

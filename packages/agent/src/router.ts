import type { IncomingMessage, ServerResponse } from "node:http";

export type RouteHandler = (
	req: IncomingMessage,
	res: ServerResponse,
	params: Record<string, string>,
) => void | Promise<void>;

type Route = {
	readonly method: string;
	readonly pattern: RegExp;
	readonly paramNames: readonly string[];
	readonly handler: RouteHandler;
};

export type Router = {
	readonly routes: readonly Route[];
	readonly handle: (req: IncomingMessage, res: ServerResponse) => void;
	readonly get: (path: string, handler: RouteHandler) => void;
	readonly post: (path: string, handler: RouteHandler) => void;
};

const buildPattern = (path: string): { pattern: RegExp; paramNames: string[] } => {
	const paramNames: string[] = [];
	const regexStr = path.replace(/:([a-zA-Z]+)/g, (_match, name: string) => {
		paramNames.push(name);
		return "([^/]+)";
	});
	return { pattern: new RegExp(`^${regexStr}$`), paramNames };
};

const extractParams = (
	match: RegExpMatchArray,
	paramNames: readonly string[],
): Record<string, string> => {
	const params: Record<string, string> = {};
	for (let i = 0; i < paramNames.length; i++) {
		params[paramNames[i]] = match[i + 1];
	}
	return params;
};

export const sendJson = (res: ServerResponse, statusCode: number, data: unknown): void => {
	const body = JSON.stringify(data);
	res.writeHead(statusCode, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(body),
	});
	res.end(body);
};

export const createRouter = (): Router => {
	const routes: Route[] = [];

	const addRoute = (method: string, path: string, handler: RouteHandler): void => {
		const { pattern, paramNames } = buildPattern(path);
		routes.push({ method, pattern, paramNames, handler });
	};

	const handle = (req: IncomingMessage, res: ServerResponse): void => {
		const method = req.method ?? "GET";
		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
		const pathname = url.pathname;

		for (const route of routes) {
			if (route.method !== method) continue;
			const match = pathname.match(route.pattern);
			if (match) {
				const params = extractParams(match, route.paramNames);
				route.handler(req, res, params);
				return;
			}
		}

		sendJson(res, 404, { error: "Not Found" });
	};

	return {
		get routes() {
			return routes;
		},
		handle,
		get: (path: string, handler: RouteHandler) => addRoute("GET", path, handler),
		post: (path: string, handler: RouteHandler) => addRoute("POST", path, handler),
	};
};

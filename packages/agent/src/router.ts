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
	readonly setFallback: (handler: FallbackHandler) => void;
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

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const setCorsHeaders = (res: ServerResponse): void => {
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		res.setHeader(key, value);
	}
};

export type FallbackHandler = (
	req: IncomingMessage,
	res: ServerResponse,
	pathname: string,
) => void | Promise<void>;

export const createRouter = (): Router => {
	const routes: Route[] = [];
	let fallback: FallbackHandler | null = null;

	const addRoute = (method: string, path: string, handler: RouteHandler): void => {
		const { pattern, paramNames } = buildPattern(path);
		routes.push({ method, pattern, paramNames, handler });
	};

	const handle = (req: IncomingMessage, res: ServerResponse): void => {
		const method = req.method ?? "GET";
		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
		const pathname = url.pathname;

		// Add CORS headers to every response
		setCorsHeaders(res);

		// Handle CORS preflight
		if (method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		for (const route of routes) {
			if (route.method !== method) continue;
			const match = pathname.match(route.pattern);
			if (match) {
				const params = extractParams(match, route.paramNames);
				route.handler(req, res, params);
				return;
			}
		}

		// Try fallback handler (e.g. static file serving) for non-API routes
		if (fallback && !pathname.startsWith("/api/")) {
			fallback(req, res, pathname);
			return;
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
		setFallback: (handler: FallbackHandler) => {
			fallback = handler;
		},
	};
};

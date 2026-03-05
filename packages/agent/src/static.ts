import { existsSync, readFileSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { FallbackHandler } from "./router.ts";

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".map": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
};

const sendFile = (res: ServerResponse, filePath: string): void => {
	const ext = extname(filePath);
	const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
	const content = readFileSync(filePath);

	res.writeHead(200, {
		"Content-Type": contentType,
		"Content-Length": content.length,
	});
	res.end(content);
};

export const createStaticHandler = (distDir: string): FallbackHandler | null => {
	if (!existsSync(distDir)) {
		return null;
	}

	const indexPath = join(distDir, "index.html");
	const hasIndex = existsSync(indexPath);

	return (_req, res, pathname) => {
		// Normalize and resolve the path to prevent directory traversal
		const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
		const filePath = join(distDir, safePath);

		// Ensure the resolved path is within distDir
		if (!filePath.startsWith(distDir)) {
			res.writeHead(403);
			res.end();
			return;
		}

		// Try serving the exact file
		if (existsSync(filePath) && statSync(filePath).isFile()) {
			sendFile(res, filePath);
			return;
		}

		// SPA fallback: serve index.html for client-side routing
		if (hasIndex) {
			sendFile(res, indexPath);
			return;
		}

		res.writeHead(404);
		res.end("Not Found");
	};
};

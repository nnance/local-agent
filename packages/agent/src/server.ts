import { type Server, createServer } from "node:http";
import { createRouter } from "./router.ts";
import { handleHealthCheck } from "./routes/health.ts";
import { handleCreateMessage, handleListMessages } from "./routes/messages.ts";
import { handleCreateSession, handleGetSession, handleListSessions } from "./routes/sessions.ts";
import { handleListSkills } from "./routes/skills.ts";

export type AppServer = {
	readonly server: Server;
	readonly start: (port: number) => Promise<void>;
	readonly stop: () => Promise<void>;
};

export const createAppServer = (): AppServer => {
	const router = createRouter();

	router.get("/api/health", handleHealthCheck);
	router.post("/api/sessions", handleCreateSession);
	router.get("/api/sessions", handleListSessions);
	router.get("/api/sessions/:id", handleGetSession);
	router.post("/api/sessions/:id/messages", handleCreateMessage);
	router.get("/api/sessions/:id/messages", handleListMessages);
	router.get("/api/skills", handleListSkills);

	const server = createServer(router.handle);

	const start = (port: number): Promise<void> =>
		new Promise((resolve) => {
			server.listen(port, () => {
				console.log(`Agent server listening on port ${port}`);
				resolve();
			});
		});

	const stop = (): Promise<void> =>
		new Promise((resolve, reject) => {
			server.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});

	return { server, start, stop };
};

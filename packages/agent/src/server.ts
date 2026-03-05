import { type Server, createServer } from "node:http";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { initDatabase } from "./db/index.ts";
import { createRouter } from "./router.ts";
import { handleHealthCheck } from "./routes/health.ts";
import { createMessageHandlers } from "./routes/messages.ts";
import { createSessionHandlers } from "./routes/sessions.ts";
import { createSkillHandlers } from "./routes/skills.ts";
import { createSkillRegistry } from "./skills/index.ts";
import type { SkillRegistry } from "./skills/index.ts";

const DEFAULT_SKILLS_DIR = join(import.meta.dirname ?? "", "../skills");

export type AppServer = {
	readonly server: Server;
	readonly db: Database.Database;
	readonly registry: SkillRegistry;
	readonly start: (port: number) => Promise<void>;
	readonly stop: () => Promise<void>;
};

export const createAppServer = (dbPath?: string, skillsDir?: string): AppServer => {
	const db = initDatabase(dbPath);
	const registry = createSkillRegistry();
	const router = createRouter();

	const { handleCreateSession, handleListSessions, handleGetSession } = createSessionHandlers(db);
	const { handleCreateMessage, handleListMessages } = createMessageHandlers(db, registry);
	const { handleListSkills } = createSkillHandlers(registry);

	router.get("/api/health", handleHealthCheck);
	router.post("/api/sessions", handleCreateSession);
	router.get("/api/sessions", handleListSessions);
	router.get("/api/sessions/:id", handleGetSession);
	router.post("/api/sessions/:id/messages", handleCreateMessage);
	router.get("/api/sessions/:id/messages", handleListMessages);
	router.get("/api/skills", handleListSkills);

	const server = createServer(router.handle);

	const start = async (port: number): Promise<void> => {
		await registry.loadAll(skillsDir ?? DEFAULT_SKILLS_DIR);
		return new Promise((resolve) => {
			server.listen(port, () => {
				console.log(`Agent server listening on port ${port}`);
				resolve();
			});
		});
	};

	const stop = (): Promise<void> =>
		new Promise((resolve, reject) => {
			server.close((err) => {
				db.close();
				if (err) reject(err);
				else resolve();
			});
		});

	return { server, db, registry, start, stop };
};

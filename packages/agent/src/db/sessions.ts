import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Session } from "./types.ts";

export const createSession = (db: Database.Database, title?: string | null): Session => {
	const id = randomUUID();
	const now = new Date().toISOString();
	const session: Session = {
		id,
		created_at: now,
		updated_at: now,
		status: "active",
		title: title ?? null,
	};

	db.prepare(
		"INSERT INTO sessions (id, created_at, updated_at, status, title) VALUES (?, ?, ?, ?, ?)",
	).run(session.id, session.created_at, session.updated_at, session.status, session.title);

	return session;
};

export const getSession = (db: Database.Database, id: string): Session | null => {
	const row = db
		.prepare("SELECT id, created_at, updated_at, status, title FROM sessions WHERE id = ?")
		.get(id) as Session | undefined;
	return row ?? null;
};

export const listSessions = (db: Database.Database): Session[] => {
	return db
		.prepare(
			"SELECT id, created_at, updated_at, status, title FROM sessions ORDER BY created_at DESC",
		)
		.all() as Session[];
};

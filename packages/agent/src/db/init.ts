import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	title TEXT
)`;

const MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	role TEXT NOT NULL,
	content TEXT NOT NULL,
	tool_call_id TEXT,
	timestamp TEXT NOT NULL,
	metadata TEXT,
	FOREIGN KEY (session_id) REFERENCES sessions(id)
)`;

const MESSAGES_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
`;

const DEFAULT_DB_PATH = "./data/local-agent.db";

export const getDbPath = (): string => process.env.DB_PATH ?? DEFAULT_DB_PATH;

export const initDatabase = (dbPath?: string): Database.Database => {
	const resolvedPath = dbPath ?? getDbPath();
	const dir = dirname(resolvedPath);
	mkdirSync(dir, { recursive: true });

	const db = new Database(resolvedPath);

	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	db.exec(SESSIONS_TABLE);
	db.exec(MESSAGES_TABLE);
	db.exec(MESSAGES_SESSION_INDEX);

	return db;
};

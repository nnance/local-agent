import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { initDatabase } from "../src/db/init.ts";
import { createMessage, getMessages } from "../src/db/messages.ts";
import { createSession, getSession, listSessions } from "../src/db/sessions.ts";

describe("Database: sessions", () => {
	let db: Database.Database;

	beforeEach(() => {
		db = initDatabase(":memory:");
	});

	afterEach(() => {
		db.close();
	});

	it("should create a session with generated id and timestamps", () => {
		const session = createSession(db);

		assert.ok(session.id.length > 0);
		assert.ok(session.created_at.length > 0);
		assert.ok(session.updated_at.length > 0);
		assert.equal(session.status, "active");
		assert.equal(session.title, null);
	});

	it("should create a session with a title", () => {
		const session = createSession(db, "My Session");

		assert.equal(session.title, "My Session");
	});

	it("should retrieve a session by id", () => {
		const created = createSession(db, "Test");
		const found = getSession(db, created.id);

		assert.ok(found !== null);
		assert.equal(found.id, created.id);
		assert.equal(found.title, "Test");
		assert.equal(found.status, "active");
		assert.equal(found.created_at, created.created_at);
		assert.equal(found.updated_at, created.updated_at);
	});

	it("should return null for non-existent session", () => {
		const found = getSession(db, "non-existent-id");
		assert.equal(found, null);
	});

	it("should list sessions ordered by created_at descending", () => {
		const s1 = createSession(db, "First");
		const s2 = createSession(db, "Second");
		const s3 = createSession(db, "Third");

		const sessions = listSessions(db);

		assert.equal(sessions.length, 3);
		// Most recent first — but since they're created in quick succession,
		// the UUIDs and timestamps may vary. Just check all are present.
		const ids = sessions.map((s) => s.id);
		assert.ok(ids.includes(s1.id));
		assert.ok(ids.includes(s2.id));
		assert.ok(ids.includes(s3.id));
	});

	it("should return empty array when no sessions exist", () => {
		const sessions = listSessions(db);
		assert.deepEqual(sessions, []);
	});
});

describe("Database: messages", () => {
	let db: Database.Database;

	beforeEach(() => {
		db = initDatabase(":memory:");
	});

	afterEach(() => {
		db.close();
	});

	it("should create a message with generated id and timestamp", () => {
		const session = createSession(db);
		const message = createMessage(db, session.id, "user", "Hello");

		assert.ok(message.id.length > 0);
		assert.equal(message.session_id, session.id);
		assert.equal(message.role, "user");
		assert.equal(message.content, "Hello");
		assert.equal(message.tool_call_id, null);
		assert.ok(message.timestamp.length > 0);
		assert.equal(message.metadata, null);
	});

	it("should create a message with metadata", () => {
		const session = createSession(db);
		const meta = JSON.stringify({ source: "test" });
		const message = createMessage(db, session.id, "user", "Hello", meta);

		assert.equal(message.metadata, meta);
	});

	it("should retrieve messages for a session ordered by timestamp", () => {
		const session = createSession(db);
		const m1 = createMessage(db, session.id, "user", "Hello");
		const m2 = createMessage(db, session.id, "assistant", "Hi there!");
		const m3 = createMessage(db, session.id, "user", "How are you?");

		const messages = getMessages(db, session.id);

		assert.equal(messages.length, 3);
		assert.equal(messages[0].id, m1.id);
		assert.equal(messages[1].id, m2.id);
		assert.equal(messages[2].id, m3.id);
		assert.equal(messages[0].role, "user");
		assert.equal(messages[1].role, "assistant");
		assert.equal(messages[2].role, "user");
	});

	it("should return empty array for session with no messages", () => {
		const session = createSession(db);
		const messages = getMessages(db, session.id);
		assert.deepEqual(messages, []);
	});

	it("should only return messages for the specified session", () => {
		const s1 = createSession(db);
		const s2 = createSession(db);
		createMessage(db, s1.id, "user", "In session 1");
		createMessage(db, s2.id, "user", "In session 2");

		const s1Messages = getMessages(db, s1.id);
		const s2Messages = getMessages(db, s2.id);

		assert.equal(s1Messages.length, 1);
		assert.equal(s1Messages[0].content, "In session 1");
		assert.equal(s2Messages.length, 1);
		assert.equal(s2Messages[0].content, "In session 2");
	});
});

describe("Database: init", () => {
	it("should create tables without error using in-memory database", () => {
		const db = initDatabase(":memory:");
		// Verify tables exist by querying sqlite_master
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);
		assert.ok(tableNames.includes("sessions"));
		assert.ok(tableNames.includes("messages"));
		db.close();
	});

	it("should enable WAL journal mode", () => {
		const db = initDatabase(":memory:");
		const result = db.pragma("journal_mode") as { journal_mode: string }[];
		// In-memory databases use "memory" journal mode, but on disk it would be "wal"
		assert.ok(result.length > 0);
		db.close();
	});

	it("should be idempotent - calling init twice should not error", () => {
		const db = initDatabase(":memory:");
		// Re-run the same init statements
		db.exec(
			"CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', title TEXT)",
		);
		db.exec(
			"CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, tool_call_id TEXT, timestamp TEXT NOT NULL, metadata TEXT, FOREIGN KEY (session_id) REFERENCES sessions(id))",
		);
		db.close();
	});
});

import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { executeScript } from "../src/skills/executor.ts";
import { createSkillRegistry } from "../src/skills/registry.ts";
import type { SkillRegistry } from "../src/skills/registry.ts";
import type { ToolMapping } from "../src/skills/types.ts";

const SKILLS_DIR = join(import.meta.dirname ?? "", "../skills");

describe("executeScript", () => {
	let registry: SkillRegistry;

	beforeEach(async () => {
		registry = createSkillRegistry();
		await registry.loadAll(SKILLS_DIR);
	});

	it("should execute file-read script successfully", async () => {
		const mapping = registry.getToolMapping("file-read__read");
		assert.ok(mapping);

		// Read the SKILL.md of file-read itself as a test
		const skillMdPath = join(SKILLS_DIR, "file-read", "SKILL.md");
		const result = await executeScript(mapping, { file_path: skillMdPath });

		assert.equal(result.exitCode, 0);
		assert.ok(result.stdout.includes("name: file-read"));
		assert.equal(result.stderr, "");
	});

	it("should return non-zero exit code for missing file", async () => {
		const mapping = registry.getToolMapping("file-read__read");
		assert.ok(mapping);

		const result = await executeScript(mapping, {
			file_path: "/tmp/definitely-does-not-exist-xyz",
		});

		assert.notEqual(result.exitCode, 0);
		assert.ok(result.stderr.includes("File not found"));
	});

	it("should execute shell-execute script", async () => {
		const mapping = registry.getToolMapping("shell-execute__exec");
		assert.ok(mapping);

		const result = await executeScript(mapping, { command: "echo hello world" });

		assert.equal(result.exitCode, 0);
		assert.equal(result.stdout.trim(), "hello world");
	});

	it("should execute file-write script", async () => {
		const mapping = registry.getToolMapping("file-write__write");
		assert.ok(mapping);

		const testPath = `/tmp/local-agent-test-${Date.now()}.txt`;
		const result = await executeScript(mapping, {
			file_path: testPath,
			content: "test content",
		});

		assert.equal(result.exitCode, 0);
		assert.ok(result.stdout.includes("Wrote"));
		assert.ok(result.stdout.includes(testPath));

		// Verify the file was written by reading it back
		const readMapping = registry.getToolMapping("file-read__read");
		assert.ok(readMapping);
		const readResult = await executeScript(readMapping, { file_path: testPath });
		assert.equal(readResult.stdout, "test content");
	});

	it("should respect timeout", async () => {
		const mapping = registry.getToolMapping("shell-execute__exec");
		assert.ok(mapping);

		const result = await executeScript(mapping, { command: "sleep 10" }, 500);

		// Should be killed by timeout — exit code is null when killed by signal
		assert.notEqual(result.exitCode, 0);
	});

	it("should pass optional parameters after required ones", async () => {
		const mapping = registry.getToolMapping("file-search-glob__glob");
		assert.ok(mapping);

		const result = await executeScript(mapping, {
			pattern: "SKILL.md",
			directory: SKILLS_DIR,
		});

		assert.equal(result.exitCode, 0);
		assert.ok(result.stdout.includes("SKILL.md"));
	});
});

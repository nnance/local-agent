import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createSkillRegistry } from "../src/skills/registry.ts";
import type { SkillRegistry } from "../src/skills/registry.ts";

const SKILLS_DIR = join(import.meta.dirname ?? "", "../skills");

describe("createSkillRegistry", () => {
	let registry: SkillRegistry;

	beforeEach(() => {
		registry = createSkillRegistry();
	});

	describe("loadAll", () => {
		it("should load all skills from the skills directory", async () => {
			await registry.loadAll(SKILLS_DIR);
			const skills = registry.getSkills();

			assert.ok(skills.length >= 7, `Expected at least 7 skills, got ${skills.length}`);

			const names = skills.map((s) => s.name);
			assert.ok(names.includes("file-read"));
			assert.ok(names.includes("file-write"));
			assert.ok(names.includes("shell-execute"));
			assert.ok(names.includes("file-search-glob"));
			assert.ok(names.includes("file-search-grep"));
			assert.ok(names.includes("web-fetch"));
			assert.ok(names.includes("web-search"));
		});

		it("should return empty for non-existent directory", async () => {
			await registry.loadAll("/tmp/non-existent-skills-dir");
			const skills = registry.getSkills();
			assert.equal(skills.length, 0);
		});
	});

	describe("loadSkill", () => {
		it("should load a single skill from a folder", async () => {
			const skill = await registry.loadSkill(join(SKILLS_DIR, "file-read"));

			assert.ok(skill);
			assert.equal(skill.name, "file-read");
			assert.ok(skill.description.length > 0);
			assert.equal(skill.scripts.length, 1);
			assert.equal(skill.scripts[0].name, "read");
		});

		it("should return null for folder without SKILL.md", async () => {
			const skill = await registry.loadSkill("/tmp");
			assert.equal(skill, null);
		});
	});

	describe("unloadSkill", () => {
		it("should remove a loaded skill", async () => {
			await registry.loadAll(SKILLS_DIR);
			const before = registry.getSkills().length;

			registry.unloadSkill("file-read");
			const after = registry.getSkills().length;

			assert.equal(after, before - 1);
			const names = registry.getSkills().map((s) => s.name);
			assert.ok(!names.includes("file-read"));
		});

		it("should remove tool mappings when unloading", async () => {
			await registry.loadAll(SKILLS_DIR);
			assert.ok(registry.getToolMapping("file-read__read"));

			registry.unloadSkill("file-read");
			assert.equal(registry.getToolMapping("file-read__read"), undefined);
		});

		it("should be safe to unload non-existent skill", () => {
			registry.unloadSkill("non-existent");
			// Should not throw
		});
	});

	describe("getToolDefinitions", () => {
		it("should return OpenAI-format tool definitions", async () => {
			await registry.loadAll(SKILLS_DIR);
			const tools = registry.getToolDefinitions();

			assert.ok(tools.length >= 7);

			const fileReadTool = tools.find((t) => t.function.name === "file-read__read");
			assert.ok(fileReadTool);
			assert.equal(fileReadTool.type, "function");
			assert.ok(fileReadTool.function.description.length > 0);
			assert.equal(fileReadTool.function.parameters.type, "object");
			assert.ok(fileReadTool.function.parameters.properties.file_path);
		});
	});

	describe("getSkillSummaries", () => {
		it("should return formatted skill summaries", async () => {
			await registry.loadAll(SKILLS_DIR);
			const summaries = registry.getSkillSummaries();

			assert.ok(summaries.includes("file-read:"));
			assert.ok(summaries.includes("file-write:"));
			assert.ok(summaries.includes("shell-execute:"));
		});

		it("should return empty string when no skills loaded", () => {
			const summaries = registry.getSkillSummaries();
			assert.equal(summaries, "");
		});
	});

	describe("getToolMapping", () => {
		beforeEach(async () => {
			await registry.loadAll(SKILLS_DIR);
		});

		it("should return mapping for valid tool name", () => {
			const mapping = registry.getToolMapping("file-read__read");

			assert.ok(mapping);
			assert.equal(mapping.skillName, "file-read");
			assert.equal(mapping.scriptName, "read");
			assert.equal(mapping.toolName, "file-read__read");
		});

		it("should return undefined for unknown tool name", () => {
			const mapping = registry.getToolMapping("unknown__tool");
			assert.equal(mapping, undefined);
		});
	});
});

describe("skill re-loading", () => {
	it("should replace existing skill when reloaded", async () => {
		const registry = createSkillRegistry();
		await registry.loadSkill(join(SKILLS_DIR, "file-read"));

		const before = registry.getSkills();
		assert.equal(before.length, 1);

		// Reload the same skill
		await registry.loadSkill(join(SKILLS_DIR, "file-read"));

		const after = registry.getSkills();
		assert.equal(after.length, 1);
		assert.equal(after[0].name, "file-read");
	});
});

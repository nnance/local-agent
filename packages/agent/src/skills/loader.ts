import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "./frontmatter.ts";
import type { ReferenceRef, Script, ScriptParameters, Skill, TemplateRef } from "./types.ts";

const SKILLS_DIR = join(import.meta.dirname ?? "", "../../skills");

type RawScript = {
	readonly name?: unknown;
	readonly path?: unknown;
	readonly description?: unknown;
	readonly parameters?: unknown;
};

type RawRef = {
	readonly name?: unknown;
	readonly path?: unknown;
};

const toScript = (raw: RawScript): Script | null => {
	if (
		typeof raw.name !== "string" ||
		typeof raw.path !== "string" ||
		typeof raw.description !== "string"
	) {
		return null;
	}
	const parameters = (raw.parameters ?? {
		type: "object",
		properties: {},
	}) as ScriptParameters;
	return {
		name: raw.name,
		path: raw.path,
		description: raw.description,
		parameters,
	};
};

const toRef = (raw: RawRef): TemplateRef | ReferenceRef | null => {
	if (typeof raw.name !== "string" || typeof raw.path !== "string") return null;
	return { name: raw.name, path: raw.path };
};

export const loadSkillFromFolder = async (folderPath: string): Promise<Skill | null> => {
	const skillMdPath = join(folderPath, "SKILL.md");
	let content: string;
	try {
		content = await readFile(skillMdPath, "utf-8");
	} catch {
		return null;
	}

	const parsed = parseFrontmatter(content);
	if (!parsed) return null;

	const { data } = parsed;

	if (typeof data.name !== "string" || typeof data.description !== "string") {
		return null;
	}

	const rawScripts = Array.isArray(data.scripts) ? data.scripts : [];
	const scripts = rawScripts
		.map((s: unknown) => toScript(s as RawScript))
		.filter((s: Script | null): s is Script => s !== null);

	const rawTemplates = Array.isArray(data.templates) ? data.templates : [];
	const templates = rawTemplates
		.map((t: unknown) => toRef(t as RawRef))
		.filter((t: TemplateRef | null): t is TemplateRef => t !== null);

	const rawReferences = Array.isArray(data.references) ? data.references : [];
	const references = rawReferences
		.map((r: unknown) => toRef(r as RawRef))
		.filter((r: ReferenceRef | null): r is ReferenceRef => r !== null);

	return {
		name: data.name,
		description: data.description,
		scripts,
		templates,
		references,
		folderPath,
	};
};

export const scanSkillsDirectory = async (
	skillsDir: string = SKILLS_DIR,
): Promise<readonly Skill[]> => {
	let entries: Dirent<string>[];
	try {
		entries = await readdir(skillsDir, { withFileTypes: true, encoding: "utf-8" });
	} catch {
		return [];
	}

	const folders = entries.filter((e) => e.isDirectory());
	const skills: Skill[] = [];

	for (const folder of folders) {
		const folderPath = join(skillsDir, folder.name);
		const skill = await loadSkillFromFolder(folderPath);
		if (skill) {
			skills.push(skill);
		}
	}

	return skills;
};

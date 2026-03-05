import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillRegistry } from "./registry.ts";
import type { OpenAIToolDefinition } from "./types.ts";

export const META_TOOL_LOAD_TEMPLATE: OpenAIToolDefinition = {
	type: "function",
	function: {
		name: "load_skill_template",
		description: "Load a prompt template from a skill. Use when you need a structured prompt.",
		parameters: {
			type: "object",
			properties: {
				skill_name: {
					type: "string",
					description: "Name of the skill",
				},
				template_name: {
					type: "string",
					description: "Name of the template",
				},
			},
			required: ["skill_name", "template_name"],
		},
	},
};

export const META_TOOL_LOAD_REFERENCE: OpenAIToolDefinition = {
	type: "function",
	function: {
		name: "load_skill_reference",
		description:
			"Load a reference file from a skill. Use when you need documentation or API specs.",
		parameters: {
			type: "object",
			properties: {
				skill_name: {
					type: "string",
					description: "Name of the skill",
				},
				reference_name: {
					type: "string",
					description: "Name of the reference",
				},
			},
			required: ["skill_name", "reference_name"],
		},
	},
};

export const getMetaToolDefinitions = (): readonly OpenAIToolDefinition[] => [
	META_TOOL_LOAD_TEMPLATE,
	META_TOOL_LOAD_REFERENCE,
];

export const executeLoadTemplate = async (
	registry: SkillRegistry,
	skillName: string,
	templateName: string,
): Promise<string> => {
	const skills = registry.getSkills();
	const skill = skills.find((s) => s.name === skillName);
	if (!skill) {
		return `Error: Skill "${skillName}" not found.`;
	}

	const template = skill.templates.find((t) => t.name === templateName);
	if (!template) {
		return `Error: Template "${templateName}" not found in skill "${skillName}".`;
	}

	const filePath = join(skill.folderPath, template.path);
	try {
		return await readFile(filePath, "utf-8");
	} catch {
		return `Error: Could not read template file at "${filePath}".`;
	}
};

export const executeLoadReference = async (
	registry: SkillRegistry,
	skillName: string,
	referenceName: string,
): Promise<string> => {
	const skills = registry.getSkills();
	const skill = skills.find((s) => s.name === skillName);
	if (!skill) {
		return `Error: Skill "${skillName}" not found.`;
	}

	const reference = skill.references.find((r) => r.name === referenceName);
	if (!reference) {
		return `Error: Reference "${referenceName}" not found in skill "${skillName}".`;
	}

	const filePath = join(skill.folderPath, reference.path);
	try {
		return await readFile(filePath, "utf-8");
	} catch {
		return `Error: Could not read reference file at "${filePath}".`;
	}
};

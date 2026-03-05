import { loadSkillFromFolder, scanSkillsDirectory } from "./loader.ts";
import type { OpenAIToolDefinition, Skill, ToolMapping } from "./types.ts";

export type SkillRegistry = {
	readonly loadAll: (skillsDir?: string) => Promise<void>;
	readonly loadSkill: (folderPath: string) => Promise<Skill | null>;
	readonly unloadSkill: (name: string) => void;
	readonly getToolDefinitions: () => readonly OpenAIToolDefinition[];
	readonly getSkillSummaries: () => string;
	readonly getSkills: () => readonly Skill[];
	readonly getToolMapping: (toolName: string) => ToolMapping | undefined;
};

const buildToolName = (skillName: string, scriptName: string): string =>
	`${skillName}__${scriptName}`;

const buildToolMappings = (skill: Skill): readonly ToolMapping[] =>
	skill.scripts.map((script) => ({
		toolName: buildToolName(skill.name, script.name),
		skillName: skill.name,
		scriptName: script.name,
		script,
		skillFolderPath: skill.folderPath,
	}));

const buildToolDefinition = (mapping: ToolMapping): OpenAIToolDefinition => ({
	type: "function",
	function: {
		name: mapping.toolName,
		description: mapping.script.description,
		parameters: mapping.script.parameters,
	},
});

export const createSkillRegistry = (): SkillRegistry => {
	const skills = new Map<string, Skill>();
	const tools = new Map<string, ToolMapping>();

	const registerSkill = (skill: Skill): void => {
		// Remove old mappings if re-registering
		unloadSkill(skill.name);

		skills.set(skill.name, skill);
		const mappings = buildToolMappings(skill);
		for (const mapping of mappings) {
			tools.set(mapping.toolName, mapping);
		}
	};

	const loadAll = async (skillsDir?: string): Promise<void> => {
		const loaded = await scanSkillsDirectory(skillsDir);
		for (const skill of loaded) {
			registerSkill(skill);
		}
	};

	const loadSkill = async (folderPath: string): Promise<Skill | null> => {
		const skill = await loadSkillFromFolder(folderPath);
		if (skill) {
			registerSkill(skill);
		}
		return skill;
	};

	const unloadSkill = (name: string): void => {
		const existing = skills.get(name);
		if (existing) {
			for (const script of existing.scripts) {
				tools.delete(buildToolName(name, script.name));
			}
			skills.delete(name);
		}
	};

	const getToolDefinitions = (): readonly OpenAIToolDefinition[] =>
		Array.from(tools.values()).map(buildToolDefinition);

	const getSkillSummaries = (): string =>
		Array.from(skills.values())
			.map((s) => `- ${s.name}: ${s.description}`)
			.join("\n");

	const getSkills = (): readonly Skill[] => Array.from(skills.values());

	const getToolMapping = (toolName: string): ToolMapping | undefined => tools.get(toolName);

	return {
		loadAll,
		loadSkill,
		unloadSkill,
		getToolDefinitions,
		getSkillSummaries,
		getSkills,
		getToolMapping,
	};
};

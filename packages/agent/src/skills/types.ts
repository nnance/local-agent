export type ScriptParameter = {
	readonly type: string;
	readonly description: string;
};

export type ScriptParameters = {
	readonly type: "object";
	readonly properties: Record<string, ScriptParameter>;
	readonly required?: readonly string[];
};

export type Script = {
	readonly name: string;
	readonly path: string;
	readonly description: string;
	readonly parameters: ScriptParameters;
};

export type TemplateRef = {
	readonly name: string;
	readonly path: string;
};

export type ReferenceRef = {
	readonly name: string;
	readonly path: string;
};

export type Skill = {
	readonly name: string;
	readonly description: string;
	readonly scripts: readonly Script[];
	readonly templates: readonly TemplateRef[];
	readonly references: readonly ReferenceRef[];
	readonly folderPath: string;
};

export type ToolMapping = {
	readonly toolName: string;
	readonly skillName: string;
	readonly scriptName: string;
	readonly script: Script;
	readonly skillFolderPath: string;
};

export type OpenAIToolDefinition = {
	readonly type: "function";
	readonly function: {
		readonly name: string;
		readonly description: string;
		readonly parameters: ScriptParameters;
	};
};

export type ExecutionResult = {
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number | null;
};

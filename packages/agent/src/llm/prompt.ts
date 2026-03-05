import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_PROMPT_FILENAME = "system-prompt.md";

const resolvePromptPath = (): string => {
	if (process.env.SYSTEM_PROMPT_PATH) {
		return process.env.SYSTEM_PROMPT_PATH;
	}
	// Default: system-prompt.md relative to packages/agent/
	return join(import.meta.dirname ?? "", "../../", DEFAULT_PROMPT_FILENAME);
};

export const loadSystemPrompt = async (): Promise<string> => {
	const promptPath = resolvePromptPath();
	try {
		return await readFile(promptPath, "utf-8");
	} catch {
		return "You are a helpful assistant.";
	}
};

import { watch } from "node:fs";
import type { SkillRegistry } from "./registry.ts";

const DEFAULT_DEBOUNCE_MS = 300;

export type SkillWatcher = {
	readonly close: () => void;
};

export const createSkillWatcher = (
	skillsDir: string,
	registry: SkillRegistry,
	debounceMs: number = DEFAULT_DEBOUNCE_MS,
): SkillWatcher => {
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const watcher = watch(skillsDir, { recursive: true }, (_eventType, _filename) => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			registry.loadAll(skillsDir).catch((err: unknown) => {
				console.error("Skill watcher reload error:", err);
			});
		}, debounceMs);
	});

	const close = (): void => {
		if (debounceTimer) clearTimeout(debounceTimer);
		watcher.close();
	};

	return { close };
};

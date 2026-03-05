import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../router.ts";
import type { SkillRegistry } from "../skills/index.ts";

export const createSkillHandlers = (registry: SkillRegistry) => {
	const handleListSkills = (_req: IncomingMessage, res: ServerResponse): void => {
		const skills = registry.getSkills().map((s) => ({
			name: s.name,
			description: s.description,
			scripts: s.scripts.map((sc) => ({
				name: sc.name,
				description: sc.description,
			})),
			templates: s.templates.map((t) => t.name),
			references: s.references.map((r) => r.name),
		}));
		sendJson(res, 200, { skills });
	};

	return { handleListSkills };
};

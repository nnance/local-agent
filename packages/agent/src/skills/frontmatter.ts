/**
 * Simple YAML frontmatter parser.
 * Handles: strings, multiline strings (>), arrays of objects, nested objects.
 * No external dependencies.
 */

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

export const extractFrontmatter = (
	content: string,
): { frontmatter: string; body: string } | null => {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) return null;
	const frontmatter = match[1];
	const body = content.slice(match[0].length).trim();
	return { frontmatter, body };
};

const getIndentLevel = (line: string): number => {
	const match = line.match(/^(\s*)/);
	return match ? match[1].length : 0;
};

const trimComment = (value: string): string => {
	let inQuote = false;
	let quoteChar = "";
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (inQuote) {
			if (ch === quoteChar) inQuote = false;
		} else if (ch === '"' || ch === "'") {
			inQuote = true;
			quoteChar = ch;
		} else if (ch === "#") {
			return value.slice(0, i).trimEnd();
		}
	}
	return value;
};

const parseScalar = (raw: string): YamlValue => {
	const value = trimComment(raw).trim();
	if (value === "" || value === "null" || value === "~") return null;
	if (value === "true") return true;
	if (value === "false") return false;

	// Quoted string
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	// Number
	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return Number(value);
	}

	return value;
};

type LineInfo = {
	readonly indent: number;
	readonly raw: string;
	readonly trimmed: string;
};

const toLineInfos = (lines: readonly string[]): readonly LineInfo[] =>
	lines
		.filter((raw) => {
			const trimmed = raw.trim();
			return trimmed !== "" && !trimmed.startsWith("#");
		})
		.map((raw) => ({
			indent: getIndentLevel(raw),
			raw,
			trimmed: raw.trim(),
		}));

const parseBlock = (
	lineInfos: readonly LineInfo[],
	startIdx: number,
	baseIndent: number,
): { value: YamlValue; nextIdx: number } => {
	const result: Record<string, YamlValue> = {};
	let i = startIdx;

	while (i < lineInfos.length) {
		const info = lineInfos[i];

		if (info.indent < baseIndent) break;
		if (info.indent > baseIndent) {
			i++;
			continue;
		}

		// Array item at this indent
		if (info.trimmed.startsWith("- ")) {
			// This block is actually an array — delegate to parent
			break;
		}

		// Key-value line
		const colonIdx = info.trimmed.indexOf(":");
		if (colonIdx === -1) {
			i++;
			continue;
		}

		const key = info.trimmed.slice(0, colonIdx).trim();
		const afterColon = info.trimmed.slice(colonIdx + 1).trim();

		if (afterColon === ">" || afterColon === "|") {
			// Multiline scalar — collect indented continuation lines
			const foldedParts: string[] = [];
			i++;
			while (i < lineInfos.length && lineInfos[i].indent > baseIndent) {
				foldedParts.push(lineInfos[i].trimmed);
				i++;
			}
			result[key] = foldedParts.join(afterColon === ">" ? " " : "\n");
		} else if (afterColon === "") {
			// Could be a nested object or array
			i++;
			if (i >= lineInfos.length || lineInfos[i].indent <= baseIndent) {
				result[key] = null;
			} else {
				const childIndent = lineInfos[i].indent;
				if (lineInfos[i].trimmed.startsWith("- ")) {
					// Array
					const arr = parseArray(lineInfos, i, childIndent);
					result[key] = arr.value;
					i = arr.nextIdx;
				} else {
					// Nested object
					const nested = parseBlock(lineInfos, i, childIndent);
					result[key] = nested.value;
					i = nested.nextIdx;
				}
			}
		} else {
			result[key] = parseScalar(afterColon);
			i++;
		}
	}

	return { value: result, nextIdx: i };
};

const parseArrayItemObject = (
	lineInfos: readonly LineInfo[],
	startIdx: number,
	itemIndent: number,
): { value: Record<string, YamlValue>; nextIdx: number } => {
	const obj: Record<string, YamlValue> = {};
	let i = startIdx;

	while (i < lineInfos.length) {
		const info = lineInfos[i];

		// Stop if we're back at or before the array indent, or hit another array item at item level
		if (info.indent < itemIndent) break;
		if (info.indent === itemIndent && info.trimmed.startsWith("- ")) break;

		// Lines deeper than or at itemIndent are part of this item
		const colonIdx = info.trimmed.indexOf(":");
		if (colonIdx === -1) {
			i++;
			continue;
		}

		const key = info.trimmed.slice(0, colonIdx).trim();
		const afterColon = info.trimmed.slice(colonIdx + 1).trim();

		if (afterColon === ">" || afterColon === "|") {
			const foldedParts: string[] = [];
			i++;
			while (i < lineInfos.length && lineInfos[i].indent > info.indent) {
				foldedParts.push(lineInfos[i].trimmed);
				i++;
			}
			obj[key] = foldedParts.join(afterColon === ">" ? " " : "\n");
		} else if (afterColon === "") {
			i++;
			if (i >= lineInfos.length || lineInfos[i].indent <= info.indent) {
				obj[key] = null;
			} else {
				const childIndent = lineInfos[i].indent;
				if (lineInfos[i].trimmed.startsWith("- ")) {
					const arr = parseArray(lineInfos, i, childIndent);
					obj[key] = arr.value;
					i = arr.nextIdx;
				} else {
					const nested = parseBlock(lineInfos, i, childIndent);
					obj[key] = nested.value;
					i = nested.nextIdx;
				}
			}
		} else {
			obj[key] = parseScalar(afterColon);
			i++;
		}
	}

	return { value: obj, nextIdx: i };
};

const parseArray = (
	lineInfos: readonly LineInfo[],
	startIdx: number,
	baseIndent: number,
): { value: YamlValue[]; nextIdx: number } => {
	const items: YamlValue[] = [];
	let i = startIdx;

	while (i < lineInfos.length) {
		const info = lineInfos[i];

		if (info.indent < baseIndent) break;
		if (info.indent > baseIndent) {
			i++;
			continue;
		}

		if (!info.trimmed.startsWith("- ")) break;

		const afterDash = info.trimmed.slice(2).trim();

		// Check if the dash line contains a key: value (object item)
		const colonIdx = afterDash.indexOf(":");
		if (colonIdx !== -1) {
			// This is an object item starting on the dash line
			// Parse the first key-value from the dash line
			const firstKey = afterDash.slice(0, colonIdx).trim();
			const firstValueRaw = afterDash.slice(colonIdx + 1).trim();

			const obj: Record<string, YamlValue> = {};

			if (firstValueRaw === ">" || firstValueRaw === "|") {
				const foldedParts: string[] = [];
				i++;
				while (i < lineInfos.length && lineInfos[i].indent > baseIndent) {
					// Check if this is actually a sibling key, not a continuation
					const siblingColon = lineInfos[i].trimmed.indexOf(":");
					if (siblingColon !== -1 && lineInfos[i].indent === baseIndent + 2) {
						// Might be a sibling key — check if it's a valid key
						break;
					}
					foldedParts.push(lineInfos[i].trimmed);
					i++;
				}
				obj[firstKey] = foldedParts.join(firstValueRaw === ">" ? " " : "\n");
			} else if (firstValueRaw === "") {
				i++;
				if (i < lineInfos.length && lineInfos[i].indent > baseIndent) {
					const childIndent = lineInfos[i].indent;
					if (lineInfos[i].trimmed.startsWith("- ")) {
						const arr = parseArray(lineInfos, i, childIndent);
						obj[firstKey] = arr.value;
						i = arr.nextIdx;
					} else {
						const nested = parseBlock(lineInfos, i, childIndent);
						obj[firstKey] = nested.value;
						i = nested.nextIdx;
					}
				} else {
					obj[firstKey] = null;
				}
			} else {
				obj[firstKey] = parseScalar(firstValueRaw);
				i++;
			}

			// Parse remaining keys of this array item object
			// They should be indented beyond baseIndent
			const remaining = parseArrayItemObject(lineInfos, i, baseIndent + 2);
			Object.assign(obj, remaining.value);
			i = remaining.nextIdx;

			items.push(obj);
		} else {
			// Simple scalar item
			items.push(parseScalar(afterDash));
			i++;
		}
	}

	return { value: items, nextIdx: i };
};

export const parseYaml = (yaml: string): Record<string, YamlValue> => {
	const lines = yaml.split("\n");
	const lineInfos = toLineInfos(lines);

	if (lineInfos.length === 0) return {};

	const result = parseBlock(lineInfos, 0, 0);
	return result.value as Record<string, YamlValue>;
};

export const parseFrontmatter = (
	content: string,
): { data: Record<string, YamlValue>; body: string } | null => {
	const extracted = extractFrontmatter(content);
	if (!extracted) return null;
	const data = parseYaml(extracted.frontmatter);
	return { data, body: extracted.body };
};

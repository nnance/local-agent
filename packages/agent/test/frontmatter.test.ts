import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFrontmatter, parseFrontmatter, parseYaml } from "../src/skills/frontmatter.ts";

describe("extractFrontmatter", () => {
	it("should extract frontmatter and body from valid content", () => {
		const content = `---
name: test
---

# Body content`;

		const result = extractFrontmatter(content);
		assert.ok(result);
		assert.equal(result.frontmatter, "name: test");
		assert.equal(result.body, "# Body content");
	});

	it("should return null for content without frontmatter", () => {
		const content = "# Just a heading\nSome text";
		const result = extractFrontmatter(content);
		assert.equal(result, null);
	});

	it("should handle empty body", () => {
		const content = `---
name: test
---`;

		const result = extractFrontmatter(content);
		assert.ok(result);
		assert.equal(result.frontmatter, "name: test");
		assert.equal(result.body, "");
	});
});

describe("parseYaml", () => {
	it("should parse simple key-value pairs", () => {
		const yaml = `name: file-read
version: 1`;

		const result = parseYaml(yaml);
		assert.equal(result.name, "file-read");
		assert.equal(result.version, 1);
	});

	it("should parse boolean values", () => {
		const yaml = `enabled: true
disabled: false`;

		const result = parseYaml(yaml);
		assert.equal(result.enabled, true);
		assert.equal(result.disabled, false);
	});

	it("should parse null values", () => {
		const yaml = `empty: null
tilde: ~`;

		const result = parseYaml(yaml);
		assert.equal(result.empty, null);
		assert.equal(result.tilde, null);
	});

	it("should parse quoted strings", () => {
		const yaml = `single: 'hello world'
double: "goodbye world"`;

		const result = parseYaml(yaml);
		assert.equal(result.single, "hello world");
		assert.equal(result.double, "goodbye world");
	});

	it("should parse multiline folded strings (>)", () => {
		const yaml = `description: >
  This is a long
  description text`;

		const result = parseYaml(yaml);
		assert.equal(result.description, "This is a long description text");
	});

	it("should parse multiline literal strings (|)", () => {
		const yaml = `content: |
  line one
  line two`;

		const result = parseYaml(yaml);
		assert.equal(result.content, "line one\nline two");
	});

	it("should parse nested objects", () => {
		const yaml = `parameters:
  type: object
  properties:
    file_path:
      type: string
      description: Path to file`;

		const result = parseYaml(yaml);
		const params = result.parameters as Record<string, unknown>;
		assert.equal(params.type, "object");

		const props = params.properties as Record<string, unknown>;
		const filePath = props.file_path as Record<string, unknown>;
		assert.equal(filePath.type, "string");
		assert.equal(filePath.description, "Path to file");
	});

	it("should parse arrays of objects", () => {
		const yaml = `scripts:
  - name: read
    path: scripts/read.sh
  - name: write
    path: scripts/write.sh`;

		const result = parseYaml(yaml);
		const scripts = result.scripts as Array<Record<string, unknown>>;
		assert.equal(scripts.length, 2);
		assert.equal(scripts[0].name, "read");
		assert.equal(scripts[0].path, "scripts/read.sh");
		assert.equal(scripts[1].name, "write");
		assert.equal(scripts[1].path, "scripts/write.sh");
	});

	it("should parse arrays of simple values", () => {
		const yaml = `required:
  - file_path
  - content`;

		const result = parseYaml(yaml);
		const required = result.required as string[];
		assert.deepEqual(required, ["file_path", "content"]);
	});

	it("should ignore comments", () => {
		const yaml = `# This is a comment
name: test # inline comment`;

		const result = parseYaml(yaml);
		assert.equal(result.name, "test");
	});

	it("should handle empty input", () => {
		const result = parseYaml("");
		assert.deepEqual(result, {});
	});
});

describe("parseFrontmatter", () => {
	it("should parse a complete SKILL.md-style frontmatter", () => {
		const content = `---
name: file-read
description: >
  Read the contents of a file from the local filesystem.
scripts:
  - name: read
    path: scripts/read.sh
    description: >
      Read a file at the given path and return its contents.
    parameters:
      type: object
      properties:
        file_path:
          type: string
          description: Absolute path to the file to read
      required:
        - file_path
templates:
  - name: summary-prompt
    path: templates/summary-prompt.md
references:
  - name: api-docs
    path: references/api-docs.md
---

# File Read

Additional documentation about this skill.`;

		const result = parseFrontmatter(content);
		assert.ok(result);
		assert.equal(result.data.name, "file-read");
		assert.equal(result.data.description, "Read the contents of a file from the local filesystem.");

		const scripts = result.data.scripts as Array<Record<string, unknown>>;
		assert.equal(scripts.length, 1);
		assert.equal(scripts[0].name, "read");
		assert.equal(scripts[0].path, "scripts/read.sh");
		assert.equal(scripts[0].description, "Read a file at the given path and return its contents.");

		const params = scripts[0].parameters as Record<string, unknown>;
		assert.equal(params.type, "object");

		const props = params.properties as Record<string, unknown>;
		const filePath = props.file_path as Record<string, unknown>;
		assert.equal(filePath.type, "string");
		assert.equal(filePath.description, "Absolute path to the file to read");

		const required = params.required as string[];
		assert.deepEqual(required, ["file_path"]);

		const templates = result.data.templates as Array<Record<string, unknown>>;
		assert.equal(templates.length, 1);
		assert.equal(templates[0].name, "summary-prompt");

		const references = result.data.references as Array<Record<string, unknown>>;
		assert.equal(references.length, 1);
		assert.equal(references[0].name, "api-docs");

		assert.ok(result.body.includes("# File Read"));
	});

	it("should return null for content without frontmatter", () => {
		const result = parseFrontmatter("# Just markdown");
		assert.equal(result, null);
	});
});

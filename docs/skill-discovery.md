# Skill Discovery - Design Document

## Overview

Skills are the sole mechanism for exposing capabilities to the LLM. Every tool the agent can use — from reading files to searching the web — is defined as a skill. There are no hardcoded tools in the application.

A skill is a **folder** in the `packages/agent/skills/` directory. The folder name is the skill identifier. Each skill folder contains a `SKILL.md` file that defines the skill's metadata, and optionally contains scripts, templates, and reference files.

## Directory Structure

```
packages/agent/skills/
  file-read/
    SKILL.md
    scripts/
      read.sh
  file-write/
    SKILL.md
    scripts/
      write.sh
  shell-execute/
    SKILL.md
    scripts/
      exec.sh
  file-search-glob/
    SKILL.md
    scripts/
      glob.sh
  file-search-grep/
    SKILL.md
    scripts/
      grep.sh
  web-fetch/
    SKILL.md
    scripts/
      fetch.sh
  web-search/
    SKILL.md
    scripts/
      search.sh
  my-custom-skill/
    SKILL.md
    scripts/
      do-thing.js
    templates/
      prompt-template.md
    references/
      api-docs.md
```

## SKILL.md Format

Each skill is defined by a `SKILL.md` file at the root of its folder. The file uses YAML frontmatter for structured metadata, followed by freeform markdown content.

### Frontmatter Schema

```yaml
---
name: file-read                          # Required. Unique skill identifier (must match folder name)
description: >                           # Required. When to use this skill. This text is
  Read the contents of a file from the   # loaded into the LLM context so it knows when
  local filesystem. Use when you need    # to invoke this skill.
  to examine file contents, check
  configuration, or read source code.
scripts:                                 # Optional. List of executable scripts
  - name: read                           # Script name (used in tool call)
    path: scripts/read.sh                # Relative path from skill folder
    description: >                       # Description of what this script does
      Read a file at the given path
      and return its contents.
    parameters:                          # JSON Schema for script parameters
      type: object
      properties:
        file_path:
          type: string
          description: Absolute path to the file to read
      required:
        - file_path
templates:                               # Optional. Prompt templates loadable by the LLM
  - name: summary-prompt
    path: templates/summary-prompt.md
references:                              # Optional. Reference files loadable by the LLM
  - name: api-docs
    path: references/api-docs.md
---

# File Read

Additional documentation about this skill. This content is NOT loaded into context
at startup — it is available for the LLM to request dynamically if needed.
```

### Required Fields

| Field         | Type   | Description                                                      |
|---------------|--------|------------------------------------------------------------------|
| `name`        | string | Unique identifier. Must match the folder name.                   |
| `description` | string | When to use this skill. Loaded into LLM context at startup.      |

### Optional Fields

| Field        | Type  | Description                                                        |
|--------------|-------|--------------------------------------------------------------------|
| `scripts`    | array | Executable scripts the LLM can invoke as tool calls.               |
| `templates`  | array | Prompt templates the LLM can request to be loaded into context.    |
| `references` | array | Reference files the LLM can request to be loaded into context.     |

## How Skills Become Tools

At startup (and on hot-reload), the skill registry:

1. Scans the `packages/agent/skills/` directory for folders containing a `SKILL.md`
2. Parses the YAML frontmatter from each `SKILL.md`
3. Builds an **in-memory skill registry** with name + description for each skill
4. Converts each skill's `scripts` into OpenAI-format tool definitions

### Tool Definition Mapping

Each script in a skill becomes an OpenAI tool definition sent to the LLM:

```
Skill: file-read
Script: read (scripts/read.sh)

  ->  OpenAI tool:
      {
        "type": "function",
        "function": {
          "name": "file-read__read",
          "description": "Read a file at the given path and return its contents.",
          "parameters": {
            "type": "object",
            "properties": {
              "file_path": {
                "type": "string",
                "description": "Absolute path to the file to read"
              }
            },
            "required": ["file_path"]
          }
        }
      }
```

**Naming convention**: Tool names use `{skill-name}__{script-name}` to namespace scripts within their skill.

### What Goes Into LLM Context

This is the most critical design point. Local Agent is built for **local models with small context windows**. Traditional agent frameworks dump everything into every request. We do the opposite — load the minimum and let the LLM discover more as needed. This means more turns but each turn fits within constrained context limits.

**Loaded on every turn** (lightweight, always present):
1. **System prompt** — loaded from the configurable system prompt file
2. **Skill summaries** — for every loaded skill, just its `name` and `description` (a few tokens each)
3. **Tool definitions** — for every script across all loaded skills, the OpenAI tool definition

**NOT loaded by default** (available on demand via meta-tools):
- Templates
- Reference files
- The markdown body of `SKILL.md`

The LLM reads the skill summaries to understand what's available, then requests additional context (templates, references) only when it determines they're needed for the current task. This trades fewer tokens per turn for more round trips — the right tradeoff for local models.

## Dynamic Content Loading

The LLM can request additional skill content at runtime. The application provides two meta-capabilities for this (implemented as always-available tools, not skills):

### `load_skill_template`
- **Parameters**: `skill_name`, `template_name`
- **Returns**: The rendered content of the template file
- **Use case**: The LLM needs a prompt template to structure its response

### `load_skill_reference`
- **Parameters**: `skill_name`, `reference_name`
- **Returns**: The content of the reference file
- **Use case**: The LLM needs documentation or API specs to complete a task

These are the only non-skill tools in the system — they exist to bootstrap the skill system itself.

## Script Execution

When the LLM makes a tool call that maps to a skill script:

1. The backend resolves the tool name (`file-read__read`) to the skill (`file-read`) and script (`read`)
2. Locates the script file (`packages/agent/skills/file-read/scripts/read.sh`)
3. Passes parameters as **command-line arguments** (in the order defined in the `parameters.required` array, followed by any optional parameters that were provided)
4. Executes the script as a child process (bash for `.sh`, node for `.js`)
5. Captures **stdout** as the tool result (returned to the LLM)
6. Captures **stderr** for error reporting
7. Respects a configurable timeout (default: 30 seconds)

### Script Contract

Scripts must follow this contract:

- **Input**: Parameters are passed as command-line arguments (one argument per parameter, in the order defined in the schema)
- **Output**: Results are written to stdout (text or JSON)
- **Errors**: Non-zero exit code indicates failure; stderr is captured as the error message
- **Language**: Bash (`.sh`) or Node.js (`.js`) only
- **Permissions**: Scripts must be executable (`chmod +x`)

### Example Scripts

**Bash** (`packages/agent/skills/file-read/scripts/read.sh`):

```bash
#!/bin/bash
set -euo pipefail

file_path="$1"

if [ ! -f "$file_path" ]; then
  echo "Error: File not found: $file_path" >&2
  exit 1
fi

cat "$file_path"
```

**Node.js** (`packages/agent/skills/file-write/scripts/write.js`):

```js
#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const [filePath, content] = process.argv.slice(2);

writeFileSync(filePath, content, 'utf8');
console.log(`Wrote ${content.length} bytes to ${filePath}`);
```

## Hot Reloading

The application watches the `packages/agent/skills/` directory using Node.js `fs.watch` (recursive):

- **New skill folder added** — Skill is registered, tools added to the next LLM request
- **SKILL.md modified** — Skill metadata is re-parsed, registry updated
- **Script added/modified** — Tool definitions updated
- **Skill folder deleted** — Skill is unregistered, tools removed

Changes take effect on the **next LLM request** (not mid-stream). The file watcher debounces changes to avoid thrashing during bulk edits.

## Skill Registry (In-Memory)

The skill registry is a runtime data structure, not persisted to database:

```
SkillRegistry {
  skills: Map<string, Skill>        // keyed by skill name
  tools: Map<string, ToolMapping>   // keyed by tool name (skill__script)

  loadAll(): void                   // scan packages/agent/skills/ and populate
  loadSkill(folderName): void       // load/reload a single skill
  unloadSkill(name): void           // remove a skill
  getToolDefinitions(): Tool[]      // OpenAI-format tool array for LLM requests
  getSkillSummaries(): string       // formatted name+description for system context
  executeToolCall(name, params)     // resolve and execute a script
}
```

## Out of Scope for MVP

- Skill chaining or pipelines (one skill invoking another)
- Skill versioning
- Remote skill repositories
- Skill permissions / sandboxing beyond OS-level file permissions
- Skill dependencies (one skill requiring another)
- Parameterized templates (templates are loaded as-is, no variable substitution)
- Skill enable/disable via UI (can be done by adding/removing folders)

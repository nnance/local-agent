# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                          # Install all workspace dependencies
npm start                            # Production: build web + start agent on port 3000
npm test                             # Run all tests across workspaces
npm run lint                         # BiomeJS lint check
npm run lint:fix                     # Auto-fix lint issues
npm run dev -w packages/agent        # Agent in watch mode (auto-restarts)
npm run dev -w packages/web          # Vite dev server (proxies /api to agent:3000)
npm run build -w packages/web        # Production web build → packages/web/dist/
npx tsx --test packages/agent/test/router.test.ts  # Run a single test file
```

## Design Philosophy

- **Context-window conscious**: Every design decision optimizes for small context windows. Only skill names and descriptions are loaded per turn. Templates, reference files, and detailed docs are loaded progressively — the LLM discovers and requests what it needs. More turns, less context pressure.
- **Protocol-driven**: The OpenAI streaming messages API defines the contract. The LLM drives behavior; the application is a thin execution layer.
- **Everything is a skill**: No hardcoded built-in tools. All capabilities (file I/O, shell, search, web access) are skills. Default skills ship with the app but are architecturally identical to user-defined skills.
- **Minimal deterministic code**: The core application has only four responsibilities: serve the UI, communicate with the LLM, execute tool calls, and discover skills at runtime.

## Development Approach

- **Functional programming** — Pure functions, composition, immutable data. No classes. Use closures and higher-order functions for state.
- **Implement over install** — Write your own solution before reaching for a dependency. Dependencies are justified only for genuinely complex problems (React, Vite, better-sqlite3) — not for utilities or things achievable with a few lines of code.
- **Simple over robust** — Prefer straightforward, readable implementations even if they don't cover every edge case. A 20-line solution that handles the common path is better than a 200-line solution that handles everything.
- **Testing philosophy** — Focus tests on happy path and meaningful edge cases. Do not aim for full code coverage. Tests should validate that the thing works and catch the failures that matter.

## Architecture

Monorepo with two packages via npm workspaces:

- **`packages/agent`** — Always-on Node.js backend. REST API + SSE streaming, SQLite persistence, filesystem-based skill system, LLM integration via OpenAI-compatible API. Only production dependency is `better-sqlite3`. Uses `node:http` directly (no Express), `node:test` for testing, `tsx` for TypeScript execution.
- **`packages/web`** — React 19 SPA with Vite, Tailwind CSS 4, shadcn/ui. Consumes the agent REST API. In production, the agent serves the built static files from `packages/web/dist/`.

### Agent Source Layout

```
packages/agent/src/
  router.ts              # Custom HTTP router with :param extraction, CORS, fallback
  server.ts              # createAppServer() — wires router, db, registry, static serving
  static.ts              # Static file serving for production web build
  body.ts                # Request body parsing (readBody, parseJsonBody)
  db/                    # SQLite layer (better-sqlite3, WAL mode, foreign keys)
    init.ts              # Schema creation (sessions + messages tables)
    sessions.ts / messages.ts  # CRUD functions
  skills/                # Filesystem-based skill system
    registry.ts          # createSkillRegistry() — Maps, tool definitions, summaries
    executor.ts          # Script execution via child_process.spawn
    frontmatter.ts       # Hand-written YAML parser (no dependency)
    loader.ts            # Scan skills/ dir, parse SKILL.md files
    meta-tools.ts        # load_skill_template / load_skill_reference
    watcher.ts           # fs.watch hot-reload with debounce
  llm/                   # LLM integration
    client.ts            # streamChatCompletion() — fetch + SSE parsing
    conversation.ts      # runConversationLoop() — async generator yielding SSE events
    prompt.ts            # System prompt loading with {skill_summaries} placeholder
  routes/                # Route handler factories (accept db/registry, return handlers)
```

### Key Flows

**Conversation loop** (`llm/conversation.ts`): `runConversationLoop()` is an async generator. It loads messages from DB, prepends system prompt with skill summaries, streams LLM response, executes any tool calls via the skill registry, persists results, and loops back to the LLM (max 25 iterations). Yields typed SSE events: `content`, `tool_call`, `tool_result`, `done`, `error`.

**Skill system**: Skills are folders in `packages/agent/skills/` with a `SKILL.md` (YAML frontmatter). Tool names use `{skill-name}__{script-name}` format. Only names + descriptions go into LLM context per turn; templates and references are loaded on demand via meta-tools. Scripts execute as child processes (`.sh` → bash, `.js` → node).

**Route handler pattern**: Each route module exports a factory function (e.g., `createSessionHandlers(db)`) that closes over dependencies and returns handler functions. The server wires these into the router at startup.

## Code Conventions

- **Factory functions** — use `createRouter()`, `createSkillRegistry()`, `createAppServer()` pattern. No classes.
- **TypeScript strict mode** with `verbatimModuleSyntax` — use `import type` for type-only imports.
- **File extensions in imports** — always use `.ts` extension in relative imports (e.g., `"./router.ts"`).
- **Node built-in prefix** — always use `node:` prefix (`node:http`, `node:fs`, `node:path`, `node:crypto`).
- **ESM only** — `"type": "module"` in all package.json files.
- **BiomeJS formatting** — tabs, double quotes, semicolons, 100-char line width.
- **Immutable types** — use `readonly` on type properties.
- **Testing** — `node:test` with `node:assert/strict`. Tests use in-memory SQLite (`:memory:`) and mock HTTP objects.

## Environment Variables

Configured via `packages/agent/.env` (loaded with Node's `--env-file` flag):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `LLM_API_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible API |
| `LLM_API_KEY` | — | API key (if required) |
| `LLM_MODEL` | `llama3` | Model identifier |
| `SYSTEM_PROMPT_PATH` | `system-prompt.md` | System prompt file |
| `DB_PATH` | `./data/local-agent.db` | SQLite database path |

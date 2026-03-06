# Local Agent

A general-purpose LLM agent purpose-built for running with **local models**.

Existing agent frameworks are designed around SaaS models with large context windows — they pack the full chat history, all tool definitions, reference documents, and system instructions into every request. This works when you have 128k+ tokens to spare. It doesn't work with local models where context is scarce.

Local Agent takes a different approach: **minimize what goes into the context window on every turn**. Only skill names and descriptions are loaded at startup. Templates, reference files, and detailed documentation are loaded dynamically — only when the LLM asks for them. This means the agent takes more turns to complete a task (it has to discover context as it goes), but each turn stays within the limits of smaller models. The tradeoff is more round trips for less context pressure.

The backend is a minimal Node.js service with a filesystem-based skill system. The web app is a separate React SPA. Any OpenAI-compatible API works (Ollama, LM Studio, llama.cpp, or hosted providers).

## Quick Start

**Prerequisites**: Node.js v22+, an OpenAI-compatible LLM provider (Ollama, LM Studio, etc.)

```bash
# Clone and install
git clone <repo-url> && cd local-agent
npm install

# Configure your LLM provider
cp .env.example packages/agent/.env
# Edit packages/agent/.env with your settings

# Start the application (builds web UI + starts agent)
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `LLM_API_BASE_URL` | `http://localhost:11434` | OpenAI-compatible API base URL |
| `LLM_API_KEY` | — | API key (if required by your provider) |
| `LLM_MODEL` | `llama3` | Model identifier |
| `SYSTEM_PROMPT_PATH` | `system-prompt.md` | Path to the system prompt file |
| `DB_PATH` | `./data/local-agent.db` | SQLite database file path |

### Development

```bash
# Start the agent in watch mode (auto-restarts on changes)
npm run dev -w packages/agent

# Start the web dev server (proxies /api to the agent on port 3000)
npm run dev -w packages/web

# Run tests
npm test

# Lint
npm run lint
```

## Architecture

```
local-agent/
  packages/
    agent/             # Always-on Node.js service
      src/             # TypeScript source
      skills/          # Default skill definitions
      system-prompt.md # Default system prompt
    web/               # React SPA chat interface
      src/
      dist/            # Production build (served by agent)
  docs/                # Design documents
```

- **Agent** — Handles LLM communication, tool execution, session persistence, and skill discovery. Built on Node.js built-ins with minimal dependencies (only `better-sqlite3` for storage). No Express, no AI SDKs — raw `node:http` and `fetch`.
- **Web** — Chat UI that consumes the agent's REST API. Built with React, Vite, Tailwind CSS, and shadcn/ui. One of potentially many clients (CLI, Slack, Telegram could be added as sibling packages).
- **Skills** — All agent capabilities are defined as skills in `packages/agent/skills/`. Skills are folders with a `SKILL.md` and optional scripts. No hardcoded tools — add a folder to add a capability.

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `POST` | `/api/sessions/:id/messages` | Send a message (returns SSE stream) |
| `GET` | `/api/sessions/:id/messages` | Get message history |
| `GET` | `/api/skills` | List loaded skills |

### Streaming

`POST /api/sessions/:id/messages` returns a Server-Sent Events stream:

- `event: content` — text chunk from the assistant
- `event: tool_call` — tool call started (name + params)
- `event: tool_result` — tool call completed (result)
- `event: done` — stream complete
- `event: error` — error occurred

## Skills

All agent capabilities are exposed through the skill system. Each skill is a folder in `packages/agent/skills/` containing a `SKILL.md` with YAML frontmatter.

### Default Skills

| Skill | Description |
|-------|-------------|
| `file-read` | Read file contents from the local filesystem |
| `file-write` | Create or overwrite files |
| `shell-execute` | Run shell commands and return output |
| `file-search-glob` | Find files by pattern matching |
| `file-search-grep` | Search file contents by pattern |
| `web-fetch` | Retrieve content from a URL |
| `web-search` | Search the web and return results |

### Adding a Custom Skill

Create a folder in `packages/agent/skills/` with a `SKILL.md`:

```yaml
---
name: my-skill
description: >
  What this skill does and when to use it.
scripts:
  - name: run
    path: scripts/run.sh
    description: What this script does.
    parameters:
      type: object
      properties:
        input:
          type: string
          description: The input parameter
      required:
        - input
---
```

Add executable scripts in a `scripts/` subfolder. The skill is automatically detected and loaded — no restart needed.

See [docs/skill-discovery.md](docs/skill-discovery.md) for the full specification.

## Design Documents

- [Product Requirements](docs/product-requirements.md) — What we're building and why
- [Skill Discovery](docs/skill-discovery.md) — How the filesystem-based skill system works
- [Development Plan](docs/development-plan.md) — Phased build plan from scaffold to MVP

## License

MIT

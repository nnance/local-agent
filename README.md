# Local Agent

A general-purpose LLM agent purpose-built for running with **local models**.

Existing agent frameworks are designed around SaaS models with large context windows — they pack the full chat history, all tool definitions, reference documents, and system instructions into every request. This works when you have 128k+ tokens to spare. It doesn't work with local models where context is scarce.

Local Agent takes a different approach: **minimize what goes into the context window on every turn**. Only skill names and descriptions are loaded at startup. Templates, reference files, and detailed documentation are loaded dynamically — only when the LLM asks for them. This means the agent takes more turns to complete a task (it has to discover context as it goes), but each turn stays within the limits of smaller models. The tradeoff is more round trips for less context pressure.

The backend is a minimal Node.js service with a filesystem-based skill system. The web app is a separate React SPA. Any OpenAI-compatible API works (Ollama, LM Studio, llama.cpp, or hosted providers).

## Architecture

```
packages/
  agent/       # Always-on Node.js service (REST API + SSE streaming)
  web/         # React SPA chat interface
```

- **Agent** — Handles LLM communication, tool execution, session persistence, and skill discovery. Built on Node.js built-ins with minimal dependencies (only `better-sqlite3` for storage).
- **Web** — Chat UI that consumes the agent's REST API. One of potentially many clients (CLI, Slack, Telegram could be added as sibling packages).
- **Skills** — All agent capabilities (file I/O, shell, search, web access) are defined as skills in `packages/agent/skills/`. Skills are folders with a `SKILL.md` and optional scripts. No hardcoded tools — add a folder to add a capability. Only lightweight summaries are loaded into context; everything else is discovered on demand.

## Status

Pre-implementation. Product requirements and development plan are complete.

## Documentation

- [Product Requirements](docs/product-requirements.md) — What we're building and why
- [Skill Discovery](docs/skill-discovery.md) — How the filesystem-based skill system works
- [Development Plan](docs/development-plan.md) — Phased build plan from scaffold to MVP

## License

MIT

# Local Agent

A lightweight, general-purpose LLM agent with a chat interface. The backend is a minimal Node.js service that communicates with any OpenAI-compatible LLM API and exposes capabilities through a filesystem-based skill system. The web app is a separate React SPA that talks to the agent via REST API.

## Architecture

```
packages/
  agent/       # Always-on Node.js service (REST API + SSE streaming)
  web/         # React SPA chat interface
```

- **Agent** — Handles LLM communication, tool execution, session persistence, and skill discovery. Built on Node.js built-ins with minimal dependencies (only `better-sqlite3` for storage).
- **Web** — Chat UI that consumes the agent's REST API. One of potentially many clients (CLI, Slack, Telegram could be added as sibling packages).
- **Skills** — All agent capabilities (file I/O, shell, search, web access) are defined as skills in `packages/agent/skills/`. Skills are folders with a `SKILL.md` and optional scripts. No hardcoded tools — add a folder to add a capability.

## Status

Pre-implementation. Product requirements and development plan are complete.

## Documentation

- [Product Requirements](docs/product-requirements.md) — What we're building and why
- [Skill Discovery](docs/skill-discovery.md) — How the filesystem-based skill system works
- [Development Plan](docs/development-plan.md) — Phased build plan from scaffold to MVP

## License

MIT

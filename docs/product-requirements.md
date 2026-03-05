# Local Agent - Product Requirements Document

## Overview

A lightweight web application that provides a chat interface for interacting with an LLM-powered agent. The application uses the **OpenAI streaming messages API** as the communication protocol between the front end and the LLM, keeping the backend minimal and largely built on Node.js built-in capabilities. The agent is **general purpose** — it can assist with any task the user describes, not limited to computer operation.

## Design Philosophy

- **Minimal dependencies**: Use Node.js built-in modules (HTTP server, filesystem, path, crypto, etc.) wherever possible. Dependencies are acceptable for front-end components but should be minimized on the backend.
- **Minimal deterministic code**: The core application has only four responsibilities:
  1. **Front-end interaction** — Serve the UI and handle user input/output
  2. **LLM communication** — Implement the OpenAI streaming messages API to send/receive messages
  3. **Tool calling** — Execute tool calls returned by the LLM and return results
  4. **Progressive skill discovery** — Dynamically discover and register capabilities at runtime
- **Protocol-driven**: The OpenAI streaming messages API defines the contract between front end and backend. The LLM drives behavior; the application is a thin execution layer.
- **Everything is a skill**: There are no hardcoded "built-in tools." All capabilities — file I/O, shell execution, search, web access — are exposed as skills. A default skill set ships with the application, but the architecture treats them identically to user-defined skills.

## Target Audience

**Primary User**: Personal use - the developer/owner of the local machine

**Key Needs**:
- A general-purpose agent for any task expressible in natural language
- Autonomous task execution without manual intervention
- Persistent session history for reference and context continuity
- Simple, distraction-free interface for agent interaction

## Core Features

### 1. Chat Interface
- Clean, minimal chat UI for natural language communication
- Send messages to the LLM and receive responses
- Real-time message streaming via the OpenAI streaming messages API (SSE)
- Conversation thread display with message history

### 2. Tool Calling via Skills
- The LLM requests tool calls; the backend executes them and returns results
- **All tools are provided by skills** — there are no hardcoded built-in tools
- Tool results are streamed back to the LLM for continued reasoning
- The tool call loop (LLM -> tool execution -> result -> LLM) is the only built-in behavior

### 3. Progressive Skill Discovery
- Skills are the sole mechanism for exposing capabilities to the LLM
- Each skill is a folder in the `packages/agent/skills/` directory with a `SKILL.md` file at its root
- Only the **name** and **description** from each skill's frontmatter are loaded into LLM context at startup
- The skills directory is watched for changes and hot-reloaded at runtime
- Skills can contain **scripts** (executable by the LLM), **templates**, and **reference files** (dynamically loadable by the LLM)
- No skill chaining or pipelines in MVP
- **Detailed skill discovery design**: see [`docs/skill-discovery.md`](./skill-discovery.md)

### 4. Default Skill Set
The following skills ship with the application in the `packages/agent/skills/` directory:
- **file-read** — Read file contents from the local filesystem
- **file-write** — Create or overwrite files
- **shell-execute** — Run shell commands and return output
- **file-search-glob** — Find files by pattern matching
- **file-search-grep** — Search file contents by pattern
- **web-fetch** — Retrieve content from a URL
- **web-search** — Search the web and return results

### 5. Session Persistence
- Store complete conversation history across sessions
- Persist session metadata (start time, status, etc.)
- Resume previous conversations with full context

## Tech Stack

### Monorepo
- **Workspace**: Node.js workspaces (no Lerna, Turborepo, or Nx)
- **Code Quality**: BiomeJS for linting and formatting (shared config at root)

### `packages/agent` (Minimal Dependencies)
- **Runtime**: Node.js (use built-in modules wherever possible)
- **HTTP Server**: Node.js built-in `http` module
- **API Protocol**: REST + SSE for clients; OpenAI streaming messages API for LLM
- **LLM Provider**: Any OpenAI-compatible API (Anthropic, OpenAI, OpenRouter, Ollama, etc.)
- **Database**: SQLite (via `better-sqlite3`)
- **Environment**: Node.js built-in `--env-file` flag for .env loading
- **Testing**: Node.js built-in test runner (`node:test`)
- **Process**: Runs as an always-on background service

### `packages/web` (Dependencies Acceptable)
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components

### What We Are NOT Using
- No full-stack framework (no Next.js, no Remix)
- No Vercel AI SDK or AI Elements
- No AI/Agent SDK of any kind — we implement the OpenAI streaming messages API directly
- No ORM — raw SQL with `better-sqlite3`
- No Express, Fastify, or other HTTP framework — use Node built-in `http`
- No monorepo tooling beyond Node.js workspaces

## Architecture

### Monorepo Structure

The project is a monorepo with two independent packages. The **agent** is a standalone, always-on service. The **web app** is one of potentially many clients that communicate with the agent via REST API. This separation exists so that future clients (Slack bot, Telegram bot, CLI) can be added as sibling packages without modifying the agent.

```
local-agent/
  packages/
    agent/             # Backend — always-on service
      src/
      skills/
      package.json
    web/               # Frontend — React SPA
      src/
      package.json
  package.json         # Workspace root
```

### Agent (Backend Service)

The agent is a long-running Node.js process that exposes a REST API. It owns all LLM communication, skill execution, and data persistence. Clients never talk to the LLM directly.

**Responsibilities**:
- REST API for client communication (sessions, messages, streaming)
- LLM communication via OpenAI streaming messages API
- Tool call execution (skill scripts)
- Skill registry and hot-reload
- System prompt loading
- SQLite database operations
- SSE streaming of responses to clients

**Key design rule**: The agent has no knowledge of any specific client. It exposes a generic REST API that any client can consume.

### Web App (Frontend Client)

The web app is a standalone React SPA that talks to the agent's REST API. It could be replaced or run alongside other clients.

**Responsibilities**:
- Chat UI (message display, input, streaming)
- Session/history viewer
- SSE client for streaming agent responses
- No direct LLM communication — all goes through the agent API

### REST API Contract

The agent exposes the following API (consumed by any client):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `POST` | `/api/sessions/:id/messages` | Send a message (returns SSE stream) |
| `GET` | `/api/sessions/:id/messages` | Get message history |
| `GET` | `/api/skills` | List loaded skills |

The `POST /api/sessions/:id/messages` endpoint is the primary interaction point. The client sends a user message and receives an SSE stream of the agent's response (including intermediate tool call activity).

### LLM Integration

- Implements the OpenAI streaming messages API format
- Sends messages + tool definitions (derived from loaded skills) to the LLM
- Parses streaming responses (SSE chunks)
- Handles tool_call responses by executing the corresponding skill and continuing the conversation loop
- Provider-agnostic: works with any API that follows the OpenAI chat completions format

### Communication Flow

```
Client (Web/Slack/CLI) -> Agent REST API -> OpenAI-compatible LLM API
                               |                      |
                          SQLite DB           Skill Execution
                                                    |
                                           Skill Registry / Discovery
```

### Streaming Flow

```
1. Client sends user message to POST /api/sessions/:id/messages
2. Agent persists user message to DB
3. Agent builds messages array + tool definitions from skill registry
4. Agent streams request to LLM API (SSE)
5. Agent forwards SSE chunks to client in real-time
6. If LLM returns tool_call:
   a. Agent executes the skill script
   b. Agent appends tool result to messages
   c. Agent sends another request to LLM (goto step 4)
7. Final assistant message streamed to client and persisted to DB
```

## Data Model

### Sessions Table
- `id`: Primary key (UUID)
- `created_at`: Session start time
- `updated_at`: Last activity timestamp
- `status`: 'active' | 'completed' | 'archived'
- `title`: Optional session title/summary

### Messages Table
- `id`: Primary key (UUID)
- `session_id`: Foreign key to sessions
- `role`: 'user' | 'assistant' | 'tool' | 'system'
- `content`: Message text (or JSON for tool calls/results)
- `tool_call_id`: Optional, links tool results to tool calls
- `timestamp`: Creation timestamp
- `metadata`: JSON field for additional data

### Skills (Filesystem-based, not in database)
Skills are defined entirely on the filesystem in the `packages/agent/skills/` directory. No database table is needed. The skill registry is built in-memory at startup by scanning the directory, and kept current via file watching. See [`docs/skill-discovery.md`](./skill-discovery.md) for the full specification.

## OpenAI Streaming Messages API

The backend implements the OpenAI chat completions format as the protocol between all layers:

### Request Format (to LLM)
```json
{
  "model": "<configured-model-id>",
  "stream": true,
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "...", "tool_calls": [...]},
    {"role": "tool", "tool_call_id": "...", "content": "..."}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read the contents of a file",
        "parameters": { "type": "object", "properties": {...} }
      }
    }
  ]
}
```

### Streaming Response (SSE)
```
data: {"choices":[{"delta":{"role":"assistant","content":"Hello"}}]}
data: {"choices":[{"delta":{"tool_calls":[{"id":"call_1","function":{"name":"read_file","arguments":"{..."}}]}}]}
data: [DONE]
```

## Configuration

### Environment Variables (`.env`)
- `LLM_API_KEY` — API key for the LLM provider
- `LLM_API_BASE_URL` — Base URL for the OpenAI-compatible API (e.g., `https://api.anthropic.com/v1`, `https://api.openai.com/v1`, `http://localhost:11434/v1`)
- `LLM_MODEL` — Model identifier (e.g., `claude-sonnet-4-20250514`, `gpt-4o`, `llama3`)
- `PORT` — Server port (default: 3000)

### System Prompt
- The system prompt is loaded from a configurable file (e.g., `system-prompt.md`)
- Path is configurable via environment variable (`SYSTEM_PROMPT_PATH`)
- A sensible default system prompt ships with the application
- The system prompt is sent as the first message in every LLM request

## UI/UX Requirements

### Design Approach
- Clean, minimal interface inspired by modern chat applications
- Focus on conversation with minimal distractions
- Responsive design (though primarily desktop-focused for local use)

### Key Components
- **Chat Container**: Main conversation view with auto-scroll
- **Message Input**: Text area with send button, support for multi-line input
- **Message Bubbles**: Distinct styling for user vs assistant messages
- **Session Sidebar** (optional): Access to conversation history
- **Loading States**: Indicators when agent is processing/working
- **Tool Activity**: Collapsible display of tool calls being executed (for transparency)

### User Experience
- Immediate message sending (optimistic UI updates)
- Streaming responses for real-time feedback
- Clear indication when agent is working on tool calls
- Easy navigation between current and historical sessions

## Security Considerations

### Authentication
- **MVP Phase**: No authentication required
- Application runs locally on trusted machine
- Access limited to localhost

### Data Protection
- All data stored locally in SQLite database
- No external data transmission beyond LLM API calls
- API keys stored in environment variables (loaded via `--env-file`)

### Tool Execution Safety
- Tools execute on the local machine — the user accepts this risk for MVP
- Future: confirmation prompts for destructive operations

## Constraints & Assumptions

### Technical Constraints
- Must run on macOS (primary development and hosting platform)
- Local hosting only (no cloud deployment for MVP)
- SQLite database (sufficient for single-user, local use)
- Backend should have minimal dependencies beyond Node.js built-ins

### Assumptions
- User has a valid API key for an OpenAI-compatible LLM provider (or a local model)
- Sufficient API credits for operations (if using a hosted provider)
- Node.js (v22+) installed on local machine
- User comfortable with command-line setup

### Development Approach
- **Functional programming** — Prefer pure functions, composition, and immutable data. Avoid classes and OOP patterns. Use closures and higher-order functions for state when needed.
- **Implement over install** — Write your own solution before reaching for a dependency. Dependencies are justified only for genuinely complex problems (React, Vite, better-sqlite3) — not for utilities, helpers, or things achievable with a few lines of code.
- **Simple over robust** — Prefer straightforward, readable implementations even if they don't cover every edge case. A 20-line solution that handles the common path is better than a 200-line solution that handles everything.
- **Testing philosophy** — Focus tests on happy path and meaningful edge cases. Do not aim for full code coverage. Tests should validate that the thing works and catch the failures that matter, not exhaustively cover every branch.
- Use TypeScript for type safety
- Maintain code quality with BiomeJS
- Write tests using Node built-in test runner (`node:test`)
- Version control with Git

## Success Criteria

The MVP is considered complete when the following criteria are met:

### 1. Functional Chat Interface
- [ ] User can access web UI via browser (localhost)
- [ ] User can type and send messages
- [ ] LLM responses are displayed in real-time with streaming (SSE)
- [ ] Conversation history is visible in the UI

### 2. Skill-Based Tool Calling
- [ ] LLM can request tool calls and receive results
- [ ] All default skills work end-to-end (file read/write, shell, glob, grep, web fetch/search)
- [ ] Tool call loop works (LLM calls skill -> result -> LLM continues)
- [ ] Tool/skill activity is visible in the UI

### 3. Progressive Skill Discovery
- [ ] Adding a folder with a `SKILL.md` to `packages/agent/skills/` registers a new skill (no code changes)
- [ ] Agent can discover and use registered skills
- [ ] Default skill set loads automatically on startup
- [ ] Skills hot-reload when files change (file watcher)

### 4. Session Persistence
- [ ] Conversations are saved to SQLite database
- [ ] User can view previous conversation history
- [ ] Sessions maintain context across page refreshes

### 5. Architecture & Minimal Dependencies
- [ ] Monorepo with `packages/agent` and `packages/web` as independent packages
- [ ] Agent runs as an always-on service with a REST API
- [ ] Web app communicates with agent exclusively via REST API (no shared code at runtime)
- [ ] Agent uses Node.js built-in HTTP server (no Express/Fastify)
- [ ] Agent has no dependency on AI SDKs (implements OpenAI API directly)
- [ ] Total agent `node_modules` footprint is minimal
- [ ] Web dependencies are limited to React, Vite, Tailwind, and shadcn/ui

### 6. User Experience
- [ ] UI is clean, minimal, and easy to use
- [ ] No crashes or critical errors during normal operation
- [ ] Loading states and feedback are clear
- [ ] Application starts and runs reliably on macOS

## Out of Scope for MVP

- Multi-user support
- Authentication/authorization
- Remote access from outside localhost
- File upload/download UI
- Advanced task scheduling
- Mobile responsive design
- Real-time collaboration features
- Analytics or monitoring dashboards
- Database backup/export features
- Custom agent personality/behavior configuration
- Conversation context window management (truncation/summarization for long conversations)
- Multi-provider switching within a single session

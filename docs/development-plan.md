# Development Plan

Phased plan for building the Local Agent MVP. Each phase produces a working, testable increment. Later phases build on earlier ones but each phase should be fully complete before moving to the next.

---

## Phase 1: Project Scaffold & Agent HTTP Server

**Goal**: Monorepo structure with a running agent service that responds to REST requests. No LLM, no skills — just the skeleton.

### Tasks
1. Initialize monorepo with Node.js workspaces (`package.json` at root)
2. Create `packages/agent` with TypeScript, `--env-file` support
3. Set up BiomeJS at the root for linting/formatting
4. Implement HTTP server using Node built-in `http` module
5. Implement a minimal router (functional, no framework) for REST endpoints
6. Stub out REST API endpoints (return empty/mock responses):
   - `POST /api/sessions` — returns a new session ID
   - `GET /api/sessions` — returns empty list
   - `GET /api/sessions/:id` — returns mock session
   - `POST /api/sessions/:id/messages` — returns mock SSE stream
   - `GET /api/sessions/:id/messages` — returns empty list
   - `GET /api/skills` — returns empty list
7. Add health check endpoint (`GET /api/health`)
8. Write tests for router and endpoint stubs

### Acceptance Criteria
- [ ] `npm install` at root installs all workspace dependencies
- [ ] `npm run dev -w packages/agent` starts the agent on configured port
- [ ] All stubbed endpoints return correct status codes and content types
- [ ] SSE stub endpoint returns `Content-Type: text/event-stream` and sends a test event
- [ ] BiomeJS lint passes with no errors
- [ ] Tests pass via `node --test`

---

## Phase 2: Database & Session Persistence

**Goal**: SQLite database with sessions and messages tables. REST endpoints read/write real data.

### Tasks
1. Add `better-sqlite3` dependency to `packages/agent`
2. Create database initialization module (create tables if not exist)
3. Implement data access functions (functional, not ORM):
   - `createSession()` → Session
   - `getSession(id)` → Session | null
   - `listSessions()` → Session[]
   - `createMessage(sessionId, role, content, metadata?)` → Message
   - `getMessages(sessionId)` → Message[]
4. Wire real data into REST endpoints (replace stubs from Phase 1)
5. Write tests for data access functions

### Acceptance Criteria
- [ ] SQLite database file created on first startup
- [ ] `POST /api/sessions` creates a session in the database
- [ ] `GET /api/sessions` returns persisted sessions
- [ ] `POST /api/sessions/:id/messages` persists the user message
- [ ] `GET /api/sessions/:id/messages` returns persisted messages
- [ ] Sessions and messages survive agent restart
- [ ] Tests pass via `node --test`

---

## Phase 3: Skill System

**Goal**: Skill registry that loads skills from the filesystem, converts them to OpenAI tool definitions, and hot-reloads on changes.

### Tasks
1. Implement YAML frontmatter parser for `SKILL.md` files (simple, no dependency — parse the `---` delimited block and handle basic YAML)
2. Implement skill loader — scan `packages/agent/skills/` for folders with `SKILL.md`
3. Implement skill registry (in-memory Map):
   - `loadAll()` — scan and populate
   - `loadSkill(folderName)` — load/reload single skill
   - `unloadSkill(name)` — remove
   - `getToolDefinitions()` — return OpenAI-format tool array
   - `getSkillSummaries()` — return formatted name+description text
4. Implement tool name mapping (`{skill-name}__{script-name}`)
5. Implement script executor:
   - Resolve tool name to skill + script
   - Execute `.sh` with bash, `.js` with node
   - Pass parameters as CLI arguments
   - Capture stdout/stderr, enforce timeout
6. Implement `load_skill_template` and `load_skill_reference` meta-tools
7. Implement file watcher (`fs.watch` recursive) with debounce for hot-reload
8. Create the 7 default skills with `SKILL.md` and scripts:
   - `file-read`, `file-write`, `shell-execute`
   - `file-search-glob`, `file-search-grep`
   - `web-fetch`, `web-search`
9. Wire `GET /api/skills` to return loaded skills from registry
10. Write tests for frontmatter parser, skill loader, script executor

### Acceptance Criteria
- [ ] Default skills load on startup with correct name/description
- [ ] `getToolDefinitions()` returns valid OpenAI-format tool array
- [ ] Each default skill's script executes and returns expected output
- [ ] Adding a new skill folder with `SKILL.md` is detected and loaded (hot-reload)
- [ ] Modifying a `SKILL.md` triggers re-parse
- [ ] Removing a skill folder unloads the skill
- [ ] `GET /api/skills` returns all loaded skills
- [ ] Meta-tools load templates and references correctly
- [ ] Tests pass via `node --test`

---

## Phase 4: LLM Integration & Tool Call Loop

**Goal**: Agent sends messages to an OpenAI-compatible LLM API, streams responses back, and executes tool calls in a loop.

### Tasks
1. Implement LLM client module (using Node built-in `fetch`):
   - Build request body (messages, tools, model, stream: true)
   - Send POST to `LLM_API_BASE_URL/chat/completions`
   - Parse SSE response stream chunk by chunk
2. Implement system prompt loader (read from `SYSTEM_PROMPT_PATH` file)
3. Implement the conversation loop (context-minimized):
   - Load session messages from DB
   - Prepend system prompt + lightweight skill summaries (name + description only)
   - Attach tool definitions from skill registry (scripts + meta-tools only, no templates/references)
   - Do NOT load full skill docs, templates, or references into context — these are loaded on demand when the LLM calls `load_skill_template` or `load_skill_reference`
   - Stream LLM response
   - If response contains `tool_calls`: execute via skill registry, append results, loop
   - If response is final text: persist assistant message, end stream
4. Wire `POST /api/sessions/:id/messages` to:
   - Persist user message to DB
   - Run conversation loop
   - Stream SSE events to the client (content chunks, tool call activity, done)
5. Define SSE event format for client consumption:
   - `event: content` — text chunk from assistant
   - `event: tool_call` — tool call started (name, params)
   - `event: tool_result` — tool call completed (result summary)
   - `event: done` — stream complete
   - `event: error` — error occurred
6. Create a default `system-prompt.md`
7. Write tests for LLM client (mock HTTP), conversation loop logic

### Acceptance Criteria
- [ ] Agent sends well-formed requests to the configured LLM API
- [ ] Streaming responses are parsed and forwarded as SSE events
- [ ] Tool calls trigger skill script execution
- [ ] Tool results are sent back to the LLM for continued reasoning
- [ ] Multi-step tool call loops work (LLM calls tool A, then tool B, then responds)
- [ ] Assistant messages are persisted to DB after completion
- [ ] System prompt is loaded from configurable file
- [ ] Context per turn is minimal: system prompt + skill summaries + tool defs + messages (no templates/references unless requested)
- [ ] `load_skill_template` and `load_skill_reference` meta-tools work within the conversation loop
- [ ] Errors (LLM unreachable, invalid API key, script timeout) produce `event: error`
- [ ] Tests pass via `node --test`

---

## Phase 5: Web App

**Goal**: React SPA that provides a chat interface consuming the agent's REST API.

### Tasks
1. Initialize `packages/web` with Vite + React + TypeScript
2. Set up Tailwind CSS and shadcn/ui
3. Implement API client module (fetch-based, talks to agent REST API)
4. Implement SSE client for streaming responses
5. Build chat components:
   - `ChatContainer` — main conversation view with auto-scroll
   - `MessageInput` — text area with send button, multi-line support (Shift+Enter)
   - `MessageBubble` — distinct styling for user vs assistant
   - `ToolActivity` — collapsible display of tool calls in progress
   - `LoadingIndicator` — shown while agent is processing
6. Build session management:
   - `SessionSidebar` — list of sessions, create new, switch between
   - Load message history when switching sessions
7. Wire streaming: on send, POST message and consume SSE stream to render assistant response incrementally
8. Add Vite proxy config for development (proxy `/api` to agent)
9. Add production build that outputs static files the agent can serve

### Acceptance Criteria
- [ ] `npm run dev -w packages/web` starts the web app
- [ ] User can create a new session
- [ ] User can type and send a message
- [ ] Assistant response streams in real-time (character by character)
- [ ] Tool call activity is displayed (collapsible)
- [ ] User can switch between sessions in the sidebar
- [ ] Message history loads when switching sessions
- [ ] UI is clean and minimal
- [ ] Works end-to-end with the agent running locally

---

## Phase 6: Integration & Polish

**Goal**: Everything works together. Rough edges smoothed. Ready for daily use.

### Tasks
1. Agent serves the built web app's static files (production mode)
2. Add startup script at monorepo root (`npm start` runs the agent which serves both API and web UI)
3. Add CORS handling for development mode (web dev server on different port)
4. Test full conversation flows end-to-end:
   - Simple Q&A (no tool calls)
   - Single tool call (e.g., read a file)
   - Multi-step tool call chain (e.g., search for files, read one, summarize)
   - Error recovery (bad tool call, script timeout)
5. Handle edge cases:
   - Empty messages
   - Very long responses
   - Concurrent requests to the same session
   - Agent restart with existing sessions
6. Add graceful shutdown (close DB, stop file watcher)
7. Write a README with setup and usage instructions
8. Final lint pass and test run

### Acceptance Criteria
- [ ] Single command (`npm start`) launches the full application
- [ ] Web UI accessible at `http://localhost:3000`
- [ ] All end-to-end conversation flows work
- [ ] Agent survives restarts without data loss
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] README covers setup (env vars, API key) and usage
- [ ] All tests pass
- [ ] BiomeJS lint passes with no errors
- [ ] All PRD success criteria are met

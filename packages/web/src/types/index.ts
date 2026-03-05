export type SessionStatus = "active" | "completed" | "archived";

export type Session = {
	readonly id: string;
	readonly created_at: string;
	readonly updated_at: string;
	readonly status: SessionStatus;
	readonly title: string | null;
};

export type MessageRole = "user" | "assistant" | "tool" | "system";

export type Message = {
	readonly id: string;
	readonly session_id: string;
	readonly role: MessageRole;
	readonly content: string;
	readonly tool_call_id: string | null;
	readonly timestamp: string;
	readonly metadata: string | null;
};

export type Skill = {
	readonly name: string;
	readonly description: string;
};

// SSE event types from the backend
export type SseMessageSavedEvent = {
	readonly type: "message_saved";
	readonly id: string;
	readonly session_id: string;
};

export type SseContentEvent = {
	readonly type: "content";
	readonly text: string;
};

export type SseToolCallEvent = {
	readonly type: "tool_call";
	readonly id: string;
	readonly name: string;
	readonly params: Record<string, unknown>;
};

export type SseToolResultEvent = {
	readonly type: "tool_result";
	readonly id: string;
	readonly result: string;
};

export type SseErrorEvent = {
	readonly type: "error";
	readonly message: string;
};

export type SseDoneEvent = {
	readonly type: "done";
};

export type SseEvent =
	| SseMessageSavedEvent
	| SseContentEvent
	| SseToolCallEvent
	| SseToolResultEvent
	| SseErrorEvent
	| SseDoneEvent;

// Tool activity tracking for the UI
export type ToolActivity = {
	readonly id: string;
	readonly name: string;
	readonly params: Record<string, unknown>;
	readonly result?: string;
	readonly status: "running" | "completed";
};

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

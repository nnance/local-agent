import type { Message, Session } from "@/types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
	}
	return res.json() as Promise<T>;
}

export async function createSession(title?: string): Promise<Session> {
	return request<Session>("/sessions", {
		method: "POST",
		body: JSON.stringify({ title }),
	});
}

export async function listSessions(): Promise<Session[]> {
	const data = await request<{ sessions: Session[] }>("/sessions");
	return data.sessions;
}

export async function getSession(id: string): Promise<Session> {
	return request<Session>(`/sessions/${id}`);
}

export async function getMessages(sessionId: string): Promise<Message[]> {
	const data = await request<{ messages: Message[] }>(`/sessions/${sessionId}/messages`);
	return data.messages;
}

/**
 * Sends a message and returns the raw Response for SSE streaming.
 * The caller is responsible for consuming the stream via the SSE client.
 */
export async function sendMessage(sessionId: string, content: string): Promise<Response> {
	const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
	}
	return res;
}

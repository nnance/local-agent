import * as api from "@/lib/api";
import type { Session } from "@/types";
import { useCallback, useEffect, useState } from "react";

export function useSessions() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadSessions = useCallback(async () => {
		try {
			setLoading(true);
			const list = await api.listSessions();
			setSessions(list);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load sessions");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	const createSession = useCallback(async (title?: string) => {
		try {
			const session = await api.createSession(title);
			setSessions((prev) => [session, ...prev]);
			setActiveSessionId(session.id);
			return session;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create session");
			return null;
		}
	}, []);

	const switchSession = useCallback((id: string) => {
		setActiveSessionId(id);
	}, []);

	return {
		sessions,
		activeSessionId,
		loading,
		error,
		createSession,
		switchSession,
		refreshSessions: loadSessions,
	};
}

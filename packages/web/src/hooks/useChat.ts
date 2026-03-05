import * as api from "@/lib/api";
import { parseSseStream } from "@/lib/sse";
import type { Message, ToolActivity } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export function useChat(sessionId: string | null) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [streamingContent, setStreamingContent] = useState("");
	const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// Load message history when session changes
	useEffect(() => {
		if (!sessionId) {
			setMessages([]);
			setStreamingContent("");
			setToolActivities([]);
			setError(null);
			return;
		}

		let cancelled = false;

		async function loadMessages(sid: string) {
			try {
				const history = await api.getMessages(sid);
				if (!cancelled) {
					setMessages(history);
					setStreamingContent("");
					setToolActivities([]);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load messages");
				}
			}
		}

		loadMessages(sessionId);
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	const sendMessage = useCallback(
		async (content: string) => {
			if (!sessionId || !content.trim() || isLoading) return;

			// Optimistically add user message
			const optimisticUserMessage: Message = {
				id: `temp-${Date.now()}`,
				session_id: sessionId,
				role: "user",
				content: content.trim(),
				tool_call_id: null,
				timestamp: new Date().toISOString(),
				metadata: null,
			};

			setMessages((prev) => [...prev, optimisticUserMessage]);
			setIsLoading(true);
			setStreamingContent("");
			setToolActivities([]);
			setError(null);

			try {
				const response = await api.sendMessage(sessionId, content.trim());
				let accumulatedContent = "";

				for await (const event of parseSseStream(response)) {
					switch (event.type) {
						case "message_saved":
							// Replace optimistic message with real one
							setMessages((prev) =>
								prev.map((m) => (m.id === optimisticUserMessage.id ? { ...m, id: event.id } : m)),
							);
							break;

						case "content":
							accumulatedContent += event.text;
							setStreamingContent(accumulatedContent);
							break;

						case "tool_call":
							setToolActivities((prev) => [
								...prev,
								{
									id: event.id,
									name: event.name,
									params: event.params,
									status: "running",
								},
							]);
							break;

						case "tool_result":
							setToolActivities((prev) =>
								prev.map((t) =>
									t.id === event.id ? { ...t, result: event.result, status: "completed" } : t,
								),
							);
							break;

						case "error":
							setError(event.message);
							break;

						case "done": {
							// Finalize: add the assistant message to history
							if (accumulatedContent) {
								const assistantMessage: Message = {
									id: `assistant-${Date.now()}`,
									session_id: sessionId,
									role: "assistant",
									content: accumulatedContent,
									tool_call_id: null,
									timestamp: new Date().toISOString(),
									metadata: null,
								};
								setMessages((prev) => [...prev, assistantMessage]);
							}
							setStreamingContent("");
							break;
						}
					}
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send message");
			} finally {
				setIsLoading(false);
			}
		},
		[sessionId, isLoading],
	);

	const cancelStream = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	return {
		messages,
		streamingContent,
		toolActivities,
		isLoading,
		error,
		sendMessage,
		cancelStream,
	};
}

import type { SseEvent } from "@/types";

/**
 * Parses an SSE stream from a fetch Response and yields SseEvent objects.
 * Handles the `event:` and `data:` fields of the SSE protocol.
 */
export async function* parseSseStream(response: Response): AsyncGenerator<SseEvent> {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Response body is not readable");
	}

	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");

			// Keep the last part as it may be incomplete
			buffer = parts.pop() ?? "";

			for (const part of parts) {
				const event = parseSseBlock(part);
				if (event) {
					yield event;
				}
			}
		}

		// Process any remaining buffer
		if (buffer.trim()) {
			const event = parseSseBlock(buffer);
			if (event) {
				yield event;
			}
		}
	} finally {
		reader.releaseLock();
	}
}

function parseSseBlock(block: string): SseEvent | null {
	let eventType = "";
	let data = "";

	for (const line of block.split("\n")) {
		if (line.startsWith("event: ")) {
			eventType = line.slice(7).trim();
		} else if (line.startsWith("data: ")) {
			data = line.slice(6);
		}
	}

	if (!eventType || !data) return null;

	try {
		const parsed = JSON.parse(data) as Record<string, unknown>;

		switch (eventType) {
			case "message_saved":
				return {
					type: "message_saved",
					id: parsed.id as string,
					session_id: parsed.session_id as string,
				};
			case "content":
				return { type: "content", text: parsed.text as string };
			case "tool_call":
				return {
					type: "tool_call",
					id: parsed.id as string,
					name: parsed.name as string,
					params: parsed.params as Record<string, unknown>,
				};
			case "tool_result":
				return {
					type: "tool_result",
					id: parsed.id as string,
					result: parsed.result as string,
				};
			case "error":
				return { type: "error", message: parsed.message as string };
			case "done":
				return { type: "done" };
			default:
				return null;
		}
	} catch {
		return null;
	}
}

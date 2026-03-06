import type { Message } from "@/types";

type MessageBubbleProps = {
	readonly message: Message;
};

/**
 * Renders simple markdown-like formatting:
 * - Code blocks (```)
 * - Inline code (`)
 * - Bold (**)
 * - Line breaks
 */
function renderContent(content: string) {
	// Split on code blocks first
	const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
	const parts: Array<{ type: "text" | "code"; lang?: string; value: string }> = [];
	let lastIndex = 0;

	let match = codeBlockRegex.exec(content);
	while (match !== null) {
		if (match.index > lastIndex) {
			parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
		}
		parts.push({ type: "code", lang: match[1], value: match[2] });
		lastIndex = match.index + match[0].length;
		match = codeBlockRegex.exec(content);
	}
	if (lastIndex < content.length) {
		parts.push({ type: "text", value: content.slice(lastIndex) });
	}

	return parts.map((part) => {
		const key = `${part.type}-${part.value.slice(0, 32)}`;
		if (part.type === "code") {
			return (
				<pre key={key} className="my-2 overflow-x-auto rounded-md bg-zinc-700 p-3 text-sm">
					<code>{part.value}</code>
				</pre>
			);
		}

		// Process inline formatting for text parts
		return <span key={key}>{renderLines(part.value)}</span>;
	});
}

function renderLines(text: string) {
	const lines = text.split("\n");
	return lines.map((line, lineIdx) => {
		const key = `line-${lineIdx}-${line.slice(0, 20)}`;
		return (
			<span key={key}>
				{renderInline(line)}
				{lineIdx < lines.length - 1 && <br />}
			</span>
		);
	});
}

function renderInline(text: string) {
	// Handle inline code and bold
	const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
	const segments = text.split(inlineRegex);

	return segments.map((segment) => {
		const key = `seg-${segment.slice(0, 24)}`;
		if (segment.startsWith("`") && segment.endsWith("`")) {
			return (
				<code key={key} className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-sm">
					{segment.slice(1, -1)}
				</code>
			);
		}
		if (segment.startsWith("**") && segment.endsWith("**")) {
			return (
				<strong key={key} className="font-semibold">
					{segment.slice(2, -2)}
				</strong>
			);
		}
		return segment;
	});
}

export function MessageBubble({ message }: MessageBubbleProps) {
	const isUser = message.role === "user";
	const isAssistant = message.role === "assistant";

	if (!isUser && !isAssistant) return null;

	return (
		<div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
					isUser ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-100"
				}`}
			>
				{isUser ? (
					<p className="whitespace-pre-wrap">{message.content}</p>
				) : (
					<div>{renderContent(message.content)}</div>
				)}
			</div>
		</div>
	);
}

/**
 * Renders a streaming assistant message that is still being received.
 */
export function StreamingBubble({
	content,
}: {
	readonly content: string;
}) {
	if (!content) return null;

	return (
		<div className="flex w-full justify-start">
			<div className="max-w-[80%] rounded-lg bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-100">
				<div>{renderContent(content)}</div>
				<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-300" />
			</div>
		</div>
	);
}

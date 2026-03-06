import { type KeyboardEvent, useCallback, useRef, useState } from "react";

type MessageInputProps = {
	readonly onSend: (content: string) => void;
	readonly disabled?: boolean;
};

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
		// Reset textarea height
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [value, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleInput = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		// Auto-resize: reset height then set to scrollHeight
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}, []);

	return (
		<div className="flex items-end gap-2 border-t border-zinc-700 bg-zinc-900 p-4">
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				onInput={handleInput}
				placeholder="Type a message... (Shift+Enter for new line)"
				disabled={disabled}
				rows={1}
				className="flex-1 resize-none rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
			/>
			<button
				type="button"
				onClick={handleSend}
				disabled={disabled || !value.trim()}
				className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-300 disabled:pointer-events-none disabled:opacity-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					className="size-4"
					aria-hidden="true"
				>
					<path d="M5 12h14" />
					<path d="m12 5 7 7-7 7" />
				</svg>
			</button>
		</div>
	);
}

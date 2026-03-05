import { Button } from "@/components/ui/button";
import { SendHorizonal } from "lucide-react";
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
		<div className="flex items-end gap-2 border-t border-border bg-background p-4">
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				onInput={handleInput}
				placeholder="Type a message... (Shift+Enter for new line)"
				disabled={disabled}
				rows={1}
				className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
			/>
			<Button
				onClick={handleSend}
				disabled={disabled || !value.trim()}
				size="icon"
				className="shrink-0"
			>
				<SendHorizonal className="size-4" />
			</Button>
		</div>
	);
}

export function LoadingIndicator() {
	return (
		<div className="flex items-center gap-2 px-4 py-3">
			<div className="flex gap-1">
				<span className="size-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
				<span className="size-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
				<span className="size-2 animate-bounce rounded-full bg-zinc-500" />
			</div>
			<span className="text-sm text-zinc-500">Thinking...</span>
		</div>
	);
}

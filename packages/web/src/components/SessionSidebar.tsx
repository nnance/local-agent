import type { Session } from "@/types";

type SessionSidebarProps = {
	readonly sessions: Session[];
	readonly activeSessionId: string | null;
	readonly onSelectSession: (id: string) => void;
	readonly onCreateSession: () => void;
	readonly collapsed: boolean;
	readonly onToggleCollapse: () => void;
};

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString();
}

function sessionTitle(session: Session): string {
	if (session.title) return session.title;
	return `Session ${session.id.slice(0, 8)}`;
}

export function SessionSidebar({
	sessions,
	activeSessionId,
	onSelectSession,
	onCreateSession,
	collapsed,
	onToggleCollapse,
}: SessionSidebarProps) {
	if (collapsed) {
		return (
			<div className="flex h-full w-12 flex-col items-center border-r border-zinc-700 bg-zinc-800 py-2">
				<button
					type="button"
					onClick={onToggleCollapse}
					title="Expand sidebar"
					className="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
				>
					<span className="text-sm">&#9776;</span>
				</button>
				<div className="mt-2">
					<button
						type="button"
						onClick={onCreateSession}
						title="New session"
						className="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
					>
						<span className="text-lg leading-none">+</span>
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full w-64 flex-col border-r border-zinc-700 bg-zinc-800">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
				<h2 className="text-sm font-semibold text-zinc-100">Sessions</h2>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onCreateSession}
						title="New session"
						className="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
					>
						<span className="text-lg leading-none">+</span>
					</button>
					<button
						type="button"
						onClick={onToggleCollapse}
						title="Collapse sidebar"
						className="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
					>
						<span className="text-sm">&laquo;</span>
					</button>
				</div>
			</div>

			{/* Session list */}
			<div className="flex-1 overflow-y-auto">
				<div className="space-y-0.5 p-2">
					{sessions.length === 0 && (
						<p className="px-2 py-4 text-center text-xs text-zinc-500">No sessions yet</p>
					)}
					{sessions.map((session) => (
						<button
							key={session.id}
							type="button"
							onClick={() => onSelectSession(session.id)}
							className={`flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors ${
								activeSessionId === session.id
									? "bg-zinc-700 text-zinc-100"
									: "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-100"
							}`}
						>
							<span className="truncate text-sm font-medium">{sessionTitle(session)}</span>
							<span className="mt-0.5 text-xs opacity-70">{formatDate(session.created_at)}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

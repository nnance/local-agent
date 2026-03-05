import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";
import { MessageSquarePlus, PanelLeft, PanelLeftClose } from "lucide-react";

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
			<div className="flex h-full w-12 flex-col items-center border-r border-border bg-card py-2">
				<Button variant="ghost" size="icon-sm" onClick={onToggleCollapse} title="Expand sidebar">
					<PanelLeft className="size-4" />
				</Button>
				<div className="mt-2">
					<Button variant="ghost" size="icon-sm" onClick={onCreateSession} title="New session">
						<MessageSquarePlus className="size-4" />
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full w-64 flex-col border-r border-border bg-card">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<h2 className="text-sm font-semibold text-foreground">Sessions</h2>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon-sm" onClick={onCreateSession} title="New session">
						<MessageSquarePlus className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onToggleCollapse}
						title="Collapse sidebar"
					>
						<PanelLeftClose className="size-4" />
					</Button>
				</div>
			</div>

			{/* Session list */}
			<ScrollArea className="flex-1">
				<div className="space-y-0.5 p-2">
					{sessions.length === 0 && (
						<p className="px-2 py-4 text-center text-xs text-muted-foreground">No sessions yet</p>
					)}
					{sessions.map((session) => (
						<button
							key={session.id}
							type="button"
							onClick={() => onSelectSession(session.id)}
							className={cn(
								"flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors",
								activeSessionId === session.id
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
							)}
						>
							<span className="truncate text-sm font-medium">{sessionTitle(session)}</span>
							<span className="mt-0.5 text-xs opacity-70">{formatDate(session.created_at)}</span>
						</button>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

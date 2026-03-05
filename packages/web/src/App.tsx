import { ChatContainer } from "@/components/ChatContainer";
import { SessionSidebar } from "@/components/SessionSidebar";
import { useSessions } from "@/hooks/useSessions";
import { useCallback, useState } from "react";

export function App() {
	const { sessions, activeSessionId, createSession, switchSession } = useSessions();

	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	const handleCreateSession = useCallback(async () => {
		await createSession();
	}, [createSession]);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
			<SessionSidebar
				sessions={sessions}
				activeSessionId={activeSessionId}
				onSelectSession={switchSession}
				onCreateSession={handleCreateSession}
				collapsed={sidebarCollapsed}
				onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
			/>
			<main className="flex-1 overflow-hidden">
				<ChatContainer sessionId={activeSessionId} />
			</main>
		</div>
	);
}

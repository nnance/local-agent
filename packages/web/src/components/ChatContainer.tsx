import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/useChat";
import { useEffect, useRef } from "react";
import { LoadingIndicator } from "./LoadingIndicator";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ToolActivityDisplay } from "./ToolActivity";

type ChatContainerProps = {
	readonly sessionId: string | null;
};

export function ChatContainer({ sessionId }: ChatContainerProps) {
	const { messages, streamingContent, toolActivities, isLoading, error, sendMessage } =
		useChat(sessionId);

	const bottomRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when content changes.
	// We intentionally depend on state values to trigger scroll on updates.
	const messageCount = messages.length;
	const hasStreaming = streamingContent.length > 0;
	const activityCount = toolActivities.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional scroll triggers
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messageCount, hasStreaming, activityCount, isLoading]);

	if (!sessionId) {
		return (
			<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
				<p className="text-lg">No session selected</p>
				<p className="mt-1 text-sm">Create a new session or select one from the sidebar</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<ScrollArea className="flex-1">
				<div className="space-y-4 p-4">
					{messages.length === 0 && !isLoading && (
						<div className="flex h-40 items-center justify-center text-muted-foreground">
							<p className="text-sm">Start a conversation by sending a message</p>
						</div>
					)}

					{messages.map((message) => (
						<MessageBubble key={message.id} message={message} />
					))}

					{toolActivities.length > 0 && <ToolActivityDisplay activities={toolActivities} />}

					{streamingContent && <StreamingBubble content={streamingContent} />}

					{isLoading && !streamingContent && <LoadingIndicator />}

					{error && (
						<div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
							{error}
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			</ScrollArea>

			<MessageInput onSend={sendMessage} disabled={isLoading} />
		</div>
	);
}

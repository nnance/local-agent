import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolActivity as ToolActivityType } from "@/types";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

type ToolActivityProps = {
	readonly activities: readonly ToolActivityType[];
};

function ToolActivityItem({
	activity,
}: {
	readonly activity: ToolActivityType;
}) {
	const [open, setOpen] = useState(false);
	const isRunning = activity.status === "running";

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-accent">
				{isRunning ? (
					<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
				) : (
					<CheckCircle2 className="size-3.5 text-green-500" />
				)}
				<span className="font-medium text-foreground">{activity.name}</span>
				<ChevronRight
					className={cn(
						"ml-auto size-3.5 text-muted-foreground transition-transform",
						open && "rotate-90",
					)}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-1 space-y-1 rounded-md border border-border/50 bg-muted/50 p-2 text-xs">
					<div>
						<span className="font-medium text-muted-foreground">Params: </span>
						<pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap text-foreground/80">
							{JSON.stringify(activity.params, null, 2)}
						</pre>
					</div>
					{activity.result !== undefined && (
						<div>
							<span className="font-medium text-muted-foreground">Result: </span>
							<pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap text-foreground/80">
								{activity.result}
							</pre>
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ToolActivityDisplay({ activities }: ToolActivityProps) {
	if (activities.length === 0) return null;

	return (
		<div className="flex w-full justify-start">
			<div className="max-w-[80%] space-y-1.5">
				{activities.map((activity) => (
					<ToolActivityItem key={activity.id} activity={activity} />
				))}
			</div>
		</div>
	);
}

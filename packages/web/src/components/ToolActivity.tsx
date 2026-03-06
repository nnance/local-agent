import type { ToolActivity as ToolActivityType } from "@/types";
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
		<div>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center gap-2 rounded-md border border-zinc-700/50 bg-zinc-800 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-700"
			>
				{isRunning ? (
					<span className="size-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
				) : (
					<span className="text-green-500">&#10003;</span>
				)}
				<span className="font-medium text-zinc-100">{activity.name}</span>
				<span className={`ml-auto text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}>
					&#8250;
				</span>
			</button>
			{open && (
				<div className="mt-1 space-y-1 rounded-md border border-zinc-700/50 bg-zinc-800/50 p-2 text-xs">
					<div>
						<span className="font-medium text-zinc-500">Params: </span>
						<pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap text-zinc-300">
							{JSON.stringify(activity.params, null, 2)}
						</pre>
					</div>
					{activity.result !== undefined && (
						<div>
							<span className="font-medium text-zinc-500">Result: </span>
							<pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap text-zinc-300">
								{activity.result}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
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

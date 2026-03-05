import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ExecutionResult, ToolMapping } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

const resolveInterpreter = (scriptPath: string): string => {
	if (scriptPath.endsWith(".sh")) return "bash";
	if (scriptPath.endsWith(".js")) return "node";
	return "bash";
};

const buildArgs = (mapping: ToolMapping, params: Record<string, unknown>): readonly string[] => {
	const { parameters } = mapping.script;
	const args: string[] = [];

	// Required params first, in declared order
	const required = parameters.required ?? [];
	for (const name of required) {
		const value = params[name];
		if (value !== undefined && value !== null) {
			args.push(String(value));
		}
	}

	// Then optional params that were provided, in property declaration order
	const propKeys = Object.keys(parameters.properties);
	for (const key of propKeys) {
		if (required.includes(key)) continue;
		const value = params[key];
		if (value !== undefined && value !== null) {
			args.push(String(value));
		}
	}

	return args;
};

export const executeScript = (
	mapping: ToolMapping,
	params: Record<string, unknown>,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ExecutionResult> => {
	const scriptPath = join(mapping.skillFolderPath, mapping.script.path);
	const interpreter = resolveInterpreter(scriptPath);
	const args = buildArgs(mapping, params);

	return new Promise((resolve) => {
		const child = spawn(interpreter, [scriptPath, ...args], {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: timeoutMs,
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

		child.on("close", (code) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
				stderr: Buffer.concat(stderrChunks).toString("utf-8"),
				exitCode: code,
			});
		});

		child.on("error", (err) => {
			resolve({
				stdout: "",
				stderr: err.message,
				exitCode: 1,
			});
		});
	});
};

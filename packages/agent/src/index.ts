import { createAppServer } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const app = createAppServer();

const shutdown = (): void => {
	console.log("\nShutting down gracefully...");
	app
		.stop()
		.then(() => {
			console.log("Server stopped.");
			process.exit(0);
		})
		.catch((err) => {
			console.error("Error during shutdown:", err);
			process.exit(1);
		});
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.start(port).catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});

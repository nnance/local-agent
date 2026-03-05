import { createAppServer } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const app = createAppServer();

app.start(port).catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});

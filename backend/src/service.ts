import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { createWebSocketServer } from "./websocket/server.js";

const server = createServer(app);

createWebSocketServer(server);

server.on("error", (error) => {
  console.error("Backend server failed to start:", error);
  process.exitCode = 1;
});

server.listen(env.port, env.host, () => {
  console.log(`Backend listening at http://${env.host}:${env.port}`);
});

import type { Server } from "node:http";
import { WebSocketServer } from "ws";

export function createWebSocketServer(server: Server): WebSocketServer {
  const webSocketServer = new WebSocketServer({ server, path: "/ws" });

  webSocketServer.on("connection", (socket) => {
    socket.on("error", (error) => {
      console.error("WebSocket connection error:", error);
    });
  });

  return webSocketServer;
}

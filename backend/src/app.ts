import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { sessionsRouter } from "./modules/sessions/sessions.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_request, response) => {
  response.json({
    service: "interview-assistant-backend",
    status: "ok",
    health: "/api/health",
  });
});

app.use("/api/health", healthRouter);
app.use("/api/v1/sessions", sessionsRouter);

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    error: "Not found",
  });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 500;

  response.status(status).json({
    success: false,
    error: status < 500 ? "Invalid request" : "Internal server error",
  });
};

app.use(errorHandler);
import type { ErrorRequestHandler } from "express";
import { logger } from "../shared/logger/logger.js";
import type { ApiResponse } from "../shared/types.js";

/**
 * Centralized Express error handler.
 * Logs the error via pino and returns a consistent ApiResponse envelope.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId =
    typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : undefined;

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 500;

  const message =
    status < 500
      ? error instanceof Error
        ? error.message
        : "Invalid request"
      : "Internal server error";

  logger.error({ err: error, requestId, status }, "Request error");

  const body: ApiResponse<never> = {
    success: false,
    error: message,
    requestId,
  };

  res.status(status).json(body);
};

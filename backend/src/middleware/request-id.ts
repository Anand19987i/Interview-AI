import crypto from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Middleware that generates or propagates an X-Request-Id header
 * on every incoming request for traceability.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const existing = req.headers["x-request-id"];
  const requestId =
    typeof existing === "string" && existing.length > 0
      ? existing
      : crypto.randomUUID();

  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

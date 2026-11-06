import cors from "cors";
import { env } from "./env.js";

export const corsMiddleware = cors({
  origin: env.corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  credentials: false,
});
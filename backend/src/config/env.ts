import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
  throw new Error("Backend environment configuration is invalid");
}

export const env = {
  nodeEnv: result.data.NODE_ENV,
  host: result.data.HOST,
  port: result.data.PORT,
  openAiApiKey: result.data.OPENAI_API_KEY || undefined,
  deepgramApiKey: result.data.DEEPGRAM_API_KEY || undefined,
  corsOrigins: result.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

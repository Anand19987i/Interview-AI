import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  GROK_API_KEY: z.string().optional().transform((value) => value?.trim() || undefined),
  GROK_MODEL: z.string().default("grok-3-mini"),
  GEMINI_API_KEY: z.string().optional().transform((value) => value?.trim() || undefined),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_API_KEY: z.string().optional().transform((value) => value?.trim() || undefined),
  DEEPGRAM_API_KEY: z.string().optional().transform((value) => value?.trim() || undefined),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
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
  frontendUrl: result.data.FRONTEND_URL,
  grokApiKey: result.data.GROK_API_KEY,
  grokModel: result.data.GROK_MODEL,
  geminiApiKey: result.data.GEMINI_API_KEY,
  geminiModel: result.data.GEMINI_MODEL,
  openAiApiKey: result.data.OPENAI_API_KEY,
  deepgramApiKey: result.data.DEEPGRAM_API_KEY,
  openAiModel: result.data.OPENAI_MODEL,
  corsOrigins: result.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

import { DeepgramClient } from "@deepgram/sdk";
import { env } from "../../config/env.js";

export function createDeepgramConnection() {
  if (!env.deepgramApiKey) {
    throw new Error("Deepgram is not configured. Set DEEPGRAM_API_KEY in backend/.env.");
  }

  const client = new DeepgramClient({ apiKey: env.deepgramApiKey });
  return client.listen.v1.connect({
    model: "nova-3",
    language: "en",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
    endpointing: 700,
    utterance_end_ms: 1000,
    Authorization: `Token ${env.deepgramApiKey}`,
    reconnectAttempts: 0,
    connectionTimeoutInSeconds: 15,
  });
}

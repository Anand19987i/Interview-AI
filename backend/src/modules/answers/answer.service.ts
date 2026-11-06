import OpenAI from "openai";
import { env } from "../../config/env.js";
import { selectAnswerProvider } from "./answer-provider.js";

const selectedProvider = selectAnswerProvider({
  grokApiKey: env.grokApiKey,
  grokModel: env.grokModel,
  geminiApiKey: env.geminiApiKey,
  geminiModel: env.geminiModel,
  openAiApiKey: env.openAiApiKey,
  openAiModel: env.openAiModel,
});
const answerProvider = selectedProvider
  ? {
      model: selectedProvider.model,
      client: new OpenAI({
        apiKey: selectedProvider.apiKey,
        ...(selectedProvider.baseURL ? { baseURL: selectedProvider.baseURL } : {}),
      }),
    }
  : undefined;

export interface AnswerContext {
  resumeText: string;
  jobDescription: string;
}

export async function* streamInterviewAnswer(
  question: string,
  context: AnswerContext,
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (!answerProvider) {
    throw new Error("No answer provider is configured. Set GROK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in backend/.env.");
  }

  const stream = await answerProvider.client.chat.completions.create(
    {
      model: answerProvider.model,
      stream: true,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You are a real-time interview coach. Answer the exact interview question using the candidate resume as the only evidence for personal experience. Use the job description only to identify relevant role priorities; never treat its requirements as candidate experience. Never invent skills, employers, responsibilities, or metrics. If the resume does not support a personal claim, say so briefly or frame it as an approach rather than past experience. Keep the answer natural and speakable, about 60-90 words or 3-6 brief bullets when appropriate. Avoid preambles and meta commentary.",
        },
        {
          role: "user",
          content: [
            `Interview question:\n${question}`,
            `Candidate resume / experience:\n${context.resumeText || "(not provided)"}`,
            `Job description:\n${context.jobDescription || "(not provided)"}`,
          ].join("\n\n"),
        },
      ],
    },
    { signal },
  );

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta.content;
    if (typeof token === "string" && token.length > 0) {
      yield token;
    }
  }
}

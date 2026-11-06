import assert from "node:assert/strict";
import test from "node:test";
import { selectAnswerProvider } from "../src/modules/answers/answer-provider.js";

const models = {
  grokModel: "grok-test",
  geminiModel: "gemini-test",
  openAiModel: "openai-test",
};

test("prefers Grok when its key is configured", () => {
  assert.deepEqual(
    selectAnswerProvider({
      ...models,
      grokApiKey: "grok-key",
      geminiApiKey: "gemini-key",
      openAiApiKey: "openai-key",
    }),
    {
      name: "Grok",
      apiKey: "grok-key",
      model: "grok-test",
      baseURL: "https://api.x.ai/v1",
    },
  );
});

test("prefers Gemini when its optional key is configured", () => {
  assert.deepEqual(
    selectAnswerProvider({
      ...models,
      geminiApiKey: "gemini-key",
      openAiApiKey: "openai-key",
    }),
    {
      name: "Gemini",
      apiKey: "gemini-key",
      model: "gemini-test",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    },
  );
});

test("falls back to OpenAI when Gemini is not configured", () => {
  assert.deepEqual(
    selectAnswerProvider({ ...models, openAiApiKey: "openai-key" }),
    {
      name: "OpenAI",
      apiKey: "openai-key",
      model: "openai-test",
    },
  );
});

test("returns no provider when neither key is configured", () => {
  assert.equal(selectAnswerProvider(models), undefined);
});

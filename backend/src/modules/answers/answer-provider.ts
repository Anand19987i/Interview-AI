export interface AnswerProviderConfig {
  grokApiKey?: string;
  grokModel: string;
  geminiApiKey?: string;
  geminiModel: string;
  openAiApiKey?: string;
  openAiModel: string;
}

export type SelectedAnswerProvider = {
  name: "Grok" | "Gemini" | "OpenAI";
  apiKey: string;
  model: string;
  baseURL?: string;
};

export function selectAnswerProvider(config: AnswerProviderConfig): SelectedAnswerProvider | undefined {
  if (config.grokApiKey) {
    return {
      name: "Grok",
      apiKey: config.grokApiKey,
      model: config.grokModel,
      baseURL: "https://api.x.ai/v1",
    };
  }

  if (config.geminiApiKey) {
    return {
      name: "Gemini",
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    };
  }

  if (config.openAiApiKey) {
    return {
      name: "OpenAI",
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
    };
  }

  return undefined;
}

const SMALL_TALK_PATTERNS = [
  /^(?:hi|hello|thanks|thank you|okay|ok|right|great|mm+|uh+|um+)[.!?]*$/i,
  /^(?:how are you(?: doing)?|how is it going|how's it going|what's up|how was your weekend)[.!?]*$/i,
];

const INCOMPLETE_ENDINGS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "but",
  "by",
  "can",
  "could",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "our",
  "the",
  "their",
  "to",
  "us",
  "was",
  "were",
  "with",
  "you",
  "your",
]);

export function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function isInterviewQuestion(text: string): boolean {
  const candidate = text
    .trim()
    .replace(/^(?:(?:uh|um|so|okay|ok|well|right|great)[,.\s]+)+/i, "")
    .trim();

  if (!candidate || SMALL_TALK_PATTERNS.some((pattern) => pattern.test(candidate))) {
    return false;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  const hasQuestionPunctuation = /[?]\s*$/.test(candidate);
  if (words.length < 4 && !(hasQuestionPunctuation && words.length >= 3)) {
    return false;
  }

  const finalWord = normalizeQuestion(words.at(-1) ?? "").split(" ").at(-1) ?? "";
  if (!hasQuestionPunctuation && INCOMPLETE_ENDINGS.has(finalWord)) {
    return false;
  }

  return (
    hasQuestionPunctuation ||
    /^(what|why|how|when|where|who|which|can|could|would|will|do|did|does|is|are|have|has)\b/i.test(candidate) ||
    /^(tell me about|describe|walk me through|share an example|give me an example)\b/i.test(candidate)
  );
}

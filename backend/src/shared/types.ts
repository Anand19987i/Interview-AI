// ─── Session Types ───────────────────────────────────────────────────────────

export interface Session {
  id: string;
  status: "created" | "active" | "stopped";
  resumeText?: string;
  jobDescription?: string;
  questions: DetectedQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedQuestion {
  id: string;
  text: string;
  detectedAt: Date;
  answerId?: string;
}

export interface GeneratedAnswer {
  id: string;
  questionId: string;
  text: string;
  tokens: string[];
  startedAt: Date;
  completedAt?: Date;
  latencyMs?: number;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WSClientEvent =
  | { type: "session.start" }
  | { type: "session.stop" }
  | { type: "session.ping" };

export type WSServerEvent =
  | { type: "session.ready"; sessionId: string; timestamp: string }
  | { type: "transcription.ready"; timestamp: string }
  | { type: "transcript.partial"; text: string; timestamp: string }
  | { type: "transcript.final"; text: string; timestamp: string }
  | {
      type: "question.detected";
      questionId: string;
      text: string;
      timestamp: string;
    }
  | {
      type: "answer.started";
      questionId: string;
      answerId: string;
      timestamp: string;
    }
  | { type: "answer.token"; answerId: string; token: string; timestamp: string }
  | {
      type: "answer.completed";
      answerId: string;
      fullText: string;
      latencyMs: number;
      timeToFirstTokenMs: number;
      timestamp: string;
    }
  | {
      type: "answer.error";
      questionId: string;
      error: string;
      timestamp: string;
    }
  | { type: "session.error"; error: string; timestamp: string }
  | { type: "session.stopped"; timestamp: string }
  | { type: "session.pong"; timestamp: string };

// ─── API Types ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

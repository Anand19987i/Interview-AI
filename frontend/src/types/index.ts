// Session types
export interface Session {
  id: string;
  status: 'created' | 'active' | 'stopped';
  resumeText?: string;
  jobDescription?: string;
  questions: DetectedQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface DetectedQuestion {
  id: string;
  text: string;
  detectedAt: string;
  answerId?: string;
}

export interface GeneratedAnswer {
  id: string;
  questionId: string;
  text: string;
  tokens: string[];
  isComplete: boolean;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
}

// WebSocket event types
export type WSClientEvent =
  | { type: 'session.start' }
  | { type: 'session.stop' }
  | { type: 'session.ping' };

export type WSServerEvent =
  | { type: 'session.ready'; sessionId: string; timestamp: string }
  | { type: 'transcription.ready'; timestamp: string }
  | { type: 'transcript.partial'; text: string; timestamp: string }
  | { type: 'transcript.final'; text: string; timestamp: string }
  | { type: 'question.detected'; questionId: string; text: string; timestamp: string }
  | { type: 'answer.started'; questionId: string; answerId: string; timestamp: string }
  | { type: 'answer.token'; answerId: string; token: string; timestamp: string }
  | { type: 'answer.completed'; answerId: string; fullText: string; latencyMs: number; timeToFirstTokenMs: number; timestamp: string }
  | { type: 'answer.error'; questionId: string; error: string; timestamp: string }
  | { type: 'session.error'; error: string; timestamp: string }
  | { type: 'session.stopped'; timestamp: string }
  | { type: 'session.pong'; timestamp: string };

// API response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// App state
export type AppView = 'dashboard' | 'setup' | 'interview';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MicrophoneStatus = 'inactive' | 'requesting' | 'active' | 'error' | 'denied';
export type InterviewActivity = 'standby' | 'connecting' | 'listening' | 'thinking' | 'answering' | 'error';

export interface InterviewState {
  sessionId: string | null;
  connectionStatus: ConnectionStatus;
  microphoneStatus: MicrophoneStatus;
  activity: InterviewActivity;
  isRecording: boolean;
  recordingDuration: number;
  partialTranscript: string;
  finalTranscripts: string[];
  detectedQuestions: DetectedQuestion[];
  answers: Map<string, GeneratedAnswer>;
  error: string | null;
}

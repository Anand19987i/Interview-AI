import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { URL } from "node:url";
import { z } from "zod";
import { env } from "../config/env.js";
import { streamInterviewAnswer } from "../modules/answers/answer.service.js";
import { isInterviewQuestion, normalizeQuestion } from "../modules/questions/question-detector.js";
import { sessionRepository } from "../modules/sessions/session.repository.js";
import { createDeepgramConnection } from "../modules/transcription/deepgram.service.js";
import type { WSServerEvent } from "../shared/types.js";
import { WebSocket, WebSocketServer, type RawData } from "ws";

type SessionSocket = WebSocket & { sessionId?: string };

const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.start") }),
  z.object({ type: z.literal("session.stop") }),
  z.object({ type: z.literal("session.ping") }),
]);

const timestamp = () => new Date().toISOString();

const sendEvent = (socket: WebSocket, event: WSServerEvent) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
};

const audioBuffer = (data: RawData): Buffer => {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
};

export function createWebSocketServer(server: Server): WebSocketServer {
  const webSocketServer = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
    verifyClient: ({ req }, done) => {
      const origin = req.headers.origin;
      if (origin && !env.corsOrigins.includes(origin)) {
        done(false, 403, "Origin not allowed");
        return;
      }
      done(true);
    },
  });

  webSocketServer.on("connection", (socket: SessionSocket, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId || !sessionRepository.get(sessionId)) {
      sendEvent(socket, { type: "session.error", error: "Invalid or unknown session ID", timestamp: timestamp() });
      socket.close();
      return;
    }

    socket.sessionId = sessionId;
    sendEvent(socket, { type: "session.ready", sessionId, timestamp: timestamp() });

    let deepgramConnection: Awaited<ReturnType<typeof createDeepgramConnection>> | undefined;
    let started = false;
    let starting = false;
    let processingAnswers = false;
    let pendingText = "";
    let lastDetectedQuestion = "";
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    let activeAnswerController: AbortController | undefined;
    const questionQueue: Array<{ id: string; text: string }> = [];

    const sendSessionError = (error: string) => {
      sendEvent(socket, { type: "session.error", error, timestamp: timestamp() });
    };

    const processQuestionQueue = async () => {
      if (processingAnswers || !socket.sessionId) {
        return;
      }
      processingAnswers = true;

      try {
        while (questionQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
          const question = questionQueue.shift();
          const session = sessionRepository.get(socket.sessionId);
          if (!question || !session) {
            continue;
          }

          const answerId = randomUUID();
          const startedAt = Date.now();
          const abortController = new AbortController();
          activeAnswerController = abortController;
          sendEvent(socket, {
            type: "answer.started",
            questionId: question.id,
            answerId,
            timestamp: timestamp(),
          });

          let fullText = "";
          let timeToFirstTokenMs: number | undefined;
          try {
            for await (const token of streamInterviewAnswer(question.text, {
              resumeText: session.resumeText ?? "",
              jobDescription: session.jobDescription ?? "",
            }, abortController.signal)) {
              if (socket.readyState !== WebSocket.OPEN) {
                break;
              }
              timeToFirstTokenMs ??= Date.now() - startedAt;
              fullText += token;
              sendEvent(socket, { type: "answer.token", answerId, token, timestamp: timestamp() });
            }

            if (fullText.trim() && socket.readyState === WebSocket.OPEN) {
              sendEvent(socket, {
                type: "answer.completed",
                answerId,
                fullText: fullText.trim(),
                latencyMs: Date.now() - startedAt,
                timeToFirstTokenMs: timeToFirstTokenMs ?? Date.now() - startedAt,
                timestamp: timestamp(),
              });
            } else if (!abortController.signal.aborted && socket.readyState === WebSocket.OPEN) {
              throw new Error("The answer provider returned an empty response.");
            }
          } catch (error) {
            if (!abortController.signal.aborted) {
              const message = error instanceof Error ? error.message : "Answer generation failed.";
              sendEvent(socket, {
                type: "answer.error",
                questionId: question.id,
                error: message,
                timestamp: timestamp(),
              });
            }
          } finally {
            activeAnswerController = undefined;
          }
        }
      } finally {
        processingAnswers = false;
      }
    };

    const detectPendingQuestion = () => {
      pauseTimer = undefined;
      const text = pendingText.trim();
      pendingText = "";
      if (!text || !isInterviewQuestion(text)) {
        return;
      }

      const normalized = normalizeQuestion(text);
      if (!normalized || normalized === lastDetectedQuestion) {
        return;
      }

      lastDetectedQuestion = normalized;
      const questionId = randomUUID();
      const detectedAt = new Date();
      sessionRepository.addQuestion(sessionId, { id: questionId, text, detectedAt });
      sendEvent(socket, { type: "question.detected", questionId, text, timestamp: detectedAt.toISOString() });
      questionQueue.push({ id: questionId, text });
      void processQuestionQueue();
    };

    const startTranscription = async () => {
      if (started || starting) {
        return;
      }

      starting = true;
      try {
        const connection = await createDeepgramConnection();
        deepgramConnection = connection;
        connection.on("message", (message) => {
          if (message.type !== "Results") {
            return;
          }

          const text = message.channel.alternatives[0]?.transcript?.trim() ?? "";
          if (!text) {
            return;
          }

          if (message.is_final) {
            sendEvent(socket, { type: "transcript.final", text, timestamp: timestamp() });
            pendingText = `${pendingText} ${text}`.trim();
            if (pauseTimer) {
              clearTimeout(pauseTimer);
            }
            pauseTimer = setTimeout(detectPendingQuestion, 1000);
          } else {
            sendEvent(socket, { type: "transcript.partial", text, timestamp: timestamp() });
          }
        });
        connection.on("error", (error) => {
          console.error("Deepgram transcription error:", error);
          sendSessionError("Deepgram transcription connection failed. Check the API key and network connection.");
        });
        connection.on("close", () => {
          if (sessionRepository.get(sessionId)?.status === "active" && socket.readyState === WebSocket.OPEN) {
            sendSessionError("Deepgram transcription connection closed unexpectedly.");
          }
        });
        connection.connect();
        await connection.waitForOpen();
        started = true;
        sessionRepository.updateStatus(sessionId, "active");
        sendEvent(socket, { type: "transcription.ready", timestamp: timestamp() });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start transcription.";
        console.error("Unable to start Deepgram transcription:", message);
        sendSessionError(message);
      } finally {
        starting = false;
      }
    };

    socket.on("error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    socket.on("message", (rawMessage, isBinary) => {
      if (!socket.sessionId) {
        return;
      }

      if (isBinary) {
        if (!deepgramConnection || !started) {
          sendSessionError("Transcription is not ready to receive audio yet.");
          return;
        }
        try {
          deepgramConnection.sendMedia(audioBuffer(rawMessage));
        } catch (error) {
          console.error("Failed to forward audio to Deepgram:", error);
          sendSessionError("Could not forward microphone audio to transcription.");
        }
        return;
      }

      let rawEvent: unknown;
      try {
        rawEvent = JSON.parse(rawMessage.toString());
      } catch {
        sendSessionError("Malformed WebSocket message.");
        return;
      }

      const parsedEvent = clientEventSchema.safeParse(rawEvent);
      if (!parsedEvent.success) {
        sendSessionError("Unsupported WebSocket event.");
        return;
      }

      if (parsedEvent.data.type === "session.start") {
        void startTranscription();
      } else if (parsedEvent.data.type === "session.stop") {
        if (pauseTimer) {
          clearTimeout(pauseTimer);
        }
        activeAnswerController?.abort();
        sessionRepository.updateStatus(sessionId, "stopped");
        try {
          deepgramConnection?.sendCloseStream({ type: "CloseStream" });
          deepgramConnection?.close();
        } catch (error) {
          console.error("Failed to close the Deepgram connection cleanly:", error);
        }
        sendEvent(socket, { type: "session.stopped", timestamp: timestamp() });
        socket.close();
      } else if (parsedEvent.data.type === "session.ping") {
        sendEvent(socket, { type: "session.pong", timestamp: timestamp() });
      }
    });

    socket.on("close", () => {
      if (pauseTimer) {
        clearTimeout(pauseTimer);
      }
      activeAnswerController?.abort();
      deepgramConnection?.close();
      sessionRepository.updateStatus(sessionId, "stopped");
    });
  });

  return webSocketServer;
}

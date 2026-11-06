import { Router } from "express";
import { z } from "zod";
import { sessionRepository } from "./session.repository.js";

export const sessionsRouter = Router();

const sessionContextSchema = z.object({
  resumeText: z.string().default(""),
  jobDescription: z.string().default(""),
});

sessionsRouter.post("/", (_request, response) => {
  const session = sessionRepository.create();

  response.status(201).json({
    success: true,
    data: session,
  });
});

sessionsRouter.get("/:sessionId", (request, response) => {
  const { sessionId } = request.params;
  const session = sessionRepository.get(sessionId);

  if (!session) {
    return response.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  return response.json({
    success: true,
    data: session,
  });
});

sessionsRouter.put("/:sessionId/context", (request, response) => {
  const { sessionId } = request.params;
  const parseResult = sessionContextSchema.safeParse(request.body ?? {});

  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: "Resume text and job description are required",
    });
  }

  const session = sessionRepository.updateContext(
    sessionId,
    parseResult.data.resumeText,
    parseResult.data.jobDescription,
  );

  if (!session) {
    return response.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  return response.json({
    success: true,
    data: session,
  });
});

sessionsRouter.delete("/:sessionId", (request, response) => {
  const { sessionId } = request.params;
  const existed = sessionRepository.delete(sessionId);

  if (!existed) {
    return response.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  return response.json({
    success: true,
    data: { deleted: true, sessionId },
  });
});

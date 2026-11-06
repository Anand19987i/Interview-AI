import { randomUUID } from "node:crypto";
import type { Session } from "../../shared/types.js";

const sessions = new Map<string, Session>();

export const sessionRepository = {
  list(): Session[] {
    return [...sessions.values()];
  },

  get(sessionId: string): Session | undefined {
    return sessions.get(sessionId);
  },

  create(): Session {
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      status: "created",
      resumeText: "",
      jobDescription: "",
      questions: [],
      createdAt: now,
      updatedAt: now,
    };

    sessions.set(session.id, session);
    return session;
  },

  updateContext(sessionId: string, resumeText: string, jobDescription: string): Session | undefined {
    const session = sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.resumeText = resumeText;
    session.jobDescription = jobDescription;
    session.updatedAt = new Date();
    sessions.set(sessionId, session);
    return session;
  },

  updateStatus(sessionId: string, status: Session["status"]): Session | undefined {
    const session = sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.status = status;
    session.updatedAt = new Date();
    sessions.set(sessionId, session);
    return session;
  },

  addQuestion(sessionId: string, question: Session["questions"][number]): Session | undefined {
    const session = sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.questions = [...session.questions, question];
    session.updatedAt = new Date();
    sessions.set(sessionId, session);
    return session;
  },

  delete(sessionId: string): boolean {
    return sessions.delete(sessionId);
  },
};

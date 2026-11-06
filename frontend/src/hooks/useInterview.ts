'use client';

import { useCallback, useEffect, useRef, useReducer } from 'react';
import { useWebSocket } from './useWebSocket';
import { useMicrophone } from './useMicrophone';
import { createSession, deleteSession, updateContext } from '@/services/api';
import type {
  InterviewState,
  WSServerEvent,
  DetectedQuestion,
  InterviewActivity,
} from '@/types';

type InterviewAction =
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ACTIVITY'; activity: InterviewActivity }
  | { type: 'SET_RECORDING'; isRecording: boolean }
  | { type: 'TICK_DURATION' }
  | { type: 'RESET_DURATION' }
  | { type: 'SET_PARTIAL_TRANSCRIPT'; text: string }
  | { type: 'ADD_FINAL_TRANSCRIPT'; text: string }
  | { type: 'ADD_QUESTION'; question: DetectedQuestion }
  | { type: 'INIT_ANSWER'; answerId: string; questionId: string }
  | { type: 'APPEND_TOKEN'; answerId: string; token: string }
  | { type: 'COMPLETE_ANSWER'; answerId: string; fullText: string; latencyMs: number; timeToFirstTokenMs: number }
  | { type: 'ANSWER_ERROR'; questionId: string; error: string }
  | { type: 'SESSION_STOPPED' }
  | { type: 'RESET' };

function createInitialState(): InterviewState {
  return {
    sessionId: null,
    connectionStatus: 'disconnected',
    microphoneStatus: 'inactive',
    activity: 'standby',
    isRecording: false,
    recordingDuration: 0,
    partialTranscript: '',
    finalTranscripts: [],
    detectedQuestions: [],
    answers: new Map(),
    error: null,
  };
}

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.sessionId };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_ACTIVITY':
      return { ...state, activity: action.activity };
    case 'SET_RECORDING':
      return { ...state, isRecording: action.isRecording };
    case 'TICK_DURATION':
      return { ...state, recordingDuration: state.recordingDuration + 1 };
    case 'RESET_DURATION':
      return { ...state, recordingDuration: 0 };
    case 'SET_PARTIAL_TRANSCRIPT':
      return { ...state, partialTranscript: action.text };
    case 'ADD_FINAL_TRANSCRIPT':
      return {
        ...state,
        finalTranscripts: [...state.finalTranscripts, action.text],
        partialTranscript: '',
      };
    case 'ADD_QUESTION':
      return {
        ...state,
        detectedQuestions: [...state.detectedQuestions, action.question],
      };
    case 'INIT_ANSWER': {
      const newAnswers = new Map(state.answers);
      newAnswers.set(action.answerId, {
        id: action.answerId,
        questionId: action.questionId,
        text: '',
        tokens: [],
        isComplete: false,
      });
      return { ...state, answers: newAnswers };
    }
    case 'APPEND_TOKEN': {
      const newAnswers = new Map(state.answers);
      const existing = newAnswers.get(action.answerId);
      if (existing) {
        newAnswers.set(action.answerId, {
          ...existing,
          tokens: [...existing.tokens, action.token],
          text: existing.text + action.token,
        });
      }
      return { ...state, answers: newAnswers };
    }
    case 'COMPLETE_ANSWER': {
      const newAnswers = new Map(state.answers);
      const existing = newAnswers.get(action.answerId);
      if (existing) {
        newAnswers.set(action.answerId, {
          ...existing,
          text: action.fullText,
          isComplete: true,
          latencyMs: action.latencyMs,
          timeToFirstTokenMs: action.timeToFirstTokenMs,
        });
      }
      return { ...state, answers: newAnswers };
    }
    case 'ANSWER_ERROR': {
      // Find the answer for this question and mark it as errored
      const newAnswers = new Map(state.answers);
      for (const [key, answer] of newAnswers) {
        if (answer.questionId === action.questionId && !answer.isComplete) {
          newAnswers.set(key, {
            ...answer,
            text: `Error: ${action.error}`,
            isComplete: true,
          });
        }
      }
      return { ...state, answers: newAnswers, error: action.error };
    }
    case 'SESSION_STOPPED':
      return { ...state, isRecording: false, activity: 'standby' };
    case 'RESET':
      return createInitialState();
    default:
      return state;
  }
}

interface UseInterviewReturn {
  state: InterviewState;
  connectionStatus: InterviewState['connectionStatus'];
  microphoneStatus: InterviewState['microphoneStatus'];
  startInterview: (resumeText: string, jobDescription: string) => Promise<void>;
  stopInterview: () => void;
}

export function useInterview(): UseInterviewReturn {
  const [state, dispatch] = useReducer(interviewReducer, undefined, createInitialState);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptionReadyRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);

  const handleWSEvent = useCallback((event: WSServerEvent) => {
    switch (event.type) {
      case 'session.ready':
        dispatch({ type: 'SET_SESSION_ID', sessionId: event.sessionId });
        break;
      case 'transcription.ready':
        transcriptionReadyRef.current?.resolve();
        break;
      case 'transcript.partial':
        dispatch({ type: 'SET_PARTIAL_TRANSCRIPT', text: event.text });
        break;
      case 'transcript.final':
        dispatch({ type: 'ADD_FINAL_TRANSCRIPT', text: event.text });
        break;
      case 'question.detected':
        dispatch({ type: 'SET_ACTIVITY', activity: 'thinking' });
        dispatch({
          type: 'ADD_QUESTION',
          question: {
            id: event.questionId,
            text: event.text,
            detectedAt: event.timestamp,
          },
        });
        break;
      case 'answer.started':
        dispatch({ type: 'SET_ACTIVITY', activity: 'answering' });
        dispatch({
          type: 'INIT_ANSWER',
          answerId: event.answerId,
          questionId: event.questionId,
        });
        break;
      case 'answer.token':
        dispatch({
          type: 'APPEND_TOKEN',
          answerId: event.answerId,
          token: event.token,
        });
        break;
      case 'answer.completed':
        dispatch({ type: 'SET_ACTIVITY', activity: 'listening' });
        dispatch({
          type: 'COMPLETE_ANSWER',
          answerId: event.answerId,
          fullText: event.fullText,
          latencyMs: event.latencyMs,
          timeToFirstTokenMs: event.timeToFirstTokenMs,
        });
        break;
      case 'answer.error':
        dispatch({ type: 'SET_ACTIVITY', activity: 'listening' });
        dispatch({
          type: 'ANSWER_ERROR',
          questionId: event.questionId,
          error: event.error,
        });
        break;
      case 'session.error':
        transcriptionReadyRef.current?.reject(new Error(event.error));
        transcriptionReadyRef.current = null;
        dispatch({ type: 'SET_ACTIVITY', activity: 'error' });
        dispatch({ type: 'SET_ERROR', error: event.error });
        break;
      case 'session.stopped':
        dispatch({ type: 'SESSION_STOPPED' });
        break;
      case 'session.pong':
        // Keepalive acknowledged, no action needed
        break;
    }
  }, []);

  const {
    connectionStatus,
    sendEvent,
    sendBinary,
    connect,
    disconnect,
  } = useWebSocket({
    onEvent: handleWSEvent,
  });

  const handleAudioData = useCallback(
    (data: ArrayBuffer) => {
      sendBinary(data);
    },
    [sendBinary]
  );

  const {
    status: microphoneStatus,
    error: micError,
    start: startMic,
    stop: stopMic,
  } = useMicrophone({ onAudioData: handleAudioData });

  // Sync microphone error to state
  useEffect(() => {
    if (micError) {
      dispatch({ type: 'SET_ERROR', error: micError });
      dispatch({ type: 'SET_ACTIVITY', activity: 'error' });
      dispatch({ type: 'SET_RECORDING', isRecording: false });
      sendEvent({ type: 'session.stop' });
      disconnect();
    }
  }, [micError, sendEvent, disconnect]);

  useEffect(() => {
    if (state.activity === 'error' && state.isRecording) {
      stopMic();
      sendEvent({ type: 'session.stop' });
      disconnect();
      dispatch({ type: 'SET_RECORDING', isRecording: false });
    }
  }, [state.activity, state.isRecording, stopMic, sendEvent, disconnect]);

  // Recording duration timer
  useEffect(() => {
    if (state.isRecording) {
      durationIntervalRef.current = setInterval(() => {
        dispatch({ type: 'TICK_DURATION' });
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [state.isRecording]);

  const startInterview = useCallback(
    async (resumeText: string, jobDescription: string) => {
      let sessionId: string | undefined;
      try {
        dispatch({ type: 'RESET' });
        dispatch({ type: 'SET_ACTIVITY', activity: 'connecting' });

        const session = await createSession();
        sessionId = session.id;
        dispatch({ type: 'SET_SESSION_ID', sessionId: session.id });
        await updateContext(session.id, resumeText, jobDescription);
        await connect(session.id);

        const transcriptionReady = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            transcriptionReadyRef.current = null;
            reject(
              new Error(
                'Transcription did not become ready in time. Check the backend and Deepgram configuration.',
              ),
            );
          }, 20000);
          transcriptionReadyRef.current = {
            resolve: () => {
              clearTimeout(timeout);
              transcriptionReadyRef.current = null;
              resolve();
            },
            reject: (error) => {
              clearTimeout(timeout);
              transcriptionReadyRef.current = null;
              reject(error);
            },
          };
        });
        sendEvent({ type: 'session.start' });
        await transcriptionReady;
        await startMic();

        dispatch({ type: 'SET_RECORDING', isRecording: true });
        dispatch({ type: 'RESET_DURATION' });
        dispatch({ type: 'SET_ACTIVITY', activity: 'listening' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start interview';
        dispatch({ type: 'SET_ERROR', error: message });
        dispatch({ type: 'SET_ACTIVITY', activity: 'error' });
        stopMic();
        sendEvent({ type: 'session.stop' });
        disconnect();
        if (sessionId) {
          try {
            await deleteSession(sessionId);
          } catch (cleanupError) {
            console.error('Failed to clean up an incomplete interview session:', cleanupError);
          }
        }
      }
    },
    [connect, disconnect, sendEvent, startMic, stopMic]
  );

  const stopInterview = useCallback(() => {
    sendEvent({ type: 'session.stop' });
    stopMic();
    dispatch({ type: 'SET_RECORDING', isRecording: false });
    dispatch({ type: 'SET_ACTIVITY', activity: 'standby' });
    disconnect();
  }, [sendEvent, stopMic, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      transcriptionReadyRef.current?.reject(new Error('Interview session was closed.'));
      transcriptionReadyRef.current = null;
      stopMic();
      disconnect();
    };
  }, [stopMic, disconnect]);

  return {
    state: {
      ...state,
      connectionStatus,
      microphoneStatus,
    },
    connectionStatus,
    microphoneStatus,
    startInterview,
    stopInterview,
  };
}

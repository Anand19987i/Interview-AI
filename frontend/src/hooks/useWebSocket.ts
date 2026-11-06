'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { WSClientEvent, WSServerEvent, ConnectionStatus } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;
const PING_INTERVAL = 25000;

interface UseWebSocketOptions {
  onEvent: (event: WSServerEvent) => void;
}

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  sendEvent: (event: WSClientEvent) => void;
  sendBinary: (data: ArrayBuffer) => void;
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => void;
}

export function useWebSocket({ onEvent }: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  const sessionIdRef = useRef<string | null>(null);
  const connectRef = useRef<(sessionId: string) => Promise<void>>(() => Promise.resolve());
  const intentionalCloseRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (sessionId: string): Promise<void> => {
      sessionIdRef.current = sessionId;

      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }

      clearTimers();
      setConnectionStatus('connecting');
      intentionalCloseRef.current = false;

      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}/ws?sessionId=${encodeURIComponent(sessionId)}`);
        wsRef.current = ws;
        let opened = false;

        ws.onopen = () => {
          opened = true;
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          if (startedRef.current) {
            ws.send(JSON.stringify({ type: 'session.start' } satisfies WSClientEvent));
          }
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session.ping' } satisfies WSClientEvent));
            }
          }, PING_INTERVAL);
          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data as string) as WSServerEvent;
            onEventRef.current(data);
          } catch {
            onEventRef.current({
              type: 'session.error',
              error: 'Received an invalid message from the interview server.',
              timestamp: new Date().toISOString(),
            });
          }
        };

        ws.onerror = () => {
          setConnectionStatus('error');
          if (!opened) {
            reject(new Error('Could not connect to the interview server.'));
          }
        };

        ws.onclose = () => {
          clearTimers();
          if (wsRef.current === ws) {
            wsRef.current = null;
          }

          if (!opened) {
            reject(new Error('The interview server closed the connection.'));
          }
          if (intentionalCloseRef.current) {
            setConnectionStatus('disconnected');
            return;
          }

          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus('connecting');
            const delay = RECONNECT_BASE_DELAY * 2 ** reconnectAttemptsRef.current;
            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
              const sid = sessionIdRef.current;
              if (sid) {
                void connectRef.current(sid).catch(() => undefined);
              }
            }, delay);
          } else {
            setConnectionStatus('error');
            onEventRef.current({
              type: 'session.error',
              error: 'Connection lost. Please stop and start the interview again.',
              timestamp: new Date().toISOString(),
            });
          }
        };
      });
    },
    [clearTimers],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    startedRef.current = false;
    sessionIdRef.current = null;
    clearTimers();
    reconnectAttemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, [clearTimers]);

  const sendEvent = useCallback((event: WSClientEvent) => {
    if (event.type === 'session.start') {
      startedRef.current = true;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  const sendBinary = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(
    () => () => {
      intentionalCloseRef.current = true;
      clearTimers();
      wsRef.current?.close();
      wsRef.current = null;
    },
    [clearTimers],
  );

  return { connectionStatus, sendEvent, sendBinary, connect, disconnect };
}

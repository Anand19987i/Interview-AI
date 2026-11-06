'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import type { MicrophoneStatus } from '@/types';

const TARGET_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

interface UseMicrophoneOptions {
  onAudioData: (data: ArrayBuffer) => void;
}

interface UseMicrophoneReturn {
  status: MicrophoneStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

function convertToPcm16(input: Float32Array, inputSampleRate: number): ArrayBuffer {
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const pcm = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
    const fraction = sourceIndex - lowerIndex;
    const sample = input[lowerIndex] * (1 - fraction) + input[upperIndex] * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm[index] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }

  return pcm.buffer;
}

export function useMicrophone({ onAudioData }: UseMicrophoneOptions): UseMicrophoneReturn {
  const [status, setStatus] = useState<MicrophoneStatus>('inactive');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const onAudioDataRef = useRef(onAudioData);

  useEffect(() => {
    onAudioDataRef.current = onAudioData;
  }, [onAudioData]);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close();
    }

    setStatus('inactive');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus('requesting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not available in this browser. Use HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      let context: AudioContext;
      try {
        context = new AudioContext({
          sampleRate: TARGET_SAMPLE_RATE,
          latencyHint: 'interactive',
        });
      } catch {
        context = new AudioContext({ latencyHint: 'interactive' });
      }
      contextRef.current = context;
      await context.resume();

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        const pcmData = convertToPcm16(samples, context.sampleRate);
        if (pcmData.byteLength > 0) {
          onAudioDataRef.current(pcmData);
        }
        event.outputBuffer.getChannelData(0).fill(0);
      };

      source.connect(processor);
      processor.connect(context.destination);

      stream.getAudioTracks().forEach((track) => {
        track.addEventListener(
          'ended',
          () => {
            setError('Microphone disconnected. Reconnect it and start a new session.');
            stop();
            setStatus('error');
          },
          { once: true },
        );
      });

      setStatus('active');
    } catch (caughtError) {
      const name = caughtError instanceof DOMException ? caughtError.name : '';
      const message =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was denied. Allow microphone access in your browser and try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found. Connect a microphone and try again.'
            : caughtError instanceof Error
              ? caughtError.message
              : 'Unable to start microphone capture.';
      stop();
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
      setError(message);
      throw new Error(message);
    }
  }, [stop]);

  useEffect(
    () => () => {
      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        processorRef.current.disconnect();
      }
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (contextRef.current && contextRef.current.state !== 'closed') {
        void contextRef.current.close();
      }
    },
    [],
  );

  return { status, error, start, stop };
}

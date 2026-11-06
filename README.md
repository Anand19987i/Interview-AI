# Real-Time AI Interview Assistant

A monorepo for a real-time interview assistant built with Next.js, TypeScript, Express, WebSockets, Deepgram, and OpenAI.

## Features

- Dashboard for resume + job description intake
- Browser microphone capture and binary audio streaming
- 16 kHz, mono, signed 16-bit PCM audio streaming to Deepgram
- WebSocket session lifecycle for interview coordination
- Session repository with REST endpoints to manage context
- Real-time transcript, question detection, and answer streaming
- Context-grounded OpenAI answers with a short, speakable response limit

## Monorepo layout

- `backend/` — Express + WebSockets + AI providers
- `frontend/` — Next.js dashboard and live interview UI
- `docs/` — project documentation and status notes

## Local setup

1. Install dependencies at the repo root:
   - `npm install`
2. Configure backend environment:
   - copy `backend/.env.example` to `backend/.env`
   - set `DEEPGRAM_API_KEY` and at least one of `GROK_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`
3. Configure frontend environment:
   - copy `frontend/.env.local.example` to `frontend/.env.local`
4. Run the app:
   - `npm run dev`

## Production build

- `npm run build`

## API overview

- `GET /api/health`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `PUT /api/v1/sessions/:sessionId/context`
- `DELETE /api/v1/sessions/:sessionId`
- `ws://localhost:5000/ws?sessionId=<session-id>`

## Notes

The interview flow captures microphone audio in the browser, converts it to mono 16 kHz linear PCM, and streams binary frames to Deepgram. Deepgram interim results and finalized segments are displayed separately. Final speech is buffered until a one-second pause; a question is emitted only if it has question punctuation or recognizable interrogative phrasing and is not a short filler/small-talk phrase. This keeps incomplete fragments and routine acknowledgements from triggering OpenAI.

Answers stream each detected question token by token using the saved resume and job description. Provider precedence is Grok, Gemini, then OpenAI: `GROK_API_KEY` selects Grok through xAI's OpenAI-compatible API; if absent, `GEMINI_API_KEY` selects Gemini; otherwise the app uses `OPENAI_API_KEY`. Set `GROK_MODEL`, `GEMINI_MODEL`, or `OPENAI_MODEL` to choose a model. Answers are instructed to be roughly 60-90 words, natural to speak aloud, and limited to facts supported by the resume. The job description is relevance context, not evidence that the candidate has a qualification. Missing provider keys are reported as session errors; the application does not fabricate transcripts or demo answers.

## Architecture and trade-offs

- **Audio capture:** Web Audio is used instead of `MediaRecorder` because Deepgram receives raw `linear16` PCM; containerized WebM/Opus chunks would need a different encoding configuration and can have per-chunk container overhead. The browser requests mono audio, targets a 16 kHz `AudioContext`, and converts samples to signed 16-bit PCM when the browser supplies another sample rate.
- **Streaming:** Binary audio goes over the browser WebSocket; the backend forwards it directly to the Deepgram Listen v1 stream. Grok, Gemini, or OpenAI Chat Completions uses streaming mode and each text delta is immediately sent as an `answer.token` event. There are no transcript polling loops or non-streaming answer requests.
- **Question detection:** Final Deepgram segments are joined until one second of silence, then checked by deterministic phrase/punctuation rules. Short acknowledgements, small talk, and incomplete trailing fragments are ignored. This avoids an extra classifier request and its latency/cost, while favoring precision over detecting every unconventional question.
- **Latency:** `answer.started` is emitted before the LLM request. The backend measures time to first generated token and total generation time; both are included with the completed answer and displayed in the workspace. Transcription starts before microphone capture, avoiding audio being sent before Deepgram is ready.
- **Reliability:** A per-session serial answer queue prevents overlapping generations. Session stop and socket disconnect abort an in-progress OpenAI stream and close Deepgram. WebSocket input is schema-validated and capped at 1 MiB. Provider/configuration errors are surfaced to the UI rather than replaced with fake content.

Run `npm run test:backend` from the monorepo root to verify the question detector and answer-provider selection behavior.

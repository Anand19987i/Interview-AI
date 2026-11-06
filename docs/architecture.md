# Architecture Documentation

## System Architecture

```mermaid
graph TD
    subgraph Frontend["Frontend (Next.js)"]
        UI[React UI Components]
        WS_Client[WebSocket Client]
        Mic[Microphone Capture]
        API_Client[REST API Client]
    end

    subgraph Backend["Backend (Express + WS)"]
        REST[REST API Routes]
        WS_Server[WebSocket Server]
        SM[Session Manager]
        TS[Transcription Service]
        QD[Question Detector]
        AS[Answer Service]
        SR[Session Repository]
    end

    subgraph External["External Services"]
        DG[Deepgram STT API]
        OAI[OpenAI GPT API]
    end

    UI --> API_Client
    UI --> WS_Client
    UI --> Mic

    API_Client -->|HTTP| REST
    WS_Client -->|WebSocket| WS_Server
    Mic -->|Binary Audio| WS_Client

    REST --> SM
    SM --> SR

    WS_Server --> SM
    WS_Server --> TS
    WS_Server --> QD
    WS_Server --> AS

    TS -->|Audio Stream| DG
    DG -->|Transcripts| TS
    TS -->|Final Transcript| QD

    QD -->|Detected Question| AS
    AS -->|Prompt + Context| OAI
    OAI -->|Token Stream| AS
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Browser as Browser (React)
    participant WS as WebSocket
    participant Backend as Backend Server
    participant DG as Deepgram
    participant OAI as OpenAI

    User->>Browser: Enter Resume & Job Description
    Browser->>Backend: POST /api/v1/sessions (create)
    Backend-->>Browser: Session ID
    Browser->>Backend: PUT /api/v1/sessions/:id/context
    Backend-->>Browser: Context Updated

    User->>Browser: Click "Start Interview"
    Browser->>WS: Connect ws://...?sessionId=xxx
    WS-->>Browser: Connected
    Browser->>WS: session.start
    WS->>Backend: Initialize Transcription
    Backend->>DG: Open Live Connection
    WS-->>Browser: session.ready

    loop Audio Streaming
        Browser->>Browser: Capture Mic Audio
        Browser->>WS: Binary Audio Chunk
        WS->>Backend: Forward Audio
        Backend->>DG: Stream Audio
        DG-->>Backend: Interim Transcript
        Backend-->>Browser: transcript.partial
        DG-->>Backend: Final Transcript
        Backend-->>Browser: transcript.final
    end

    Note over Backend: Question Detected
    Backend-->>Browser: question.detected
    Backend->>OAI: Generate Answer (streaming)

    loop Token Streaming
        OAI-->>Backend: Token
        Backend-->>Browser: answer.token
    end

    Backend-->>Browser: answer.completed

    User->>Browser: Click "Stop"
    Browser->>WS: session.stop
    Backend->>DG: Close Connection
    Backend->>OAI: Cancel Generation
    WS-->>Browser: session.stopped
    Browser->>Browser: Cleanup Resources
```

## Module Architecture

### Backend Modules

| Module | Responsibility |
|--------|---------------|
| **Health** | System health check endpoint |
| **Sessions** | Session CRUD, lifecycle management |
| **Transcription** | Deepgram integration, audio → text |
| **Questions** | Deterministic question detection |
| **Answers** | OpenAI integration, prompt building, streaming |

### Frontend Architecture

| Layer | Responsibility |
|-------|---------------|
| **Pages** | Route-level components, view orchestration |
| **Components** | Reusable UI elements |
| **Hooks** | State management, WebSocket, microphone |
| **Services** | REST API client |
| **Types** | Shared TypeScript interfaces |

## Technology Decisions

### Why WebSocket for Audio?
- Binary streaming without Base64 overhead
- Bidirectional for events (transcripts, answers)
- Lower latency than HTTP polling

### Why Deterministic Question Detection?
- No LLM call needed → faster response
- Punctuation + keyword heuristics are sufficient
- Avoids unnecessary API costs
- Predictable behavior

### Why MediaRecorder for Audio?
- Browser-native API with wide support
- Handles encoding/format automatically
- Deepgram supports container format detection
- Simpler than manual PCM via AudioWorklet

### Why In-Memory Sessions?
- No database setup complexity
- Sufficient for single-server interview sessions
- Sessions are short-lived (interview duration)
- Easy to extend to persistent storage later

## Latency Pipeline

```
User speaks → Mic captures (250ms chunks) → WebSocket → Backend → Deepgram
                                                                      ↓
UI ← answer.token ← Backend ← OpenAI streaming ← Question detected ← Final transcript
```

Target: < 3 seconds from question completion to first answer token.

Measured timestamps:
1. Last audio chunk received
2. Final transcript from Deepgram
3. Question detected
4. OpenAI request initiated
5. First answer token received
6. Answer completed


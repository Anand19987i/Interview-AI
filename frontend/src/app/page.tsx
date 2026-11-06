"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useInterview } from "@/hooks/useInterview";

function WaveformIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 10v4m4-8v12m4-15v18m4-14v10m4-7v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15ZM5 2l.7 1.3L7 4l-1.3.7L5 6l-.7-1.3L3 4l1.3-.7L5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function MicrophoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ activity }: { activity: string }) {
  const status = {
    standby: { label: "Ready", className: "status-ready" },
    connecting: { label: "Connecting", className: "status-waiting" },
    listening: { label: "Listening", className: "status-live" },
    thinking: { label: "Processing question", className: "status-thinking" },
    answering: { label: "Generating answer", className: "status-thinking" },
    error: { label: "Action needed", className: "status-error" },
  }[activity] ?? { label: "Ready", className: "status-ready" };

  return (
    <span className={`status-badge ${status.className}`}>
      <span className="status-dot" />
      {status.label}
    </span>
  );
}

function ConnectionStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    disconnected: "Offline",
    connecting: "Connecting",
    connected: "Connected",
    error: "Connection issue",
  };
  return (
    <span className={`connection-status connection-${status}`}>
      <span className="connection-dot" />
      {labels[status] ?? "Offline"}
    </span>
  );
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const { state, connectionStatus, microphoneStatus, startInterview, stopInterview } = useInterview();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const answerList = useMemo(
    () => [...state.answers.values()].filter((answer) => answer.text.length > 0),
    [state.answers],
  );
  const latestAnswer = answerList.at(-1);
  const latestQuestion = state.detectedQuestions.at(-1);
  const isReady = resumeText.trim().length > 0 && jobDescription.trim().length > 0;
  const isBusy = state.activity === "connecting";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.finalTranscripts.length, state.partialTranscript]);

  const copyAnswer = async () => {
    if (!latestAnswer) return;
    try {
      await navigator.clipboard.writeText(latestAnswer.text);
      setCopyMessage("Copied");
      window.setTimeout(() => setCopyMessage(""), 1800);
    } catch {
      setCopyMessage("Could not copy");
      window.setTimeout(() => setCopyMessage(""), 2500);
    }
  };

  const microphoneLabel: Record<string, string> = {
    inactive: "Mic idle",
    requesting: "Requesting mic",
    active: "Mic connected",
    error: "Mic issue",
    denied: "Mic access denied",
  };

  return (
    <main className="interview-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="Interview AI home">
            <span className="brand-mark"><WaveformIcon /></span>
            <span className="brand-name">Interview <span>AI</span></span>
            <span className="brand-divider" />
            <span className="brand-caption">Interview copilot</span>
          </Link>
          <div className="header-status">
            <ConnectionStatus status={connectionStatus} />
            <span className="header-separator" />
            <StatusBadge activity={state.activity} />
            {state.isRecording ? (
              <span className="session-timer" aria-label="Interview duration">
                {Math.floor(state.recordingDuration / 60).toString().padStart(2, "0")}:
                {(state.recordingDuration % 60).toString().padStart(2, "0")}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="workspace">
        <section className="workspace-heading">
          <div>
            <p className="eyebrow">LIVE WORKSPACE</p>
            <h1>Your interview, in focus.</h1>
            <p className="heading-copy">Stay present in the conversation. Your copilot listens, catches the question, and helps you shape a clear answer.</p>
          </div>
          <div className="session-controls">
            <span className={`mic-indicator ${microphoneStatus === "active" ? "mic-active" : ""} ${microphoneStatus === "error" || microphoneStatus === "denied" ? "mic-error" : ""}`}>
              <MicrophoneIcon />
              {microphoneLabel[microphoneStatus] ?? "Mic idle"}
            </span>
            <button
              type="button"
              onClick={() => void startInterview(resumeText, jobDescription)}
              disabled={!isReady || state.isRecording || isBusy}
              className="button button-start"
            >
              <span className="button-play" aria-hidden="true">▶</span>
              {isBusy ? "Connecting…" : "Start interview"}
            </button>
            <button
              type="button"
              onClick={stopInterview}
              disabled={!state.isRecording && !isBusy}
              className="button button-stop"
            >
              <span className="stop-square" aria-hidden="true" />
              Stop
            </button>
          </div>
        </section>

        <div className="workspace-grid">
          <aside className="context-card panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR CONTEXT</p>
                <h2>Make answers yours</h2>
              </div>
              <span className="context-step">01</span>
            </div>
            <p className="panel-description">Add your experience and the role details. Your copilot uses these to keep suggestions relevant and grounded.</p>
            <div className="context-fields">
              <label className="field">
                <span className="field-label">Resume / candidate summary <span>REQUIRED</span></span>
                <textarea
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  disabled={state.isRecording || isBusy}
                  placeholder="Paste your resume or summarize your skills, experience, and achievements…"
                  aria-label="Resume or candidate summary"
                />
              </label>
              <label className="field">
                <span className="field-label">Job description <span>REQUIRED</span></span>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  disabled={state.isRecording || isBusy}
                  placeholder="Paste the role description, responsibilities, or qualifications…"
                  aria-label="Job description"
                />
              </label>
            </div>
            <div className={`context-note ${isReady ? "context-complete" : ""}`}>
              <span className="note-icon">{isReady ? "✓" : "i"}</span>
              <span>{isReady ? "Context added. Your suggestions will be tailored to this role." : "Both fields are needed to start. Your browser will ask for microphone access."}</span>
            </div>
          </aside>

          <section className="live-column" aria-label="Live interview">
            <article className={`answer-card panel ${latestAnswer && !latestAnswer.isComplete ? "answer-streaming" : ""}`}>
              <div className="answer-heading">
                <div className="section-title">
                  <span className="title-icon answer-icon"><SparklesIcon /></span>
                  <div>
                    <div className="title-line">
                      <h2>Suggested answer</h2>
                      {latestAnswer && !latestAnswer.isComplete ? <span className="generating-label"><span />Generating</span> : null}
                    </div>
                    <p>Clear, concise talking points based on your context</p>
                  </div>
                </div>
                {latestAnswer ? (
                  <button type="button" onClick={() => void copyAnswer()} className="copy-button" aria-label="Copy suggested answer">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M12 7V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" stroke="currentColor" strokeWidth="1.4" /></svg>
                    {copyMessage || "Copy"}
                  </button>
                ) : null}
              </div>
              <div className="answer-body" aria-live="polite">
                {latestAnswer?.text ? (
                  <>
                    <p className="answer-text">{latestAnswer.text}</p>
                    {latestAnswer.isComplete && latestAnswer.latencyMs !== undefined ? (
                      <p className="answer-latency">
                        First token <strong>{latestAnswer.timeToFirstTokenMs ?? latestAnswer.latencyMs} ms</strong>
                        <span>·</span>
                        Complete in <strong>{(latestAnswer.latencyMs / 1000).toFixed(1)} s</strong>
                      </p>
                    ) : null}
                  </>
                ) : state.activity === "thinking" || state.activity === "answering" ? (
                  <div className="answer-pending">
                    <span className="loading-orb"><SparklesIcon /></span>
                    <div>
                      <strong>{state.activity === "thinking" ? "Thinking through the question" : "Preparing your answer"}</strong>
                      <p>Grounding a concise response in your experience…</p>
                    </div>
                    <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
                  </div>
                ) : (
                  <div className="answer-empty">
                    <span className="empty-sparkle"><SparklesIcon /></span>
                    <strong>Your answer will appear here</strong>
                    <p>Once a question is detected, your suggested response will stream in real time.</p>
                  </div>
                )}
              </div>
              {answerList.length > 1 ? (
                <details className="previous-answers">
                  <summary>Previous responses <span>{answerList.length - 1}</span></summary>
                  <div className="previous-answer-list">
                    {answerList.slice(0, -1).reverse().map((answer) => {
                      const question = state.detectedQuestions.find((item) => item.id === answer.questionId);
                      return (
                        <div key={answer.id} className="previous-answer">
                          {question ? <p className="previous-question">{question.text}</p> : null}
                          <p>{answer.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </article>

            <article className="question-card panel">
              <div className="question-header">
                <div className="section-title">
                  <span className="title-icon question-icon"><WaveformIcon /></span>
                  <div>
                    <h2>Detected question</h2>
                    <p>Identified after a natural pause in the conversation</p>
                  </div>
                </div>
                <span className="question-count">{state.detectedQuestions.length} detected</span>
              </div>
              <div className={`question-content ${latestQuestion ? "has-question" : ""}`}>
                <span className="question-marker" />
                <p>{latestQuestion?.text ?? "The latest interview question will show up here."}</p>
              </div>
            </article>

            <article className="transcript-card panel">
              <div className="transcript-header">
                <div className="section-title">
                  <span className="title-icon transcript-icon"><MicrophoneIcon /></span>
                  <div>
                    <h2>Live transcript</h2>
                    <p>Speech recognized from your microphone</p>
                  </div>
                </div>
                {state.isRecording ? (
                  <span className="live-label"><span className="live-wave"><i /><i /><i /><i /></span> LIVE</span>
                ) : null}
              </div>
              <div className="transcript-body" aria-live="polite" aria-relevant="additions text">
                {state.finalTranscripts.length === 0 && !state.partialTranscript ? (
                  <div className="transcript-empty">
                    <span className="empty-mic"><MicrophoneIcon /></span>
                    <p>Transcript will appear here when you start listening.</p>
                  </div>
                ) : null}
                {state.finalTranscripts.map((transcript, index) => (
                  <p key={`${index}-${transcript}`} className="transcript-final">
                    <span className="transcript-tag">FINAL</span>
                    {transcript}
                  </p>
                ))}
                {state.partialTranscript ? (
                  <p className="transcript-partial">
                    <span className="transcript-tag">LIVE</span>
                    {state.partialTranscript}
                  </p>
                ) : null}
                <div ref={transcriptEndRef} />
              </div>
            </article>
          </section>
        </div>

        {state.error ? (
          <div role="alert" className="error-banner">
            <span className="error-symbol">!</span>
            <p>{state.error}</p>
          </div>
        ) : null}

        <footer className="workspace-footer">
          <span>Interview AI</span>
          <span>Use suggestions as prompts, not scripts. Keep your answers true to your experience.</span>
        </footer>
      </div>
    </main>
  );
}

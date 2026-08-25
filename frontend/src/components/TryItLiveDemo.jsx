// frontend/src/components/TryItLiveDemo.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Anonymous Interactive "Try It Live" Demo Component
//
// Zero-setup visitor demo for the landing page:
//   - 3 curated premade questions (Tech workflow & problem solving)
//   - Question switcher to cycle through prompts
//   - TTS: "Hear the AI" → POST /api/tts/speak → plays MP3
//   - STT: "Tap & speak" → ws://localhost:5000/ws/demo → live transcript + 3C scores
//   - 30-second recording auto-cutoff (client + server side)
//   - 3-attempt cap per session → triggers onOpenAuth() on 4th attempt
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Volume2, ChevronRight } from "lucide-react";


// ── Constants ────────────────────────────────────────────────────────────────
const WS_URL = "ws://localhost:5000/ws/demo";
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;
const MAX_RECORDING_SECONDS = 30;
const MAX_ATTEMPTS = 3;

const PREMADE_QUESTIONS = [
  "What is a technical project you recently worked on?",
  "How do you usually approach troubleshooting a difficult technical bug?",
  "Why did you decide to go into IT?",
];

// ── Icons: lucide-react, stroke-driven, inherit currentColor so state colors just work ──
// ── DemoScaleBar helper ──────────────────────────────────────────────────────
const DemoScaleBar = ({ color, filled }) => (
  <div className="lp-demo-scale" aria-hidden="true">
    {Array.from({ length: 10 }).map((_, i) => (
      <div
        key={i}
        className="lp-demo-scale-seg"
        style={i < filled ? { backgroundColor: color } : undefined}
      />
    ))}
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
export default function TryItLiveDemo({ onOpenAuth }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(MAX_RECORDING_SECONDS);
  const [transcriptText, setTranscriptText] = useState("");
  // null until the first real 3C result arrives — nothing is pre-claimed
  const [scores, setScores] = useState(null);
  const [micError, setMicError] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const audioRef = useRef(null);
  const fetchAbortControllerRef = useRef(null);
  const isTTSActiveRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const recordingStartRef = useRef(null);
  // Accumulated finalized speech — only the live in-progress turn rides on top
  const finalTranscriptRef = useRef("");

  // ── TTS: "Hear the AI" ─────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    isTTSActiveRef.current = false;
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
      fetchAbortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsAudioPlaying(false);
    setIsAudioLoading(false);
  }, []);

  // ── STT: "Tap & speak" ─────────────────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    cleanupAudio();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
    }
    setIsRecording(false);
    setRecordingTimer(MAX_RECORDING_SECONDS);
  }, [isRecording, cleanupAudio]);

  const beginMicCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Only a real, successful capture counts against the free-attempt cap
      setAttemptCount((prev) => prev + 1);
      setMicError("");
      setTranscriptText("");
      finalTranscriptRef.current = "";

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "start_recording" }));
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        wsRef.current.send(pcm.buffer);
      };

      recordingStartRef.current = Date.now();
      setRecordingTimer(MAX_RECORDING_SECONDS);
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsed);
        setRecordingTimer(remaining);

        if (remaining <= 0) {
          cleanupAudio();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
          }
          setIsRecording(false);
          setRecordingTimer(MAX_RECORDING_SECONDS);
        }
      }, 1000);
    } catch (err) {
      console.error("[TryItLive] Mic error:", err.message);
      const userFacing =
        err?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow the mic in your browser, then try again."
          : err?.name === "NotFoundError"
            ? "No microphone was found. Connect one, then try again."
            : "Couldn't start the microphone. Check your browser settings and try again.";
      setMicError(userFacing);
      setIsRecording(false);
    }
  }, [cleanupAudio]);

  const startRecording = useCallback(async () => {
    if (attemptCount >= MAX_ATTEMPTS) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    stopAudio();

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        beginMicCapture();
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "transcript") {
          if (msg.isFinal) {
            // Commit the finished turn once — never append the interim preview again.
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
            }
            setTranscriptText(finalTranscriptRef.current);
          } else if (msg.text) {
            // Interim: overlay the live in-progress turn on the accumulated result
            // so finalized speech stays stable instead of flickering word-by-word.
            setTranscriptText(
              finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text
            );
          }
        } else if (msg.type === "scores") {
          setScores({
            clarity: msg.clarity,
            correctness: msg.correctness,
            completeness: msg.completeness,
          });
        } else if (msg.type === "recording_timeout") {
          cleanupAudio();
          setIsRecording(false);
          setRecordingTimer(MAX_RECORDING_SECONDS);
        } else if (msg.type === "error") {
          console.error("[TryItLive] WS error:", msg.message);
        }
      };

      ws.onerror = () => {
        setMicError("Couldn't reach the speech server. Check your connection and try again.");
      };

      ws.onclose = () => {
        cleanupAudio();
        setIsRecording(false);
        setRecordingTimer(MAX_RECORDING_SECONDS);
        wsRef.current = null;
      };
    } else {
      beginMicCapture();
    }
  }, [attemptCount, onOpenAuth, cleanupAudio, beginMicCapture, stopAudio]);

  // ── Question switcher & Play Audio ─────────────────────────────────────────
  const handleNextQuestion = useCallback(() => {
    stopRecording();
    stopAudio();
    setSelectedQuestion((prev) => (prev + 1) % PREMADE_QUESTIONS.length);
    // A new prompt deserves a clean slate — never show the previous answer
    setTranscriptText("");
    finalTranscriptRef.current = "";
    setScores(null);
    setMicError("");
  }, [stopRecording, stopAudio]);

  const playQuestionAudio = useCallback(async () => {
    // Synchronous ref check prevents microtask/render race conditions
    if (isTTSActiveRef.current || isAudioPlaying || isAudioLoading || audioRef.current || fetchAbortControllerRef.current) {
      console.log("[TryItLive] TTS active -> stopping current playback/request");
      stopAudio();
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    // Set synchronous lock immediately before any async call
    isTTSActiveRef.current = true;
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;
    setIsAudioLoading(true);

    try {
      const question = PREMADE_QUESTIONS[selectedQuestion];
      console.log(`[TryItLive] Requesting TTS audio for Q${selectedQuestion + 1}: "${question.substring(0, 40)}…"`);

      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "TTS request failed");
      }

      const blob = await res.blob();
      if (abortController.signal.aborted || !isTTSActiveRef.current) {
        console.log("[TryItLive] TTS fetch aborted before play");
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        console.log("[TryItLive] TTS audio finished playing");
        URL.revokeObjectURL(url);
        isTTSActiveRef.current = false;
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
        audioRef.current = null;
        fetchAbortControllerRef.current = null;
      };
      audio.onerror = (e) => {
        console.error("[TryItLive] TTS audio playback error:", e);
        URL.revokeObjectURL(url);
        isTTSActiveRef.current = false;
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
        audioRef.current = null;
        fetchAbortControllerRef.current = null;
      };

      setIsAudioLoading(false);
      setIsAudioPlaying(true);
      console.log("[TryItLive] Playing audio stream...");
      await audio.play();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[TryItLive] TTS error:", err.message);
      } else {
        console.log("[TryItLive] TTS fetch aborted safely");
      }
      isTTSActiveRef.current = false;
      setIsAudioPlaying(false);
      setIsAudioLoading(false);
      audioRef.current = null;
      fetchAbortControllerRef.current = null;
    }
  }, [selectedQuestion, isAudioPlaying, isAudioLoading, isRecording, stopAudio, stopRecording]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupAudio();
      stopAudio();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Backend scores arrive on the 0–100 scale; the product rubric speaks 1.0–5.0
  const toRubricScore = (score100) => (score100 / 20).toFixed(1);
  const rubricFill = (score100) => Math.max(0, Math.round(score100 / 10));

  // One live-region sentence so screen readers track the demo's state
  // Mic errors announce via the visible role="alert" node — keep this polite
  // region for state changes only, so screen readers don't double-report.
  const statusAnnouncement = isAudioLoading
    ? "Loading the question audio."
    : isAudioPlaying
      ? "The AI is speaking the question."
      : isRecording
        ? "Listening. Recording your answer."
        : "Ready. Tap and speak to try the live demo.";

  // Derive composite status for CSS data-attribute targeting
  const demoStatus = isRecording ? "recording" : (isAudioPlaying || isAudioLoading) ? "speaking" : "idle";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="lp-demo"
      role="group"
      aria-label="Live AI interview demo"
      data-status={demoStatus}
    >
      {/* ── Header bar ── */}
      <div className="lp-demo-header">
        <div className="lp-demo-header-left">
          <div className="lp-demo-mark" aria-hidden="true">
            <div className="lp-demo-mark-ring" />
            <div className="lp-demo-mark-dot" />
          </div>
          <div className="lp-demo-title-group">
            <span className="lp-demo-title">Live voice demo</span>
            <span className="lp-demo-subtitle">No sign-up · 3 free attempts</span>
          </div>
        </div>

        <div className="lp-demo-header-right">
          <div className="lp-demo-attempt-pill" title="Free demo attempt limit">
            <span>{attemptCount}/{MAX_ATTEMPTS} used</span>
          </div>
          <div className="lp-demo-live-badge" aria-label="Live demo indicator">
            <div className="lp-demo-live-dot" aria-hidden="true" />
            <span className="lp-demo-live-label">LIVE</span>
          </div>
        </div>
      </div>

      {/* ── Body: left (AI speaker) + right (user panel) ── */}
      <div className="lp-demo-body">

        {/* Left — AI Speaker panel */}
        <div className="lp-demo-speaker">
          {/* Calm interviewer mark */}
          <div className="lp-demo-avatar-wrap">
            <div className="lp-demo-avatar" aria-hidden="true">
              <div className="lp-demo-orb-halo" />
              <div className="lp-demo-orb-ring" />
              <div className="lp-demo-orb" />
              <div className="lp-demo-waveform">
                <div className="lp-demo-wave-bar lp-demo-wave-bar--1" />
                <div className="lp-demo-wave-bar lp-demo-wave-bar--2" />
                <div className="lp-demo-wave-bar lp-demo-wave-bar--3" />
                <div className="lp-demo-wave-bar lp-demo-wave-bar--4" />
                <div className="lp-demo-wave-bar lp-demo-wave-bar--5" />
              </div>
            </div>

            {/* Status indicator below avatar */}
            <div className="lp-demo-status-row">
              <span className={`lp-demo-status-chip${demoStatus !== "idle" ? " lp-demo-status-chip--active" : ""}`}>
                <span className="lp-demo-status-dot" aria-hidden="true" />
                {isAudioLoading ? "LOADING" : isAudioPlaying ? "SPEAKING" : isRecording ? "LISTENING" : "READY"}
              </span>
            </div>
          </div>

          {/* Question card */}
          <div className="lp-demo-question-container">
            <div className="lp-demo-question-header">
              <span className="lp-demo-question-tag">Question {selectedQuestion + 1} of {PREMADE_QUESTIONS.length}</span>
              <button
                className="lp-demo-question-cycle"
                onClick={handleNextQuestion}
                title="Switch question prompt"
                aria-label="Switch question prompt"
              >
                <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>Next</span>
              </button>
            </div>
            <p className="lp-demo-question">
              &ldquo;{PREMADE_QUESTIONS[selectedQuestion]}&rdquo;
            </p>
            {/* Hear the AI — contextually placed in speaker panel */}
            <button
              className={`lp-demo-play-btn${isAudioPlaying || isAudioLoading ? " lp-demo-play-btn--active" : ""}`}
              aria-label={isAudioPlaying || isAudioLoading ? "Stop AI audio" : "Hear the AI"}
              onClick={playQuestionAudio}
            >
              <Volume2 size={16} strokeWidth={2} aria-hidden="true" />
              <span>{isAudioLoading ? "Loading..." : isAudioPlaying ? "Stop audio" : "Hear the AI"}</span>
            </button>
          </div>
        </div>

        {/* Vertical rule separator (desktop) */}
        <div className="lp-demo-vr" aria-hidden="true" />

        {/* Right — User response panel */}
        <div className="lp-demo-right">

          {/* Transcript box */}
          <div className={`lp-demo-transcript-box${micError ? " lp-demo-transcript-box--error" : ""}`}>
            <div className="lp-demo-transcript-meta">
              <div className="lp-demo-transcribing" aria-label="Transcribing indicator">
                <div className="lp-demo-transcribing-dot" aria-hidden="true" />
                <span className="lp-demo-transcribing-label">
                  {isRecording ? "TRANSCRIBING" : "YOUR SPEECH"}
                </span>
              </div>
              <div className="lp-demo-meta-spacer" aria-hidden="true" />
              <div className="lp-demo-timestamp">
                <span>{isRecording ? formatTimer(recordingTimer) : "00:30 MAX"}</span>
              </div>
            </div>
            {micError ? (
              <p className="lp-demo-error-text" role="alert">
                {micError}
              </p>
            ) : (
              <p
                className={`lp-demo-transcript-text${transcriptText ? "" : " lp-demo-transcript-text--empty"}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {transcriptText
                  ? `"${transcriptText}"`
                  : "Tap & speak into your mic to try real-time speech recognition and instant 3C evaluation."}
              </p>
            )}
            <span className="lp-demo-sr-only" aria-live="polite">
              {statusAnnouncement}
            </span>
          </div>

          {/* 3C Score chips — neutral until the first real result; cyan as the single live accent */}
          <div className="lp-demo-feedback">
            <div className={`lp-demo-chip${scores ? " lp-demo-chip--active" : " lp-demo-chip--neutral"}`}>
              <div className="lp-demo-chip-top">
                <div className="lp-demo-chip-label-row">
                  <div className="lp-demo-chip-dot" aria-hidden="true" />
                  <span className="lp-demo-chip-label">CLARITY</span>
                </div>
                <span className="lp-demo-chip-score">{scores ? toRubricScore(scores.clarity) : "—"}</span>
              </div>
              <DemoScaleBar color="#22D3EE" filled={scores ? rubricFill(scores.clarity) : 0} />
            </div>
            <div className={`lp-demo-chip${scores ? " lp-demo-chip--active" : " lp-demo-chip--neutral"}`}>
              <div className="lp-demo-chip-top">
                <div className="lp-demo-chip-label-row">
                  <div className="lp-demo-chip-dot" aria-hidden="true" />
                  <span className="lp-demo-chip-label">CORRECTNESS</span>
                </div>
                <span className="lp-demo-chip-score">{scores ? toRubricScore(scores.correctness) : "—"}</span>
              </div>
              <DemoScaleBar color="#22D3EE" filled={scores ? rubricFill(scores.correctness) : 0} />
            </div>
            <div className={`lp-demo-chip${scores ? " lp-demo-chip--active" : " lp-demo-chip--neutral"}`}>
              <div className="lp-demo-chip-top">
                <div className="lp-demo-chip-label-row">
                  <div className="lp-demo-chip-dot" aria-hidden="true" />
                  <span className="lp-demo-chip-label">COMPLETENESS</span>
                </div>
                <span className="lp-demo-chip-score">{scores ? toRubricScore(scores.completeness) : "—"}</span>
              </div>
              <DemoScaleBar color="#22D3EE" filled={scores ? rubricFill(scores.completeness) : 0} />
            </div>
          </div>

          {/* Mic / Record control */}
          <div className="lp-demo-controls">
            <button
              className={`lp-demo-mic-btn${isRecording ? " lp-demo-mic-btn--active" : ""}`}
              aria-label={isRecording ? "Stop speaking" : "Start speaking"}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording
                ? <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                : <Mic size={16} strokeWidth={2} aria-hidden="true" />}
              <span>{isRecording ? `Stop · ${formatTimer(recordingTimer)}` : "Tap & speak"}</span>
            </button>
            <p className="lp-demo-controls-hint">
              {micError
                ? "Fix the issue above, then tap & speak to retry."
                : attemptCount >= MAX_ATTEMPTS
                  ? "Unlimited practice with a free account"
                  : `${MAX_ATTEMPTS - attemptCount} free attempt${MAX_ATTEMPTS - attemptCount !== 1 ? "s" : ""} remaining`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer caption ── */}
      <div className="lp-demo-caption">
        <span className="lp-demo-caption-text">
          Real-time speech-to-text · instant 3C scoring
        </span>
      </div>
    </div>
  );
}

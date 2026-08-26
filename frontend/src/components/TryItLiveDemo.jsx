// frontend/src/components/TryItLiveDemo.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Anonymous Interactive "Try It Live" Demo Component
// Cool Color Spectrum: Royal Cobalt · Sky Cyan · Cool Mint
// Primitives inspired by: shadcn/ui · Rare UI · Beautiful UI
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Volume2, ChevronRight, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const WS_URL = "ws://localhost:5000/ws/demo";
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;
const MAX_RECORDING_SECONDS = 30;
const MAX_ATTEMPTS = 3;

const PREMADE_QUESTIONS = [
  {
    category: "System Architecture",
    text: "What is a technical project you recently worked on?",
  },
  {
    category: "Troubleshooting",
    text: "How do you usually approach troubleshooting a difficult technical bug?",
  },
  {
    category: "Career & Motivation",
    text: "Why did you decide to go into IT?",
  },
];

// ── Segmented Scale Bar Helper ───────────────────────────────────────────────
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
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(MAX_RECORDING_SECONDS);
  const [transcriptText, setTranscriptText] = useState("");
  const [scores, setScores] = useState(null);
  const [micError, setMicError] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);

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

  // ── STT: Mic Stream & Audio Context Cleanup ────────────────────────────────
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
          ? "Microphone access is blocked. Please enable microphone permission in your browser."
          : err?.name === "NotFoundError"
            ? "No microphone found. Please connect a microphone and try again."
            : "Could not initialize microphone. Please check your browser audio settings.";
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
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
            }
            setTranscriptText(finalTranscriptRef.current);
          } else if (msg.text) {
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
        setMicError("Speech recognition server unreachable. Retrying connection...");
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
  const handleSelectQuestion = useCallback((index) => {
    stopRecording();
    stopAudio();
    setSelectedQuestion(index);
    setTranscriptText("");
    finalTranscriptRef.current = "";
    setScores(null);
    setMicError("");
  }, [stopRecording, stopAudio]);

  const handleNextQuestion = useCallback(() => {
    handleSelectQuestion((selectedQuestion + 1) % PREMADE_QUESTIONS.length);
  }, [selectedQuestion, handleSelectQuestion]);

  const playQuestionAudio = useCallback(async () => {
    if (isTTSActiveRef.current || isAudioPlaying || isAudioLoading || audioRef.current || fetchAbortControllerRef.current) {
      stopAudio();
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    isTTSActiveRef.current = true;
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;
    setIsAudioLoading(true);

    try {
      const currentQ = PREMADE_QUESTIONS[selectedQuestion].text;

      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentQ }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error("TTS request failed");
      }

      const blob = await res.blob();
      if (abortController.signal.aborted || !isTTSActiveRef.current) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        isTTSActiveRef.current = false;
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
        audioRef.current = null;
        fetchAbortControllerRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        isTTSActiveRef.current = false;
        setIsAudioPlaying(false);
        setIsAudioLoading(false);
        audioRef.current = null;
        fetchAbortControllerRef.current = null;
      };

      setIsAudioLoading(false);
      setIsAudioPlaying(true);
      await audio.play();
    } catch (err) {
      isTTSActiveRef.current = false;
      setIsAudioPlaying(false);
      setIsAudioLoading(false);
      audioRef.current = null;
      fetchAbortControllerRef.current = null;
    }
  }, [selectedQuestion, isAudioPlaying, isAudioLoading, isRecording, stopAudio, stopRecording]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      stopAudio();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanupAudio, stopAudio]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toRubricScore = (score100) => (score100 / 20).toFixed(1);
  const rubricFill = (score100) => Math.max(0, Math.round(score100 / 10));

  const demoStatus = isRecording ? "recording" : (isAudioPlaying || isAudioLoading) ? "speaking" : "idle";

  return (
    <div
      className="lp-demo"
      role="group"
      aria-label="Live interactive AI interview demo"
      data-status={demoStatus}
    >
      {/* Top Header Bar */}
      <div className="lp-demo-header">
        <div className="lp-demo-header-left">
          <div className="lp-demo-mark" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.5} />
          </div>
          <div className="lp-demo-title-group">
            <span className="lp-demo-title">Voice AI Sandbox</span>
            <span className="lp-demo-subtitle">Zero setup · 3 free live attempts</span>
          </div>
        </div>

        <div className="lp-demo-header-right">
          <div className="lp-demo-attempt-pill">
            <span>{attemptCount}/{MAX_ATTEMPTS} attempts</span>
          </div>
          <div className="lp-demo-live-badge">
            <div className="lp-demo-live-dot" aria-hidden="true" />
            <span>INTERACTIVE</span>
          </div>
        </div>
      </div>

      {/* Demo Body */}
      <div className="lp-demo-body">
        {/* Question Selector Card (Beautiful UI / shadcn style) */}
        <div className="lp-demo-question-card">
          <div className="lp-demo-question-tabs">
            <div className="lp-demo-question-pills">
              {PREMADE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  className={`lp-demo-q-pill${selectedQuestion === idx ? " lp-demo-q-pill--active" : ""}`}
                  onClick={() => handleSelectQuestion(idx)}
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>
            <button
              className="lp-demo-question-next"
              onClick={handleNextQuestion}
              aria-label="Switch to next question prompt"
            >
              <span>Next</span>
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>

          <p className="lp-demo-question-text">
            &ldquo;{PREMADE_QUESTIONS[selectedQuestion].text}&rdquo;
          </p>

          <div className="lp-demo-question-actions">
            <button
              className={`lp-demo-tts-btn${isAudioPlaying || isAudioLoading ? " lp-demo-tts-btn--active" : ""}`}
              onClick={playQuestionAudio}
              aria-label={isAudioPlaying ? "Stop voice audio" : "Hear AI voice prompt"}
            >
              <Volume2 size={15} strokeWidth={2} />
              <span>{isAudioLoading ? "Loading voice..." : isAudioPlaying ? "Stop AI Voice" : "Hear AI Prompt"}</span>
            </button>
          </div>
        </div>

        {/* Live Speech Recognition Box (Beautiful UI Thinking / Stream style) */}
        <div className={`lp-demo-transcript-card${micError ? " lp-demo-transcript-card--error" : ""}`}>
          <div className="lp-demo-transcript-header">
            <div className="lp-demo-transcribing-status">
              {isRecording && <div className="lp-demo-transcribing-dot" aria-hidden="true" />}
              <span>{isRecording ? "LISTENING TO VOICE..." : "YOUR SPOKEN TRANSCRIPT"}</span>
            </div>
            <span className="lp-demo-timer-badge">
              {isRecording ? formatTimer(recordingTimer) : "30s MAX"}
            </span>
          </div>

          {micError ? (
            <div className="lp-demo-transcript-error">
              <AlertCircle size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              {micError}
            </div>
          ) : (
            <p className={`lp-demo-transcript-content${!transcriptText ? " lp-demo-transcript-empty" : ""}`}>
              {transcriptText || "Tap the button below and speak your answer out loud into your microphone..."}
            </p>
          )}
        </div>

        {/* 3C Rubric Dimension Chips */}
        <div className="lp-demo-rubric-grid">
          <div className="lp-demo-score-card lp-demo-score-card--clarity">
            <div className="lp-demo-score-head">
              <span className="lp-demo-score-label">CLARITY</span>
              <span className="lp-demo-score-val" style={{ color: "var(--blue)" }}>
                {scores ? `${toRubricScore(scores.clarity)}/5` : "—"}
              </span>
            </div>
            <DemoScaleBar color="var(--blue)" filled={scores ? rubricFill(scores.clarity) : 0} />
          </div>

          <div className="lp-demo-score-card lp-demo-score-card--correctness">
            <div className="lp-demo-score-head">
              <span className="lp-demo-score-label">CORRECTNESS</span>
              <span className="lp-demo-score-val" style={{ color: "var(--mint)" }}>
                {scores ? `${toRubricScore(scores.correctness)}/5` : "—"}
              </span>
            </div>
            <DemoScaleBar color="var(--mint)" filled={scores ? rubricFill(scores.correctness) : 0} />
          </div>

          <div className="lp-demo-score-card lp-demo-score-card--completeness">
            <div className="lp-demo-score-head">
              <span className="lp-demo-score-label">COMPLETENESS</span>
              <span className="lp-demo-score-val" style={{ color: "var(--amber)" }}>
                {scores ? `${toRubricScore(scores.completeness)}/5` : "—"}
              </span>
            </div>
            <DemoScaleBar color="var(--amber)" filled={scores ? rubricFill(scores.completeness) : 0} />
          </div>
        </div>

        {/* Action Controls (Rare UI Tactile System) */}
        <div className="lp-demo-actions">
          <button
            className={`lp-demo-mic-main${isRecording ? " lp-demo-mic-main--active" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? "Stop recording answer" : "Start speaking"}
          >
            {isRecording ? (
              <>
                <Square size={14} fill="currentColor" />
                <span>Stop Answer ({formatTimer(recordingTimer)})</span>
              </>
            ) : (
              <>
                <Mic size={18} strokeWidth={2.5} />
                <span>Tap & Speak Your Answer</span>
              </>
            )}
          </button>

          <span className="lp-demo-action-hint">
            {attemptCount >= MAX_ATTEMPTS
              ? "Free attempt limit reached. Create a free account for unlimited practice!"
              : `${MAX_ATTEMPTS - attemptCount} free live demo attempt${MAX_ATTEMPTS - attemptCount !== 1 ? "s" : ""} remaining`}
          </span>
        </div>
      </div>
    </div>
  );
}

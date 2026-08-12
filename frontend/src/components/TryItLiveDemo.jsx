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

// ── Icons ────────────────────────────────────────────────────────────────────
const StopIcon = ({ fill = "#FFFFFF" }) => (
  <svg viewBox="0 0 14 14" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="10" height="10" rx="2" fill={fill} />
  </svg>
);

const MicIcon = ({ size = 15, fill = "#081318" }) => (
  <svg viewBox="0 0 14 14" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.9 0.588q-0.643 0.027-1.183 0.386-0.537 0.355-0.803 0.93-0.14 0.28-0.198 0.547-0.027 0.096-0.027 0.475l-0.014 4.409 0.041 0.167q0.198 0.786 0.759 1.261 0.434 0.366 1.022 0.52 0.109 0.027 0.191 0.034 0.085 0.007 0.311 0.007 0.28 0 0.434-0.027 0.154-0.027 0.379-0.113 0.461-0.167 0.824-0.523 0.366-0.359 0.547-0.834 0.041-0.126 0.085-0.294l0.055-0.171 0-4.156q0-0.489-0.027-0.687-0.014-0.126-0.072-0.294l-0.014-0.027q-0.236-0.701-0.803-1.135-0.567-0.434-1.309-0.475l-0.198 0z" fill={fill} />
  </svg>
);

const VolumeIcon = () => (
  <svg viewBox="0 0 14 14" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.85156 1.76367q-0.16748 0.02734-0.30761 0.11279-0.08545 0.04102-0.27344 0.21875-0.18799 0.17432-0.91602 0.90235-1.08008 1.06299-1.12109 1.06982-0.04102 0.00684-0.85449 0.02051-0.66992 0-0.82373 0.01367-0.15381 0.01367-0.30762 0.09912-0.23926 0.11279-0.3999 0.30762-0.16064 0.19482-0.23243 0.44775-0.01367 0.08545-0.02734 0.3794l0 1.66455 0 1.66455q0.01367 0.29395 0.02734 0.3794 0.08545 0.30762 0.30762 0.52636 0.22559 0.21533 0.51953 0.31446 0.06836 0.01367 0.22217 0.02734l0.70068 0q0.82715 0.01367 0.86817 0.02051 0.04102 0.00684 1.09717 1.05957 1.05957 1.04932 1.12793 1.09033 0.22559 0.15381 0.48535 0.16748 0.25977 0.01367 0.50927-0.11279 0.11279-0.05469 0.2461-0.18116 0.1333-0.12646 0.18799-0.25292l0.02734-0.04102q0.04443-0.08545 0.05811-0.25293 0.01367-0.2085 0.02734-0.97754l0-7.07178q-0.01367-0.76904-0.02734-0.84082-0.08545-0.33496-0.35889-0.55029-0.27344-0.21875-0.6084-0.21875-0.11279 0-0.15381 0.01367z m5.27735 0.96729q-0.10938 0.02734-0.2085 0.11279-0.09912 0.08203-0.14014 0.16064-0.04101 0.0752-0.0581 0.17432-0.01367 0.0957-0.01367 0.16748 0.03076 0.19482 0.25293 0.43408 1.06299 1.14844 1.26123 2.67285 0.01367 0.19824 0.01367 0.54688 0 0.34863-0.01367 0.54687-0.19824 1.52441-1.26123 2.67286-0.16748 0.18115-0.21875 0.32129-0.04785 0.14014-0.01368 0.29394 0.0376 0.15381 0.15381 0.28027 0.11963 0.12647 0.31446 0.16407 0.19824 0.03418 0.35205-0.05127 0.11279-0.05469 0.34179-0.30078 0.23242-0.24609 0.42725-0.5127 0.81348-1.13135 1.02881-2.51562 0.21875-1.3877-0.21533-2.70362-0.19482-0.57422-0.45459-1.03564-0.25977-0.46484-0.63575-0.92627-0.32471-0.39307-0.49218-0.4751-0.08203-0.02734-0.22901-0.03418-0.14697-0.00684-0.1914 0.00684z m-5.30469 4.26904l0 3.83496-0.89551-0.89551q-0.89551-0.88184-0.96728-0.93652-0.2085-0.14014-0.43409-0.19824-0.08203-0.02734-0.21533-0.03418-0.1333-0.00684-0.73486-0.02051l-0.82715 0 0-3.5 0.82715 0q0.60156-0.01367 0.73486-0.02051 0.1333-0.00684 0.21533-0.03418 0.2666-0.07178 0.46143-0.21191 0.07178-0.05469 0.95361-0.93653l0.88184-0.88183q0 0 0 3.83496z m3.33252-2.31055q-0.16748 0.07178-0.28028 0.20508-0.11279 0.12988-0.12646 0.30078 0 0.12305 0.02734 0.21533 0.02734 0.09229 0.12647 0.2461 0.22559 0.33496 0.32129 0.61523 0.05811 0.19482 0.07861 0.33496 0.02051 0.14014 0.02051 0.39307 0 0.25293-0.02051 0.39307-0.02051 0.14014-0.07861 0.33496-0.0957 0.28027-0.32129 0.61523-0.11279 0.18115-0.14014 0.2666-0.05469 0.2666 0.09912 0.48535 0.15381 0.21533 0.40332 0.22901 0.25293 0.01367 0.42041-0.11279 0.11279-0.09912 0.29395-0.39307 0.18457-0.29395 0.28027-0.55713 0.30762-0.81348 0.21533-1.65088-0.08887-0.84082-0.57763-1.56885-0.19482-0.28027-0.3794-0.33837-0.08203-0.02734-0.19482-0.02735-0.11279 0-0.16748 0.01367z" fill="#FFFFFF" />
  </svg>
);

const ChevronRightIcon = ({ size = 11, fill = "#9CA3AF" }) => (
  <svg viewBox="0 0 12 12" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.5 2.25 8.25 6 4.5 9.75" stroke={fill} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
            setTranscriptText((prev) => (prev ? `${prev} ${msg.text}` : msg.text));
          } else {
            setTranscriptText(msg.text || "");
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
                <ChevronRightIcon />
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
              <VolumeIcon />
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
              <p className="lp-demo-transcript-text" aria-live="polite" aria-atomic="true">
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
              {isRecording ? <StopIcon fill="#67E8F9" /> : <MicIcon size={15} fill="#081318" />}
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
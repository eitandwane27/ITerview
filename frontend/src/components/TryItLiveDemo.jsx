// frontend/src/components/TryItLiveDemo.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Exact AI Studio Audio Console Layout
// Track Switcher: Frontend · Backend · System Design
// Two-Panel Layout: Verbal Transcript & Instant 3C Feedback
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic,
  Square,
  Volume2,
  ChevronRight,
  ShieldCheck,
  Zap,
  MessageSquare,
  Code2,
  Layers,
  Terminal,
  Cpu,
  AlertCircle,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const WS_URL = "ws://localhost:5000/ws/demo";
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;
const MAX_RECORDING_SECONDS = 30;
const MAX_ATTEMPTS = 3;

// ── Track & Question Database ────────────────────────────────────────────────
const TRACK_DATA = [
  {
    id: "frontend",
    label: "Frontend",
    icon: Code2,
    color: "var(--blue)",
    lightColor: "var(--blue-light)",
    borderColor: "var(--blue-border)",
    questions: [
      {
        id: "fe-1",
        tags: ["Project Experience", "Overview"],
        question: "What is a technical project you recently worked on?",
        hint: "Briefly describe what you built, what tools you used, and what you learned.",
      },
      {
        id: "fe-2",
        tags: ["Problem Solving", "Debugging"],
        question: "How do you usually approach troubleshooting a difficult technical bug?",
        hint: "Walk through how you identify the problem, test fixes, and verify it works.",
      },
      {
        id: "fe-3",
        tags: ["Career & Motivation", "Intro"],
        question: "Why did you decide to go into IT and software development?",
        hint: "Share what got you interested in technology and what you enjoy about building things.",
      },
    ],
  },
  {
    id: "backend",
    label: "Backend",
    icon: Terminal,
    color: "var(--mint)",
    lightColor: "var(--mint-light)",
    borderColor: "var(--mint-border)",
    questions: [
      {
        id: "be-1",
        tags: ["APIs & Web", "Fundamentals"],
        question: "How would you explain what an API is in simple terms?",
        hint: "Explain how applications share data, like a waiter delivering an order to a kitchen.",
      },
      {
        id: "be-2",
        tags: ["Core Concepts", "Overview"],
        question: "What is the difference between frontend and backend development?",
        hint: "Describe what users see on screen versus what runs behind the scenes on a server.",
      },
      {
        id: "be-3",
        tags: ["Learning", "Growth"],
        question: "Tell me about a time you had to learn a new programming concept or tool.",
        hint: "Describe your learning process, resources you found helpful, and how you practiced.",
      },
    ],
  },
  {
    id: "system-design",
    label: "System Design",
    icon: Layers,
    color: "var(--indigo)",
    lightColor: "var(--indigo-light)",
    borderColor: "var(--indigo-border)",
    questions: [
      {
        id: "sd-1",
        tags: ["Debugging", "Mindset"],
        question: "What steps do you take when your code doesn't work as expected?",
        hint: "Explain how you read error messages, check console logs, or ask for help.",
      },
      {
        id: "sd-2",
        tags: ["User Experience", "Basics"],
        question: "What are some simple ways to make a website or application easier for users?",
        hint: "Mention clear layouts, fast loading times, accessible colors, or mobile responsiveness.",
      },
      {
        id: "sd-3",
        tags: ["Collaboration", "Teamwork"],
        question: "Why is communication important when working on a technical project?",
        hint: "Discuss asking clarifying questions, sharing progress, and working well with others.",
      },
    ],
  },
];

// ── Segmented Scale Dashes Helper ───────────────────────────────────────────
const SegmentedScale = ({ color, filled }) => (
  <div className="lp-exact-scale" aria-hidden="true">
    {Array.from({ length: 8 }).map((_, i) => (
      <span
        key={i}
        className={`lp-exact-scale-dash${i < filled ? " lp-exact-scale-dash--filled" : ""}`}
        style={i < filled ? { backgroundColor: color } : undefined}
      />
    ))}
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
export default function TryItLiveDemo({ onOpenAuth }) {
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
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

  const currentTrack = TRACK_DATA[selectedTrackIndex];
  const currentQuestion = currentTrack.questions[selectedQuestionIndex];

  // ── TTS: "Hear AI Voice" ───────────────────────────────────────────────────
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

  // ── STT: Mic Stream Cleanup ────────────────────────────────────────────────
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
          ? "Microphone access is blocked. Please allow microphone permission in your browser."
          : err?.name === "NotFoundError"
            ? "No microphone found. Please connect a microphone and try again."
            : "Could not initialize microphone. Please check your audio settings.";
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

  // ── Track & Question Switchers ─────────────────────────────────────────────
  const handleSelectTrack = (idx) => {
    stopRecording();
    stopAudio();
    setSelectedTrackIndex(idx);
    setSelectedQuestionIndex(0);
    setTranscriptText("");
    finalTranscriptRef.current = "";
    setScores(null);
    setMicError("");
  };

  const handleSelectQuestion = (idx) => {
    stopRecording();
    stopAudio();
    setSelectedQuestionIndex(idx);
    setTranscriptText("");
    finalTranscriptRef.current = "";
    setScores(null);
    setMicError("");
  };

  const handleNextQuestion = () => {
    handleSelectQuestion((selectedQuestionIndex + 1) % currentTrack.questions.length);
  };

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
      const qText = currentQuestion.question;

      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: qText }),
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
  }, [currentQuestion, isAudioPlaying, isAudioLoading, isRecording, stopAudio, stopRecording]);

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
  const rubricFill = (score100) => Math.max(0, Math.round((score100 / 100) * 8));

  return (
    <div className="lp-exact-card" role="region" aria-label="Interactive AI Voice Interview Simulator">
      {/* ── 1. Minimal Header ── */}
      <div className="lp-exact-header">
        {/* Left: Mascot Avatar & Brand */}
        <div className="lp-exact-brand">
          <div className="lp-exact-avatar-box">
            <svg
              className="lp-exact-avatar-svg"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="50" cy="50" r="46" fill="url(#exact-avatar-glow)" opacity="0.3" />
              <rect x="24" y="28" width="52" height="46" rx="23" fill="url(#exact-avatar-head)" stroke="#3B82F6" strokeWidth="2" />
              <path d="M 18 44 C 18 20, 82 20, 82 44" stroke="#60A5FA" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              <rect x="14" y="38" width="10" height="20" rx="5" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.5" />
              <rect x="76" y="38" width="10" height="20" rx="5" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.5" />
              <rect x="32" y="38" width="36" height="22" rx="11" fill="#0B132B" stroke="#38BDF8" strokeWidth="1.5" />
              <rect x="41" y="45" width="2.5" height="7" rx="1" fill="#38BDF8" />
              <rect x="46" y="42" width="2.5" height="13" rx="1" fill="#38BDF8" />
              <rect x="51" y="41" width="2.5" height="15" rx="1" fill="#60A5FA" />
              <rect x="56" y="42" width="2.5" height="13" rx="1" fill="#38BDF8" />
              <rect x="61" y="45" width="2.5" height="7" rx="1" fill="#38BDF8" />
              <path d="M 22 54 Q 32 70, 46 68" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />
              <circle cx="48" cy="68" r="3.5" fill="#38BDF8" />
              <defs>
                <radialGradient id="exact-avatar-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="exact-avatar-head" x1="24" y1="28" x2="76" y2="74" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1E3A8A" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="lp-exact-brand-text">
            <span className="lp-exact-brand-name">iTerview</span>
            <span className="lp-exact-brand-sub">AI Interview Coach</span>
          </div>
        </div>

        {/* Right: Zero Login Pill, Q Switcher, Attempt Counter */}
        <div className="lp-exact-header-right">
          <div className="lp-exact-pill-tag">
            <ShieldCheck size={14} className="lp-exact-tag-icon" />
            <span>Zero login required</span>
          </div>

          <div className="lp-exact-q-switcher" role="tablist" aria-label="Question switcher">
            {currentTrack.questions.map((_, idx) => (
              <button
                key={idx}
                role="tab"
                aria-selected={selectedQuestionIndex === idx}
                className={`lp-exact-q-btn${selectedQuestionIndex === idx ? " lp-exact-q-btn--active" : ""}`}
                onClick={() => handleSelectQuestion(idx)}
              >
                Q{idx + 1}
              </button>
            ))}
            <button
              className="lp-exact-q-next"
              onClick={handleNextQuestion}
              aria-label="Next question prompt"
            >
              <span>Next</span>
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>

          <div className="lp-exact-attempt-pill">
            <span>{attemptCount}/{MAX_ATTEMPTS} used</span>
          </div>
        </div>
      </div>

      {/* ── 2. Dev Track Switcher & Hear AI Voice Bar ── */}
      <div className="lp-exact-track-bar">
        <div className="lp-exact-track-tabs" role="tablist" aria-label="Developer discipline tracks">
          {TRACK_DATA.map((track, idx) => {
            const Icon = track.icon;
            const isActive = selectedTrackIndex === idx;
            return (
              <button
                key={track.id}
                role="tab"
                aria-selected={isActive}
                className={`lp-exact-track-tab lp-exact-track-tab--${track.id}${isActive ? " lp-exact-track-tab--active" : ""}`}
                onClick={() => handleSelectTrack(idx)}
              >
                <Icon size={15} strokeWidth={2.2} className="lp-exact-track-icon" />
                <span>{track.label}</span>
              </button>
            );
          })}
        </div>

        <button
          className={`lp-exact-hear-btn${isAudioPlaying || isAudioLoading ? " lp-exact-hear-btn--active" : ""}`}
          onClick={playQuestionAudio}
          aria-label={isAudioPlaying ? "Stop voice audio" : "Hear AI voice prompt"}
        >
          <Volume2 size={16} strokeWidth={2.2} />
          <span>{isAudioLoading ? "Loading audio..." : isAudioPlaying ? "Stop Voice" : "Hear AI Voice"}</span>
        </button>
      </div>

      {/* ── 3. Context First (Tags, Question, Hint) ── */}
      <div className="lp-exact-context">
        <div className="lp-exact-tags">
          {currentQuestion.tags.map((tag, i) => (
            <span key={i} className="lp-exact-tag">
              {tag}
            </span>
          ))}
        </div>

        <h3 className="lp-exact-question">
          {currentQuestion.question}
        </h3>

        <p className="lp-exact-hint">
          {currentQuestion.hint}
        </p>
      </div>

      {/* ── 4. Two Panel Layout (Verbal Transcript & Instant 3C Feedback) ── */}
      <div className="lp-exact-two-panel">
        {/* Left Panel: Verbal Transcript */}
        <div className={`lp-exact-panel lp-exact-panel--transcript${micError ? " lp-exact-panel--error" : ""}`}>
          <div className="lp-exact-panel-header">
            <div className="lp-exact-panel-title">
              <span className="lp-exact-wave-icon" aria-hidden="true">
                <span /><span /><span />
              </span>
              <span>VERBAL TRANSCRIPT</span>
            </div>
            <span className="lp-exact-timer">
              {isRecording ? formatTimer(recordingTimer) : "00:30 MAX"}
            </span>
          </div>

          <div className="lp-exact-transcript-body">
            {micError ? (
              <div className="lp-exact-error-msg" role="alert">
                <AlertCircle size={16} />
                <span>{micError}</span>
              </div>
            ) : transcriptText ? (
              <div className="lp-exact-streaming-text">
                <p>{transcriptText}</p>
                {isRecording && <span className="lp-exact-caret" aria-hidden="true" />}
              </div>
            ) : (
              <div className="lp-exact-empty-stage">
                <div className="lp-exact-soundwave-graphic" aria-hidden="true">
                  {/* Left soundwave bars */}
                  <div className="lp-exact-wave-cluster">
                    <span style={{ height: 12 }} />
                    <span style={{ height: 20 }} />
                    <span style={{ height: 14 }} />
                    <span style={{ height: 26 }} />
                    <span style={{ height: 18 }} />
                  </div>

                  {/* Center Mic Circle */}
                  <div className="lp-exact-mic-circle">
                    <Mic size={20} className="lp-exact-mic-icon-blue" />
                  </div>

                  {/* Right soundwave bars */}
                  <div className="lp-exact-wave-cluster">
                    <span style={{ height: 18 }} />
                    <span style={{ height: 26 }} />
                    <span style={{ height: 14 }} />
                    <span style={{ height: 20 }} />
                    <span style={{ height: 12 }} />
                  </div>
                </div>

                <p className="lp-exact-empty-note">
                  Tap the button and answer<br />
                  out loud into your microphone.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Instant 3C Feedback */}
        <div className="lp-exact-panel lp-exact-panel--feedback">
          <div className="lp-exact-panel-header">
            <div className="lp-exact-panel-title">
              <Zap size={14} className="lp-exact-zap-icon" />
              <span>INSTANT 3C FEEDBACK</span>
            </div>
            <span className="lp-exact-feedback-status">
              {scores ? "Live Evaluated" : "Awaiting your answer"}
            </span>
          </div>

          <div className="lp-exact-rubric-list">
            {/* 1. Clarity */}
            <div className="lp-exact-rubric-row lp-exact-rubric-row--clarity">
              <div className="lp-exact-row-top">
                <div className="lp-exact-row-left">
                  <div className="lp-exact-row-icon lp-exact-row-icon--blue">
                    <MessageSquare size={14} strokeWidth={2.2} />
                  </div>
                  <div className="lp-exact-row-labels">
                    <span className="lp-exact-row-title">1. Clarity</span>
                    <span className="lp-exact-row-desc">Structure & articulation</span>
                  </div>
                </div>
                <div className="lp-exact-row-score" style={{ color: "var(--blue)" }}>
                  {scores ? `${toRubricScore(scores.clarity)}` : "—"}
                  <span className="lp-exact-score-denom"> / 5.0</span>
                </div>
              </div>
              <SegmentedScale color="var(--blue)" filled={scores ? rubricFill(scores.clarity) : 0} />
            </div>

            {/* 2. Correctness */}
            <div className="lp-exact-rubric-row lp-exact-rubric-row--correctness">
              <div className="lp-exact-row-top">
                <div className="lp-exact-row-left">
                  <div className="lp-exact-row-icon lp-exact-row-icon--mint">
                    <Code2 size={14} strokeWidth={2.2} />
                  </div>
                  <div className="lp-exact-row-labels">
                    <span className="lp-exact-row-title">2. Correctness</span>
                    <span className="lp-exact-row-desc">Technical reasoning</span>
                  </div>
                </div>
                <div className="lp-exact-row-score" style={{ color: "var(--mint)" }}>
                  {scores ? `${toRubricScore(scores.correctness)}` : "—"}
                  <span className="lp-exact-score-denom"> / 5.0</span>
                </div>
              </div>
              <SegmentedScale color="var(--mint)" filled={scores ? rubricFill(scores.correctness) : 0} />
            </div>

            {/* 3. Completeness */}
            <div className="lp-exact-rubric-row lp-exact-rubric-row--completeness">
              <div className="lp-exact-row-top">
                <div className="lp-exact-row-left">
                  <div className="lp-exact-row-icon lp-exact-row-icon--amber">
                    <Layers size={14} strokeWidth={2.2} />
                  </div>
                  <div className="lp-exact-row-labels">
                    <span className="lp-exact-row-title">3. Completeness</span>
                    <span className="lp-exact-row-desc">Depth & edge cases</span>
                  </div>
                </div>
                <div className="lp-exact-row-score" style={{ color: "var(--amber)" }}>
                  {scores ? `${toRubricScore(scores.completeness)}` : "—"}
                  <span className="lp-exact-score-denom"> / 5.0</span>
                </div>
              </div>
              <SegmentedScale color="var(--amber)" filled={scores ? rubricFill(scores.completeness) : 0} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Strong CTA Zone ── */}
      <div className="lp-exact-cta-zone">
        <button
          className={`lp-exact-main-mic-btn${isRecording ? " lp-exact-main-mic-btn--recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          aria-label={isRecording ? "Stop recording answer" : "Start speaking answer out loud"}
        >
          {isRecording ? (
            <>
              <Square size={16} fill="currentColor" />
              <span>Stop Recording & Evaluate ({formatTimer(recordingTimer)})</span>
            </>
          ) : (
            <>
              <Mic size={18} strokeWidth={2.4} />
              <span>Tap to Speak Your Answer Out Loud</span>
            </>
          )}
        </button>

        <p className="lp-exact-cta-sub">
          {attemptCount >= MAX_ATTEMPTS ? (
            <span className="lp-exact-limit-reach">
              Free attempt limit reached.{" "}
              <button type="button" onClick={onOpenAuth} className="lp-exact-register-link">
                Sign up free for unlimited practice
              </button>
            </span>
          ) : (
            <span>
              {MAX_ATTEMPTS - attemptCount} free attempt{MAX_ATTEMPTS - attemptCount !== 1 ? "s" : ""} remaining · Real-time feedback · No credit card required
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

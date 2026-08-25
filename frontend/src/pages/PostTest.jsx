// frontend/src/pages/PostTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Graduation Challenge — Post-Test Interview Arena
//
// Mirrors the architecture of PreTest.jsx but with:
//  - A "Graduation Briefing" overlay shown before connecting
//  - Gold/emerald victory color scheme
//  - A persistent "Beat your baseline!" goal bar
//  - Connects to ws://localhost:5000/ws/posttest
//  - On session_complete → navigates to /likert-post
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { auth } from "../firebase";
import AiAnalysisLoader from "../components/AiAnalysisLoader";
import "./PreTest.css";
import "./PostTest.css";

export default function PostTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || "aura-2-luna-en";

  // ── Overlay state ──────────────────────────────────────────────────────────
  const [showBriefing, setShowBriefing] = useState(true);

  // ── UI State ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState("Connecting to session…");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [showContinueButton, setShowContinueButton] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Playback Functions ─────────────────────────────────────────────────────
  const playBase64 = useCallback((base64Data, onEnded, onError) => {
    if (!isMountedRef.current) return;
    try {
      fetch(`data:audio/mpeg;base64,${base64Data}`)
        .then((r) => r.blob())
        .then((blob) => {
          if (!isMountedRef.current) return;

          if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
          }

          const url = URL.createObjectURL(blob);
          currentObjectUrlRef.current = url;
          const audio = new Audio(url);
          currentAudioRef.current = audio;

          const cleanupThisAudio = () => {
            if (currentAudioRef.current === audio) {
              currentAudioRef.current = null;
            }
            if (currentObjectUrlRef.current === url) {
              URL.revokeObjectURL(url);
              currentObjectUrlRef.current = null;
            }
          };

          audio.onended = () => {
            cleanupThisAudio();
            if (isMountedRef.current) onEnded();
          };
          audio.onerror = () => {
            cleanupThisAudio();
            if (isMountedRef.current) onError(new Error("Audio playback failed."));
          };
          audio.play().catch((err) => {
            cleanupThisAudio();
            if (isMountedRef.current) onError(err);
          });
        })
        .catch((err) => {
          if (isMountedRef.current) onError(err);
        });
    } catch (err) {
      if (isMountedRef.current) onError(err);
    }
  }, []);

  const processQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const item = audioQueueRef.current[0];
    isPlayingRef.current = true;
    setIsPlayingAudio(true);

    const onEnded = () => {
      isPlayingRef.current = false;
      audioQueueRef.current.shift();
      if (audioQueueRef.current.length === 0) setIsPlayingAudio(false);
      processQueue();
    };
    const onPlaybackError = (err) => {
      setError(`Audio playback error: ${err.message}`);
      onEnded();
    };
    if (item.type === "base64") {
      playBase64(item.data, onEnded, onPlaybackError);
    }
  }, [playBase64]);

  const enqueueBase64Audio = useCallback(
    (base64Data) => {
      audioQueueRef.current.push({ type: "base64", data: base64Data });
      processQueue();
    },
    [processQueue]
  );

  // ── WebSocket connection (only starts AFTER briefing dismissed) ────────────
  useEffect(() => {
    if (showBriefing) return; // wait until user clicks "Start Graduation Challenge"

    const user = auth.currentUser;
    const uid = user ? user.uid : "anonymous_user";
    const ws = new WebSocket(
      `ws://localhost:5000/ws/posttest?voice=${voice}&uid=${uid}`
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS/Post] Connected to graduation challenge session");
      setIsConnected(true);
      setError("");
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "status":
          setStatus(msg.message);
          break;
        case "session_resumed":
          setCurrentQuestion(msg.currentQuestionIndex + 1);
          break;
        case "tts_audio":
          enqueueBase64Audio(msg.data);
          break;
        case "transcript":
          if (msg.isFinal) {
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
            }
            setFinalTranscript(finalTranscriptRef.current);
            setPartialTranscript("");
          } else {
            setPartialTranscript(msg.text || "");
          }
          break;
        case "error":
          setError(msg.message);
          break;
        case "feedback_complete":
          setShowContinueButton(true);
          setStatus("Answer recorded. Click below to continue.");
          break;
        case "session_complete":
          setIsSessionComplete(true);
          setIsAnalyzing(true);
          setStatus("Graduation Challenge complete! Calculating your growth…");
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed. Is the backend running?");
      setIsConnected(false);
    };
    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
      cleanupAudio();
    };
  }, [showBriefing, enqueueBase64Audio, processQueue, voice]);

  // ── Volume meter ──────────────────────────────────────────────────────────
  const startVolumeMeter = (analyser) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setVolume(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const cleanupAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = "";
      } catch (e) {}
      currentAudioRef.current = null;
    }

    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch (e) {}
      currentObjectUrlRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsPlayingAudio(false);

    cancelAnimationFrame(animFrameRef.current);
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    setVolume(0);
  };

  // ── Mic controls ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || !isConnected) return;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      finalTranscriptRef.current = "";
      setFinalTranscript("");
      setPartialTranscript("");
      setConfirmedTranscript("");
      setAwaitingConfirmation(false);

      wsRef.current.send(JSON.stringify({ type: "start_recording" }));

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioCtx.destination);
      startVolumeMeter(analyser);

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

      setIsRecording(true);
      setStatus("Recording your answer…");
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    cleanupAudio();
    wsRef.current?.send(JSON.stringify({ type: "stop_recording" }));
    setIsRecording(false);
    setStatus("Review your answer before confirming.");
    setConfirmedTranscript(
      (
        finalTranscriptRef.current +
        (partialTranscript ? (finalTranscriptRef.current ? " " : "") + partialTranscript : "")
      ).trim()
    );
    setAwaitingConfirmation(true);
  };

  const submitAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "submit_answer", final_text: confirmedTranscript }));
    setAwaitingConfirmation(false);
    setFinalTranscript("");
    setPartialTranscript("");
    setConfirmedTranscript("");
    finalTranscriptRef.current = "";
    setStatus("Answer submitted. Waiting for the next question…");
  };

  const handleContinue = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); currentAudioRef.current.src = ""; } catch {}
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    setIsPlayingAudio(false);
    isPlayingRef.current = false;
    wsRef.current.send(JSON.stringify({ type: "next_question" }));
    setCurrentQuestion((prev) => prev + 1);
    setShowContinueButton(false);
    setStatus("Loading the next question…");
  };

  const reRecord = () => {
    setAwaitingConfirmation(false);
    setFinalTranscript("");
    setPartialTranscript("");
    setConfirmedTranscript("");
    finalTranscriptRef.current = "";
    startRecording();
  };

  // ── Graduation Briefing Overlay ────────────────────────────────────────────
  if (showBriefing) {
    return (
      <div className="pt-root posttest-briefing-root">
        <div className="posttest-briefing-overlay">
          <div className="posttest-briefing-card">
            <div className="posttest-briefing-badge">🎓</div>
            <h1 className="posttest-briefing-title">
              The Graduation Challenge
            </h1>
            <p className="posttest-briefing-subtitle">Measure Your Growth!</p>
            <div className="posttest-briefing-divider" />
            <p className="posttest-briefing-body">
              To calculate your <strong>exact improvement</strong>, we will now
              reassess you using the same <strong>5 diagnostic questions</strong>{" "}
              from the start of your journey. This allows the AI to compare your
              answers side-by-side.
            </p>
            <div className="posttest-briefing-goal-banner">
              🏆 <span>Apply everything you've learned to maximize your growth in <strong>Clarity</strong>, <strong>Correctness</strong>, and <strong>Completeness</strong>!</span>
            </div>
            <button
              id="btn-start-graduation"
              className="posttest-briefing-btn"
              onClick={() => setShowBriefing(false)}
            >
              🚀 Start Graduation Challenge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Arena ─────────────────────────────────────────────────────────────
  return (
    <div className="pt-root posttest-root">
      {/* Top Bar */}
      <header className="pt-topbar posttest-topbar">
        <div className="pt-topbar-brand">ITerview</div>
        <div className="pt-topbar-meta">
          <span className="pt-phase-badge posttest-phase-badge">🎓 Graduation Challenge</span>
          <span className="pt-q-counter">Question {currentQuestion} of 5</span>
        </div>
      </header>

      {/* Goal Banner */}
      <div className="posttest-goal-bar">
        🏆 Goal: Beat your starting baseline scores!
      </div>

      {/* Progress bar */}
      <div className="pt-progress-bar-track posttest-progress-track">
        <div
          className="pt-progress-bar-fill posttest-progress-fill"
          style={{ width: `${(currentQuestion / 5) * 100}%` }}
        />
      </div>

      {isAnalyzing && (
        <AnimatePresence>
          <AiAnalysisLoader
            key="post-analysis-loader"
            onComplete={() =>
              navigate("/likert-post", { state: { voice } })
            }
          />
        </AnimatePresence>
      )}
      <main className="pt-main">
          {/* Left Column */}
          <div className="pt-content" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {error && (
              <div className="pt-error-toast" role="alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="pt-card pt-question-card posttest-question-card">
              <div className="pt-card-body">
                <span className="pt-question-number posttest-question-number">
                  Question {currentQuestion}
                </span>
                <div className="pt-question-text">
                  Listen to the AI's question, then record your answer.
                </div>

                {/* Status Strip */}
                <div
                  className={`pt-status-strip ${
                    !isConnected
                      ? "idle"
                      : isPlayingAudio
                      ? "speaking"
                      : isRecording
                      ? "listening"
                      : awaitingConfirmation
                      ? "verify"
                      : "idle"
                  }`}
                >
                  <div className="pt-status-dot" />
                  <span>
                    {status}
                    {isPlayingAudio && " 🔊"}
                  </span>
                </div>

                {/* Verify Panel */}
                {awaitingConfirmation && (
                  <div className="pt-verify-panel" style={{ marginTop: "1.5rem" }}>
                    <span className="pt-verify-label">Review Your Answer</span>
                    <textarea
                      className="pt-verify-textarea"
                      value={confirmedTranscript}
                      onChange={(e) => setConfirmedTranscript(e.target.value)}
                      placeholder="Your transcribed answer will appear here…"
                    />
                    <div className="pt-verify-actions">
                      <button className="pt-btn pt-btn-success" onClick={submitAnswer}>
                        ✅ Confirm & Continue
                      </button>
                      <button className="pt-btn pt-btn-ghost" onClick={reRecord}>
                        🔄 Re-Record
                      </button>
                    </div>
                  </div>
                )}

                {/* Mic Area */}
                {!isSessionComplete && !awaitingConfirmation && !showContinueButton && (
                  <div className="pt-mic-btn-wrap">
                    {!isRecording ? (
                      <button
                        className="pt-mic-btn inactive"
                        onClick={startRecording}
                        disabled={!isConnected || isPlayingAudio}
                      >
                        🎙️
                      </button>
                    ) : (
                      <button className="pt-mic-btn active" onClick={stopRecording}>
                        ⏹️
                      </button>
                    )}
                    <span className="pt-mic-label">
                      {isRecording ? "Recording..." : "Tap to Speak"}
                    </span>

                    {isRecording && (
                      <div style={{ marginTop: "1rem", width: "100%", maxWidth: "300px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                          <span>Microphone Level</span>
                          <span>{volume}%</span>
                        </div>
                        <div className="pt-progress-bar-track" style={{ borderRadius: "4px", overflow: "hidden" }}>
                          <div
                            className="pt-progress-bar-fill"
                            style={{
                              width: `${volume}%`,
                              background: volume > 70 ? "var(--red)" : volume > 20 ? "var(--green)" : "var(--accent)",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Continue Button */}
                {showContinueButton && !isSessionComplete && (
                  <div className="pt-mic-btn-wrap" style={{ marginTop: "1rem" }}>
                    <button
                      className="pt-btn pt-btn-primary posttest-continue-btn"
                      onClick={handleContinue}
                    >
                      Continue to Next Question ➔
                    </button>
                  </div>
                )}

                {isSessionComplete && (
                  <div className="pt-mic-btn-wrap">
                    <button
                      className="pt-btn pt-btn-primary"
                      onClick={() => navigate("/likert-post", { state: { voice } })}
                    >
                      🏁 View Your Results
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="pt-sidebar">
            <div className="pt-card">
              <div className="pt-card-header">
                <div className="pt-card-icon accent">📝</div>
                <span className="pt-card-title">Live Transcript</span>
              </div>
              <div className="pt-card-body pt-transcript-body" aria-live="polite">
                {!finalTranscript && !partialTranscript ? (
                  <div className="pt-transcript-empty">
                    Your voice transcript will appear here...
                  </div>
                ) : (
                  <>
                    <span className="pt-transcript-final">{finalTranscript}</span>
                    {partialTranscript && (
                      <span className="pt-transcript-partial">
                        {" "}
                        {partialTranscript}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Victory card */}
            <div className="pt-card posttest-victory-card">
              <div className="pt-card-header">
                <div className="pt-card-icon">🏆</div>
                <span className="pt-card-title">Your Mission</span>
              </div>
              <div className="pt-card-body">
                <p className="posttest-mission-text">
                  Answer the same 5 questions you faced at the start. The AI will
                  measure your growth across <strong>Clarity</strong>,{" "}
                  <strong>Correctness</strong>, and <strong>Completeness</strong>.
                </p>
                <div className="posttest-score-chips">
                  <span className="posttest-score-chip">🎯 Clarity</span>
                  <span className="posttest-score-chip">✅ Correctness</span>
                  <span className="posttest-score-chip">📋 Completeness</span>
                </div>
              </div>
            </div>
          </aside>
        </main>
    </div>
  );
}

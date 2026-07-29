// frontend/src/pages/PreTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: STT & TTS Core Integration
//
// Blueprint flow implemented:
//   1. On mount → connect WebSocket → server sends TTS question audio
//   2. User presses mic → PCM audio streamed to server → Deepgram STT
//   3. Transcripts echo back in real-time for display
//   4. User presses stop → reviews transcript → confirms OR re-records
//   5. On confirm → { type: "submit_answer" } → server speaks next question
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import AiAnalysisLoader from "../components/AiAnalysisLoader";
import "./PreTest.css";

export default function PreTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || "aura-2-luna-en";

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
  const [confirmedTranscript, setConfirmedTranscript] = useState(""); // editable
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

  const finalTranscriptRef = useRef(""); // to accumulate final segments reliably

  // ── Audio queue refs (prevents feedback + question TTS from overlapping) ───
  const audioQueueRef = useRef([]); // pending audio items (base64 or stream objects)
  const isPlayingRef = useRef(false); // true while any audio clip is playing
  const currentAudioRef = useRef(null); // active playing HTML5 Audio element

  // ── Playback Functions ─────────────────────────────────────────────────────

  const playBase64 = useCallback((base64Data, onEnded, onError) => {
    try {
      fetch(`data:audio/mpeg;base64,${base64Data}`)
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;

          audio.onended = () => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            onEnded();
          };

          audio.onerror = () => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            onError(new Error("Audio playback failed."));
          };

          audio.play().catch((err) => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            onError(err);
          });
        })
        .catch((err) => {
          onError(err);
        });
    } catch (err) {
      onError(err);
    }
  }, []);

  const processQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const item = audioQueueRef.current[0]; // peek
    isPlayingRef.current = true;
    setIsPlayingAudio(true);

    const onEnded = () => {
      isPlayingRef.current = false;
      audioQueueRef.current.shift(); // remove completed item
      if (audioQueueRef.current.length === 0) setIsPlayingAudio(false);
      processQueue(); // play next
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
    [processQueue],
  );

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    const uid = user ? user.uid : "anonymous_user";
    const ws = new WebSocket(
      `ws://localhost:5000/ws/interview?voice=${voice}&uid=${uid}`,
    );
    ws.binaryType = "arraybuffer"; // Set to receive binary chunks as ArrayBuffers
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to interview session");
      setIsConnected(true);
      setError("");
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // invalid json
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
          setStatus("Pre-test complete! AI Analysis starting...");
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
      console.log("[WS] Connection closed");
    };

    return () => {
      ws.close();
      cleanupAudio();
    };
  }, [enqueueBase64Audio, processQueue, voice]);

  // ── Volume meter (RAF loop) ───────────────────────────────────────────────
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

  // ── Mic controls ───────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || !isConnected) return;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Reset transcripts
      finalTranscriptRef.current = "";
      setFinalTranscript("");
      setPartialTranscript("");
      setConfirmedTranscript("");
      setAwaitingConfirmation(false);

      // Tell the server we're starting
      wsRef.current.send(JSON.stringify({ type: "start_recording" }));

      // Setup Web Audio API exactly like MicTest for raw PCM
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
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
        wsRef.current.send(pcm.buffer); // binary frame → sttService
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

    // Tell the server to close the Deepgram session
    wsRef.current?.send(JSON.stringify({ type: "stop_recording" }));

    setIsRecording(false);
    setStatus("Review your answer before confirming.");

    // Phase 2: let the user review the transcript
    const combined = (
      finalTranscriptRef.current +
      (partialTranscript ? (finalTranscriptRef.current ? " " : "") + partialTranscript : "")
    ).trim();
    setConfirmedTranscript(combined);
    setAwaitingConfirmation(true);
  };

  const submitAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: "submit_answer",
        final_text: confirmedTranscript,
      }),
    );

    setAwaitingConfirmation(false);
    setFinalTranscript("");
    setPartialTranscript("");
    setConfirmedTranscript("");
    finalTranscriptRef.current = "";
    setStatus("Answer submitted. Waiting for the next question…");
  };

  const handleContinue = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Stop current playing audio if any to prevent overlap
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch (err) {
        console.error("Error stopping current audio:", err);
      }
      currentAudioRef.current = null;
    }

    // Reset audio queue
    audioQueueRef.current = [];
    setIsPlayingAudio(false);
    isPlayingRef.current = false;

    wsRef.current.send(
      JSON.stringify({
        type: "next_question",
      }),
    );

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

  // ── Derived UI ────────────────────────────────────────────────────────────
  return (
    <div className="pt-root">
      {/* Top Bar */}
      <header className="pt-topbar">
        <div className="pt-topbar-brand">ITerview</div>
        <div className="pt-topbar-meta">
          <span className="pt-phase-badge">Pre-Test</span>
          <span className="pt-q-counter">Question {currentQuestion} of 5</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="pt-progress-bar-track">
        <div
          className="pt-progress-bar-fill"
          style={{ width: `${(currentQuestion / 5) * 100}%` }}
        ></div>
      </div>

      {isAnalyzing ? (
        <AiAnalysisLoader onComplete={() => navigate('/interview')} />
      ) : (
      <main className="pt-main">
        {/* Left Column */}
        <div
          className="pt-content"
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {error && (
            <div className="pt-error-toast" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="pt-card pt-question-card">
            <div className="pt-card-body">
              <span className="pt-question-number">
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

              {/* Verify Panel (Phase 2) */}
              {awaitingConfirmation && (
                <div
                  className="pt-verify-panel"
                  style={{ marginTop: "1.5rem" }}
                >
                  <span className="pt-verify-label">Review Your Answer</span>
                  <textarea
                    className="pt-verify-textarea"
                    value={confirmedTranscript}
                    onChange={(e) => setConfirmedTranscript(e.target.value)}
                    placeholder="Your transcribed answer will appear here…"
                  />
                  <div className="pt-verify-actions">
                    <button
                      className="pt-btn pt-btn-success"
                      onClick={submitAnswer}
                    >
                      ✅ Confirm &amp; Continue
                    </button>
                    <button className="pt-btn pt-btn-ghost" onClick={reRecord}>
                      🔄 Re-Record
                    </button>
                  </div>
                </div>
              )}

              {/* Mic Area */}
              {!isSessionComplete &&
                !awaitingConfirmation &&
                !showContinueButton && (
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
                      <button
                        className="pt-mic-btn active"
                        onClick={stopRecording}
                      >
                        ⏹️
                      </button>
                    )}
                    <span className="pt-mic-label">
                      {isRecording ? "Recording..." : "Tap to Speak"}
                    </span>

                    {/* Volume Meter */}
                    {isRecording && (
                      <div
                        style={{
                          marginTop: "1rem",
                          width: "100%",
                          maxWidth: "300px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <span>Microphone Level</span>
                          <span>{volume}%</span>
                        </div>
                        <div
                          className="pt-progress-bar-track"
                          style={{ borderRadius: "4px", overflow: "hidden" }}
                        >
                          <div
                            className="pt-progress-bar-fill"
                            style={{
                              width: `${volume}%`,
                              background:
                                volume > 70
                                  ? "var(--red)"
                                  : volume > 20
                                    ? "var(--green)"
                                    : "var(--accent)",
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
                    className="pt-btn pt-btn-primary"
                    onClick={handleContinue}
                    style={{
                      padding: "0.8rem 2rem",
                      fontSize: "1.05rem",
                      fontWeight: "600",
                      borderRadius: "12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "var(--accent)",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    Continue to Next Question ➔
                  </button>
                </div>
              )}

              {isSessionComplete && (
                <div className="pt-mic-btn-wrap">
                  <button
                    className="pt-btn pt-btn-primary"
                    onClick={() => navigate("/dashboard")}
                  >
                    🏁 Return to Dashboard
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
        </aside>
      </main>
      )}
    </div>
  );
}

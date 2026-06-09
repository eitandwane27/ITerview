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
import { useNavigate } from "react-router-dom";
// We use MicTest.css for the requested layout matching
import "../components/MicTest.css";
import "./PreTest.css";

export default function PreTest() {
  const navigate = useNavigate();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState("Connecting to session…");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState(""); 
  const [confirmedTranscript, setConfirmedTranscript] = useState(""); // editable
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  
  const finalTranscriptRef = useRef(""); // to accumulate final segments reliably

  // ── Audio playback helper ──────────────────────────────────────────────────
  const playAudioFromBase64 = useCallback((base64Data) => {
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      setIsPlayingAudio(true);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlayingAudio(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlayingAudio(false);
        setError("Audio playback failed.");
      };
      audio.play().catch((err) => {
        setIsPlayingAudio(false);
        setError(`Playback error: ${err.message}`);
      });
    } catch (err) {
      setError(`Audio decode error: ${err.message}`);
    }
  }, []);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000/ws/interview");
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
        return; // binary data or invalid json
      }

      switch (msg.type) {
        case "status":
          setStatus(msg.message);
          break;

        case "tts_audio":
          playAudioFromBase64(msg.data);
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

        case "session_complete":
          setIsSessionComplete(true);
          setStatus("Pre-test complete! All 5 questions answered.");
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
  }, [playAudioFromBase64]);

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
        } 
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
    setConfirmedTranscript(finalTranscriptRef.current);
    setAwaitingConfirmation(true);
  };

  const submitAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({ type: "submit_answer", final_text: confirmedTranscript })
    );

    setAwaitingConfirmation(false);
    setFinalTranscript("");
    setPartialTranscript("");
    setConfirmedTranscript("");
    finalTranscriptRef.current = "";
    setStatus("Answer submitted. Waiting for the next question…");
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
  const volumeClass = volume > 70 ? "loud" : volume > 20 ? "good" : "";
  const dotClass = isConnected ? (isRecording ? "recording" : "ok") : "error-dot";

  return (
    <div className="mictest-container">
      {/* Top Bar */}
      <header className="mictest-topbar">
        <div className="mictest-topbar-content">
          <h1>ITerview</h1>
          <span>Pre-Test Interview Session</span>
        </div>
      </header>

      <main className="mictest-main">
        {/* Header */}
        <div className="mictest-header">
          <h2>Pre-Test Interview</h2>
          <p>The AI will ask you questions. Listen, then record your answer.</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mictest-banner error" role="alert">
            <span className="mictest-banner-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Status Card */}
        <div className="mictest-card">
          <p className="mictest-card-title">🎙️ Interview Status</p>

          <div className="mictest-status" style={{ marginTop: 0, marginBottom: "1rem" }}>
            <span className={`mictest-dot ${dotClass}`} />
            <span style={{ fontWeight: 500, color: "#111827" }}>
              {status}
              {isPlayingAudio && " 🔊 Playing question…"}
            </span>
          </div>

          {/* Volume Meter (Visible when recording) */}
          {isRecording && (
            <div className="mictest-volume-bar-wrap" style={{ marginTop: "1rem" }}>
              <div className="mictest-volume-label">
                <span>Microphone Level</span>
                <span>{volume}%</span>
              </div>
              <div className="mictest-volume-track" role="meter" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100}>
                <div className={`mictest-volume-fill ${volumeClass}`} style={{ width: `${volume}%` }} />
              </div>
            </div>
          )}

          {/* Actions */}
          {!isSessionComplete && (
            <div className="mictest-btn-row" style={{ marginTop: "1.5rem" }}>
              {awaitingConfirmation ? (
                <>
                  <button className="mictest-btn-test" onClick={submitAnswer} style={{ background: "#111827", color: "white", borderColor: "#111827" }}>
                    ✅ Confirm &amp; Continue
                  </button>
                  <button className="mictest-btn-test" onClick={reRecord}>
                    🔄 Re-Record
                  </button>
                </>
              ) : (
                <>
                  {!isRecording ? (
                    <button
                      className="mictest-btn-test active"
                      style={{ borderColor: "#22c55e", color: "#166534", backgroundColor: "#f0fdf4" }}
                      onClick={startRecording}
                      disabled={!isConnected || isPlayingAudio}
                    >
                      🎙️ Start Recording
                    </button>
                  ) : (
                    <button className="mictest-btn-test active" onClick={stopRecording}>
                      ⏹️ Stop Recording
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          
          {isSessionComplete && (
            <div className="mictest-btn-row" style={{ marginTop: "1.5rem" }}>
              <button className="mictest-proceed-btn" onClick={() => navigate("/dashboard")}>
                🏁 Return to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Transcript Preview Card */}
        {(finalTranscript || partialTranscript || awaitingConfirmation) && (
          <div className="mictest-card">
            <p className="mictest-card-title">📝 Voice Preview</p>
            <p className="mictest-label" style={{ marginBottom: "0.5rem" }}>
              {awaitingConfirmation ? "Review and edit your answer before submitting:" : "Live Transcript:"}
            </p>
            
            {awaitingConfirmation ? (
              <textarea
                value={confirmedTranscript}
                onChange={(e) => setConfirmedTranscript(e.target.value)}
                rows={6}
                style={{
                  width: "100%",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "0.95rem",
                  color: "#111827",
                  lineHeight: "1.5",
                  resize: "vertical",
                  boxSizing: "border-box"
                }}
                placeholder="Your transcribed answer will appear here…"
              />
            ) : (
              <div className="mictest-transcript" aria-live="polite">
                {finalTranscript || partialTranscript ? (
                  <>
                    <span>{finalTranscript}</span>
                    {partialTranscript && (
                      <span className="partial"> {partialTranscript}</span>
                    )}
                  </>
                ) : (
                  <span className="placeholder">Listening...</span>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

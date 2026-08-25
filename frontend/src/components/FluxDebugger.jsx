// frontend/src/components/FluxDebugger.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DEV ONLY — Deepgram Flux STT & EndOfTurn Dev Debugger
// Route: /dev/flux
//
// Features:
// 1. Dual Connection Modes (Backend WS vs Direct Browser WS to Deepgram)
// 2. Real-time EOT Parameter Tuning (eot_threshold, eot_timeout_ms)
// 3. Live Turn Inspector (StartOfTurn / EndOfTurn, interim stream, volume)
// 4. Interactive Event Inspector with search, filter, and expandable JSON view
// 5. Turn History & Analytics (Turn count, confidence scores, duration)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import "./FluxDebugger.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const WS_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  .replace(/^http/, "ws") + "/ws/dev-stt-test";
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;

export default function FluxDebugger() {
  // ── Mode & Settings State ──────────────────────────────────────────────────
  const [mode, setMode] = useState("direct"); // "direct" | "backend"
  const [eotThreshold, setEotThreshold] = useState(0.7);
  const [eotTimeoutMs, setEotTimeoutMs] = useState(5000);

  // ── Connection & Audio State ───────────────────────────────────────────────
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // ── Live Turn State ────────────────────────────────────────────────────────
  const [turnState, setTurnState] = useState("IDLE"); // IDLE | SPEAKING | END_OF_TURN
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [lastTurnConfidence, setLastTurnConfidence] = useState(null);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [liveTurnText, setLiveTurnText] = useState("");

  // ── Event Log State ────────────────────────────────────────────────────────
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState("ALL"); // ALL | StartOfTurn | EndOfTurn | Interim | Final | Error
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEventIds, setExpandedEventIds] = useState(new Set());

  // ── History & Metrics State ────────────────────────────────────────────────
  const [completedTurns, setCompletedTurns] = useState([]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const turnStartTimeRef = useRef(null);
  const currentInterimRef = useRef("");
  const eventIdCounterRef = useRef(1);

  // ── Add Event Helper ───────────────────────────────────────────────────────
  const addEventLog = useCallback((eventType, label, payload) => {
    const id = eventIdCounterRef.current++;
    const newEntry = {
      id,
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }),
      type: eventType,
      label,
      payload,
    };
    setEvents((prev) => [newEntry, ...prev.slice(0, 199)]);
  }, []);

  // ── Cleanup Audio ──────────────────────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
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
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setVolume(0);
  }, []);

  // ── Disconnect WebSocket ───────────────────────────────────────────────────
  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
    setIsRecording(false);
    setTurnState("IDLE");
  }, []);

  // ── Start Audio Pipeline ───────────────────────────────────────────────────
  const startAudioPipeline = useCallback(async (sendChunkCallback) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    });
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    processorRef.current = processor;

    source.connect(analyser);
    source.connect(processor);
    processor.connect(audioCtx.destination);

    // Volume Meter Loop
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setVolume(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      sendChunkCallback(pcm.buffer);
    };
  }, []);

  // ── Handle Incoming Raw Deepgram or Backend Payload ─────────────────────────
  const handleFluxMessage = useCallback((msg) => {
    // 1. Backend wrapped flux_event
    if (msg.type === "flux_event" && msg.event) {
      msg = msg.event;
    }

    // 2. StartOfTurn
    if (msg.event === "StartOfTurn") {
      const turnIdx = msg.turn_index ?? currentTurnIndex + 1;
      setCurrentTurnIndex(turnIdx);
      setTurnState("SPEAKING");
      setLiveTurnText("");
      setPartialTranscript("");
      currentInterimRef.current = "";
      turnStartTimeRef.current = Date.now();
      addEventLog("StartOfTurn", `🎙️ StartOfTurn (Turn ${turnIdx})`, msg);
      return;
    }

    // 3. EndOfTurn
    if (msg.event === "EndOfTurn") {
      const turnIdx = msg.turn_index ?? currentTurnIndex;
      const confidence = msg.end_of_turn_confidence ?? null;
      setLastTurnConfidence(confidence);
      setTurnState("END_OF_TURN");

      const text = (msg.transcript || currentInterimRef.current || "").trim();
      const durationMs = turnStartTimeRef.current ? Date.now() - turnStartTimeRef.current : 0;
      const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

      if (text) {
        setCompletedTurns((prev) => [
          {
            turnIndex: turnIdx,
            text,
            confidence,
            wordCount,
            durationMs,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      }

      setLiveTurnText(text);
      setPartialTranscript("");
      currentInterimRef.current = "";

      addEventLog("EndOfTurn", `🔇 EndOfTurn (Turn ${turnIdx}, Conf: ${confidence ?? "N/A"})`, msg);

      setTimeout(() => {
        setTurnState("IDLE");
      }, 1500);
      return;
    }

    // 4. Standard backend transcript object
    if (msg.type === "transcript") {
      if (msg.isFinal) {
        if (msg.text) {
          setCompletedTurns((prev) => [
            {
              turnIndex: currentTurnIndex || prev.length + 1,
              text: msg.text,
              confidence: null,
              wordCount: msg.text.split(/\s+/).filter(Boolean).length,
              durationMs: turnStartTimeRef.current ? Date.now() - turnStartTimeRef.current : 0,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ]);
          setLiveTurnText(msg.text);
          setPartialTranscript("");
          addEventLog("Final", `✅ Backend Final: "${msg.text}"`, msg);
        }
      } else {
        setPartialTranscript(msg.text || "");
        currentInterimRef.current = msg.text || "";
        addEventLog("Interim", `💬 Backend Interim: "${msg.text}"`, msg);
      }
      return;
    }

    // 5. Direct Deepgram Turn Interim / Final
    const text = msg.transcript ?? msg?.channel?.alternatives?.[0]?.transcript ?? "";
    if (text) {
      const isFinal = msg.is_final === true;
      if (!isFinal) {
        setPartialTranscript(text);
        currentInterimRef.current = text;
        addEventLog("Interim", `💬 Interim: "${text}"`, msg);
      } else {
        setLiveTurnText(text);
        setPartialTranscript("");
        currentInterimRef.current = text;
        addEventLog("Final", `✅ Final: "${text}"`, msg);
      }
    } else {
      addEventLog("Payload", `📦 Raw Message (${msg.type || msg.event || "unknown"})`, msg);
    }
  }, [addEventLog, currentTurnIndex]);

  // ── Start Recording / Connection ──────────────────────────────────────────
  const startSession = async () => {
    setErrorMessage("");
    setStatus("connecting");
    addEventLog("System", `Connecting in ${mode.toUpperCase()} mode…`, { mode, eotThreshold, eotTimeoutMs });

    try {
      if (mode === "direct") {
        // Fetch Token from Backend
        const tokenRes = await fetch(`${BACKEND_URL}/api/deepgram/token`);
        if (!tokenRes.ok) throw new Error("Failed to retrieve Deepgram token from server");
        const { token } = await tokenRes.json();

        const url = `wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=${eotThreshold}&eot_timeout_ms=${eotTimeoutMs}&encoding=linear16&sample_rate=${SAMPLE_RATE}`;
        const ws = new WebSocket(url, ["token", token]);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = async () => {
          setStatus("connected");
          setIsRecording(true);
          addEventLog("System", "✅ Direct WS Connected to Deepgram Flux", { url });

          await startAudioPipeline((chunk) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(chunk);
            }
          });
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            handleFluxMessage(msg);
          } catch (err) {
            console.error("JSON parse err:", err);
          }
        };

        ws.onerror = (e) => {
          setStatus("error");
          setErrorMessage("Direct Deepgram WebSocket connection error");
          addEventLog("Error", "❌ WebSocket Error", e);
        };

        ws.onclose = (e) => {
          setStatus("disconnected");
          setIsRecording(false);
          cleanupAudio();
          addEventLog("System", `🔌 WS Closed (code ${e.code})`, { code: e.code, reason: e.reason });
        };
      } else {
        // Backend Mode
        const ws = new WebSocket(WS_BACKEND_URL);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = async () => {
          setStatus("connected");
          setIsRecording(true);
          ws.send(JSON.stringify({ type: "start_recording" }));
          addEventLog("System", "✅ Connected to Backend Dev STT Socket", { url: WS_BACKEND_URL });

          await startAudioPipeline((chunk) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(chunk);
            }
          });
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "error") {
              setErrorMessage(msg.message);
              addEventLog("Error", `❌ Backend STT Error: ${msg.message}`, msg);
            } else {
              handleFluxMessage(msg);
            }
          } catch (err) {
            console.error("JSON parse err:", err);
          }
        };

        ws.onerror = (e) => {
          setStatus("error");
          setErrorMessage("Backend WebSocket error");
          addEventLog("Error", "❌ Backend WS Error", e);
        };

        ws.onclose = (e) => {
          setStatus("disconnected");
          setIsRecording(false);
          cleanupAudio();
          addEventLog("System", `🔌 Backend WS Closed (code ${e.code})`, { code: e.code });
        };
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to start test session");
      addEventLog("Error", `❌ ${err.message}`, err);
      cleanupAudio();
    }
  };

  // ── Stop Recording ─────────────────────────────────────────────────────────
  const stopSession = () => {
    if (mode === "backend" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
    }
    cleanupAudio();
    disconnectWs();
    addEventLog("System", "⏹ Session Stopped", {});
  };

  // ── Toggle JSON Expansion ──────────────────────────────────────────────────
  const toggleExpand = (id) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Clear Logs ─────────────────────────────────────────────────────────────
  const clearLogs = () => {
    setEvents([]);
    setExpandedEventIds(new Set());
  };

  const clearHistory = () => {
    setCompletedTurns([]);
    setCurrentTurnIndex(0);
    setLiveTurnText("");
    setPartialTranscript("");
  };

  // ── Filtered Events ────────────────────────────────────────────────────────
  const filteredEvents = events.filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const labelMatch = e.label.toLowerCase().includes(query);
      const jsonMatch = JSON.stringify(e.payload).toLowerCase().includes(query);
      return labelMatch || jsonMatch;
    }
    return true;
  });

  // ── Computed Metrics ───────────────────────────────────────────────────────
  const totalTurns = completedTurns.length;
  const turnsWithConf = completedTurns.filter((t) => t.confidence !== null);
  const avgConfidence = turnsWithConf.length
    ? (turnsWithConf.reduce((acc, t) => acc + t.confidence, 0) / turnsWithConf.length).toFixed(2)
    : "—";
  const avgDuration = totalTurns
    ? (completedTurns.reduce((acc, t) => acc + t.durationMs, 0) / totalTurns / 1000).toFixed(1) + "s"
    : "—";
  const totalWords = completedTurns.reduce((acc, t) => acc + t.wordCount, 0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      disconnectWs();
    };
  }, [cleanupAudio, disconnectWs]);

  return (
    <div className="flux-debugger-root">
      {/* ── Header Bar ───────────────────────────────────────────────────── */}
      <header className="fd-header">
        <div className="fd-brand">
          <span className="fd-badge">DEV TOOL</span>
          <h1>Deepgram Flux & EndOfTurn Debugger</h1>
        </div>

        <div className="fd-controls-top">
          {/* Mode Switcher */}
          <div className="fd-mode-toggle">
            <button
              className={`fd-mode-btn ${mode === "direct" ? "active" : ""}`}
              onClick={() => {
                if (isRecording) stopSession();
                setMode("direct");
              }}
            >
              Direct Browser WS
            </button>
            <button
              className={`fd-mode-btn ${mode === "backend" ? "active" : ""}`}
              onClick={() => {
                if (isRecording) stopSession();
                setMode("backend");
              }}
            >
              Backend Socket WS
            </button>
          </div>

          {/* Connection Indicator & Record CTA */}
          <div className="fd-conn-status">
            <span className={`fd-status-dot fd-dot-${status}`} />
            <span className="fd-status-text">{status.toUpperCase()}</span>
          </div>

          {!isRecording ? (
            <button className="fd-btn fd-btn-start" onClick={startSession}>
              🎙️ Start Test
            </button>
          ) : (
            <button className="fd-btn fd-btn-stop" onClick={stopSession}>
              ⏹️ Stop Test
            </button>
          )}
        </div>
      </header>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {errorMessage && (
        <div className="fd-banner fd-banner-error">
          <span>⚠️ {errorMessage}</span>
          <button className="fd-btn-icon" onClick={() => setErrorMessage("")}>✕</button>
        </div>
      )}

      {/* ── Tuning Parameters (Direct Mode) ────────────────────────────────── */}
      {mode === "direct" && (
        <div className="fd-tuning-panel">
          <div className="fd-tuning-title">
            <span>⚙️ Deepgram Flux EOT Parameters</span>
            <span className="fd-tuning-hint">(Adjust parameters before clicking Start Test)</span>
          </div>

          <div className="fd-tuning-grid">
            <div className="fd-param-group">
              <label htmlFor="eot-thresh-input">
                eot_threshold: <strong>{eotThreshold}</strong>
              </label>
              <input
                id="eot-thresh-input"
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={eotThreshold}
                onChange={(e) => setEotThreshold(parseFloat(e.target.value))}
                disabled={isRecording}
              />
              <span className="fd-param-desc">Lower (0.3-0.5) = quicker pause detection | Higher (0.8-0.9) = stricter silence wait</span>
            </div>

            <div className="fd-param-group">
              <label htmlFor="eot-timeout-input">
                eot_timeout_ms: <strong>{eotTimeoutMs} ms</strong>
              </label>
              <input
                id="eot-timeout-input"
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={eotTimeoutMs}
                onChange={(e) => setEotTimeoutMs(parseInt(e.target.value, 10))}
                disabled={isRecording}
              />
              <span className="fd-param-desc">Max wait time for pause before firing EndOfTurn</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Dashboard Layout ────────────────────────────────────────── */}
      <div className="fd-main-grid">
        {/* Left Column: Live Audio & Turn Status */}
        <div className="fd-col-left">
          {/* Turn State Card */}
          <div className="fd-card fd-turn-card">
            <div className="fd-card-header">
              <h3>Turn State Inspector</h3>
              <span className={`fd-turn-badge fd-turn-${turnState}`}>
                {turnState === "SPEAKING" ? "🎙️ SPEAKING" : turnState === "END_OF_TURN" ? "🔇 END OF TURN" : "💤 IDLE"}
              </span>
            </div>

            <div className="fd-turn-metrics">
              <div className="fd-metric-mini">
                <span className="fd-metric-label">Turn Index</span>
                <span className="fd-metric-val">{currentTurnIndex}</span>
              </div>
              <div className="fd-metric-mini">
                <span className="fd-metric-label">Last EOT Confidence</span>
                <span className="fd-metric-val">{lastTurnConfidence !== null ? lastTurnConfidence : "—"}</span>
              </div>
            </div>

            {/* Volume Meter */}
            <div className="fd-vol-bar-container">
              <div className="fd-vol-header">
                <span>Microphone Volume</span>
                <span>{volume}%</span>
              </div>
              <div className="fd-vol-track">
                <div
                  className="fd-vol-fill"
                  style={{
                    width: `${volume}%`,
                    background: volume > 70 ? "#ef4444" : volume > 20 ? "#10b981" : "#6366f1",
                  }}
                />
              </div>
            </div>

            {/* Live Transcript Stream */}
            <div className="fd-transcript-box">
              <div className="fd-transcript-label">Live Turn Transcript</div>
              <div className="fd-transcript-content">
                {liveTurnText && <span className="fd-text-completed">{liveTurnText} </span>}
                {partialTranscript ? (
                  <span className="fd-text-interim">{partialTranscript}</span>
                ) : (
                  !liveTurnText && <span className="fd-placeholder">Speak to begin transcribing…</span>
                )}
              </div>
            </div>
          </div>

          {/* Turn Analytics & History */}
          <div className="fd-card fd-history-card">
            <div className="fd-card-header">
              <h3>Completed Turn History ({completedTurns.length})</h3>
              <button className="fd-btn-sm fd-btn-ghost" onClick={clearHistory}>Clear History</button>
            </div>

            {/* Metrics Header */}
            <div className="fd-summary-tiles">
              <div className="fd-tile">
                <span className="fd-tile-val">{totalTurns}</span>
                <span className="fd-tile-label">Total Turns</span>
              </div>
              <div className="fd-tile">
                <span className="fd-tile-val">{avgConfidence}</span>
                <span className="fd-tile-label">Avg Confidence</span>
              </div>
              <div className="fd-tile">
                <span className="fd-tile-val">{avgDuration}</span>
                <span className="fd-tile-label">Avg Duration</span>
              </div>
              <div className="fd-tile">
                <span className="fd-tile-val">{totalWords}</span>
                <span className="fd-tile-label">Total Words</span>
              </div>
            </div>

            <div className="fd-history-list">
              {completedTurns.length === 0 ? (
                <div className="fd-placeholder-center">No turns recorded yet</div>
              ) : (
                completedTurns.map((turn, i) => (
                  <div key={i} className="fd-history-item">
                    <div className="fd-turn-item-top">
                      <span className="fd-turn-num">Turn #{turn.turnIndex}</span>
                      <span className="fd-turn-time">{turn.timestamp}</span>
                      {turn.confidence !== null && (
                        <span className={`fd-conf-pill ${turn.confidence > 0.7 ? "high" : "low"}`}>
                          EOT Conf: {turn.confidence}
                        </span>
                      )}
                      <span className="fd-duration-pill">{(turn.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="fd-turn-item-text">"{turn.text}"</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Event Inspector */}
        <div className="fd-col-right">
          <div className="fd-card fd-events-card">
            <div className="fd-card-header">
              <h3>Flux Event Stream Log</h3>
              <button className="fd-btn-sm fd-btn-ghost" onClick={clearLogs}>Clear Log</button>
            </div>

            {/* Event Filter & Search Bar */}
            <div className="fd-filter-bar">
              <div className="fd-filter-pills">
                {["ALL", "StartOfTurn", "EndOfTurn", "Interim", "Final", "Error"].map((ft) => (
                  <button
                    key={ft}
                    className={`fd-pill ${filterType === ft ? "active" : ""}`}
                    onClick={() => setFilterType(ft)}
                  >
                    {ft}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="fd-search-input"
                placeholder="Search JSON payload or log text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Log Stream */}
            <div className="fd-event-log-container">
              {filteredEvents.length === 0 ? (
                <div className="fd-placeholder-center">No events match current filter</div>
              ) : (
                filteredEvents.map((item) => {
                  const isExpanded = expandedEventIds.has(item.id);
                  return (
                    <div key={item.id} className={`fd-event-row fd-event-type-${item.type}`}>
                      <div className="fd-event-row-main" onClick={() => toggleExpand(item.id)}>
                        <span className="fd-event-time">{item.timestamp}</span>
                        <span className={`fd-event-type-badge ${item.type}`}>{item.type}</span>
                        <span className="fd-event-label">{item.label}</span>
                        <span className="fd-expand-icon">{isExpanded ? "▼" : "▶"}</span>
                      </div>

                      {isExpanded && (
                        <div className="fd-event-json-wrap">
                          <pre className="fd-json-code">{JSON.stringify(item.payload, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

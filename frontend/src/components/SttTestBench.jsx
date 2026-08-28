// frontend/src/components/SttTestBench.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DEV ONLY — /dev/stt-test
//
// Minimal STT latency testbench. Connects to the same backend WS and uses the
// identical audio pipeline (ScriptProcessor → PCM Int16 → binary frames) as
// PreTest.jsx so results are production-representative.
//
// Focus: see how fast interim letters appear and how accurate finals are.
// No TTS, no AI, no question flow — just raw STT output.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from 'react';
import './SttTestBench.css';

// Uses the dedicated dev socket route to avoid MongoDB writes and burning TTS API balance
const WS_URL = 'ws://localhost:5000/ws/dev-stt-test';
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048; // smaller = lower latency (was 4096 in PreTest)

export default function SttTestBench() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [wsStatus, setWsStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [isRecording, setIsRecording] = useState(false);
  const [partial, setPartial] = useState('');
  const [finals, setFinals] = useState([]); // array of { text, ts }
  const [volume, setVolume] = useState(0);
  const [latencies, setLatencies] = useState([]); // ms from word-start to final
  const [wordCount, setWordCount] = useState(0);
  const [sessionLog, setSessionLog] = useState([]); // raw log lines

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const firstWordTsRef = useRef(null); // timestamp of first interim char in current utterance
  const logRef = useRef([]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg) => {
    const line = `${new Date().toISOString().slice(11, 23)} ${msg}`;
    logRef.current = [line, ...logRef.current.slice(0, 49)]; // keep last 50
    setSessionLog([...logRef.current]);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    addLog('WS → connecting…');

    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      addLog('WS ✅ connected');
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'transcript') {
        if (msg.isFinal) {
          if (msg.text) {
            const latency = msg.latencyMs !== undefined ? msg.latencyMs : null;
            firstWordTsRef.current = null;

            setFinals((prev) => [
              { text: msg.text, ts: Date.now(), latency },
              ...prev.slice(0, 19), // keep last 20 finals
            ]);
            setWordCount((prev) => prev + msg.text.split(/\s+/).filter(Boolean).length);
            if (latency !== null) {
              setLatencies((prev) => [...prev.slice(-29), latency]);
            }
            setPartial('');
            addLog(`FINAL (${latency != null ? latency + 'ms' : '?'}): "${msg.text}"`);
          } else {
            // UtteranceEnd empty final
            setPartial('');
            firstWordTsRef.current = null;
          }
        } else {
          // Interim — record the timestamp of the VERY first interim character
          if (!firstWordTsRef.current && msg.text) {
            firstWordTsRef.current = Date.now();
          }
          setPartial(msg.text || '');
        }
      } else if (msg.type === 'error') {
        addLog(`ERR: ${msg.message}`);
      }
      // Ignore tts_audio, status, etc.
    };

    ws.onerror = () => {
      setWsStatus('error');
      addLog('WS ❌ error');
    };

    ws.onclose = (e) => {
      setWsStatus('disconnected');
      addLog(`WS closed (${e.code})`);
    };
  }, [addLog]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // ── Audio pipeline — identical to PreTest.jsx ──────────────────────────────
  const startVolumeMeter = useCallback((analyser) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setVolume(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close();
    }
    audioCtxRef.current = null;
    setVolume(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || wsRef.current?.readyState !== WebSocket.OPEN) return;

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

      // Reset transcript state
      setPartial('');
      firstWordTsRef.current = null;

      wsRef.current.send(JSON.stringify({ type: 'start_recording' }));
      addLog('MIC ▶ start_recording sent');

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Smaller buffer = lower chunk latency vs PreTest's 4096
      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
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
    } catch (err) {
      addLog(`MIC ERR: ${err.message}`);
    }
  }, [isRecording, addLog, startVolumeMeter]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    cleanupAudio();
    wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }));
    addLog('MIC ⏹ stop_recording sent');
    setIsRecording(false);
  }, [isRecording, cleanupAudio, addLog]);

  // ── Auto-connect on mount ──────────────────────────────────────────────────
  useEffect(() => {
    connect();
    return () => {
      cleanupAudio();
      disconnect();
    };
  }, []); // eslint-disable-line

  // ── Derived stats ──────────────────────────────────────────────────────────
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const clearSession = () => {
    setFinals([]);
    setLatencies([]);
    setWordCount(0);
    setPartial('');
    logRef.current = [];
    setSessionLog([]);
    firstWordTsRef.current = null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="stb-root">
      {/* Header */}
      <header className="stb-header">
        <div className="stb-title">
          <span className="stb-badge">DEV</span>
          STT Test Bench
        </div>
        <div className="stb-header-right">
          <span className={`stb-ws-dot stb-ws-${wsStatus}`} />
          <span className="stb-ws-label">{wsStatus}</span>
          {wsStatus === 'disconnected' || wsStatus === 'error' ? (
            <button className="stb-btn stb-btn-sm" onClick={connect}>
              Reconnect
            </button>
          ) : (
            <button className="stb-btn stb-btn-sm stb-btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      <div className="stb-body">
        {/* ── Left column ── */}
        <div className="stb-left">
          {/* Stats row */}
          <div className="stb-stats-row">
            <div className="stb-stat">
              <span className="stb-stat-val">{avgLatency != null ? `${avgLatency}ms` : '—'}</span>
              <span className="stb-stat-label">Avg final latency</span>
            </div>
            <div className="stb-stat">
              <span className="stb-stat-val">
                {latencies.length > 0 ? `${Math.min(...latencies)}ms` : '—'}
              </span>
              <span className="stb-stat-label">Best latency</span>
            </div>
            <div className="stb-stat">
              <span className="stb-stat-val">{wordCount}</span>
              <span className="stb-stat-label">Words transcribed</span>
            </div>
            <div className="stb-stat">
              <span className="stb-stat-val">{finals.length}</span>
              <span className="stb-stat-label">Utterances</span>
            </div>
          </div>

          {/* Transcript container — the main thing to observe */}
          <div className="stb-transcript-card">
            <div className="stb-transcript-label">Live Transcript</div>
            <div className="stb-transcript-box" aria-live="polite">
              {finals.length === 0 && !partial ? (
                <span className="stb-placeholder">
                  Start recording to see transcription appear here…
                </span>
              ) : (
                <>
                  {/* Finals — rendered oldest→newest so they accumulate naturally */}
                  <span className="stb-finals">
                    {[...finals].reverse().map((f, i) => (
                      <span key={i} className="stb-final-segment">
                        {f.text}{' '}
                      </span>
                    ))}
                  </span>
                  {/* Partial — visually distinct, updates in real-time */}
                  {partial && <span className="stb-partial">{partial}</span>}
                </>
              )}
            </div>

            {/* Volume bar */}
            {isRecording && (
              <div className="stb-vol-row">
                <span className="stb-vol-label">MIC</span>
                <div className="stb-vol-track">
                  <div
                    className="stb-vol-fill"
                    style={{
                      width: `${volume}%`,
                      background: volume > 70 ? '#ef4444' : volume > 20 ? '#22c55e' : '#6366f1',
                    }}
                  />
                </div>
                <span className="stb-vol-pct">{volume}%</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="stb-controls">
            {!isRecording ? (
              <button
                className="stb-btn stb-btn-record"
                onClick={startRecording}
                disabled={wsStatus !== 'connected'}
              >
                🎙 Start Recording
              </button>
            ) : (
              <button className="stb-btn stb-btn-stop" onClick={stopRecording}>
                ⏹ Stop
              </button>
            )}
            <button className="stb-btn stb-btn-ghost" onClick={clearSession}>
              Clear
            </button>
          </div>

          {/* Utterance history with latencies */}
          {finals.length > 0 && (
            <div className="stb-history">
              <div className="stb-history-label">Utterance History</div>
              {finals.map((f, i) => (
                <div key={i} className="stb-history-item">
                  <span className="stb-history-text">{f.text}</span>
                  {f.latency != null && (
                    <span
                      className={`stb-history-lat ${f.latency < 400 ? 'fast' : f.latency < 800 ? 'ok' : 'slow'}`}
                    >
                      {f.latency}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column — raw log ── */}
        <div className="stb-right">
          <div className="stb-log-label">Raw Event Log</div>
          <div className="stb-log">
            {sessionLog.length === 0 ? (
              <span className="stb-placeholder">Events will appear here…</span>
            ) : (
              sessionLog.map((line, i) => (
                <div key={i} className="stb-log-line">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

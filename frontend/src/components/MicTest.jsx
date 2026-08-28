// src/components/MicTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Microphone Setup & Test Screen — sits between LikertScale (pre) and the
// actual interview session (/pre-test). Lets the user:
//   1. Choose their audio input device
//   2. Run a live mic test with a real-time volume meter
//   3. Optionally speak a sentence — transcript preview via Deepgram STT
//      (uses the short-lived token from GET /api/deepgram/token)
//   4. Hear the AI interviewer voice via POST /api/tts/speak (aura-2-luna-en)
//   5. Click "Start Interview" once satisfied → navigates to /pre-test
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './MicTest.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Chevron SVG — shared by both selects
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
  </svg>
);

export default function MicTest() {
  const navigate = useNavigate();

  // ── Device list ──────────────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');

  // ── Voice selection ──────────────────────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState('aura-2-luna-en');

  // ── Test session state ───────────────────────────────────────────────────
  const [isTesting, setIsTesting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [status, setStatus] = useState('idle');
  // idle | requesting | recording | ok | denied | error
  const [errorMsg, setErrorMsg] = useState('');

  // ── TTS sample state ─────────────────────────────────────────────────────
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const audioRef = useRef(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);
  const isTestingRef = useRef(false); // mirrors isTesting for ws.onclose

  // ── On mount: enumerate devices WITHOUT requesting permission ─────────────
  useEffect(() => {
    refreshDevices();
    return stopTest; // cleanup on unmount
  }, []);

  const refreshDevices = () => {
    navigator.mediaDevices.enumerateDevices().then((list) => {
      const mics = list.filter((d) => d.kind === 'audioinput');
      setDevices(mics);
      if (mics.length > 0 && !selectedMic) {
        setSelectedMic(mics[0].deviceId);
      }
    });
  };

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const stopTest = () => {
    isTestingRef.current = false;
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
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsTesting(false);
    setVolume(0);
    setPartialTranscript('');
  };

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

  // ── Start mic test ────────────────────────────────────────────────────────
  const startTest = async () => {
    setStatus('requesting');
    setErrorMsg('');
    setFinalTranscript('');
    setPartialTranscript('');

    let stream;

    // 1. Request mic permission
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic
          ? {
              deviceId: { exact: selectedMic },
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            }
          : {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            },
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg(
          'Microphone access was blocked. Click the 🔒 icon in your browser\'s address bar and set Microphone to "Allow", then try again.'
        );
      } else if (err.name === 'NotFoundError') {
        setStatus('error');
        setErrorMsg('No microphone was found. Please connect a mic and try again.');
      } else {
        setStatus('error');
        setErrorMsg(`Unexpected error: ${err.message}`);
      }
      return;
    }

    // Permission granted — re-enumerate so device labels update to real names
    refreshDevices();
    streamRef.current = stream;

    // 2. Web Audio — volume meter + PCM extraction
    try {
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

      // 3. Fetch Deepgram token from backend
      const tokenRes = await fetch(`${BACKEND_URL}/api/deepgram/token`);
      if (!tokenRes.ok) throw new Error('Failed to get Deepgram token from backend');
      const { token } = await tokenRes.json();

      // 4. Open Deepgram WebSocket (browser → Deepgram directly using Flux)
      const ws = new WebSocket(
        'wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.7&eot_timeout_ms=5000&encoding=linear16&sample_rate=16000',
        ['token', token]
      );
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        isTestingRef.current = true;
        setIsTesting(true);
        setStatus('recording');

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm.buffer);
        };
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        // Flux turn events
        if (msg.event === 'StartOfTurn') {
          console.log(`[Flux] --- StartOfTurn (Turn ${msg.turn_index}) ---`);
          setPartialTranscript('');
          return;
        }

        if (msg.event === 'EndOfTurn') {
          const turn = msg.turn_index;
          const confidence = msg.end_of_turn_confidence;
          console.log(`[Flux] --- EndOfTurn (Turn ${turn}, Confidence: ${confidence}) ---`);
          const text = (msg.transcript || partialTranscript)?.trim();
          if (text) {
            setFinalTranscript((prev) => (prev ? `${prev} ${text}` : text));
            setPartialTranscript('');
            setStatus('ok');
          }
          return;
        }

        // Extract transcript from Flux payload or fallback channel alternative
        const text = msg.transcript ?? msg?.channel?.alternatives?.[0]?.transcript;
        if (text) {
          if (msg.is_final) {
            const trimmed = text.trim();
            if (trimmed) {
              setFinalTranscript((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
              setPartialTranscript('');
              setStatus('ok');
            }
          } else {
            setPartialTranscript(text);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('Deepgram WS error:', err);
        setStatus('error');
        setErrorMsg('Could not connect to speech service. Check your internet connection.');
      };

      ws.onclose = () => {
        if (isTestingRef.current) stopTest();
      };
    } catch (err) {
      console.error('Mic test setup failed:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong setting up the audio pipeline.');
      stopTest();
    }
  };

  // ── Toggle test ───────────────────────────────────────────────────────────
  const handleToggleTest = () => {
    if (isTesting) {
      stopTest();
      setStatus('idle');
      setErrorMsg('');
    } else {
      startTest();
    }
  };

  // ── TTS: play AI interviewer voice sample ────────────────────────────────
  const handleHearSample = async () => {
    setTtsLoading(true);
    setTtsError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Hello! I'm your AI interviewer. When you're ready, click Start Interview and we'll begin.",
          voice: selectedVoice,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `Server returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (err) {
      console.error('[TTS] Sample playback failed:', err);
      setTtsError('Could not play audio sample. Check your connection or try again.');
    } finally {
      setTtsLoading(false);
    }
  };

  // ── Proceed to interview ──────────────────────────────────────────────────
  const handleProceed = () => {
    stopTest();
    navigate('/pre-test', { state: { voice: selectedVoice } });
  };

  const handleLogout = async () => {
    try {
      stopTest();
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  // ── Derived UI ────────────────────────────────────────────────────────────
  const volumeClass = volume > 70 ? 'loud' : volume > 20 ? 'good' : '';

  const dotClass =
    status === 'recording'
      ? 'recording'
      : status === 'ok'
        ? 'ok'
        : status === 'denied' || status === 'error'
          ? 'error-dot'
          : '';

  const statusText =
    {
      idle: 'Idle — press "Test Microphone" to begin',
      requesting: 'Waiting for microphone permission…',
      recording: 'Listening — say something to check your mic',
      ok: 'Mic check passed ✓',
      denied: 'Permission denied',
      error: 'Error occurred',
    }[status] ?? '';

  return (
    <div className="mictest-container">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="mictest-topbar">
        <div className="mictest-topbar-content">
          <h1>ITerview</h1>
          <span className="mictest-phase-badge">Pre-Test · Mic Setup</span>
        </div>
      </header>

      <main className="mictest-main">
        {/* ── Page heading ────────────────────────────────────────────────── */}
        <div className="mictest-header">
          <h2>Set Up Your Microphone</h2>
          <p>Choose your input device and do a quick sound check before the interview begins.</p>
        </div>

        {/* ── Permission / Error Banner ────────────────────────────────────── */}
        {errorMsg && (
          <div
            className={`mictest-banner ${status === 'denied' ? 'denied' : 'error'}`}
            role="alert"
          >
            <span className="mictest-banner-icon">{status === 'denied' ? '🔒' : '⚠️'}</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Audio Input Card ─────────────────────────────────────────────── */}
        <div className="mictest-card">
          <p className="mictest-card-title">🎙️ Audio Input</p>

          {/* Inner lavender card — card-in-card pattern */}
          <div className="mictest-inner">
            <label htmlFor="mic-select" className="mictest-label">
              Select Microphone
            </label>
            <div className="mictest-select-wrap">
              <select
                id="mic-select"
                className="mictest-select"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                disabled={isTesting}
              >
                {devices.length === 0 && <option value="">No microphones found</option>}
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                  </option>
                ))}
              </select>
              <span className="mictest-select-chevron">
                <ChevronIcon />
              </span>
            </div>

            {/* Volume Meter */}
            <div className="mictest-volume-bar-wrap">
              <div className="mictest-volume-label">
                <span>Microphone Level</span>
                <span>{volume}%</span>
              </div>
              <div
                className="mictest-volume-track"
                role="meter"
                aria-valuenow={volume}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`mictest-volume-fill ${volumeClass}`}
                  style={{ width: `${volume}%` }}
                />
              </div>
            </div>

            {/* Test Button */}
            <div className="mictest-btn-row">
              <button
                id="mic-test-btn"
                className={`mictest-btn-test ${isTesting ? 'active' : ''}`}
                onClick={handleToggleTest}
              >
                {isTesting ? '⏹ Stop Test' : '▶ Test Microphone'}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="mictest-status">
            <span className={`mictest-dot ${dotClass}`} />
            <span>{statusText}</span>
          </div>
        </div>

        {/* ── Voice Preview Card ───────────────────────────────────────────── */}
        <div className="mictest-card">
          <p className="mictest-card-title">📝 Voice Preview</p>
          <p className="mictest-label">
            Say something — your speech will appear below in real time.
          </p>
          <div className="mictest-transcript" aria-live="polite">
            {finalTranscript || partialTranscript ? (
              <>
                <span>{finalTranscript}</span>
                {partialTranscript && <span className="partial"> {partialTranscript}</span>}
              </>
            ) : (
              <span className="placeholder">Transcript will appear here…</span>
            )}
          </div>
        </div>

        {/* ── AI Voice Card ────────────────────────────────────────────────── */}
        <div className="mictest-card">
          <p className="mictest-card-title">🔊 AI Interviewer Voice</p>

          <div className="mictest-inner">
            <label htmlFor="voice-select" className="mictest-label">
              AI Voice Model
            </label>
            <div className="mictest-select-wrap">
              <select
                id="voice-select"
                className="mictest-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={ttsLoading}
              >
                <option value="aura-2-luna-en">Luna (Female)</option>
                <option value="aura-2-juno-en">Juno (Female)</option>
                <option value="aura-2-zeus-en">Zeus (Male)</option>
                <option value="aura-2-amalthea-en">Amalthea (Female)</option>
              </select>
              <span className="mictest-select-chevron">
                <ChevronIcon />
              </span>
            </div>

            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioRef} style={{ display: 'none' }} />

            <div className="mictest-btn-row">
              <button
                id="mic-tts-sample-btn"
                className="mictest-btn-test"
                onClick={handleHearSample}
                disabled={ttsLoading}
              >
                {ttsLoading ? '⏳ Loading…' : '▶ Hear Sample'}
              </button>
            </div>
          </div>

          {ttsError && (
            <div
              className="mictest-banner error"
              role="alert"
              style={{ marginTop: '12px', marginBottom: 0 }}
            >
              <span className="mictest-banner-icon">⚠️</span>
              <span>{ttsError}</span>
            </div>
          )}
        </div>

        {/* ── Info tip ─────────────────────────────────────────────────────── */}
        <div className="mictest-tip">
          <span className="mictest-tip-icon">💡</span>
          <span>
            Make sure you're in a quiet environment. The interview will record your voice and
            transcribe it in real time using Deepgram. You can re-test as many times as you like
            before starting.
          </span>
        </div>

        {/* ── Proceed CTA ─────────────────────────────────────────────────── */}
        <button id="mictest-proceed-btn" className="mictest-proceed-btn" onClick={handleProceed}>
          Start Interview →
        </button>

        {/* ── Sign out ────────────────────────────────────────────────────── */}
        <div className="mictest-signout-wrap">
          <button className="mictest-signout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}

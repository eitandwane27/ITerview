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
//
// Design: Cool Color Spectrum system (Royal Cobalt · Signal Sky Cyan · Deep
// Indigo · Cool Mint · Warm Amber) — the same token family as LandingPage
// and Dashboard. Card tints follow the flow: blue = audio input, cyan = live
// signal (transcript), indigo = AI voice. Status spectrum: amber = waiting,
// cyan = live, mint = passed, coral = blocked / error.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  AudioLines,
  AudioWaveform,
  Volume2,
  ChevronDown,
  Play,
  Square,
  Loader2,
  ArrowRight,
  Lightbulb,
  Lock,
  AlertCircle,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import logoSrc from '../assets/logo';
import './MicTest.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Status chip copy per pipeline state — the state machine lives in
// startTest()/stopTest() below (idle → requesting → recording → ok, with
// denied / error as terminal failures).
const STATUS_TEXT = {
  idle: 'Ready — run a quick test to check your levels',
  requesting: 'Waiting for microphone permission…',
  recording: 'Listening — say something to check your mic',
  ok: 'Mic check passed',
  denied: 'Permission denied',
  error: 'Error occurred',
};

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
          'Microphone access was blocked. Click the lock icon in your browser\'s address bar and set Microphone to "Allow", then try again.'
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
  // Volume fill follows the status spectrum: cobalt (quiet) → mint (good) →
  // amber (too loud) — same thresholds the previous meter used.
  const volumeFillClass =
    volume > 70 ? 'mictest-volume__fill--loud' : volume > 20 ? 'mictest-volume__fill--good' : '';
  const volumeValClass =
    volume > 70 ? 'mictest-volume__val--loud' : volume > 20 ? 'mictest-volume__val--good' : '';

  // Status chip tone: neutral idle · amber requesting · cyan recording ·
  // mint passed · coral denied/error
  const statusTone =
    status === 'recording'
      ? 'recording'
      : status === 'ok'
        ? 'ok'
        : status === 'requesting'
          ? 'requesting'
          : status === 'denied' || status === 'error'
            ? 'error'
            : 'idle';

  // Chips swap their dot for an icon on terminal states
  const StatusIcon =
    status === 'ok' ? CheckCircle2 : status === 'denied' || status === 'error' ? AlertCircle : null;

  const isDenied = status === 'denied';

  return (
    <div className="mictest-root">
      {/* ── Top Bar — db-topnav pattern: logo + wordmark, phase chip, sign out ── */}
      <header className="mictest-topnav">
        <div className="mictest-topnav__inner">
          <div className="mictest-topnav__logo-group">
            <img src={logoSrc} alt="ITerview" className="mictest-logo-img" />
            <span className="mictest-topnav__wordmark">ITerview</span>
          </div>
          <div className="mictest-topnav__right">
            <span className="mictest-phase-badge">Pre-Test · Mic Setup</span>
            <button
              type="button"
              className="mictest-signout-btn"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="mictest-signout-btn__label">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mictest-main">
        {/* ── Page heading ── */}
        <div className="mictest-header">
          <h1 className="mictest-header__title">Set up your microphone</h1>
          <p className="mictest-header__sub">
            Choose your input device and do a quick sound check before the interview begins.
          </p>
        </div>

        {/* ── Permission / error banner (amber = user action, coral = failure) ── */}
        {errorMsg && (
          <div
            className={`mictest-banner ${isDenied ? 'mictest-banner--denied' : 'mictest-banner--error'}`}
            role="alert"
          >
            {isDenied ? (
              <Lock size={16} aria-hidden="true" />
            ) : (
              <AlertCircle size={16} aria-hidden="true" />
            )}
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Card 1 · Audio Input (cobalt — the primary setup flow) ── */}
        <section className="mictest-card mictest-card--blue" aria-labelledby="mictest-audio-title">
          <div className="mictest-card__head">
            <span className="mictest-icon-badge mictest-icon-badge--blue" aria-hidden="true">
              <Mic size={22} strokeWidth={2.2} />
            </span>
            <div className="mictest-card__head-text">
              <h2 className="mictest-card__title" id="mictest-audio-title">
                Audio input
              </h2>
              <p className="mictest-card__sub">
                Pick the microphone you'll speak into, then run a live level check.
              </p>
            </div>
            <span
              className={`mictest-status-chip mictest-status-chip--${statusTone}`}
              role="status"
            >
              {StatusIcon ? (
                <StatusIcon size={13} aria-hidden="true" />
              ) : (
                <span className="mictest-pulse-dot" aria-hidden="true" />
              )}
              {STATUS_TEXT[status] ?? ''}
            </span>
          </div>

          {/* Microphone picker — db-select-wrap pattern (icon + chevron) */}
          <div className="mictest-field">
            <label htmlFor="mic-select" className="mictest-field__label">
              Microphone
            </label>
            <div className="mictest-select-wrap">
              <Mic size={17} className="mictest-select-wrap__icon" aria-hidden="true" />
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
              <ChevronDown size={17} className="mictest-select-wrap__chevron" aria-hidden="true" />
            </div>
          </div>

          {/* Live volume meter — lp-3c-metric-bar pattern + quiet/good/loud scale */}
          <div className="mictest-volume">
            <div className="mictest-volume__labels">
              <span className="mictest-volume__label">Microphone level</span>
              <span className={`mictest-volume__val ${volumeValClass}`}>{volume}%</span>
            </div>
            <div
              className="mictest-volume__track"
              role="meter"
              aria-valuenow={volume}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Microphone input level"
            >
              <div
                className={`mictest-volume__fill ${volumeFillClass}`}
                style={{ width: `${volume}%` }}
              />
            </div>
            <div className="mictest-volume__scale" aria-hidden="true">
              <span>Quiet</span>
              <span>Good</span>
              <span>Loud</span>
            </div>
          </div>

          {/* Test toggle — cobalt while idle, coral stop while recording */}
          <div className="mictest-card__actions">
            <button
              type="button"
              id="mic-test-btn"
              className={`mictest-btn-test ${isTesting ? 'mictest-btn-test--stop' : ''}`}
              onClick={handleToggleTest}
              disabled={status === 'requesting'}
            >
              {status === 'requesting' ? (
                <>
                  <Loader2 size={15} className="mictest-spin" aria-hidden="true" />
                  Requesting…
                </>
              ) : isTesting ? (
                <>
                  <Square size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  Stop test
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  Test microphone
                </>
              )}
            </button>
          </div>
        </section>

        {/* ── Card 2 · Live Transcript (cyan — the live signal surface) ── */}
        <section
          className="mictest-card mictest-card--cyan"
          aria-labelledby="mictest-transcript-title"
        >
          <div className="mictest-card__head">
            <span className="mictest-icon-badge mictest-icon-badge--cyan" aria-hidden="true">
              <AudioLines size={22} strokeWidth={2.2} />
            </span>
            <div className="mictest-card__head-text">
              <h2 className="mictest-card__title" id="mictest-transcript-title">
                Live transcript
              </h2>
              <p className="mictest-card__sub">
                Say something while the test runs — your speech appears here in real time.
              </p>
            </div>
            {isTesting && (
              <span className="mictest-live-chip">
                <span className="mictest-pulse-dot" aria-hidden="true" />
                Live
              </span>
            )}
          </div>

          <div
            className={`mictest-transcript ${isTesting ? 'mictest-transcript--live' : ''}`}
            aria-live="polite"
          >
            {finalTranscript || partialTranscript ? (
              <>
                <span className="mictest-transcript__final">{finalTranscript}</span>
                {partialTranscript && (
                  <span className="mictest-transcript__partial"> {partialTranscript}</span>
                )}
              </>
            ) : (
              <span className="mictest-transcript__placeholder">
                {isTesting
                  ? 'Listening… start talking and your words will appear here'
                  : 'Transcript will appear here…'}
              </span>
            )}
          </div>
        </section>

        {/* ── Card 3 · AI Interviewer Voice (indigo — the AI/tech tint) ── */}
        <section
          className="mictest-card mictest-card--indigo"
          aria-labelledby="mictest-voice-title"
        >
          <div className="mictest-card__head">
            <span className="mictest-icon-badge mictest-icon-badge--indigo" aria-hidden="true">
              <Volume2 size={22} strokeWidth={2.2} />
            </span>
            <div className="mictest-card__head-text">
              <h2 className="mictest-card__title" id="mictest-voice-title">
                AI interviewer voice
              </h2>
              <p className="mictest-card__sub">
                Pick the voice that will ask your questions, then hear a sample.
              </p>
            </div>
          </div>

          {/* Voice picker */}
          <div className="mictest-field">
            <label htmlFor="voice-select" className="mictest-field__label">
              Voice model
            </label>
            <div className="mictest-select-wrap">
              <AudioWaveform size={17} className="mictest-select-wrap__icon" aria-hidden="true" />
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
              <ChevronDown size={17} className="mictest-select-wrap__chevron" aria-hidden="true" />
            </div>
          </div>

          {/* Hidden TTS playback element — no controls, driven by ref */}
          <audio ref={audioRef} style={{ display: 'none' }} />

          <div className="mictest-card__actions">
            <button
              type="button"
              id="mic-tts-sample-btn"
              className="mictest-btn-ghost"
              onClick={handleHearSample}
              disabled={ttsLoading}
            >
              {ttsLoading ? (
                <>
                  <Loader2 size={15} className="mictest-spin" aria-hidden="true" />
                  Loading sample…
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  Hear sample
                </>
              )}
            </button>
          </div>

          {ttsError && (
            <div className="mictest-banner mictest-banner--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{ttsError}</span>
            </div>
          )}
        </section>

        {/* ── Setup tip — cyan info banner (db-resume-banner pattern) ── */}
        <div className="mictest-tip">
          <Lightbulb size={16} className="mictest-tip__icon" aria-hidden="true" />
          <span>
            Find a quiet spot before you begin. The interview records your voice and transcribes it
            in real time — you can re-test as many times as you like.
          </span>
        </div>

        {/* ── Proceed CTA — full-width tactile cobalt pill (db-cta-btn pattern) ── */}
        <button
          type="button"
          id="mictest-proceed-btn"
          className="mictest-proceed-btn"
          onClick={handleProceed}
        >
          Start interview
          <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* ── Privacy footnote — echoes the landing page trust language ── */}
        <p className="mictest-footnote">
          <Lock size={12} aria-hidden="true" />
          The mic is only active while a test runs — nothing is recorded or saved on this screen.
        </p>
      </main>
    </div>
  );
}

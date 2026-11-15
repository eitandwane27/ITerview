import { authenticatedFetch, schoolSocketProtocols } from '../utils/authenticatedApi';
// src/components/MicTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Microphone Setup & Test Screen — sits between LikertScale (pre) and the
// actual interview session (/pre-test). Lets the user:
//   1. Choose their audio input device
//   2. Run a live mic test with a real-time volume meter
//   3. Optionally speak a sentence — transcript preview via Deepgram STT
//      (streams through the authenticated backend /ws/mic-test connection)
//   4. Choose and preview the AI interviewer voice
//   5. Click "Start Interview" once satisfied → navigates to /pre-test
//
// Design: Cool Color Spectrum system (Royal Cobalt · Signal Sky Cyan · Deep
// Indigo · Cool Mint · Warm Amber) — the same token family as LandingPage
// and Dashboard. Card tints follow the flow: blue = audio input, cyan = live
// signal (transcript), indigo = AI voice. Status spectrum: amber = waiting,
// cyan = live, mint = passed, coral = blocked / error.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Keyboard,
  AudioLines,
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
import {
  buildAudioInputConstraints,
  readPreferredAudioInput,
  rememberPreferredAudioInput,
} from '../utils/audioInputDevices';
import './MicTest.css';
import { EASE } from './motion/motion';
import InterviewerVoicePicker from './InterviewerVoicePicker';
import { DEFAULT_INTERVIEWER_VOICE } from '../utils/interviewerVoices';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const MIC_TEST_WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws/mic-test';
const CONNECT_TIMEOUT_MS = 10000;

// Status chip copy per pipeline state — the state machine lives in
// startTest()/stopTest() below (idle → requesting → connecting → recording → ok, with
// denied / error as terminal failures).
const STATUS_TEXT = {
  idle: 'Ready — run a quick test to check your levels',
  requesting: 'Waiting for microphone permission…',
  connecting: 'Connecting to speech service…',
  recording: 'Listening — say something to check your mic',
  ok: 'Mic check passed',
  denied: 'Permission denied',
  error: 'Error occurred',
};

export default function MicTest() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [isStarting, setIsStarting] = useState(false);
  const pendingInterviewRef = useRef(null);
  const savingVoiceRef = useRef(false);
  const [voice, setVoice] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(CONNECT_TIMEOUT_MS)]);
    authenticatedFetch(`/api/users/${encodeURIComponent(uid)}`, { signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data && !signal.aborted) {
          setVoice(data.user?.interviewerVoice || DEFAULT_INTERVIEWER_VOICE);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // ── Device list ──────────────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [deviceListReady, setDeviceListReady] = useState(false);
  const [captureUnavailable, setCaptureUnavailable] = useState(false);
  const [selectedMic, setSelectedMic] = useState(readPreferredAudioInput);

  // ── Test session state ───────────────────────────────────────────────────
  const [isTesting, setIsTesting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [status, setStatus] = useState('idle');
  // idle | requesting | connecting | recording | ok | denied | error
  const [errorMsg, setErrorMsg] = useState('');

  // ── Refs ─────────────────────────────────────────────────────────────────
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);
  const isTestingRef = useRef(false); // includes pending permission/connection
  const attemptRef = useRef(0);
  const connectTimeoutRef = useRef(null);

  // ── On mount: enumerate devices WITHOUT requesting permission ─────────────
  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices);
      stopTest();
    };
  }, []);

  const refreshDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = list.filter((d) => d.kind === 'audioinput');
      setDevices(mics);
      setDeviceListReady(true);
      setSelectedMic((currentMic) => {
        const nextMic = mics.some((device) => device.deviceId === currentMic)
          ? currentMic
          : mics[0]?.deviceId || '';
        rememberPreferredAudioInput(nextMic);
        return nextMic;
      });
    } catch {
      setCaptureUnavailable(true);
    }
  };

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const stopTest = () => {
    isTestingRef.current = false;
    attemptRef.current += 1;
    clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = null;
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
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
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
    if (isTestingRef.current || pendingInterviewRef.current) return;
    isTestingRef.current = true;
    const attempt = ++attemptRef.current;
    setStatus('requesting');
    setErrorMsg('');
    setFinalTranscript('');
    setPartialTranscript('');

    let stream;

    // 1. Request mic permission
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioInputConstraints(selectedMic, { sampleRate: 16000 }),
      });
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      isTestingRef.current = false;
      setCaptureUnavailable(true);
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

    if (attempt !== attemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    // Permission granted — re-enumerate so device labels update to real names
    refreshDevices();
    streamRef.current = stream;
    setCaptureUnavailable(false);
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (streamRef.current !== stream) return;
      stopTest();
      setStatus('error');
      setCaptureUnavailable(true);
    }, { once: true });

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

      // 3. Authenticate to our backend, which owns the Deepgram connection.
      setStatus('connecting');
      const protocols = await schoolSocketProtocols();
      if (attempt !== attemptRef.current) return;
      const ws = new WebSocket(MIC_TEST_WS_URL, protocols);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      const failTest = (message) => {
        if (wsRef.current !== ws) return;
        setStatus('error');
        setErrorMsg(message);
        stopTest();
      };
      connectTimeoutRef.current = setTimeout(() => {
        failTest('Could not connect to speech service. Please try again.');
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
        ws.send(JSON.stringify({ type: 'start_recording' }));
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
        if (wsRef.current !== ws) return;
        if (typeof event.data !== 'string') return;
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg?.type === 'error') {
          failTest(msg.message || 'Speech service failed. Please try again.');
          return;
        }

        if (msg?.type !== 'transcript' || typeof msg.text !== 'string') return;
        const text = msg.text;
        if (text) {
          if (msg.isFinal) {
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
        console.error('Mic test connection error:', err);
        failTest('Could not connect to speech service. Check your connection and sign in again if needed.');
      };

      ws.onclose = () => {
        failTest('Speech service disconnected. Please run the microphone test again.');
      };
    } catch (err) {
      if (attempt !== attemptRef.current) return;
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

  // ── Proceed to interview ──────────────────────────────────────────────────
  const handleProceed = async () => {
    if (pendingInterviewRef.current || savingVoiceRef.current) return;
    stopTest();
    if (selectedVoice && selectedVoice !== voice) {
      savingVoiceRef.current = true;
      setIsSavingVoice(true);
      setVoiceError('');
      try {
        const response = await authenticatedFetch('/api/users/role', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewerVoice: selectedVoice }),
          signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error('Voice preference save failed.');
      } catch {
        setVoiceError('Couldn’t save your interviewer voice. Try again.');
        return;
      } finally {
        savingVoiceRef.current = false;
        setIsSavingVoice(false);
      }
    }
    pendingInterviewRef.current = {
      voice: selectedVoice || voice,
      fromMicSetup: true,
    };
    setIsStarting(true);
  };

  const finishHandoff = (phase) => {
    if (phase !== 'leaving' || !pendingInterviewRef.current) return;
    const state = pendingInterviewRef.current;
    pendingInterviewRef.current = null;
    navigate('/pre-test', { state });
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
        : status === 'requesting' || status === 'connecting'
          ? 'requesting'
          : status === 'denied' || status === 'error'
            ? 'error'
            : 'idle';

  // Chips swap their dot for an icon on terminal states
  const StatusIcon =
    status === 'ok' ? CheckCircle2 : status === 'denied' || status === 'error' ? AlertCircle : null;

  const micUnavailable = captureUnavailable || (deviceListReady && !devices.length);
  const showUnavailableStatus = micUnavailable && statusTone !== 'requesting';
  const isDenied = status === 'denied';

  return (
    <Motion.div
      className="mictest-root"
      initial={false}
      animate={isStarting ? 'leaving' : 'ready'}
      variants={{
        ready: { opacity: 1, scale: 1 },
        leaving: { opacity: 0, scale: reducedMotion ? 1 : 0.99 },
      }}
      transition={{ duration: reducedMotion ? 0.08 : 0.18, ease: EASE }}
      onAnimationComplete={finishHandoff}
      aria-busy={isStarting || isSavingVoice}
    >
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
              disabled={isStarting || isSavingVoice}
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
        {micUnavailable ? (
          <div className="mictest-banner mictest-typing-fallback">
            <MicOff size={17} aria-hidden="true" />
            <div role="status">
              <strong>No microphone available</strong>
              <p>Connect a mic or allow access to start the spoken check.</p>
            </div>
          </div>
        ) : errorMsg && (
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
              className={`mictest-status-chip mictest-status-chip--${showUnavailableStatus ? 'error' : statusTone}`}
              role="status"
            >
              {showUnavailableStatus ? (
                <AlertCircle size={13} aria-hidden="true" />
              ) : StatusIcon ? (
                <StatusIcon size={13} aria-hidden="true" />
              ) : (
                <span className="mictest-pulse-dot" aria-hidden="true" />
              )}
              {showUnavailableStatus ? 'Microphone unavailable' : STATUS_TEXT[status] ?? ''}
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
                onChange={(e) => {
                  setSelectedMic(e.target.value);
                  rememberPreferredAudioInput(e.target.value);
                }}
                disabled={isStarting || isSavingVoice || isTesting || status === 'requesting' || status === 'connecting'}
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

          <div className="mictest-card__actions">
            <button
              type="button"
              id="mic-test-btn"
              className={`mictest-btn-test ${isTesting ? 'mictest-btn-test--stop' : ''}`}
              onClick={handleToggleTest}
              disabled={isStarting || isSavingVoice || status === 'requesting' || status === 'connecting'}
            >
              {status === 'requesting' || status === 'connecting' ? (
                <>
                  <Loader2 size={15} className="mictest-spin" aria-hidden="true" />
                  {status === 'connecting' ? 'Connecting…' : 'Requesting…'}
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
            <button type="button" className="mictest-typing-button" disabled={isStarting || isSavingVoice}
              onClick={() => {
                stopTest();
                navigate('/interview?set=1&mode=drill&input=typing', {
                  state: { practiceReturn: '/mic-test', voice: selectedVoice || voice },
                });
              }}>
              <Keyboard size={16} aria-hidden="true" /> Practice by typing <ArrowRight size={15} aria-hidden="true" />
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
                Choose the voice that will guide you through your interview.
              </p>
            </div>
          </div>

          <InterviewerVoicePicker
            value={selectedVoice || voice}
            onChange={value => { setSelectedVoice(value); setVoiceError(''); }}
            disabled={isStarting || isSavingVoice}
            labelledBy="mictest-voice-title"
          />

          {voiceError && (
            <div className="mictest-banner mictest-banner--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{voiceError}</span>
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
          disabled={isStarting || isSavingVoice}
          aria-live="polite"
        >
          {isSavingVoice ? 'Saving voice…' : isStarting ? 'Starting interview…' : 'Start interview'}
          <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* ── Privacy footnote — echoes the landing page trust language ── */}
        <p className="mictest-footnote">
          <Lock size={12} aria-hidden="true" />
          The mic is only active while a test runs — nothing is recorded or saved on this screen.
        </p>
      </main>
    </Motion.div>
  );
}

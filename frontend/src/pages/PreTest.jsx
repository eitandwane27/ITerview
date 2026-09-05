// frontend/src/pages/PreTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: STT & TTS Core Integration — Pre-Test Diagnostic Arena
//
// Blueprint flow implemented:
//   1. On mount → connect WebSocket → server sends TTS question audio (+ text)
//   2. User presses mic → PCM audio streamed to server → Deepgram STT
//   3. Transcripts echo back in real-time for display
//   4. User presses stop → reviews transcript → confirms OR re-records
//   5. On confirm → { type: "submit_answer" } → one morphing CTA advances
//   6. After Q5 → baseline reveal (score + weakness) → explicit launch
//
// Once-only: the baseline is taken exactly once per account. The server
// rejects retakes with `pretest_completed`, which this page renders as a
// "saved baseline" panel instead of a session.
//
// Design: Cool Color Spectrum system (Royal Cobalt · Signal Sky Cyan · Deep
// Indigo · Cool Mint · Warm Amber) — the same token family as MicTest and
// Dashboard. Cyan is reserved for the live mic; coral stays an error color.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mic,
  Square,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Check,
  AudioLines,
  Volume2,
  X,
} from 'lucide-react';
import { auth } from '../firebase';
import { AnimatePresence } from 'framer-motion';
import AiAnalysisLoader from '../components/AiAnalysisLoader';
import { AIOrb } from './MainSets';
import logoSrc from '../assets/logo';
import './PreTest.css';

// Env-driven backend URL — same derivation as MicTest/TryItLiveDemo, so this
// page works in staging/prod instead of only on localhost.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const WS_BASE = BACKEND_URL.replace(/^http/, 'ws');

// Weakness tag → coach copy (mirrors AiAnalysisLoader's registry)
const WEAKNESS_LABELS = {
  focus_clarity: 'Clarity',
  focus_correctness: 'Correctness',
  focus_completeness: 'Completeness',
};
const weaknessLabel = (tag) =>
  WEAKNESS_LABELS[tag] ||
  (tag
    ? tag.replace(/^focus_/, '').charAt(0).toUpperCase() + tag.replace(/^focus_/, '').slice(1)
    : '');

export default function PreTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || 'aura-2-luna-en';

  // ── UI State ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('Connecting to session…');
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [confirmedTranscript, setConfirmedTranscript] = useState(''); // editable
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [verifyError, setVerifyError] = useState('');
  // One CTA, one promise: idle → (Confirm) → saving → (server ack) → ready →
  // (Next question). No second gate button ever appears.
  const [submissionPhase, setSubmissionPhase] = useState('idle');

  // Session outcomes
  const [baseline, setBaseline] = useState(null); // { score, weakness }
  const [alreadyCompleted, setAlreadyCompleted] = useState(null); // { score, weakness }

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const volumeFillRef = useRef(null);
  const verifyTextareaRef = useRef(null);

  const finalTranscriptRef = useRef(''); // accumulates final segments reliably
  const partialRef = useRef(''); // mirrors partialTranscript for stop handlers
  const awaitingRef = useRef(false); // mirrors awaitingConfirmation for the WS handler
  const backupRef = useRef(''); // previous answer kept safe during re-record

  // Audio queue refs (prevents feedback + question TTS from overlapping)
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const isMountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const wasOpenRef = useRef(false);

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
            if (isMountedRef.current) onError(new Error('Audio playback failed.'));
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

  // Recursive "play next" hop: the queue processor calls itself through a ref
  // so the hook stays dependency-clean while the playback chain keeps going.
  const processQueueRef = useRef(() => {});

  const processQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const item = audioQueueRef.current[0]; // peek
    isPlayingRef.current = true;
    setIsPlayingAudio(true);

    const onEnded = () => {
      isPlayingRef.current = false;
      audioQueueRef.current.shift(); // remove completed item
      if (audioQueueRef.current.length === 0) setIsPlayingAudio(false);
      processQueueRef.current(); // play next
    };

    const onPlaybackError = (err) => {
      setError(`Audio playback error: ${err.message}`);
      onEnded();
    };

    if (item.type === 'base64') {
      playBase64(item.data, onEnded, onPlaybackError);
    }
  }, [playBase64]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const enqueueBase64Audio = useCallback(
    (base64Data) => {
      audioQueueRef.current.push({ type: 'base64', data: base64Data });
      processQueue();
    },
    [processQueue]
  );

  // ── Audio cleanup — stops playback, drains the queue, tears down the
  // recording pipeline (refs only, declared before its first caller) ──────────
  const cleanupAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch {
        // element already released
      }
      currentAudioRef.current = null;
    }

    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch {
        // URL already revoked
      }
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
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    setVolume(0);
    if (volumeFillRef.current) volumeFillRef.current.style.width = '0%';
  };

  // ── Volume meter (RAF loop, throttled state for the % readout) ────────────
  // The fill bar is painted via ref every frame; the numeric readout only
  // updates ~3×/s so screen readers aren't spammed by RAF-frequency changes.
  const startVolumeMeter = (analyser) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      const level = Math.min(100, Math.round((avg / 128) * 100));
      if (volumeFillRef.current) volumeFillRef.current.style.width = `${level}%`;
      frame += 1;
      if (frame % 5 === 0) setVolume(level);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  // ── WebSocket message handler (stable — reads refs, calls setters) ────────
  const handleWsMessage = useCallback(
    (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // invalid json
      }

      switch (msg.type) {
        case 'status':
          setStatus(msg.message);
          break;

        case 'session_resumed':
          setCurrentQuestion(msg.currentQuestionIndex + 1);
          break;

        case 'tts_audio': {
          // The server is the source of truth for the question index — this
          // also heals any counter desync from double-clicked Continue.
          if (typeof msg.questionIndex === 'number') {
            setCurrentQuestion(msg.questionIndex + 1);
          }
          if (msg.questionText) setCurrentQuestionText(msg.questionText);
          enqueueBase64Audio(msg.data);
          break;
        }

        case 'transcript':
          if (msg.isFinal) {
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
              // Late finals while the user is already reviewing: fold them
              // into the editable answer so nothing heard is silently lost.
              if (awaitingRef.current) {
                setConfirmedTranscript((prev) => (prev ? `${prev} ${msg.text}` : msg.text));
              }
            }
            setFinalTranscript(finalTranscriptRef.current);
            partialRef.current = '';
            setPartialTranscript('');
          } else {
            partialRef.current = msg.text || '';
            setPartialTranscript(msg.text || '');
          }
          break;

        case 'error':
          setError(msg.message);
          break;

        case 'feedback_complete':
          setSubmissionPhase('ready');
          setStatus("Answer recorded. Continue when you're ready.");
          break;

        case 'session_complete':
          setBaseline({ score: msg.baseline_score ?? null, weakness: msg.weakness_tag ?? null });
          setIsSessionComplete(true);
          setStatus('Pre-test complete — your baseline is ready.');
          break;

        case 'pretest_completed':
          // Once-only rule: the baseline already exists for this account.
          setAlreadyCompleted({
            score: msg.baseline_score ?? null,
            weakness: msg.weakness_tag ?? null,
          });
          intentionalCloseRef.current = true;
          wsRef.current?.close();
          setStatus('Pre-test already completed.');
          break;

        default:
          break;
      }
    },
    [enqueueBase64Audio]
  );

  // ── WebSocket connection (reconnectable) ───────────────────────────────────
  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    // The socket connects in the effect below; the initial status text already
    // says "Connecting to session…" so no synchronous setState is needed here.
    intentionalCloseRef.current = false;
    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous_user';
    const ws = new WebSocket(
      `${WS_BASE}/ws/interview?voice=${encodeURIComponent(voice)}&uid=${encodeURIComponent(uid)}`
    );
    ws.binaryType = 'arraybuffer'; // receive binary chunks as ArrayBuffers
    wsRef.current = ws;

    ws.onopen = () => {
      wasOpenRef.current = true;
      setIsConnected(true);
      setConnectionLost(false);
      setError('');
    };

    ws.onmessage = handleWsMessage;

    ws.onerror = () => {
      setError('Connection problem — check that the backend is running.');
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!intentionalCloseRef.current && wasOpenRef.current && isMountedRef.current) {
        setConnectionLost(true);
        setStatus('Connection lost.');
      }
    };
  }, [handleWsMessage, voice]);

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      cleanupAudio();
    };
  }, [connect]);

  // ── Error toast auto-expiry (manual dismiss also available) ────────────────
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  // Move focus into the review panel when it appears — the mic button that
  // held focus has just been swapped out from under the user.
  useEffect(() => {
    if (awaitingConfirmation) verifyTextareaRef.current?.focus();
  }, [awaitingConfirmation]);

  // ── Mic controls ───────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || !isConnected) return;
    setError('');
    setVerifyError('');

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

      // Non-destructive re-record: whatever was confirmed before is kept in
      // backupRef until a new take produces finals.
      backupRef.current = confirmedTranscript || finalTranscriptRef.current || '';

      // Reset transcripts
      finalTranscriptRef.current = '';
      setFinalTranscript('');
      partialRef.current = '';
      setPartialTranscript('');
      setConfirmedTranscript('');
      setAwaitingConfirmation(false);
      awaitingRef.current = false;

      // Tell the server we're starting
      wsRef.current.send(JSON.stringify({ type: 'start_recording' }));

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
      setStatus('Recording your answer…');
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    cleanupAudio();

    // Tell the server to close the Deepgram session
    wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }));

    setIsRecording(false);

    const partialText = partialRef.current;
    let combined = (
      finalTranscriptRef.current +
      (partialText ? (finalTranscriptRef.current ? ' ' : '') + partialText : '')
    ).trim();

    // Re-record safety net: if the new take captured nothing but a previous
    // answer exists, keep the previous answer instead of destroying it.
    if (!combined && backupRef.current) {
      combined = backupRef.current;
      backupRef.current = '';
      setStatus('The new take came through quiet, so we kept your previous answer.');
    } else {
      backupRef.current = '';
      setStatus('Review your answer — you can edit it before confirming.');
    }

    setFinalTranscript(combined);
    setConfirmedTranscript(combined);
    setAwaitingConfirmation(true);
    awaitingRef.current = true;
  };

  const submitAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionLost(true);
      return;
    }
    if (!confirmedTranscript.trim()) {
      setVerifyError('Your answer is empty — record it first, or press Re-record to try again.');
      return;
    }
    setVerifyError('');
    setSubmissionPhase('saving');
    setStatus('Saving your answer…');
    wsRef.current.send(
      JSON.stringify({
        type: 'submit_answer',
        final_text: confirmedTranscript,
      })
    );
  };

  const handleNextQuestion = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionLost(true);
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'next_question' }));

    setAwaitingConfirmation(false);
    awaitingRef.current = false;
    setSubmissionPhase('idle');
    setFinalTranscript('');
    partialRef.current = '';
    setPartialTranscript('');
    setConfirmedTranscript('');
    setVerifyError('');
    finalTranscriptRef.current = '';
    setCurrentQuestion((prev) => Math.min(prev + 1, 5)); // server corrects via questionIndex
    setStatus('Loading the next question…');
  };

  const handleReplay = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionLost(true);
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'replay_question' }));
  };

  const reRecord = () => {
    backupRef.current = confirmedTranscript || finalTranscriptRef.current || '';
    setAwaitingConfirmation(false);
    awaitingRef.current = false;
    setSubmissionPhase('idle');
    setVerifyError('');
    setFinalTranscript('');
    partialRef.current = '';
    setPartialTranscript('');
    setConfirmedTranscript('');
    finalTranscriptRef.current = '';
    startRecording();
  };

  // ── Derived UI ─────────────────────────────────────────────────────────────
  // Progress counts confirmed answers, so the bar reflects real work done —
  // it starts empty and hits 100% exactly when the session completes.
  const answeredCount = isSessionComplete ? 5 : currentQuestion - 1;

  // Status strip tone: neutral (idle/offline) · cobalt (AI speaking) · cyan
  // (listening) · indigo (review) — same spectrum as the MicTest status chip.
  const stripTone = !isConnected
    ? 'idle'
    : isPlayingAudio
      ? 'speaking'
      : isRecording
        ? 'listening'
        : awaitingConfirmation
          ? 'verify'
          : 'idle';

  const volumeValClass =
    volume > 70 ? 'pt-volume-val--loud' : volume > 20 ? 'pt-volume-val--good' : '';

  const canShowReplay =
    isConnected &&
    !!currentQuestionText &&
    !isRecording &&
    !isPlayingAudio &&
    !awaitingConfirmation &&
    !isSessionComplete &&
    !alreadyCompleted;

  return (
    <div className="pt-root">
      {/* AI Analysis Loader — only launched by an explicit user action */}
      <AnimatePresence>
        {isAnalyzing && (
          <AiAnalysisLoader
            key="pre-analysis-loader"
            weakness={baseline?.weakness || alreadyCompleted?.weakness || 'focus_completeness'}
            onComplete={() => navigate('/interview?set=1', { state: { voice } })}
            onSkip={() => navigate('/interview?set=1', { state: { voice } })}
            onClose={() => setIsAnalyzing(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Top Bar — db-topnav pattern: logo + wordmark, phase chip ── */}
      <header className="pt-topbar">
        <div className="pt-topbar__brand">
          <img src={logoSrc} alt="ITerview" className="pt-logo-img" />
          <span className="pt-topbar__wordmark">ITerview</span>
        </div>
        <div className="pt-topbar__meta">
          <span className="pt-phase-badge">Pre-test</span>
        </div>
      </header>

      {/* ── Reconnect banner — no more zombie state after a dropped socket ── */}
      {connectionLost && !alreadyCompleted && (
        <div className="pt-reconnect-banner" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            Connection lost — your progress is saved. Reconnect to pick up where you left off.
          </span>
          <button
            type="button"
            className="pt-btn pt-btn-ghost pt-btn--sm"
            onClick={() => {
              setStatus('Connecting to session…');
              connect();
            }}
          >
            Reconnect
          </button>
        </div>
      )}

      {/* ── Progress bar — fills with confirmed answers, not questions seen ── */}
      <div
        className="pt-progress-track"
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuetext={`${answeredCount} of 5 questions answered`}
        aria-label="Pre-test progress"
      >
        <div className="pt-progress-fill" style={{ width: `${(answeredCount / 5) * 100}%` }} />
      </div>

      <main className="pt-main">
        {/* ── Stage (left column) — the session centerpiece ── */}
        <section className="pt-stage-card" aria-label="Pre-test session stage">
          {alreadyCompleted ? (
            /* ── Once-only gate: retake rejected, baseline already saved ── */
            <div className="pt-complete-panel pt-complete-panel--saved">
              <span className="pt-complete-kicker">Pre-test already completed</span>
              <p className="pt-complete-score">
                <span className="pt-complete-num">{alreadyCompleted.score ?? '—'}%</span>
                <span className="pt-complete-num-label">saved baseline</span>
              </p>
              <p className="pt-complete-note">
                Your baseline is taken once so we can measure how far you grow. Head back to
                your dashboard to keep practicing, or proceed to MainSets.
              </p>
              <div className="pt-complete-actions">
                <button
                  type="button"
                  className="pt-btn pt-btn-cta"
                  onClick={() => setIsAnalyzing(true)}
                >
                  Proceed to MainSets
                  <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="pt-btn pt-btn-ghost"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Return to dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Shared AIOrb from MainSets — it speaks the question and
                  listens while you answer, exactly like the live arena */}
              <div className="pt-orb-wrap">
                <AIOrb isSpeaking={isPlayingAudio} isListening={isRecording} />
              </div>

              <div className="pt-stage-head">
                <span className="pt-question-chip">
                  Question {Math.min(currentQuestion, 5)} of 5
                </span>
                {/* The question itself is the headline — recognition, not recall */}
                <h1 className="pt-stage-title">
                  {currentQuestionText || 'Listen to the question, then answer out loud.'}
                </h1>
                {canShowReplay && (
                  <button type="button" className="pt-replay-btn" onClick={handleReplay}>
                    <Volume2 size={14} aria-hidden="true" />
                    Hear it again
                  </button>
                )}
              </div>

              {/* Status strip — one tone per pipeline state */}
              <div className={`pt-status-strip pt-status-strip--${stripTone}`} role="status">
                <span className="pt-status-dot" aria-hidden="true" />
                <span>{status}</span>
              </div>

              {/* ── Baseline reveal — the payoff the old flow never showed ── */}
              {isSessionComplete && baseline ? (
                <div className="pt-complete-panel">
                  <span className="pt-complete-kicker">Pre-test complete</span>
                  <p className="pt-complete-score">
                    <span className="pt-complete-num">{baseline.score ?? '—'}%</span>
                    <span className="pt-complete-num-label">baseline score</span>
                  </p>
                  <p className="pt-complete-note">
                    Across Clarity, Correctness and Completeness
                    {baseline.weakness ? (
                      <>
                        {' '}— we'll focus your practice on{' '}
                        <strong>{weaknessLabel(baseline.weakness)}</strong>, where a little
                        coaching will move the needle most.
                      </>
                    ) : (
                      '. Every practice set from here targets where you can grow most.'
                    )}
                  </p>
                  <div className="pt-complete-actions">
                    <button
                      type="button"
                      className="pt-btn pt-btn-cta pt-btn-cta--lg"
                      onClick={() => setIsAnalyzing(true)}
                    >
                      Proceed to MainSets
                      <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="pt-btn pt-btn-ghost"
                      onClick={() => navigate('/dashboard')}
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      Return to dashboard
                    </button>
                  </div>
                </div>
              ) : awaitingConfirmation ? (
                /* ── Verify Panel (Phase 2) — indigo review surface ── */
                <div className="pt-verify-panel">
                  <span className="pt-verify-label">Review your answer</span>
                  <textarea
                    ref={verifyTextareaRef}
                    className="pt-verify-textarea"
                    value={confirmedTranscript}
                    onChange={(e) => setConfirmedTranscript(e.target.value)}
                    placeholder="Your transcribed answer will appear here…"
                    aria-label="Edit your transcribed answer"
                    rows={4}
                  />
                  <span className="pt-verify-hint">
                    Editing is optional — just fix any words the transcription missed.
                  </span>
                  {verifyError && (
                    <span className="pt-verify-error" role="alert">
                      {verifyError}
                    </span>
                  )}
                  <div className="pt-verify-actions">
                    {submissionPhase === 'ready' ? (
                      /* The CTA morphs in place — one button, one promise */
                      <button
                        type="button"
                        className="pt-btn pt-btn-cta"
                        onClick={handleNextQuestion}
                      >
                        {currentQuestion >= 5 ? 'Finish & see my baseline' : 'Next question'}
                        <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="pt-btn pt-btn-cta"
                          onClick={submitAnswer}
                          disabled={submissionPhase === 'saving'}
                        >
                          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                          {submissionPhase === 'saving' ? 'Saving…' : 'Confirm answer'}
                        </button>
                        <button
                          type="button"
                          className="pt-btn pt-btn-ghost"
                          onClick={reRecord}
                          disabled={submissionPhase === 'saving'}
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          Re-record
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Mic Area ── */
                <div className="pt-mic-zone">
                  {!isRecording ? (
                    <button
                      type="button"
                      className="pt-mic-btn"
                      onClick={startRecording}
                      disabled={!isConnected || isPlayingAudio}
                      aria-label={
                        isPlayingAudio
                          ? 'Waiting for the question to finish'
                          : 'Start recording your answer'
                      }
                    >
                      <Mic size={30} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pt-mic-btn pt-mic-btn--active"
                      onClick={stopRecording}
                      aria-label="Stop recording"
                    >
                      <Square size={26} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    </button>
                  )}
                  <span className={`pt-mic-label ${isRecording ? 'pt-mic-label--active' : ''}`}>
                    {isRecording
                      ? 'Recording — speak your answer'
                      : isPlayingAudio
                        ? 'Luna is speaking…'
                        : 'Press to speak'}
                  </span>

                  {/* Volume Meter */}
                  {isRecording && (
                    <div className="pt-volume">
                      <div className="pt-volume__labels">
                        <span className="pt-volume__label">Microphone level</span>
                        <span className={`pt-volume__val ${volumeValClass}`}>{volume}%</span>
                      </div>
                      <div
                        className="pt-volume__track"
                        role="meter"
                        aria-valuenow={volume}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Microphone input level"
                      >
                        {/* Fill painted via ref — no per-frame React re-render */}
                        <div ref={volumeFillRef} className="pt-volume__fill" style={{ width: '0%' }} />
                      </div>
                    </div>
                  )}

                  {/* Coach note — reassurance at the moment of highest stakes */}
                  {!isRecording && !isPlayingAudio && (
                    <p className="pt-coach-note">
                      Take your time — there are no wrong answers, and you can re-record anytime.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        {/* ── Sidebar: live transcript ── */}
        <aside className="pt-sidebar">
          <div className="pt-transcript-card">
            <div className="pt-transcript-card__head">
              <span className="pt-icon-badge pt-icon-badge--cyan" aria-hidden="true">
                <AudioLines size={20} strokeWidth={2.2} />
              </span>
              <span className="pt-transcript-card__title">
                {awaitingConfirmation ? 'Answer in review' : 'Live transcript'}
              </span>
              {isRecording && (
                <span className="pt-live-chip">
                  <span className="pt-pulse-dot" aria-hidden="true" />
                  Live
                </span>
              )}
            </div>
            <div
              className={`pt-transcript-body ${isRecording ? 'pt-transcript-body--live' : ''}`}
            >
              {/* SR announcement throttled to finals only — partials stay silent */}
              <span className="pt-sr-only" aria-live="polite">
                {finalTranscript}
              </span>
              {awaitingConfirmation ? (
                <span className="pt-transcript-empty">
                  Saved for review — edit your answer in the panel. We'll fold in any last words
                  the transcriber catches.
                </span>
              ) : !finalTranscript && !partialTranscript ? (
                <span className="pt-transcript-empty">
                  {isRecording
                    ? 'Listening… your words will appear here'
                    : 'Your voice transcript will appear here…'}
                </span>
              ) : (
                <>
                  <span className="pt-transcript-final">{finalTranscript}</span>
                  {partialTranscript && (
                    <span className="pt-transcript-partial"> {partialTranscript}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* ── Error toast (coral, db-form-error pattern, fixed bottom) ── */}
      {error && (
        <div className="pt-error-toast" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            className="pt-toast-close"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// frontend/src/pages/PreTest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: STT & TTS Core Integration — Pre-Test Diagnostic Arena
//
// Blueprint flow implemented:
//   1. Start the baseline → connect WebSocket → server sends question audio (+ text)
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
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { AnimatePresence } from 'framer-motion';
import AiAnalysisLoader from '../components/AiAnalysisLoader';
import TestWorkspace from '../components/TestWorkspace';

// Env-driven backend URL — same derivation as MicTest/TryItLiveDemo, so this
// page works in staging/prod instead of only on localhost.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const WS_BASE = BACKEND_URL.replace(/^http/, 'ws');

export default function PreTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || 'aura-2-luna-en';

  // ── Auth State ─────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [authLoading, setAuthLoading] = useState(() => !auth.currentUser);

  // The introduction gates the once-only baseline before audio connects.
  const [showBriefing, setShowBriefing] = useState(true);

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

  // ── Sync Auth state so refreshing never defaults to anonymous_user ─────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthLoading(false);
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
  const cleanupAudio = useCallback(() => {
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
  }, []);

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

        case 'answer_save_failed':
          setSubmissionPhase('idle');
          setVerifyError(msg.message);
          setStatus('Your answer is still here. Confirm it again to retry.');
          break;

        case 'feedback_complete':
          setSubmissionPhase('ready');
          setStatus("Answer recorded. Continue when you're ready.");
          break;

        case 'session_complete':
          setBaseline({ score: msg.baseline_score ?? null, weakness: msg.weakness_tag ?? null });
          setIsSessionComplete(true);
          setStatus('Starting check complete. Your starting point is saved.');
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
  const connect = useCallback(
    (explicitUid) => {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const uid = explicitUid || auth.currentUser?.uid;
      if (!uid) {
        // Defer connecting until Firebase Auth has verified the user token
        return;
      }

      // The socket connects in the effect below; the initial status text already
      // says "Connecting to session…" so no synchronous setState is needed here.
      intentionalCloseRef.current = false;
      const searchParams = new URLSearchParams(location.search);
      const resetParam = searchParams.get('reset') === 'true' ? '&reset=true' : '';

      const ws = new WebSocket(
        `${WS_BASE}/ws/interview?voice=${encodeURIComponent(voice)}&uid=${encodeURIComponent(uid)}${resetParam}`
      );
      ws.binaryType = 'arraybuffer'; // receive binary chunks as ArrayBuffers
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current === ws) {
          wasOpenRef.current = true;
          setIsConnected(true);
          setConnectionLost(false);
          setError('');
        }
      };

      ws.onmessage = (event) => {
        if (wsRef.current === ws) {
          handleWsMessage(event);
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          setError('We couldn’t connect to your session. Check your connection and try again.');
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          setIsConnected(false);
          if (!intentionalCloseRef.current && wasOpenRef.current && isMountedRef.current) {
            setConnectionLost(true);
            setStatus('Connection lost.');
          }
        }
      };
    },
    [handleWsMessage, voice, location.search]
  );

  useEffect(() => {
    if (authLoading || !currentUser || showBriefing) return undefined;

    const connectTimer = window.setTimeout(() => connect(currentUser.uid), 0);

    return () => {
      window.clearTimeout(connectTimer);
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      cleanupAudio();
    };
  }, [connect, authLoading, currentUser, showBriefing, cleanupAudio]);

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
      setStatus('Review your answer. You can edit it before confirming.');
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
      setVerifyError('Your answer is empty. Record again or add your answer before confirming.');
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
    setCurrentQuestionText('');
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

  return (
    <TestWorkspace
      variant="pre"
      showBriefing={showBriefing}
      authLoading={authLoading}
      isConnected={isConnected}
      isRecording={isRecording}
      isPlayingAudio={isPlayingAudio}
      isSessionComplete={isSessionComplete}
      connectionLost={connectionLost}
      alreadyCompleted={alreadyCompleted}
      result={baseline}
      currentQuestion={currentQuestion}
      currentQuestionText={currentQuestionText}
      status={status}
      finalTranscript={finalTranscript}
      partialTranscript={partialTranscript}
      confirmedTranscript={confirmedTranscript}
      awaitingConfirmation={awaitingConfirmation}
      submissionPhase={submissionPhase}
      verifyError={verifyError}
      error={error}
      volume={volume}
      volumeFillRef={volumeFillRef}
      verifyTextareaRef={verifyTextareaRef}
      onStart={() => setShowBriefing(false)}
      onExit={() => navigate('/dashboard')}
      onReconnect={() => {
        setStatus('Connecting to session…');
        connect(currentUser?.uid);
      }}
      onReplay={handleReplay}
      onRecord={startRecording}
      onStop={stopRecording}
      onAnswerChange={setConfirmedTranscript}
      onConfirm={submitAnswer}
      onNext={handleNextQuestion}
      onReRecord={reRecord}
      onContinue={() => setIsAnalyzing(true)}
      onViewResults={() => navigate('/results')}
      onDismissError={() => setError('')}
    >
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
    </TestWorkspace>
  );
}

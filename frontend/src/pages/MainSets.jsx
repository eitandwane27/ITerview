// frontend/src/pages/MainSets.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 / 2 / 3 Interview Arena — Soft Productivity SaaS design system
//
// Features:
// - Toggle Mic (Push-to-Talk & Spacebar shortcut) architecture
// - Connects to ws://localhost:5000/ws/set{n}
// - AI Coach Panel for 1-sentence tips
// - Stabilized Zero-CLS Live Transcript & Response Panel
// - Interactive candidate notes scratchpad & full transcript modal
// - SetBriefingOverlay shown on mount
// - Design: ITerview studio world (Session Ramp neutrals, cyan signal)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { AnimatePresence } from 'framer-motion';
import Set2TransitionOverlay from '../components/Set2TransitionOverlay';
import Set3TransitionOverlay from '../components/Set3TransitionOverlay';
import InterviewSidebar from '../components/InterviewSidebar';
import logoSrc from '../assets/logo';
import {
  Mic,
  Square,
  PhoneOff,
  Phone,
  Clock,
  Flag,
  Sun,
  Settings,
  MoreHorizontal,
  Shield,
  Activity,
  ArrowRight,
  X,
} from 'lucide-react';
import './MainSets.css';

// ── Set metadata ───────────────────────────────────────────────────────────
const SET_META = {
  1: { label: 'Set 1: Personalized', difficulty: 'easy', category: 'Personalized' },
  2: { label: 'Set 2: Technical Mastery', difficulty: 'hard', category: 'Technical' },
  3: { label: 'Set 3: Behavioral STAR', difficulty: 'medium', category: 'Behavioral' },
};

// Sidebar previews for unasked questions in preview/dev mode (real sessions
// only reveal a question once the server sends it).
const PREVIEW_QUESTIONS = {
  1: [
    'Tell me about a challenging technical project you worked on and what your specific role was.',
    'How did you handle testing in that project?',
    'Describe how you collaborated with designers or product managers.',
    'What was the hardest bug you hit and how did you debug it?',
    'What would you improve if you revisited that project today?',
  ],
  2: [
    'Explain the difference between SQL and NoSQL databases, and when you would choose one over the other.',
    'Explain JavaScript closures and their use cases.',
    'How would you optimize a React app for performance?',
    'Explain the virtual DOM and how it differs from the real DOM.',
    'How do you handle side effects and data fetching in modern React?',
  ],
  3: [
    'Tell me about a time you worked on a group programming project and how your team divided the tasks.',
    "Describe a time you disagreed with a teammate's coding style.",
    'Tell me about a time you missed a deadline. What happened?',
    'Describe a situation where you explained a technical concept to a non-technical stakeholder.',
    'Tell me about a failure you owned and what you changed afterward.',
  ],
};

// Elapsed-time formatting: stage clock (hh:mm:ss) and session chip (mm:ss)
const pad2 = (n) => String(n).padStart(2, '0');
const formatHMS = (t) =>
  `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${pad2(t % 60)}`;
const formatMS = (t) => `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;

// ── Isolated Mascot & AI Orb Components ─────────────────────────────────────

export function MascotLogo({ src = logoSrc, size = 32, className = '' }) {
  return (
    <div
      className={`ix-mascot-logo ${className}`}
      style={{ width: size, height: size }}
      aria-label="iTerview mascot"
    >
      <img
        src={src}
        alt="iTerview mascot"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}

export function AIOrb({ isSpeaking = false, isListening = false, isComplete = false }) {
  return (
    <div
      className={`ix-orb-container ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''} ${isComplete ? 'complete' : ''}`}
      aria-label="AI Interviewer Orb"
    >
      <div className="ix-orb-glow-backdrop" />
      <div className="ix-orb-sphere">
        <div className="ix-orb-specular" />
        <div className="ix-orb-eyes">
          <span className="ix-orb-pill" />
          <span className="ix-orb-pill" />
        </div>
      </div>
    </div>
  );
}

export default function MainSets() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || 'aura-2-luna-en';
  const query = new URLSearchParams(location.search);
  const setNumber = parseInt(query.get('set')) || 1;
  const mode = query.get('mode') || 'diagnostic';
  const focusArea = query.get('focusArea') || '';
  const isResume = query.get('resume') === 'true';
  const isAutostart = query.get('autostart') === 'true';
  const preview = query.get('preview') === 'true' || location.pathname.includes('/dev/');

  const meta = SET_META[setNumber] || SET_META[1];

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showBriefing, setShowBriefing] = useState(setNumber !== 1 && !isResume && !isAutostart);
  const [_status, setStatus] = useState('Waiting to start...');
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showNextTransition, setShowNextTransition] = useState(false);
  const [userRole, setUserRole] = useState('Frontend');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [hasReceivedQ1Audio, setHasReceivedQ1Audio] = useState(false);
  const [_slowWait, setSlowWait] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [coachTip, setCoachTip] = useState(
    'Your personalized AI feedback will appear here after each answer.'
  );
  const [_scores, setScores] = useState(null);

  // Modals & User interaction state
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptModalData, setTranscriptModalData] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);

  // ── Session HUD state (stage clock, sidebar question list, tabs, PIP) ─────
  const [elapsedSec, setElapsedSec] = useState(0);
  const [questionsAsked, setQuestionsAsked] = useState([]);
  const [activeTab, setActiveTab] = useState('questions');
  const [userInitials, setUserInitials] = useState('ME');
  const [candidateNotes, setCandidateNotes] = useState(() => {
    try {
      return localStorage.getItem(`iterview_notes_set_${setNumber}`) || '';
    } catch {
      return '';
    }
  });

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setCandidateNotes(val);
    try {
      localStorage.setItem(`iterview_notes_set_${setNumber}`, val);
    } catch {
      // ignore storage error
    }
  };

  // Stage clock ticks only while a session is live.
  useEffect(() => {
    if (!isConnected || isSessionComplete) return undefined;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isConnected, isSessionComplete]);

  // ── Sidebar question list helpers ──────────────────────────────────────────
  const addQuestion = useCallback((index, text) => {
    setQuestionsAsked((prev) =>
      prev.some((q) => q.index === index)
        ? prev.map((q) => (q.index === index ? { ...q, text } : q))
        : [...prev, { index, text, answered: false, answer: '' }]
    );
  }, []);

  // Flags the most recent unanswered question as answered.
  const markCurrentAnswered = useCallback((answerText) => {
    setQuestionsAsked((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (!next[i].answered) {
          next[i] = { ...next[i], answered: true, answer: answerText || '' };
          break;
        }
      }
      return next;
    });
  }, []);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const isMountedRef = useRef(true);
  const isSessionCompleteRef = useRef(false);
  const processQueueRef = useRef(null);
  const liveTranscriptScrollRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-scroll the live transcription container smoothly to bottom as candidate speaks
  useEffect(() => {
    if (isRecording && liveTranscriptScrollRef.current) {
      liveTranscriptScrollRef.current.scrollTop = liveTranscriptScrollRef.current.scrollHeight;
    }
  }, [finalTranscript, partialTranscript, isRecording]);

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

  const processQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const item = audioQueueRef.current[0];
    isPlayingRef.current = true;
    setIsPlayingAudio(true);

    const onEnded = () => {
      isPlayingRef.current = false;
      audioQueueRef.current.shift();
      if (audioQueueRef.current.length === 0) {
        setIsPlayingAudio(false);
        if (isSessionCompleteRef.current && setNumber < 3) {
          setShowNextTransition(true);
        }
      }
      processQueueRef.current?.();
    };

    if (item.type === 'base64') {
      playBase64(item.data, onEnded, onEnded);
    }
  }, [playBase64, setNumber]);

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

  // ── Cleanup Audio ────────────────────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch {
        // ignore cleanup error
      }
      currentAudioRef.current = null;
    }

    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch {
        // ignore cleanup error
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
  }, []);

  // ── Fetch user role on mount ───────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      fetch(`/api/users/${user.uid}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.role) {
            const r = data.user.role;
            setUserRole(r.charAt(0).toUpperCase() + r.slice(1));
          }
          const u = auth.currentUser;
          const rawName =
            data.user?.name || u?.displayName || (u?.email ? u.email.split('@')[0] : '');
          const parts = String(rawName).trim().split(/\s+/).filter(Boolean);
          if (parts.length > 0) {
            setUserInitials(
              parts
                .slice(0, 2)
                .map((w) => w.charAt(0).toUpperCase())
                .join('') || 'ME'
            );
          }
        })
        .catch((err) => console.error('Error fetching user role:', err));
    }
  }, []);

  // ── WebSocket connection (Starts automatically for Set 1, or after transition) ──
  const startSession = useCallback(() => {
    setShowBriefing(false);

    if (preview) {
      setIsConnected(true);
      setIsGeneratingQuestions(false);
      setHasReceivedQ1Audio(true);
      setStatus('Question ready. Click Answer to respond.');
      const previewQ =
        setNumber === 1
          ? 'Tell me about a challenging technical project you worked on and what your specific role was.'
          : setNumber === 2
            ? 'Explain the difference between SQL and NoSQL databases, and when you would choose one over the other.'
            : 'Tell me about a time you worked on a group programming project and how your team divided the tasks.';
      setCurrentQuestion(1);
      setCurrentQuestionText(previewQ);
      addQuestion(1, previewQ);
      return;
    }

    if (!isResume && (setNumber === 1 || setNumber === 2)) {
      setIsGeneratingQuestions(true);
      setHasReceivedQ1Audio(false);
      setSlowWait(false);
    } else {
      setIsGeneratingQuestions(false);
    }

    setStatus(`Connecting to Set ${setNumber} session...`);

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous_user';
    const focusParam = focusArea ? `&focusArea=${focusArea}` : '';
    const ws = new WebSocket(
      `ws://localhost:5000/ws/set${setNumber}?voice=${voice}&uid=${uid}${focusParam}`
    );
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to Set ${setNumber}`);
      setIsConnected(true);
      setError('');
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'generation_progress':
          if (msg.role) setUserRole(msg.role.charAt(0).toUpperCase() + msg.role.slice(1));
          if (msg.message) setStatus(msg.message);
          break;
        case 'status':
          setStatus(msg.message);
          break;
        case 'tts_audio':
          setHasReceivedQ1Audio(true);
          enqueueBase64Audio(msg.data);
          break;
        case 'question_text':
          addQuestion(msg.index, msg.text);
          setCurrentQuestionText(msg.text);
          setCurrentQuestion(msg.index);
          setFinalTranscript('');
          setPartialTranscript('');
          finalTranscriptRef.current = '';
          setIsEvaluating(false);
          break;
        case 'coach_tip':
          setCoachTip(msg.tip);
          markCurrentAnswered(finalTranscriptRef.current);
          if (setNumber === 2) {
            setScores({
              problem_solving: msg.problem_solving_score,
              accuracy: msg.accuracy_score,
              depth: msg.depth_score,
            });
          } else if (setNumber === 3) {
            setScores({
              situation: msg.situation_score,
              action: msg.action_score,
              result: msg.result_score,
            });
          }
          break;
        case 'transcript':
          if (msg.isFinal) {
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
            }
            setFinalTranscript(finalTranscriptRef.current);
            setPartialTranscript('');
          } else {
            setPartialTranscript(msg.text || '');
          }
          break;
        case 'error':
          setError(msg.message);
          setIsEvaluating(false);
          break;
        case 'session_complete':
          setIsSessionComplete(true);
          isSessionCompleteRef.current = true;
          setStatus(`Set ${setNumber} Complete!`);
          setIsEvaluating(false);
          if (setNumber < 3) {
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
              setShowNextTransition(true);
            }
          }
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed. Is the backend running?');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [
    preview,
    setNumber,
    voice,
    focusArea,
    isResume,
    enqueueBase64Audio,
    addQuestion,
    markCurrentAnswered,
  ]);

  const goToNextSet = () => {
    setShowNextTransition(false);
    const nextSet = setNumber + 1;
    const modeParam = mode === 'practice' ? '&mode=practice' : '';
    const focusParam = focusArea ? `&focusArea=${focusArea}` : '';
    navigate(`/interview?set=${nextSet}${modeParam}${focusParam}&autostart=true`, {
      state: { voice },
    });
  };

  // ── Reset & Initialize on route change ────────────────────────────────────
  useEffect(() => {
    isSessionCompleteRef.current = false;
    if (setNumber === 1 || isResume || isAutostart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startSession();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupAudio();
    };
  }, [
    location.search,
    location.pathname,
    setNumber,
    isResume,
    isAutostart,
    startSession,
    cleanupAudio,
  ]);

  const isGenerating = isGeneratingQuestions && !(hasReceivedQ1Audio && currentQuestionText);

  // Slow-generation guard: after ~15s without Q1 audio, surface one honest hint with a retry.
  useEffect(() => {
    if (!isGeneratingQuestions || !isConnected || error) return undefined;
    const timer = setTimeout(() => setSlowWait(true), 15000);
    return () => clearTimeout(timer);
  }, [isGeneratingQuestions, isConnected, error]);

  // ── Volume meter ─────────────────────────────────────────────────────────
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

  // ── Mic controls ───────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (preview) {
      if (isRecording) {
        setIsRecording(false);
        setIsEvaluating(true);
        setStatus('Answer submitted. Evaluating...');

        setTimeout(() => {
          setIsEvaluating(false);
          setCoachTip(
            setNumber === 1
              ? 'Great detail on the database structure. Try to explain why you chose SQL over NoSQL.'
              : setNumber === 2
                ? 'Good explanation of database types. Focus on scaling trade-offs next time.'
                : 'Excellent use of the STAR method. You clearly outlined the situation and task.'
          );

          if (setNumber === 2) {
            setScores({ problem_solving: 8, accuracy: 9, depth: 7 });
          } else if (setNumber === 3) {
            setScores({ situation: 8, action: 7, result: 9 });
          }

          markCurrentAnswered(finalTranscriptRef.current);

          const nextQ = currentQuestion + 1;
          if (nextQ > 5) {
            setIsSessionComplete(true);
            setStatus(`Set ${setNumber} Complete!`);
          } else {
            const mockText =
              setNumber === 1
                ? `Mock Personalized Question ${nextQ}: How did you handle testing in that project?`
                : setNumber === 2
                  ? `Mock Technical Question ${nextQ}: Explain JavaScript closures and their use cases.`
                  : `Mock Behavioral Question ${nextQ}: Describe a time you disagreed with a teammate's coding style.`;
            setCurrentQuestion(nextQ);
            setCurrentQuestionText(mockText);
            addQuestion(nextQ, mockText);
            // Clean slate for Question 2+
            setFinalTranscript('');
            setPartialTranscript('');
            finalTranscriptRef.current = '';
            setStatus('Question ready. Click Answer to respond.');
          }
        }, 1500);
      } else {
        setIsRecording(true);
        setStatus('Listening...');
        setFinalTranscript('');
        setPartialTranscript('');
        finalTranscriptRef.current = '';

        // Progressive preview simulation: sentence 1 interim -> finalized -> sentence 2
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setPartialTranscript('This is a preview transcription of your response.');
        }, 500);

        setTimeout(() => {
          if (!isMountedRef.current) return;
          const s1 = 'This is a preview transcription of your response.';
          finalTranscriptRef.current = s1;
          setFinalTranscript(s1);
          setPartialTranscript(
            'Variables declared with const are block-scoped and cannot be reassigned,'
          );
        }, 1800);

        setTimeout(() => {
          if (!isMountedRef.current) return;
          const fullText =
            'This is a preview transcription of your response. Variables declared with const are block-scoped and cannot be reassigned, whereas let allows reassignment while still maintaining block scope.';
          finalTranscriptRef.current = fullText;
          setFinalTranscript(fullText);
          setPartialTranscript('');
        }, 3400);
      }
      return;
    }

    if (!isConnected) return;
    setError('');

    if (isRecording) {
      cleanupAudio();
      wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }));
      setIsRecording(false);
      setIsEvaluating(true);
      const combinedText = (
        finalTranscriptRef.current +
        (partialTranscript ? (finalTranscriptRef.current ? ' ' : '') + partialTranscript : '')
      ).trim();
      wsRef.current?.send(
        JSON.stringify({
          type: 'submit_answer',
          final_text: combinedText,
        })
      );
      setStatus('Answer submitted. Evaluating...');
    } else {
      try {
        setFinalTranscript('');
        setPartialTranscript('');
        finalTranscriptRef.current = '';

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        wsRef.current.send(JSON.stringify({ type: 'start_recording' }));

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
          wsRef.current.send(pcm.buffer);
        };

        setIsRecording(true);
      } catch (err) {
        setError(`Microphone error: ${err.message}`);
      }
    }
  }, [
    preview,
    isRecording,
    isConnected,
    currentQuestion,
    setNumber,
    markCurrentAnswered,
    addQuestion,
    cleanupAudio,
    partialTranscript,
  ]);

  // ── Keyboard shortcut: Spacebar to Answer/Stop ───────────────────────────
  const micDisabled =
    !isConnected || isPlayingAudio || isEvaluating || isGenerating || !hasReceivedQ1Audio;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;
        if (showTranscriptModal || showEndModal || showBriefing || isSessionComplete) return;
        if (micDisabled && !isRecording) return;
        e.preventDefault();
        toggleMic();
      } else if (e.key === 'Escape') {
        if (showTranscriptModal) setShowTranscriptModal(false);
        if (showEndModal) setShowEndModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleMic,
    micDisabled,
    isRecording,
    showTranscriptModal,
    showEndModal,
    showBriefing,
    isSessionComplete,
  ]);

  // ── Sidebar derivations ────────────────────────────────────────────────────
  const answeredRows = questionsAsked.filter((q) => q.answered);

  const titleFor = (i) => {
    const asked = questionsAsked.find((q) => q.index === i);
    if (asked) return asked.text;
    const mocks = PREVIEW_QUESTIONS[setNumber];
    if (mocks && mocks[i - 1]) return mocks[i - 1];
    return null;
  };

  const finishSession = () => {
    if (mode === 'practice' && setNumber === 3) {
      navigate('/results?mode=practice');
    } else if (setNumber === 3) {
      navigate('/post-test', { state: { voice } });
    } else {
      navigate('/dashboard');
    }
  };

  const activeQuestionIndex = currentQuestion > 0 ? currentQuestion : 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ix-root">
      {/* ── Overlay gates (Briefing / Transition) ── */}
      <AnimatePresence>
        {showBriefing && setNumber === 2 && (
          <Set2TransitionOverlay key="start-2" onReady={startSession} role={userRole} />
        )}
        {showBriefing && setNumber === 3 && (
          <Set3TransitionOverlay key="start-3" onReady={startSession} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showBriefing && showNextTransition && setNumber === 1 && (
          <Set2TransitionOverlay key="next-2" onReady={goToNextSet} role={userRole} />
        )}
        {!showBriefing && showNextTransition && setNumber === 2 && (
          <Set3TransitionOverlay key="next-3" onReady={goToNextSet} />
        )}
      </AnimatePresence>

      {/* ── Interview Session Screen ── */}
      {!showBriefing && (
        <>
          {/* ── Top Header Bar ── */}
          <header className="ix-topbar">
            <div
              className="ix-topbar-left"
              onClick={() => setShowEndModal(true)}
              title="Return to Dashboard"
            >
              <MascotLogo size={28} />
              <span className="ix-topbar-brand-name">iTerview.</span>
            </div>

            <div className="ix-topbar-center">
              <span className="ix-topbar-progress">Question {activeQuestionIndex} of 5</span>
            </div>

            <div className="ix-topbar-right">
              <span className="ix-badge-difficulty">
                <span className="ix-pill-dot green" />
                {meta.difficulty ? meta.difficulty.toUpperCase() : 'EASY'}
              </span>

              <span className="ix-badge-set">{meta.label || 'Set 1: Personalized'}</span>

              <div className="ix-topbar-actions">
                <button type="button" className="ix-topbar-icon-btn" title="Toggle theme">
                  <Sun size={15} />
                </button>

                <button type="button" className="ix-topbar-icon-btn" title="Settings">
                  <Settings size={15} />
                </button>

                <button
                  type="button"
                  className="ix-topbar-end-btn"
                  onClick={() => setShowEndModal(true)}
                  title="End interview"
                >
                  <Phone size={13} />
                  <span>End</span>
                </button>
              </div>
            </div>
          </header>

          {/* ── Main Two-Column Content Grid ── */}
          <div className="ix-body">
            {/* Left Column (Stage + Question Card + Footer) */}
            <main className="ix-main-column">
              {/* ── Main Interview Stage Card (Top Card) ── */}
              <section className="ix-stage-card" aria-label="AI interviewer stage">
                {/* Header row: AI Interviewer pill, LIVE + Timer, PIP avatar */}
                <div className="ix-stage-header-row">
                  <div className="ix-stage-interviewer-pill">
                    <span className="ix-dot-blue" />
                    <span>AI Interviewer · Mrs. Tania Shahira</span>
                  </div>

                  <div className="ix-stage-live-timer-pill">
                    <span className="ix-dot-green" />
                    <span className="ix-live-text">LIVE</span>
                    <span className="ix-stage-time">{formatHMS(elapsedSec)}</span>
                  </div>

                  <div className="ix-pip-card">
                    <button type="button" className="ix-pip-menu-btn" title="Options">
                      <MoreHorizontal size={14} />
                    </button>
                    <div className="ix-pip-avatar-circle">{userInitials || 'ME'}</div>
                    <span className="ix-pip-user-label">You</span>
                  </div>
                </div>

                {/* Center AI Orb */}
                <div className="ix-stage-orb-wrap">
                  <AIOrb
                    isSpeaking={isPlayingAudio}
                    isListening={isRecording}
                    isComplete={isSessionComplete}
                  />
                </div>

                {/* Bottom Heading & Subtext */}
                <div className="ix-stage-bottom-text">
                  <h3 className="ix-stage-heading">
                    {isRecording
                      ? 'AI Interviewer is listening to your answer...'
                      : isPlayingAudio
                        ? 'AI Interviewer is speaking...'
                        : isEvaluating
                          ? 'Evaluating your response...'
                          : 'AI Interviewer is ready'}
                  </h3>
                  <p className="ix-stage-subtext">Speak clearly and take your time.</p>
                </div>
              </section>

              {/* ── Live Question Card (Bottom Card) ── */}
              <section className="ix-question-card" aria-label="Live question and answer">
                {/* Live Pill & Question Timer Row */}
                <div className="ix-card-top-row">
                  <span className="ix-badge-live">
                    <span className="ix-dot-green" />
                    LIVE
                  </span>
                  <span className="ix-q-timer-badge">
                    <Clock size={12} />
                    <span>{formatMS(elapsedSec)}</span>
                  </span>
                </div>

                {/* Question Inner Panel Box */}
                <div className="ix-question-box">
                  <div className="ix-question-meta-row">
                    <div className="ix-question-meta-left">
                      <span className="ix-q-pill">Q{activeQuestionIndex}</span>
                      <span className="ix-q-sublabel">CURRENT QUESTION</span>
                    </div>
                    <span className="ix-focus-tag">
                      {focusArea || (meta.category ? meta.category.toLowerCase() : 'clarity')}
                    </span>
                  </div>
                  <h2 className="ix-question-title">
                    {currentQuestionText ||
                      (preview || !isConnected
                        ? 'Can you explain the difference between using the let keyword and the const keyword when declaring a variable in JavaScript?'
                        : 'Loading question...')}
                  </h2>
                </div>

                {/* ── Stabilized Zero-CLS Response & Transcription Container ── */}
                <div className="ix-response-container">
                  {isRecording ? (
                    <div className="ix-response-state ix-state-recording">
                      <div className="ix-answer-meta-row">
                        <div className="ix-answer-status">
                          <span className="ix-rec-pulse-dot" />
                          <span className="ix-answer-lead">Listening &amp; Recording</span>
                          <span className="ix-rec-timer">{formatMS(elapsedSec)}</span>
                        </div>
                        <span className="ix-speech-hint">Speak clearly into your microphone</span>
                      </div>

                      <div className="ix-waveform-row">
                        <div className="ix-waveform" aria-hidden="true">
                          {[
                            4, 6, 12, 8, 16, 24, 14, 8, 18, 28, 36, 20, 10, 16, 26, 32, 18, 12, 22,
                            38, 44, 30, 16, 24, 34, 40, 22, 14, 20, 32, 36, 18, 10, 14, 28, 34, 16,
                            8, 12, 22, 30, 18, 8, 14, 20, 12, 6, 4,
                          ].map((height, i) => (
                            <span
                              key={i}
                              className="ix-waveform-bar"
                              style={{
                                height: `${Math.max(4, Math.min(22, height * (0.3 + (volume / 100) * 0.7)))}px`,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Live Multi-Line Unified Transcription Stream */}
                      <div className="ix-transcript-live-box" ref={liveTranscriptScrollRef}>
                        {finalTranscript || partialTranscript ? (
                          <p className="ix-transcript-live-stream">
                            {finalTranscript && (
                              <span className="ix-transcript-final">{finalTranscript}</span>
                            )}
                            {partialTranscript && (
                              <span className="ix-transcript-interim">
                                {finalTranscript ? ' ' : ''}
                                {partialTranscript}
                              </span>
                            )}
                            <span className="ix-transcript-caret" aria-hidden="true" />
                          </p>
                        ) : (
                          <p className="ix-transcript-listening-placeholder">
                            Listening... your spoken response will transcribe here in real time.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : isEvaluating ? (
                    <div className="ix-response-state ix-state-evaluating">
                      <div className="ix-evaluating-wrap">
                        <Activity size={18} className="ix-evaluating-spinner" />
                        <span className="ix-evaluating-text">
                          Analyzing your response and synthesizing feedback...
                        </span>
                      </div>
                    </div>
                  ) : finalTranscript ? (
                    <div className="ix-response-state ix-state-recorded">
                      <div className="ix-answer-meta-row">
                        <div className="ix-answer-status">
                          <span className="ix-dot-green" />
                          <span className="ix-answer-lead">Answer Recorded</span>
                          <span className="ix-word-count">
                            {finalTranscript.trim().split(/\s+/).filter(Boolean).length} words
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ix-btn-view-transcript"
                          onClick={() => {
                            setTranscriptModalData({
                              questionNumber: activeQuestionIndex,
                              questionText:
                                currentQuestionText || titleFor(activeQuestionIndex) || 'Question',
                              transcript: finalTranscript,
                            });
                            setShowTranscriptModal(true);
                          }}
                        >
                          <span>View full transcript</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                      <div className="ix-transcript-recorded-box">
                        <p className="ix-transcript-quote">"{finalTranscript}"</p>
                      </div>
                    </div>
                  ) : (
                    <div className="ix-response-state ix-state-idle">
                      <div className="ix-idle-prompt">
                        <div className="ix-idle-left">
                          <div className="ix-idle-mic-icon">
                            <Mic size={14} />
                          </div>
                          <span className="ix-idle-text">
                            {isPlayingAudio
                              ? 'AI Interviewer is speaking...'
                              : 'Ready for your answer. Click Answer or press Space to start.'}
                          </span>
                        </div>
                        <kbd className="ix-kbd-hint">Space</kbd>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Action Dock (Streamlined, Zero Decoys) ── */}
                <div className="ix-action-dock">
                  {isSessionComplete ? (
                    <button
                      className="ix-btn-primary-action"
                      id="btn-session-complete"
                      onClick={finishSession}
                    >
                      <Flag size={15} />
                      <span>
                        {setNumber === 3
                          ? mode === 'practice'
                            ? 'View Practice Summary'
                            : 'Start Graduation Challenge'
                          : 'Return to Dashboard'}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        id="btn-toggle-mic"
                        type="button"
                        className={`ix-dock-btn-main ${isRecording ? 'recording' : ''}`}
                        onClick={toggleMic}
                        disabled={micDisabled}
                        title={
                          isRecording ? 'Stop & Submit Answer (Space)' : 'Start Answering (Space)'
                        }
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={16} />}
                        <span>{isRecording ? 'Stop & Submit' : 'Answer'}</span>
                        <kbd className="ix-dock-kbd">Space</kbd>
                      </button>

                      <button
                        id="btn-session-end"
                        type="button"
                        className="ix-dock-btn-secondary"
                        onClick={() => setShowEndModal(true)}
                        title="End interview session"
                      >
                        <PhoneOff size={15} />
                        <span>End</span>
                      </button>
                    </>
                  )}
                </div>
              </section>
            </main>

            {/* ════ Right Sidebar ════ */}
            <InterviewSidebar
              activeQuestionIndex={activeQuestionIndex}
              questionsAsked={questionsAsked}
              currentQuestionText={currentQuestionText}
              titleFor={titleFor}
              candidateNotes={candidateNotes}
              onNotesChange={handleNotesChange}
              onClearNotes={() => {
                setCandidateNotes('');
                try {
                  localStorage.removeItem(`iterview_notes_set_${setNumber}`);
                } catch {
                  // ignore
                }
              }}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              coachTip={coachTip}
            />
          </div>

          {/* Centered Privacy Footer */}
          <footer className="ix-footer">
            <Shield size={13} className="ix-footer-shield" />
            <span>Your answers are saved automatically and kept private.</span>
          </footer>

          {/* ── Full Transcript Modal ── */}
          {showTranscriptModal && transcriptModalData && (
            <div
              className="ix-modal-backdrop"
              onClick={() => setShowTranscriptModal(false)}
              role="presentation"
            >
              <div
                className="ix-modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-transcript-title"
              >
                <div className="ix-modal-header">
                  <div className="ix-modal-title-wrap">
                    <span className="ix-modal-pill">
                      Q{transcriptModalData.questionNumber} Transcript
                    </span>
                    <h3 id="modal-transcript-title" className="ix-modal-title">
                      {transcriptModalData.questionText}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="ix-modal-close-btn"
                    onClick={() => setShowTranscriptModal(false)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="ix-modal-body">
                  <div className="ix-transcript-full-box">
                    <p className="ix-transcript-full-text">{transcriptModalData.transcript}</p>
                  </div>
                </div>
                <div className="ix-modal-footer">
                  <span className="ix-modal-wordcount">
                    {transcriptModalData.transcript.trim().split(/\s+/).filter(Boolean).length}{' '}
                    words recorded
                  </span>
                  <button
                    type="button"
                    className="ix-btn-modal-action"
                    onClick={() => setShowTranscriptModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── End Interview Confirmation Modal ── */}
          {showEndModal && (
            <div
              className="ix-modal-backdrop"
              onClick={() => setShowEndModal(false)}
              role="presentation"
            >
              <div
                className="ix-modal-card ix-modal-card-sm"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-end-title"
              >
                <div className="ix-modal-header">
                  <h3 id="modal-end-title" className="ix-modal-title">
                    End Interview Session?
                  </h3>
                  <button
                    type="button"
                    className="ix-modal-close-btn"
                    onClick={() => setShowEndModal(false)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="ix-modal-body">
                  <p className="ix-modal-desc">
                    Are you sure you want to exit? Any answered questions and coach feedback for
                    this session will be preserved.
                  </p>
                </div>
                <div className="ix-modal-footer">
                  <button
                    type="button"
                    className="ix-btn-secondary-flat"
                    onClick={() => setShowEndModal(false)}
                  >
                    Stay in Session
                  </button>
                  <button
                    type="button"
                    className="ix-btn-danger-action"
                    onClick={() => navigate('/dashboard')}
                  >
                    End & Return to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

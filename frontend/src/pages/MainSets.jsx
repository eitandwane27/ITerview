import { schoolSocketProtocols } from '../utils/authenticatedApi';
import { authenticatedFetch } from '../utils/authenticatedApi';
// frontend/src/pages/MainSets.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 / 2 / 3 Interview Arena — Soft Productivity SaaS design system
//
// Features:
// - Toggle Mic (Push-to-Talk & Spacebar shortcut) architecture
// - Connects to ws://localhost:5000/ws/set{n}
// - AI Coach Panel for 1-sentence tips
// - Stabilized Zero-CLS Live Transcript & Response Panel
// - Chat-style Transcript tab: AI question → candidate answer → AI reply
// - Full answer transcript modal for the recorded response
// - Living orb is audio-reactive to the AI's voice via a Web Audio AnalyserNode tap
// - SetBriefingOverlay shown on mount
// - Design: ITerview studio world (Session Ramp neutrals, cyan signal)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import useRoleCatalogue from '../hooks/useRoleCatalogue';
import usePracticeBookmarks from '../hooks/usePracticeBookmarks';
import { DEFAULT_INTERVIEWER_VOICE, interviewerVoices } from '../utils/interviewerVoices';
import { formatRoleLabel } from '../utils/roleCatalogue';
import { AnimatePresence } from 'framer-motion';
import * as Popover from '@radix-ui/react-popover';
import Set2TransitionOverlay from '../components/Set2TransitionOverlay';
import Set3TransitionOverlay from '../components/Set3TransitionOverlay';
import InterviewSidebar from '../components/InterviewSidebar';
// Living orb lives in its own component now; re-exported for PreTest compat.
import { AIOrb } from '../components/AIOrb';
import { useTtsAudioLevel } from '../hooks/useTtsAudioLevel';
import logoSrc from '../assets/logo';
import {
  Mic,
  MicOff,
  Keyboard,
  Square,
  Pause,
  LogOut,
  Clock,
  Flag,
  Sun,
  CircleHelp,
  Shield,
  Activity,
  ArrowRight,
  Bookmark,
  CircleCheck,
  Pencil,
  X,
} from 'lucide-react';
import './MainSets.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const WS_BASE = BACKEND_URL.replace(/^http/, 'ws');
const MAX_TYPED_ANSWER_LENGTH = 12000;

// ── Set metadata ───────────────────────────────────────────────────────────
const SET_META = {
  1: { label: 'Set 1: Personalized', category: 'Personalized' },
  2: { label: 'Set 2: Technical Mastery', category: 'Technical' },
  3: { label: 'Set 3: Behavioral STAR', category: 'Behavioral' },
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

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const DIFFICULTY_RANK = { easy: 1, medium: 2, hard: 3 };

function normalizeDifficulty(value) {
  const normalized = String(value || '').toLowerCase();
  return VALID_DIFFICULTIES.has(normalized) ? normalized : null;
}

function getEffectiveUserDifficulty(user) {
  const selected = normalizeDifficulty(user?.difficulty) || 'easy';
  const unlocked = normalizeDifficulty(user?.unlockedDifficulty) || 'easy';
  return DIFFICULTY_RANK[selected] <= DIFFICULTY_RANK[unlocked] ? selected : unlocked;
}

function getFirstSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim() || text;
}

function getLatestFeedback(questions) {
  for (let index = questions.length - 1; index >= 0; index -= 1) {
    const question = questions[index];
    if (question.answered && (question.reply || question.tip)) {
      return {
        whatYouDidWell: getFirstSentence(question.reply),
        tryImproving: question.tip || '',
      };
    }
  }
  return null;
}

const STAGE_STATE_COPY = {
  ready: {
    label: 'AI interviewer is ready',
    title: 'Ready when you are',
    detail: 'Take a breath. You’ve got this.',
  },
  speaking: {
    label: 'AI interviewer is speaking',
    title: 'Your interviewer is speaking',
    detail: 'Listen for the heart of the question.',
  },
  listening: {
    label: 'AI interviewer is listening',
    title: 'Listening to you',
    detail: 'Take your time. I’m right here.',
  },
  evaluating: {
    label: 'AI interviewer is evaluating your response',
    title: 'Thinking through your answer',
    detail: 'Finding the feedback that will help most.',
  },
  responding: {
    label: 'AI interviewer is preparing spoken feedback',
    title: 'Your feedback is ready',
    detail: 'Preparing the spoken response.',
  },
  booting: {
    label: 'AI interviewer is preparing your questions',
    title: 'Preparing your interview',
    detail: 'Personalizing the next question for you.',
  },
  complete: {
    label: 'Interview session complete',
    title: 'You made it through',
    detail: 'Your interview is complete. Nice work.',
  },
  offline: {
    label: 'AI interviewer is connecting',
    title: 'Connecting your interviewer',
    detail: 'Hold on. We’ll continue in a moment.',
  },
  error: {
    label: 'AI interviewer needs attention',
    title: 'Something needs attention',
    detail: 'Check the message below, then try again.',
  },
};

function resolveStageState({
  isSpeaking,
  isListening,
  isComplete,
  isEvaluating,
  isPreparingFeedbackAudio,
  isBooting,
  isOffline,
  hasError,
}) {
  if (hasError) return 'error';
  if (isListening) return 'listening';
  if (isSpeaking) return 'speaking';
  if (isPreparingFeedbackAudio) return 'responding';
  if (isComplete) return 'complete';
  if (isEvaluating) return 'evaluating';
  if (isBooting) return 'booting';
  if (isOffline) return 'offline';
  return 'ready';
}

function StageAtmosphere({ isSpeaking = false, volume = 0 }) {
  const edgeRef = useRef(null);
  const [isVisible, setIsVisible] = useState(() => !document.hidden);

  useEffect(() => {
    let isInView = true;
    const updateVisibility = () => setIsVisible(isInView && !document.hidden);
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
          isInView = entry.isIntersecting;
          updateVisibility();
        })
      : null;

    if (edgeRef.current) observer?.observe(edgeRef.current);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  const isActive = isSpeaking && isVisible;
  const speechLevel = isActive && Number.isFinite(volume)
    ? Math.max(0, Math.min(1, volume / 100))
    : 0;

  return (
    <>
      <div className="ix-stage-atmosphere" aria-hidden="true" />
      <div
        ref={edgeRef}
        className="ix-stage-speaking-edge"
        data-active={isActive ? 'true' : 'false'}
        style={{ '--ix-stage-edge-level': speechLevel }}
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Maps the arena's single state enum onto the shared WebGL companion API.
 * Keeping this adapter local avoids duplicating the interview state resolver.
 */
function InterviewBubbleBot({ state, volume = 0 }) {
  return (
    <AIOrb
      isSpeaking={state === 'speaking'}
      isListening={state === 'listening'}
      isComplete={state === 'complete'}
      isEvaluating={state === 'evaluating' || state === 'responding'}
      isBooting={state === 'booting'}
      isOffline={state === 'offline'}
      hasError={state === 'error'}
      volume={volume}
      expressiveMotion
      ariaLabel={STAGE_STATE_COPY[state]?.label}
    />
  );
}

// ── Isolated Mascot Component ────────────────────────────────────────────────
// AIOrb is re-exported here for compatibility with older interview imports.

export { AIOrb };

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

export default function MainSets() {
  const location = useLocation();

  // Query-string navigation keeps the route component mounted. Key the actual
  // session so moving between sets gets a clean set-scoped state lifecycle.
  return <MainSetsSession key={`${location.pathname}${location.search}`} />;
}

function MainSetsSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice;
  const query = new URLSearchParams(location.search);
  const setNumber = parseInt(query.get('set')) || 1;
  const mode = query.get('mode') || 'diagnostic';
  const savedQuestionId = query.get('questionId') || '';
  const isSavedPractice = Boolean(savedQuestionId);
  const isDrill = mode === 'drill' || isSavedPractice;
  const practiceReturn = mode === 'drill' && !isSavedPractice
    ? location.state?.practiceReturn
    : null;
  const practiceReturnLabel = {
    '/mic-test': 'Return to microphone setup',
    '/pre-test': 'Return to pre-test',
    '/post-test': 'Return to post-test',
  }[practiceReturn];
  const focusArea = query.get('focusArea') || '';
  const isResume = query.get('resume') === 'true';
  const launchId = query.get('launch') || '';
  const isAutostart = query.get('autostart') === 'true';
  const preview = query.get('preview') === 'true' || location.pathname.includes('/dev/');

  const meta = SET_META[setNumber] || SET_META[1];

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showBriefing, setShowBriefing] = useState(setNumber !== 1 && !isResume && !isAutostart);
  const [_status, setStatus] = useState('Waiting to start...');
  const [error, setError] = useState('');
  const [canRetryEvaluation, setCanRetryEvaluation] = useState(false);
  const submittedAnswerRef = useRef('');
  const [isConnected, setIsConnected] = useState(false);
  const [sessionVoice, setSessionVoice] = useState(null);
  const interviewer = interviewerVoices.find(option =>
    option.value === (preview ? voice || DEFAULT_INTERVIEWER_VOICE : sessionVoice)
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(() => query.get('input') === 'typing');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [micUnavailable, setMicUnavailable] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isPreparingFeedbackAudio, setIsPreparingFeedbackAudio] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showNextTransition, setShowNextTransition] = useState(false);
  const { roles } = useRoleCatalogue();
  const [userRole, setUserRole] = useState('');
  const [sessionRoleLabel, setSessionRoleLabel] = useState('');
  const [savedSessionMode, setSavedSessionMode] = useState(null);
  const [savedSessionFocus, setSavedSessionFocus] = useState('');
  const effectiveMode = savedSessionMode || mode;
  const effectiveFocus = savedSessionFocus || focusArea;
  const userRoleLabel = sessionRoleLabel || formatRoleLabel(userRole, roles);
  const [sessionDifficulty, setSessionDifficulty] = useState(() =>
    preview ? normalizeDifficulty(query.get('difficulty')) || 'easy' : null
  );
  const [totalQuestions, setTotalQuestions] = useState(isSavedPractice ? 1 : isDrill ? 3 : 5);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [hasReceivedQ1Audio, setHasReceivedQ1Audio] = useState(false);
  const [_slowWait, setSlowWait] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isReviewingAnswer, setIsReviewingAnswer] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
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
  const [showSessionGuide, setShowSessionGuide] = useState(false);
  const endDialogRef = useRef(null);

  useEffect(() => {
    if (!showEndModal) return undefined;
    const previousFocus = document.activeElement;
    const dialog = endDialogRef.current;
    dialog?.querySelector('[data-pause-cancel]')?.focus();
    const keepFocusInDialog = (event) => {
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener('keydown', keepFocusInDialog);
    return () => {
      dialog?.removeEventListener('keydown', keepFocusInDialog);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [showEndModal]);

  // ── Session HUD state (stage clock, sidebar question list, tabs, PIP) ─────
  const [elapsedSec, setElapsedSec] = useState(0);
  const [questionsAsked, setQuestionsAsked] = useState([]);
  const [activeTab, setActiveTab] = useState('questions');
  const [userInitials, setUserInitials] = useState('ME');

  const { savedQuestionIndexes, toggle: togglePracticeSave, undo: undoPracticeSave,
    toast: practiceToast, dismiss: dismissPracticeToast, error: bookmarkError, busy: bookmarkBusy } = usePracticeBookmarks({
    preview, disabled: isDrill, setNumber, questions: questionsAsked, role: userRole, difficulty: sessionDifficulty,
  });

  // Stage clock ticks only while a session is live.
  useEffect(() => {
    if (!isConnected || isSessionComplete) return undefined;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isConnected, isSessionComplete]);

  // ── Sidebar question list & transcript thread helpers ──────────────────────
  const addQuestion = useCallback((index, text) => {
    setQuestionsAsked((prev) =>
      prev.some((q) => q.index === index)
        ? prev.map((q) => (q.index === index ? { ...q, text } : q))
        : [...prev, { index, text, answered: false, answer: '', reply: '', tip: '' }]
    );
  }, []);

  // Flags the most recent unanswered question as answered and attaches the AI's
  // spoken reply (interviewer_reply) that drives the transcript thread.
  const markCurrentAnswered = useCallback((answerText, replyText, tipText) => {
    setQuestionsAsked((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (!next[i].answered) {
          next[i] = {
            ...next[i],
            answered: true,
            answer: answerText || '',
            reply: replyText || '',
            tip: tipText || '',
          };
          break;
        }
      }
      return next;
    });
  }, []);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const micAttemptRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const interimTextRef = useRef('');
  const acceptingTranscriptsRef = useRef(false);
  const previewRecordingRef = useRef(0);
  const submissionPendingRef = useRef(false);
  const transcriptEditorRef = useRef(null);
  const typedAnswerRef = useRef(null);
  const editTranscriptButtonRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const isMountedRef = useRef(true);
  const isSessionCompleteRef = useRef(false);
  const processQueueRef = useRef(null);
  const liveTranscriptScrollRef = useRef(null);

  useEffect(() => {
    if (isEditingTranscript) {
      const editor = transcriptEditorRef.current;
      editor?.focus();
      editor?.setSelectionRange(editor.value.length, editor.value.length);
    }
  }, [isEditingTranscript]);

  useEffect(() => {
    if (isTyping && hasReceivedQ1Audio && !isEvaluating) {
      typedAnswerRef.current?.focus({ preventScroll: true });
    }
  }, [isTyping, isEvaluating, currentQuestion, hasReceivedQ1Audio]);

  const finishTranscriptEdit = (save) => {
    if (save) {
      const text = transcriptDraft.trim();
      if (!text) return;
      finalTranscriptRef.current = text;
      setFinalTranscript(text);
    }
    setIsEditingTranscript(false);
    requestAnimationFrame(() => editTranscriptButtonRef.current?.focus());
  };

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

  // ── AI voice level (the "AnalyserNode" that makes the orb alive) ──────────
  // Taps each queued TTS clip into a shared Web Audio analyser and publishes a
  // smoothed 0–100 speech level, so the orb pulses with the interviewer's
  // actual voice instead of holding a static speaking pose.
  const {
    level: ttsAudioLevel,
    attach: attachTtsAudioLevel,
    detach: detachTtsAudioLevel,
  } = useTtsAudioLevel();

  // ── Playback Functions ─────────────────────────────────────────────────────

  const playBase64 = useCallback(
    (base64Data, onEnded, onError) => {
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

            // Tap the clip into the shared analyser so the orb rides the AI's
            // voice; the element's output now flows source → analyser → speakers.
            attachTtsAudioLevel(audio);

            const cleanupThisAudio = () => {
              detachTtsAudioLevel();
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
    },
    [attachTtsAudioLevel, detachTtsAudioLevel]
  );

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
        if (isSessionCompleteRef.current && !isDrill && setNumber < 3) {
          setShowNextTransition(true);
        }
      }
      processQueueRef.current?.();
    };

    if (item.type === 'base64') {
      playBase64(item.data, onEnded, onEnded);
    }
  }, [isDrill, playBase64, setNumber]);

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
    micAttemptRef.current = null;
    // Hard-stop the voice meter so the orb settles instantly on pause/unmount.
    detachTtsAudioLevel({ immediate: true });

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
  }, [detachTtsAudioLevel]);

  // ── Fetch user role on mount ───────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      authenticatedFetch(`/api/users/${user.uid}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.role) {
            // Session metadata is authoritative when a saved set is resumed.
            setUserRole(current => current || data.user.role);
          }
          if (data.user) {
            setSessionDifficulty(current => current || getEffectiveUserDifficulty(data.user));
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
  const socketAttemptRef = useRef(0);
  useEffect(() => () => { socketAttemptRef.current += 1; }, []);
  const startSession = useCallback(async () => {
    setShowBriefing(false);

    if (!isResume) {
      // Fresh session (preview or real) → start the transcript thread clean;
      // preview startSession synchronously re-adds Q1 right after this.
      setQuestionsAsked([]);
    }

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

    if (!isResume && (setNumber === 1 || setNumber === 2 || isSavedPractice)) {
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
    const focusParam = focusArea ? `&focusArea=${encodeURIComponent(focusArea)}` : '';
    const voiceParam = voice ? `&voice=${encodeURIComponent(voice)}` : '';
    const attempt = ++socketAttemptRef.current;
    let protocols;
    try { protocols = await schoolSocketProtocols(); }
    catch (error) { setError(error.message); setIsGeneratingQuestions(false); return; }
    if (attempt !== socketAttemptRef.current) return;
    const ws = new WebSocket(
      isSavedPractice
        ? `${WS_BASE}/ws/practice-again?questionId=${encodeURIComponent(savedQuestionId)}${voiceParam}`
        : `${WS_BASE}/ws/set${setNumber}?uid=${encodeURIComponent(uid)}&mode=${encodeURIComponent(mode)}${focusParam}&launch=${encodeURIComponent(launchId)}${voiceParam}`, protocols
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
        case 'session_meta':
          setSessionVoice(msg.voice);
          if (msg.role) setUserRole(msg.role);
          if (msg.roleLabel) setSessionRoleLabel(msg.roleLabel);
          if (['practice', 'diagnostic', 'drill'].includes(msg.mode)) setSavedSessionMode(msg.mode);
          if (['focus_clarity', 'focus_correctness', 'focus_completeness'].includes(msg.weakness)) {
            setSavedSessionFocus(msg.weakness.replace('focus_', ''));
          }
          if (normalizeDifficulty(msg.difficulty)) {
            setSessionDifficulty(normalizeDifficulty(msg.difficulty));
          }
          if (Number.isInteger(msg.totalQuestions) && msg.totalQuestions > 0) {
            setTotalQuestions(msg.totalQuestions);
          }
          break;
        case 'generation_progress':
          if (msg.role) setUserRole(msg.role);
          if (msg.message) setStatus(msg.message);
          break;
        case 'status':
          setStatus(msg.message);
          break;
        case 'tts_audio':
          setHasReceivedQ1Audio(true);
          enqueueBase64Audio(msg.data);
          break;
        case 'audio_unavailable':
          setHasReceivedQ1Audio(true);
          setStatus(msg.message);
          break;
        case 'question_text':
          acceptingTranscriptsRef.current = false;
          submissionPendingRef.current = false;
          setIsReviewingAnswer(false);
          setIsEditingTranscript(false);
          setTranscriptDraft('');
          setTypedAnswer('');
          setCanRetryEvaluation(false);
          setError('');
          addQuestion(msg.index, msg.text);
          setCurrentQuestionText(msg.text);
          setCurrentQuestion(msg.index);
          setFinalTranscript('');
          setPartialTranscript('');
          interimTextRef.current = '';
          finalTranscriptRef.current = '';
          setIsEvaluating(false);
          break;
        case 'coach_tip':
          if (isSavedPractice) setIsEvaluating(false);
          setCoachTip(msg.tip);
          markCurrentAnswered(finalTranscriptRef.current, msg.interviewer_reply, msg.tip);
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
          // A provider can deliver buffered results after stop. Keep the
          // review snapshot (and any corrections) stable until submission.
          if (!acceptingTranscriptsRef.current) break;
          if (msg.isFinal) {
            if (msg.text) {
              finalTranscriptRef.current = finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${msg.text}`
                : msg.text;
            }
            setFinalTranscript(finalTranscriptRef.current);
            interimTextRef.current = '';
            setPartialTranscript('');
          } else {
            interimTextRef.current = msg.text || '';
            setPartialTranscript(interimTextRef.current);
          }
          break;
        case 'error':
          acceptingTranscriptsRef.current = false;
          submissionPendingRef.current = false;
          setError(msg.message);
          setIsGeneratingQuestions(false);
          cleanupAudio();
          setIsRecording(false);
          setCanRetryEvaluation(msg.code === 'EVALUATION_FAILED');
          setIsEvaluating(false);
          setIsPreparingFeedbackAudio(false);
          break;
        case 'session_complete':
          setIsPreparingFeedbackAudio(msg.audioPending === true);
          setIsSessionComplete(true);
          isSessionCompleteRef.current = true;
          setStatus(isDrill ? 'Drill complete!' : `Set ${setNumber} Complete!`);
          setIsEvaluating(false);
          if (!isDrill && setNumber < 3) {
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
              setShowNextTransition(true);
            }
          }
          break;
        case 'feedback_audio_complete':
          setIsPreparingFeedbackAudio(false);
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
      acceptingTranscriptsRef.current = false;
      submissionPendingRef.current = false;
      setIsConnected(false);
      cleanupAudio();
      setIsRecording(false);
      setIsEvaluating(false);
      setIsPreparingFeedbackAudio(false);
      setIsGeneratingQuestions(false);
      if (!isSessionCompleteRef.current) {
        setError(current => current || 'Your interview connection closed. Return to the dashboard and try again.');
      }
    };
  }, [
    preview,
    setNumber,
    voice,
    focusArea,
    mode,
    isDrill,
    isSavedPractice,
    savedQuestionId,
    isResume,
    launchId,
    enqueueBase64Audio,
    addQuestion,
    markCurrentAnswered,
    cleanupAudio,
  ]);

  const goToNextSet = () => {
    setShowNextTransition(false);
    const nextSet = setNumber + 1;
    const modeParam = effectiveMode === 'practice' ? '&mode=practice' : '';
    const focusParam = effectiveFocus ? `&focusArea=${encodeURIComponent(effectiveFocus)}` : '';
    navigate(`/interview?set=${nextSet}${modeParam}${focusParam}&autostart=true`, {
      state: { voice },
    });
  };

  // ── Reset & Initialize on route change ────────────────────────────────────
  useEffect(() => {
    isSessionCompleteRef.current = false;
    let startTimer = null;
    if (setNumber === 1 || isResume || isAutostart) {
      // Defer the connection by one task. In React Strict Mode the first
      // development-only effect pass is cleaned up before this runs, preventing
      // two sockets from racing to own the same MongoDB session document.
      startTimer = window.setTimeout(startSession, 0);
    }

    return () => {
      if (startTimer !== null) window.clearTimeout(startTimer);
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
    let smoothedVolume = 0;
    let lastPublishedAt = 0;

    const tick = (now) => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      const nextVolume = Math.min(100, (avg / 128) * 100);
      smoothedVolume = smoothedVolume * 0.68 + nextVolume * 0.32;

      // Audio analysis can stay frame-synced, but publishing at 20fps avoids
      // rerendering the full interview layout on every display frame.
      if (now - lastPublishedAt >= 50) {
        const roundedVolume = Math.round(smoothedVolume);
        setVolume((previousVolume) =>
          Math.abs(previousVolume - roundedVolume) >= 2 ? roundedVolume : previousVolume
        );
        lastPublishedAt = now;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  // Review is local until the user explicitly submits the confirmed text.
  const submitAnswer = useCallback(() => {
    const text = (isTyping ? typedAnswer : finalTranscriptRef.current).trim();
    if ((!isTyping && (!isReviewingAnswer || isEditingTranscript)) || !text ||
      (isTyping && text.length > MAX_TYPED_ANSWER_LENGTH) || isEvaluating ||
      !isConnected || submissionPendingRef.current) return;
    if (!preview && wsRef.current?.readyState !== WebSocket.OPEN) return;
    submissionPendingRef.current = true;
    submittedAnswerRef.current = text;
    finalTranscriptRef.current = text;
    setFinalTranscript(text);
    setIsReviewingAnswer(false);
    setError('');
    setCanRetryEvaluation(false);
    setIsEvaluating(true);
    setStatus('Answer submitted. Evaluating...');
    if (preview) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        submissionPendingRef.current = false;
        const previewTip =
          setNumber === 1
            ? 'Great detail on the database structure. Try to explain why you chose SQL over NoSQL.'
            : setNumber === 2
              ? 'Good explanation of database types. Focus on scaling trade-offs next time.'
              : 'Excellent use of the STAR method. You clearly outlined the situation and task.';
        const previewReply =
          setNumber === 1
            ? 'That is a solid answer. Let us move on to how you handled testing in that project.'
            : setNumber === 2
              ? 'Good explanation of database types. Focus on scaling trade-offs next time.'
              : 'Excellent use of the STAR method. You clearly outlined the situation and task.';

        setIsEvaluating(false);
        setCoachTip(previewTip);

        if (setNumber === 2) {
          setScores({ problem_solving: 8, accuracy: 9, depth: 7 });
        } else if (setNumber === 3) {
          setScores({ situation: 8, action: 7, result: 9 });
        }

        markCurrentAnswered(text, previewReply, previewTip);

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
          setTypedAnswer('');
          finalTranscriptRef.current = '';
          setStatus('Question ready. Click Answer to respond.');
        }
      }, 1500);
    } else {
      wsRef.current.send(JSON.stringify({ type: 'submit_answer', final_text: text }));
    }
  }, [isTyping, typedAnswer, isReviewingAnswer, isEditingTranscript, isEvaluating, isConnected, preview,
    setNumber, currentQuestion, markCurrentAnswered, addQuestion]);

  // ── Mic controls ───────────────────────────────────────────────────────────
  const stopCapture = useCallback(() => {
    previewRecordingRef.current += 1;
    acceptingTranscriptsRef.current = false;
    cleanupAudio();
    if (!preview && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_recording' }));
    }
    setIsRecording(false);
  }, [cleanupAudio, preview]);

  const startTyping = () => {
    micAttemptRef.current = null;
    if (isRecording) stopCapture();
    const captured = isEditingTranscript ? transcriptDraft : [
      finalTranscriptRef.current, isRecording ? partialTranscript : '',
    ].filter(Boolean).join(' ');
    if (isRecording || isReviewingAnswer || canRetryEvaluation) {
      setTypedAnswer(draft => [draft, captured].filter(Boolean).join('\n'));
    }
    setIsReviewingAnswer(false);
    setIsEditingTranscript(false);
    setIsTyping(true);
  };

  const toggleMic = useCallback(async () => {
    if (!isConnected || isEvaluating || isEditingTranscript || submissionPendingRef.current || micAttemptRef.current) return;
    if (!preview && wsRef.current?.readyState !== WebSocket.OPEN) return;
    setError('');
    setCanRetryEvaluation(false);

    if (isRecording) {
      stopCapture();
      const combinedText = (
        finalTranscriptRef.current +
        (partialTranscript ? (finalTranscriptRef.current ? ' ' : '') + partialTranscript : '')
      ).trim();
      finalTranscriptRef.current = combinedText;
      setFinalTranscript(combinedText);
      setPartialTranscript('');
      setIsReviewingAnswer(true);
      setStatus('Review your transcript, then submit your answer.');
      return;
    }

    const beginCapture = () => {
      setIsTyping(false);
      setMicUnavailable(false);
      setIsReviewingAnswer(false);
      setTranscriptDraft('');
      setFinalTranscript('');
      setPartialTranscript('');
      finalTranscriptRef.current = '';
      interimTextRef.current = '';
      acceptingTranscriptsRef.current = true;
      setIsRecording(true);
      setStatus('Listening...');
    };

    if (preview) {
      const recordingId = ++previewRecordingRef.current;
      beginCapture();

      // Progressive preview simulation: sentence 1 interim -> finalized -> sentence 2
      setTimeout(() => {
        if (!isMountedRef.current || recordingId !== previewRecordingRef.current || !acceptingTranscriptsRef.current) return;
        setPartialTranscript('This is a preview transcription of your response.');
      }, 500);

      setTimeout(() => {
        if (!isMountedRef.current || recordingId !== previewRecordingRef.current || !acceptingTranscriptsRef.current) return;
        const s1 = 'This is a preview transcription of your response.';
        finalTranscriptRef.current = s1;
        setFinalTranscript(s1);
        setPartialTranscript(
          'Variables declared with const are block-scoped and cannot be reassigned,'
        );
      }, 1800);

      setTimeout(() => {
        if (!isMountedRef.current || recordingId !== previewRecordingRef.current || !acceptingTranscriptsRef.current) return;
        const fullText =
          'This is a preview transcription of your response. Variables declared with const are block-scoped and cannot be reassigned, whereas let allows reassignment while still maintaining block scope.';
        finalTranscriptRef.current = fullText;
        setFinalTranscript(fullText);
        setPartialTranscript('');
      }, 3400);
      return;
    }
    const ws = wsRef.current;
    const attempt = Symbol();
    micAttemptRef.current = attempt;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (micAttemptRef.current !== attempt || ws.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

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
        if (!acceptingTranscriptsRef.current || ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(pcm.buffer);
      };

      const track = stream.getAudioTracks()[0];
      if (track?.readyState !== 'live') throw new Error('Microphone disconnected');
      track.addEventListener('ended', () => {
        if (streamRef.current !== stream) return;
        const captured = [finalTranscriptRef.current, interimTextRef.current].filter(Boolean).join(' ');
        stopCapture();
        setTypedAnswer(draft => [draft, captured].filter(Boolean).join('\n'));
        setFinalTranscript('');
        setPartialTranscript('');
        setMicUnavailable(true);
        setIsTyping(true);
      }, { once: true });
      ws.send(JSON.stringify({ type: 'start_recording' }));
      beginCapture();
    } catch {
      if (micAttemptRef.current !== attempt) return;
      cleanupAudio();
      setMicUnavailable(true);
      if (isReviewingAnswer) {
        setTypedAnswer(draft => [draft, finalTranscriptRef.current].filter(Boolean).join('\n'));
        setIsReviewingAnswer(false);
      }
      setIsTyping(true);
    } finally {
      if (micAttemptRef.current === attempt) micAttemptRef.current = null;
    }
  }, [
    preview,
    isRecording,
    isConnected,
    isEvaluating,
    isEditingTranscript,
    isReviewingAnswer,
    cleanupAudio,
    partialTranscript,
    stopCapture,
  ]);

  // ── Keyboard shortcut: Spacebar to Answer/Stop ───────────────────────────
  const micDisabled =
    !isConnected || isPlayingAudio || isEvaluating || isGenerating || !hasReceivedQ1Audio;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (e.repeat || isReviewingAnswer || isTyping) return;
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (['input', 'textarea', 'button', 'a', 'select'].includes(activeTag)
          || document.activeElement?.isContentEditable) return;
        if (showTranscriptModal || showEndModal || showSessionGuide || showBriefing || isSessionComplete) return;
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
    isReviewingAnswer,
    isTyping,
    showTranscriptModal,
    showEndModal,
    showSessionGuide,
    showBriefing,
    isSessionComplete,
  ]);

  // ── Sidebar derivations ────────────────────────────────────────────────────
  const titleFor = (i) => {
    const asked = questionsAsked.find((q) => q.index === i);
    if (asked) return asked.text;
    const mocks = PREVIEW_QUESTIONS[setNumber];
    if (mocks && mocks[i - 1]) return mocks[i - 1];
    return null;
  };

  const returnFromDrill = () => {
    if (practiceReturnLabel) {
      navigate(practiceReturn, { replace: true, state: { voice, assessmentPaused: practiceReturn !== '/mic-test' } });
    } else {
      navigate(isSavedPractice ? '/dashboard?tab=practice-again' : '/dashboard', { replace: true });
    }
  };

  const handlePauseAndReturn = () => {
    if (isRecording || isEvaluating) return;
    setShowEndModal(false);
    cleanupAudio();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    returnFromDrill();
  };

  const finishSession = () => {
    if (isDrill) {
      returnFromDrill();
    } else if (effectiveMode === 'practice' && setNumber === 3) {
      navigate('/results?mode=practice');
    } else if (setNumber === 3) {
      navigate('/post-test', { state: { voice } });
    } else {
      navigate('/dashboard');
    }
  };

  const retryEvaluation = () => {
    if (!isConnected || isEvaluating || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setError('');
    setCanRetryEvaluation(false);
    setIsEvaluating(true);
    setStatus('Retrying evaluation...');
    wsRef.current.send(JSON.stringify({ type: 'submit_answer', final_text: submittedAnswerRef.current }));
  };

  const activeQuestionIndex = currentQuestion > 0 ? currentQuestion : 1;
  const stageState = resolveStageState({
    isSpeaking: isPlayingAudio,
    isListening: isRecording,
    isComplete: isSessionComplete,
    isEvaluating,
    isPreparingFeedbackAudio,
    isBooting: isGenerating,
    isOffline: !preview && !isConnected,
    hasError: Boolean(error),
  });
  const stageCopy = stageState === 'ready' && isReviewingAnswer
    ? { label: 'Your transcript is ready to review', title: 'Check your transcript',
      detail: 'Correct any misheard words, then submit your answer.' }
    : STAGE_STATE_COPY[stageState];

  // ── Transcript tab thread (AI question → candidate answer → AI reply) ──────
  // Derived from the same questionsAsked log that drives the question list, so
  // the chat can never drift from the real session state.
  const chatTurns = useMemo(() => {
    const turns = [];
    questionsAsked.forEach((q) => {
      turns.push({
        id: `q${q.index}-question`,
        role: 'ai',
        label: `AI Interviewer · Q${q.index}`,
        text: q.text || '',
      });
      if (q.answered) {
        if (q.answer) {
          turns.push({
            id: `q${q.index}-answer`,
            role: 'candidate',
            label: 'You',
            text: q.answer,
          });
        }
        if (q.reply) {
          turns.push({
            id: `q${q.index}-reply`,
            role: 'ai',
            label: 'AI Interviewer · reply',
            text: q.reply,
          });
        }
      }
    });

    // Live tail: the in-flight candidate turn, finalised into the log once the
    // coach feedback lands for this question (see markCurrentAnswered).
    const currentAnswered = questionsAsked.some(
      (q) => q.index === activeQuestionIndex && q.answered
    );
    if (!isSessionComplete && !currentAnswered) {
      const liveText = (
        finalTranscript +
        (partialTranscript ? (finalTranscript ? ' ' : '') + partialTranscript : '')
      ).trim();
      if (isRecording || isEvaluating || liveText) {
        turns.push({
          id: `q${activeQuestionIndex}-live`,
          role: 'candidate',
          label: 'You',
          text: liveText,
          live: isRecording ? 'recording' : isEvaluating ? 'evaluating' : null,
        });
      }
    }
    return turns;
  }, [
    questionsAsked,
    activeQuestionIndex,
    isSessionComplete,
    isRecording,
    isEvaluating,
    finalTranscript,
    partialTranscript,
  ]);

  const latestFeedback = getLatestFeedback(questionsAsked);
  const answeredCount = questionsAsked.filter((question) => question.answered).length;
  const sessionLabel = isSavedPractice
    ? 'Practice Again'
    : isDrill
      ? `${effectiveFocus ? effectiveFocus.charAt(0).toUpperCase() + effectiveFocus.slice(1) : '3C'} Drill`
      : meta.label;
  const leaveLabel = isDrill ? 'Leave drill' : 'Pause';
  const LeaveIcon = isDrill ? LogOut : Pause;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ix-root">
      {/* ── Overlay gates (Briefing / Transition) ── */}
      <AnimatePresence>
        {showBriefing && setNumber === 2 && (
          <Set2TransitionOverlay key="start-2" onReady={startSession} role={userRole} roleLabel={userRoleLabel} />
        )}
        {showBriefing && setNumber === 3 && (
          <Set3TransitionOverlay key="start-3" onReady={startSession} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showBriefing && showNextTransition && setNumber === 1 && (
          <Set2TransitionOverlay key="next-2" onReady={goToNextSet} role={userRole} roleLabel={userRoleLabel} />
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
            <div className="ix-topbar-inner">
              <button
                type="button"
                className="ix-topbar-brand"
                onClick={() => setShowEndModal(true)}
                aria-label="ITerview — return to dashboard"
                title="Return to dashboard"
              >
                <img className="ix-topbar-logo" src={logoSrc} alt="" width="44" height="32" />
                <span className="ix-topbar-brand-name">ITerview</span>
              </button>

              <div className="ix-topbar-session">
                <h1 className="ix-topbar-session-title">{sessionLabel}</h1>
                <div className="ix-topbar-session-meta">
                  <span className="ix-topbar-progress">
                    {isSessionComplete ? 'Session complete' : `Question ${activeQuestionIndex} of ${totalQuestions}`}
                  </span>
                  <div
                    className="ix-topbar-progress-track"
                    role="progressbar"
                    aria-label="Answers completed"
                    aria-valuemin={0}
                    aria-valuemax={totalQuestions}
                    aria-valuenow={answeredCount}
                  >
                    {Array.from({ length: totalQuestions }, (_, index) => (
                      <span key={index} data-state={
                        questionsAsked.some((question) => question.index === index + 1 && question.answered)
                          ? 'done'
                          : !isSessionComplete && index + 1 === activeQuestionIndex ? 'current' : 'upcoming'
                      } />
                    ))}
                  </div>
                  <span
                    className="ix-badge-difficulty"
                    data-difficulty={sessionDifficulty || 'loading'}
                    aria-label={sessionDifficulty ? `Difficulty: ${sessionDifficulty}` : 'Difficulty is being calibrated'}
                  >
                    {sessionDifficulty ? sessionDifficulty.charAt(0).toUpperCase() + sessionDifficulty.slice(1) : 'Calibrating…'}
                  </span>
                </div>
              </div>

              <div className="ix-topbar-actions">
                <button type="button" className="ix-topbar-icon-btn" title="Toggle theme" aria-label="Toggle theme">
                  <Sun size={16} aria-hidden="true" />
                </button>

                <Popover.Root open={showSessionGuide} onOpenChange={setShowSessionGuide}>
                  <Popover.Trigger asChild>
                    <button type="button" className="ix-topbar-guide-btn" aria-label="Session guide" title="Session guide">
                      <CircleHelp size={18} aria-hidden="true" />
                      <span>Session guide</span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Content className="ix-session-guide" align="end" sideOffset={12} collisionPadding={16}
                    aria-labelledby="ix-session-guide-title">
                    <div className="ix-session-guide-heading">
                      <h2 id="ix-session-guide-title">Your session, at a glance</h2>
                      <Popover.Close asChild>
                        <button type="button" className="ix-session-guide-close" aria-label="Close session guide">
                          <X size={18} aria-hidden="true" />
                        </button>
                      </Popover.Close>
                    </div>
                    <dl>
                      <div>
                        <dt>Answer out loud <kbd>Space</kbd></dt>
                        <dd>Press once to start recording. Press again to stop. Review your transcript, correct any misheard words, then click Submit answer.</dd>
                      </div>
                      <div>
                        <dt>Practice by typing</dt>
                        <dd>Switch to the keyboard to answer the same question without a microphone.</dd>
                      </div>
                      <div>
                        <dt>Review as you go</dt>
                        <dd>Switch between Questions and Transcript to revisit the conversation and your feedback.</dd>
                      </div>
                      <div>
                        <dt>{isDrill ? 'Leaving a drill' : 'Pick up where you left off'}</dt>
                        <dd>{isDrill
                          ? 'Drill answers are temporary. Leaving discards this drill without changing your main-set progress.'
                          : 'Submitted answers and feedback are saved automatically. Pause to return to the dashboard and resume later.'}</dd>
                      </div>
                    </dl>
                  </Popover.Content>
                </Popover.Root>

                <button
                  type="button"
                  className="ix-topbar-end-btn"
                  onClick={() => setShowEndModal(true)}
                  title={isDrill ? 'Leave drill' : 'Pause interview session'}
                >
                  <LeaveIcon size={16} aria-hidden="true" />
                  <span>{leaveLabel}</span>
                </button>
              </div>
            </div>
          </header>

          {/* ── Main Two-Column Content Grid ── */}
          <div className="ix-body">
            {/* Left Column (Stage + Question Card + Footer) */}
            <main className="ix-main-column">
              {/* ── Main Interview Stage Card (Top Card) ── */}
              <section
                className="ix-stage-card"
                data-state={stageState}
                aria-label="AI interviewer stage"
              >
                <StageAtmosphere isSpeaking={stageState === 'speaking'} volume={ttsAudioLevel} />

                {/* Header row: AI Interviewer pill, LIVE + Timer, PIP avatar */}
                <div className="ix-stage-header-row">
                  <div className="ix-stage-interviewer-pill">
                    <span className="ix-dot-blue" />
                    <span className="ix-stage-interviewer-label">
                      <span>AI Interviewer</span>
                      {interviewer && (
                        <span className="ix-stage-interviewer-name"> · {interviewer.masculine ? 'Mr.' : 'Ms.'} {interviewer.name}</span>
                      )}
                    </span>
                  </div>

                  <div className="ix-stage-live-timer-pill">
                    <span className="ix-dot-green" />
                    <span className="ix-live-text">LIVE</span>
                    <span className="ix-stage-time">{formatHMS(elapsedSec)}</span>
                  </div>

                  <div className="ix-pip-card">
                    <div className="ix-pip-avatar-circle">{userInitials || 'ME'}</div>
                    <span className="ix-pip-user-label">You</span>
                  </div>
                </div>

                {/* Shader-driven glass companion; it pauses offscreen and has a CSS fallback.
                    Mic level drives it while you answer; the TTS analyser drives it while the AI speaks. */}
                <div className="ix-stage-orb-wrap">
                  <InterviewBubbleBot
                    state={stageState}
                    volume={isRecording ? volume : ttsAudioLevel}
                  />
                </div>

                {/* Bottom Heading & Subtext */}
                <div
                  className="ix-stage-bottom-text"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="ix-stage-signal" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <h3 className="ix-stage-heading">{stageCopy.title}</h3>
                  <p className="ix-stage-subtext" role={error ? 'alert' : undefined}>{error || stageCopy.detail}</p>
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
                    {!isDrill && <button
                      type="button"
                      className="ix-practice-save"
                      aria-pressed={savedQuestionIndexes.includes(activeQuestionIndex)}
                      aria-label={savedQuestionIndexes.includes(activeQuestionIndex)
                        ? `Remove question ${activeQuestionIndex} from practice`
                        : `Save question ${activeQuestionIndex} for practice`}
                      title={preview ? 'Preview bookmark' : 'Save to Practice Again'}
                      disabled={!currentQuestionText || bookmarkBusy}
                      onClick={() => togglePracticeSave(activeQuestionIndex, currentQuestionText)}
                    >
                      <Bookmark size={16} aria-hidden="true"
                        fill={savedQuestionIndexes.includes(activeQuestionIndex) ? 'currentColor' : 'none'} />
                      <span>{savedQuestionIndexes.includes(activeQuestionIndex) ? 'Saved' : 'Save for practice'}</span>
                    </button>}
                  </div>
                  <h2 className="ix-question-title">
                    {currentQuestionText ||
                      (preview
                        ? 'Can you explain the difference between using the let keyword and the const keyword when declaring a variable in JavaScript?'
                        : isConnected ? 'Loading question...' : 'Connecting to your interview...')}
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
                  ) : isTyping && currentQuestionText && !isSessionComplete ? (
                    <div className="ix-response-state ix-state-typing">
                      <div className="ix-answer-meta-row">
                        <label className="ix-answer-lead" htmlFor="ix-typed-answer">Your answer</label>
                        <span className="ix-typed-label"><Keyboard size={14} aria-hidden="true" /> Typed practice</span>
                      </div>
                      {micUnavailable && <p className="ix-typed-notice" role="status">
                        <MicOff size={14} aria-hidden="true" /> Microphone unavailable. You can continue by typing.
                      </p>}
                      <textarea id="ix-typed-answer" ref={typedAnswerRef} className="ix-transcript-editor" rows={3}
                        value={typedAnswer} onChange={event => setTypedAnswer(event.target.value)}
                        maxLength={MAX_TYPED_ANSWER_LENGTH} placeholder="Type your answer here…" />
                      {typedAnswer.length > MAX_TYPED_ANSWER_LENGTH && <p className="ix-typed-notice" role="status">
                        Shorten your answer to 12,000 characters or fewer.
                      </p>}
                    </div>
                  ) : isReviewingAnswer ? (
                    <div className="ix-response-state ix-state-review">
                      <div className="ix-answer-meta-row ix-review-meta-row">
                        <div className="ix-answer-status">
                          <span id="transcript-review-label" className="ix-answer-lead">
                            {isEditingTranscript ? 'Edit transcript' : 'Review your transcript'}
                          </span>
                          <span className="ix-word-count">
                            {(isEditingTranscript ? transcriptDraft : finalTranscript).trim().split(/\s+/).filter(Boolean).length} words
                          </span>
                        </div>
                        {!isEditingTranscript && finalTranscript && (
                          <button ref={editTranscriptButtonRef} type="button"
                            className="ix-transcript-action" onClick={() => {
                              setTranscriptDraft(finalTranscript);
                              setIsEditingTranscript(true);
                            }}>
                            <Pencil size={13} aria-hidden="true" /> Edit transcript
                          </button>
                        )}
                      </div>
                      {isEditingTranscript ? (
                        <>
                          <textarea id="answer-transcript-editor" ref={transcriptEditorRef}
                            className="ix-transcript-editor" rows={3}
                            aria-labelledby="transcript-review-label" aria-describedby="transcript-review-help"
                            value={transcriptDraft} onChange={event => setTranscriptDraft(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                finishTranscriptEdit(false);
                              }
                            }} />
                          <div className="ix-transcript-edit-actions">
                            <button type="button" className="ix-transcript-action"
                              onClick={() => finishTranscriptEdit(false)}>Cancel</button>
                            <button type="button" className="ix-transcript-action ix-transcript-action-save"
                              disabled={!transcriptDraft.trim()}
                              onClick={() => finishTranscriptEdit(true)}>Save changes</button>
                          </div>
                        </>
                      ) : finalTranscript ? (
                        <div className="ix-transcript-review-box">
                          <p className="ix-transcript-quote">{finalTranscript}</p>
                        </div>
                      ) : (
                        <p className="ix-transcript-review-help" role="status">
                          No speech was captured. Record your answer again to continue.
                        </p>
                      )}
                      {finalTranscript && <p id="transcript-review-help" className="ix-transcript-review-help" role="status">
                        {isEditingTranscript ? 'Correct any words that were misheard, then save your changes.'
                          : 'Check for misheard words. Your answer is submitted only when you click Submit answer.'}
                      </p>}
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
                  {canRetryEvaluation && !isTyping && (
                    <button type="button" className="ix-btn-primary-action" onClick={retryEvaluation}
                      disabled={!isConnected || isEvaluating || isRecording || isPlayingAudio}>
                      Retry evaluation
                    </button>
                  )}
                  {isSessionComplete ? (
                    <button
                      className="ix-btn-primary-action"
                      id="btn-session-complete"
                      onClick={finishSession}
                    >
                      <Flag size={15} />
                      <span>
                        {practiceReturnLabel || (isSavedPractice ? 'Return to Practice Again' : isDrill ? 'Finish Drill' : setNumber === 3
                          ? effectiveMode === 'practice'
                            ? 'View Practice Summary'
                            : 'Start Graduation Challenge'
                          : 'Return to Dashboard')}
                      </span>
                    </button>
                  ) : (
                    <>
                      {isTyping ? (
                        <>
                          <button type="button" className="ix-dock-btn-main" onClick={submitAnswer}
                            disabled={micDisabled || !typedAnswer.trim() || typedAnswer.trim().length > MAX_TYPED_ANSWER_LENGTH}>
                            Submit answer <ArrowRight size={16} aria-hidden="true" />
                          </button>
                          <button id="btn-toggle-mic" type="button" className="ix-dock-btn-secondary ix-dock-btn-input"
                            disabled={micDisabled} onClick={toggleMic}>
                            <Mic size={16} aria-hidden="true" /> Use microphone
                          </button>
                        </>
                      ) : isReviewingAnswer ? (
                        <>
                          <button type="button" className="ix-dock-btn-main" onClick={submitAnswer}
                            disabled={micDisabled || isEditingTranscript || !finalTranscript.trim()}>
                            <ArrowRight size={16} aria-hidden="true" /> Submit answer
                          </button>
                          <button id="btn-toggle-mic" type="button" className="ix-transcript-action"
                            disabled={micDisabled || isEditingTranscript} onClick={toggleMic}>
                            <Mic size={15} aria-hidden="true" /> Record again
                          </button>
                        </>
                      ) : <button
                        id="btn-toggle-mic"
                        type="button"
                        className={`ix-dock-btn-main ${isRecording ? 'recording' : ''}`}
                        onClick={toggleMic}
                        disabled={micDisabled}
                        title={
                          isRecording ? 'Stop & Review Answer (Space)' : 'Start Answering (Space)'
                        }
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={16} />}
                        <span>{isRecording ? 'Stop & Review' : 'Answer'}</span>
                        <kbd className="ix-dock-kbd">Space</kbd>
                      </button>}

                      {!isTyping && !isEvaluating && (
                        <button type="button" className="ix-dock-btn-secondary ix-dock-btn-input"
                          onClick={startTyping} disabled={!isConnected || !currentQuestionText}>
                          <Keyboard size={16} aria-hidden="true" /> Practice by typing
                        </button>
                      )}

                      <button
                        id="btn-session-end"
                        type="button"
                        className="ix-dock-btn-secondary"
                        onClick={() => setShowEndModal(true)}
                        title={isDrill ? 'Leave drill' : 'Pause interview session'}
                      >
                        <LeaveIcon size={16} aria-hidden="true" />
                        <span>{leaveLabel}</span>
                      </button>
                    </>
                  )}
                </div>
              </section>

              {bookmarkError && <p role="alert">{bookmarkError}</p>}
              {practiceToast && (
                <div className="ix-practice-toast" key={practiceToast.id}>
                  <CircleCheck size={20} className="ix-practice-toast-icon" aria-hidden="true" />
                  <div className="ix-practice-toast-copy" role="status" aria-atomic="true">
                    <span>{practiceToast.wasSaved ? 'Removed from practice' : 'Saved for practice'}</span>
                    <span className="ix-practice-toast-detail">{preview ? 'Preview only' : 'Your Practice Again library'}</span>
                  </div>
                  <button type="button" className="ix-practice-toast-undo" onClick={undoPracticeSave} disabled={bookmarkBusy}>
                    Undo
                  </button>
                  <button type="button" className="ix-practice-toast-dismiss"
                    aria-label="Dismiss practice notification" onClick={dismissPracticeToast}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </main>

            {/* ════ Right Sidebar ════ */}
            <InterviewSidebar
              activeQuestionIndex={activeQuestionIndex}
              questionsAsked={questionsAsked}
              currentQuestionText={currentQuestionText}
              titleFor={titleFor}
              chatTurns={chatTurns}
              userInitials={userInitials}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              coachTip={coachTip}
              whatYouDidWell={latestFeedback?.whatYouDidWell}
              tryImproving={latestFeedback?.tryImproving}
              savedQuestionIndexes={savedQuestionIndexes}
              onTogglePracticeSave={isDrill ? undefined : togglePracticeSave}
              totalQuestions={totalQuestions}
              bookmarkBusy={bookmarkBusy}
            />
          </div>

          {/* Centered Privacy Footer */}
          <footer className="ix-footer">
            <Shield size={13} className="ix-footer-shield" />
            <span>
              {isDrill
                ? 'Drill answers are temporary and are not added to progress or history.'
                : 'Your answers are saved automatically and kept private.'}
            </span>
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
                ref={endDialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-end-title"
                aria-describedby="modal-end-description"
              >
                <div className="ix-modal-header">
                  <h3 id="modal-end-title" className="ix-modal-title">
                    {isDrill ? 'Leave This Drill?' : 'Pause Interview Session?'}
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
                  <p id="modal-end-description" className="ix-modal-desc">
                    {isRecording
                      ? 'Stop and submit your current answer before leaving. The current recording has not been saved yet.'
                      : isEvaluating
                        ? isDrill
                          ? 'Your answer is being scored. Please wait a moment before leaving.'
                          : 'Your answer is being scored and saved. Please wait a moment before leaving.'
                        : isReviewingAnswer || typedAnswer.trim()
                          ? 'Your current answer has not been submitted. Leaving will discard your draft.'
                        : isDrill
                          ? 'This drill is temporary. Leaving will discard its questions, answers, and feedback without changing your main-set progress.'
                          : 'Your generated questions, submitted answers, and coach feedback are saved. You can resume this exact set from the dashboard.'}
                  </p>
                </div>
                <div className="ix-modal-footer">
                  <button
                    type="button"
                    className="ix-btn-secondary-flat"
                    data-pause-cancel
                    onClick={() => setShowEndModal(false)}
                  >
                    Stay in Session
                  </button>
                  <button
                    type="button"
                    className="ix-btn-danger-action"
                    onClick={handlePauseAndReturn}
                    disabled={isRecording || isEvaluating}
                  >
                    {isRecording
                      ? 'Stop Answer First'
                      : isEvaluating
                        ? 'Saving Answer?'
                        : isReviewingAnswer || typedAnswer.trim()
                          ? isDrill ? 'Leave & discard answer' : 'Pause & discard answer'
                        : practiceReturnLabel || (isDrill
                          ? 'Leave Drill'
                          : 'Pause & Return to Dashboard')}
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

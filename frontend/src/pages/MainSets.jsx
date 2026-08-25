// frontend/src/pages/MainSets.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 / 2 / 3 Interview Arena — Soft Productivity SaaS design system
//
// Features:
// - Toggle Mic (Push-to-Talk) architecture
// - Connects to ws://localhost:5000/ws/set{n}
// - AI Coach Panel for 1-sentence tips
// - Live Transcript Panel
// - SetBriefingOverlay shown on mount
// - Design: ITerview studio world (Session Ramp neutrals, cyan signal)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { AnimatePresence } from "framer-motion";
import Set2TransitionOverlay from "../components/Set2TransitionOverlay";
import Set3TransitionOverlay from "../components/Set3TransitionOverlay";
import {
  Mic,
  Video,
  MonitorUp,
  MessageSquare,
  Hand,
  PhoneOff,
  Timer,
  Clock,
  Check,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Flag,
} from "lucide-react";
import "./MainSets.css";

// ── Set metadata ───────────────────────────────────────────────────────────
const SET_META = {
  1: { label: "Set 1: Personalized", difficulty: "easy", category: "Personalized" },
  2: { label: "Set 2: Technical Mastery", difficulty: "hard", category: "Technical" },
  3: { label: "Set 3: Behavioral STAR", difficulty: "medium", category: "Behavioral" },
};

// Sidebar previews for unasked questions in preview/dev mode (real sessions
// only reveal a question once the server sends it).
const PREVIEW_QUESTIONS = {
  1: [
    "Tell me about a challenging technical project you worked on and what your specific role was.",
    "How did you handle testing in that project?",
    "Describe how you collaborated with designers or product managers.",
    "What was the hardest bug you hit and how did you debug it?",
    "What would you improve if you revisited that project today?",
  ],
  2: [
    "Explain the difference between SQL and NoSQL databases, and when you would choose one over the other.",
    "Explain JavaScript closures and their use cases.",
    "How would you optimize a React app for performance?",
    "Explain the virtual DOM and how it differs from the real DOM.",
    "How do you handle side effects and data fetching in modern React?",
  ],
  3: [
    "Tell me about a time you worked on a group programming project and how your team divided the tasks.",
    "Describe a time you disagreed with a teammate's coding style.",
    "Tell me about a time you missed a deadline. What happened?",
    "Describe a situation where you explained a technical concept to a non-technical stakeholder.",
    "Tell me about a failure you owned and what you changed afterward.",
  ],
};

// Elapsed-time formatting: stage clock (hh:mm:ss) and session chip (mm:ss)
const pad2 = (n) => String(n).padStart(2, "0");
const formatHMS = (t) =>
  `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${pad2(t % 60)}`;
const formatMS = (t) => `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;

export default function MainSets() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || "aura-2-luna-en";
  const query = new URLSearchParams(location.search);
  const setNumber = parseInt(query.get("set")) || 1;
  const mode = query.get("mode") || "diagnostic";
  const focusArea = query.get("focusArea") || "";
  const isResume = query.get("resume") === "true";
  const isAutostart = query.get("autostart") === "true";
  const preview =
    query.get("preview") === "true" || location.pathname.includes("/dev/");

  const meta = SET_META[setNumber] || SET_META[1];

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showBriefing, setShowBriefing] = useState(
    setNumber !== 1 && !isResume && !isAutostart
  );
  const [status, setStatus] = useState("Waiting to start...");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showNextTransition, setShowNextTransition] = useState(false);
  const [userRole, setUserRole] = useState("Frontend");
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [hasReceivedQ1Audio, setHasReceivedQ1Audio] = useState(false);
  const [slowWait, setSlowWait] = useState(false);

  // Volume & Transcript state
  const [volume, setVolume] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [coachTip, setCoachTip] = useState(
    "Your personalized AI feedback will appear here after each answer.",
  );
  const [scores, setScores] = useState(null);

  // ── Session HUD state (stage clock, sidebar question list, tabs, PIP) ─────
  const [elapsedSec, setElapsedSec] = useState(0);
  const [questionsAsked, setQuestionsAsked] = useState([]);
  const [activeTab, setActiveTab] = useState("questions");
  const [userInitials, setUserInitials] = useState("ME");

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
        ? prev
        : [...prev, { index, text, answered: false, answer: "" }],
    );
  }, []);

  // Flags the most recent unanswered question as answered. The finalized
  // transcript is snapshotted by the caller (reading the ref inside this
  // callback trips the react-hooks compiler immutability rule).
  const markCurrentAnswered = useCallback((answerText) => {
    setQuestionsAsked((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (!next[i].answered) {
          next[i] = { ...next[i], answered: true, answer: answerText || "" };
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
  const finalTranscriptRef = useRef("");
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const isMountedRef = useRef(true);
  const isSessionCompleteRef = useRef(false);

  // ── Orb placeholder ────────────────────────────────────────────────────────
  // A pure-CSS stand-in driven purely by the stage's state class
  // (.ix-stage.speaking/.listening/.complete). No WebGL, no audio graph —
  // swap this block for an alternative orb component when one is chosen.

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
            if (isMountedRef.current) onError(new Error("Audio playback failed."));
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
      processQueue();
    };

    if (item.type === "base64") {
      playBase64(item.data, onEnded, onEnded);
    }
  }, [playBase64, setNumber]);

  const enqueueBase64Audio = useCallback(
    (base64Data) => {
      audioQueueRef.current.push({ type: "base64", data: base64Data });
      processQueue();
    },
    [processQueue],
  );

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
          // Derive PIP self-view initials from whatever identity info we have
          const u = auth.currentUser;
          const rawName =
            data.user?.name || u?.displayName || (u?.email ? u.email.split("@")[0] : "");
          const parts = String(rawName).trim().split(/\s+/).filter(Boolean);
          if (parts.length > 0) {
            setUserInitials(
              parts
                .slice(0, 2)
                .map((w) => w.charAt(0).toUpperCase())
                .join("") || "ME",
            );
          }
        })
        .catch((err) => console.error("Error fetching user role:", err));
    }
  }, []);

  // ── WebSocket connection (Starts automatically for Set 1, or after transition) ──
  const startSession = useCallback(() => {
    setShowBriefing(false);

    if (preview) {
      setIsConnected(true);
      setIsGeneratingQuestions(false);
      // Preview never receives tts_audio, so mark audio-ready to keep the
      // mic CTA ungated in this mode.
      setHasReceivedQ1Audio(true);
      setStatus("Question ready. Click Answer to respond.");
      const previewQ =
        setNumber === 1
          ? "Tell me about a challenging technical project you worked on and what your specific role was."
          : setNumber === 2
            ? "Explain the difference between SQL and NoSQL databases, and when you would choose one over the other."
            : "Tell me about a time you worked on a group programming project and how your team divided the tasks.";
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

    // Retry safety: drop any previous socket first so retries can't leak
    // connections or let the stale onclose clobber the fresh session state.
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const user = auth.currentUser;
    const uid = user ? user.uid : "anonymous_user";
    const focusParam = focusArea ? `&focusArea=${focusArea}` : "";
    const ws = new WebSocket(
      `ws://localhost:5000/ws/set${setNumber}?voice=${voice}&uid=${uid}${focusParam}`,
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to Set ${setNumber}`);
      setIsConnected(true);
      setError("");
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "generation_progress":
          if (msg.role) setUserRole(msg.role.charAt(0).toUpperCase() + msg.role.slice(1));
          if (msg.message) setStatus(msg.message);
          break;
        case "status":
          setStatus(msg.message);
          break;
        case "tts_audio":
          setHasReceivedQ1Audio(true);
          enqueueBase64Audio(msg.data);
          break;
        case "question_text":
          addQuestion(msg.index, msg.text);
          setCurrentQuestionText(msg.text);
          setCurrentQuestion(msg.index);
          setFinalTranscript("");
          setPartialTranscript("");
          finalTranscriptRef.current = "";
          setIsEvaluating(false);
          break;
        case "coach_tip":
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
          setIsEvaluating(false);
          break;
        case "session_complete":
          setIsSessionComplete(true);
          isSessionCompleteRef.current = true;
          setStatus(`Set ${setNumber} Complete!`);
          setIsEvaluating(false);
          if (setNumber < 3) {
            // Only show immediately if we are not currently playing audio and queue is empty
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
      setError("WebSocket connection failed. Is the backend running?");
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [preview, setNumber, voice, focusArea, isResume, enqueueBase64Audio, addQuestion, markCurrentAnswered]);

  const goToNextSet = () => {
    setShowNextTransition(false);
    const nextSet = setNumber + 1;
    const modeParam = mode === "practice" ? "&mode=practice" : "";
    const focusParam = focusArea ? `&focusArea=${focusArea}` : "";
    navigate(`/interview?set=${nextSet}${modeParam}${focusParam}&autostart=true`, { state: { voice } });
  };

  // ── Reset & Initialize on route change ────────────────────────────────────
  useEffect(() => {
    isSessionCompleteRef.current = false;
    setStatus(preview ? "Preview mode active" : "Waiting to start...");
    setError("");
    setIsConnected(preview);
    setIsRecording(false);
    setIsPlayingAudio(false);
    setIsEvaluating(false);
    setIsSessionComplete(false);
    setShowNextTransition(false);
    setVolume(0);
    setPartialTranscript("");
    setFinalTranscript("");
    setElapsedSec(0);
    setQuestionsAsked([]);
    setCurrentQuestion(0);
    setCurrentQuestionText("");
    setCoachTip(
      setNumber === 1
        ? "Your personalized AI feedback will appear here after each answer."
        : setNumber === 2
          ? "Your technical evaluation feedback will appear here after each answer."
          : "Your behavioral STAR evaluation feedback will appear here after each answer.",
    );
    setScores(null);

    if (setNumber === 1 || isResume || isAutostart) {
      setShowBriefing(false);
      startSession();
    } else {
      setShowBriefing(true);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupAudio();
    };
  }, [location.search, location.pathname, setNumber, isResume, isAutostart, startSession]);

  // ── Inline generation state (replaces the old full-screen loader) ─────────
  // Generating ends only when Q1 is truly ready: text arrived AND audio in hand.
  useEffect(() => {
    if (isGeneratingQuestions && hasReceivedQ1Audio && currentQuestionText) {
      setIsGeneratingQuestions(false);
    }
  }, [isGeneratingQuestions, hasReceivedQ1Audio, currentQuestionText]);

  // Slow-generation guard: after ~15s without Q1 audio, surface one honest
  // hint with a retry. Real elapsed time — no fabricated progress stages.
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

  const cleanupAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = "";
      } catch (e) {}
      currentAudioRef.current = null;
    }

    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch (e) {}
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
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    setVolume(0);
  };

  // ── Mic controls ───────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (preview) {
      if (isRecording) {
        setIsRecording(false);
        setIsEvaluating(true);
        setStatus("Answer submitted. Evaluating...");

        setTimeout(() => {
          setIsEvaluating(false);
          setCoachTip(
            setNumber === 1
              ? "Great detail on the database structure. Try to explain why you chose SQL over NoSQL."
              : setNumber === 2
                ? "Good explanation of database types. Focus on scaling trade-offs next time."
                : "Excellent use of the STAR method. You clearly outlined the situation and task.",
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
            setStatus("Question ready. Click Answer to respond.");
          }
        }, 1500);
      } else {
        setIsRecording(true);
        setStatus("Listening...");
        setFinalTranscript(
          "This is a preview transcription of your answer. You can start speaking now.",
        );
      }
      return;
    }

    if (!isConnected) return;
    setError("");

    if (isRecording) {
      cleanupAudio();
      wsRef.current?.send(JSON.stringify({ type: "stop_recording" }));
      setIsRecording(false);
      setIsEvaluating(true);
      const combinedText = (
        finalTranscriptRef.current +
        (partialTranscript ? (finalTranscriptRef.current ? " " : "") + partialTranscript : "")
      ).trim();
      wsRef.current?.send(
        JSON.stringify({
          type: "submit_answer",
          final_text: combinedText,
        }),
      );
      setStatus("Answer submitted. Evaluating...");
    } else {
      try {
        setFinalTranscript("");
        setPartialTranscript("");
        finalTranscriptRef.current = "";

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        wsRef.current.send(JSON.stringify({ type: "start_recording" }));

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)(
          { sampleRate: 16000 },
        );
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
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const orbState = isSessionComplete
    ? "complete"
    : isPlayingAudio
      ? "speaking"
      : isRecording
        ? "listening"
        : "";

  // ── Sidebar derivations ────────────────────────────────────────────────────
  const answeredRows = questionsAsked.filter((q) => q.answered);
  const activeIndex =
    currentQuestion > 0 && currentQuestionText && !isSessionComplete ? currentQuestion : -1;
  const upcomingRows = [1, 2, 3, 4, 5].filter(
    (i) => !answeredRows.some((q) => q.index === i) && i !== activeIndex,
  );

  const titleFor = (i) => {
    const asked = questionsAsked.find((q) => q.index === i);
    if (asked) return asked.text;
    const mocks = PREVIEW_QUESTIONS[setNumber];
    if (preview && mocks && mocks[i - 1]) return mocks[i - 1];
    return null;
  };

  const sentiment = (() => {
    if (!scores) return { tone: "", label: "Awaiting first answer", pct: 0 };
    const vals = Object.values(scores);
    const avg = vals.reduce((sum, v) => sum + Number(v), 0) / vals.length;
    const pct = Math.round(avg * 10);
    const tone = avg >= 8 ? "good" : avg >= 6 ? "mid" : "low";
    const label = avg >= 8 ? "Positive Sentiment" : avg >= 6 ? "Neutral Sentiment" : "Needs Focus";
    return { tone, label, pct };
  })();

  const finishSession = () => {
    if (mode === "practice" && setNumber === 3) {
      navigate("/results?mode=practice");
    } else if (setNumber === 3) {
      navigate("/post-test", { state: { voice } });
    } else {
      navigate("/dashboard");
    }
  };

  const micDisabled =
    !isConnected || isPlayingAudio || isEvaluating || isGeneratingQuestions || !hasReceivedQ1Audio;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ix-root">
      {/* ── Overlay gates (Briefing / Transition) ── */}
      {/* AnimatePresence needs keyed motion components as DIRECT children —
          fragments break mount/unmount tracking, so exit animations don't run
          and the overlay can stay stuck at its hidden state. */}
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

      {/* ── Interview Session V2 — dark wireframe port ── */}
      {!showBriefing && (
        <>
          {/* ── Top Bar ── */}
          <header className="ix-topbar">
            <div
              className="ix-topbar-brand"
              onClick={() => navigate("/dashboard")}
              title="Return to Dashboard"
            >
              ITerview
            </div>

            <div className="ix-topbar-counter">
              Question {currentQuestion > 0 ? currentQuestion : "—"} of 5
            </div>

            <div className="ix-topbar-badges">
              <span className={`ix-pill-easy ${meta.difficulty}`}>
                <span className="ix-pill-dot" />
                {meta.difficulty.toUpperCase()}
              </span>
              <span className="ix-pill-set">{meta.label}</span>
            </div>
          </header>

          <div className="ix-body">
            <main className="ix-main">

          {/* ── Video Stage ── */}
          <section className={`ix-stage ${orbState}`} aria-label="AI interviewer stage">
            <div className="ix-glow ix-glow-soft" />
            <div className="ix-glow ix-glow-cyan" />
            <div className="ix-ring ix-ring-outer" />
            <div className="ix-ring ix-ring-inner" />

            {/* Lightweight AI presence — pure-CSS instrument dial (same
                language as the landing demo: halo ring, breathing ring, dark
                cyan-lit core, 5-bar waveform). States come from the stage
                class (.ix-stage.speaking/.listening/.complete) in MainSets.css.
                Swap this block for an alternative orb component when chosen. */}
            <div className="ix-orb-lite" aria-hidden="true">
              <span className="ix-orb-halo" />
              <span className="ix-orb-ring" />
              <span className="ix-orb-core" />
              <span className="ix-orb-wave">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`ix-orb-bar ix-orb-bar--${i}`} />
                ))}
              </span>
            </div>

            {/* Stage overlays */}
            <div className="ix-ai-pill">
              <span className="ix-ai-dot" />
              <span>AI Interviewer · Mrs. Tania Shahira</span>
            </div>

            {/* PIP self-view card */}
            <div className="ix-pip">
              <div className="ix-pip-avatar">{userInitials}</div>
              <div className="ix-pip-label">Me</div>
              <div className={`ix-pip-wave${isPlayingAudio ? " ai" : ""}`} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    style={
                      isRecording
                        ? {
                            transform: `scaleY(${Math.min(
                              1,
                              (4 + Math.round((volume / 100) * (5 + i * 2))) / 11,
                            )})`,
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>

            {/* Centered LIVE + stage-clock cluster */}
            <div className="ix-stage-meta">
              <span className="ix-stage-live">
                <span className="ix-dot-green" />
                LIVE
              </span>
              <span className="ix-stage-timer">{formatHMS(elapsedSec)}</span>
            </div>
          </section>

          {/* ── Lower Panel ── */}
          <section className="ix-lower">
            <div className="ix-session-row">
              <span className="ix-live-pill">
                <span className="ix-dot-green" />
                LIVE
              </span>
              {error && <span className="ix-error-chip">{error}</span>}
              <span className="ix-timer-box">
                <Timer size={12} />
                {formatMS(elapsedSec)}
              </span>
            </div>

            {/* Question HUD */}
            <div className="ix-hud">
              <div className="ix-hud-accent" />
              <div className="ix-hud-content">
                <div className="ix-hud-head">
                  <span className="ix-q-num">
                    Q{currentQuestion > 0 ? currentQuestion : "—"}
                  </span>
                  <span className="ix-q-label">CURRENT QUESTION</span>
                  <span className="ix-q-category">{focusArea || meta.category}</span>
                </div>
                {currentQuestionText ? (
                  <div className="ix-q-text">{currentQuestionText}</div>
                ) : (
                  <div className="ix-q-skeleton" aria-hidden="true">
                    <span />
                    <span />
                  </div>
                )}
              </div>
            </div>

            {/* Transcript ticker — doubles as the session status line when idle */}
            <div className={`ix-ticker${isRecording ? " recording" : ""}`}>
              {isRecording ? (
                <>
                  <span className="ix-ticker-badge">
                    <span className="ix-dot-live" />
                    TRANSCRIBING
                  </span>
                  <span className="ix-ticker-text">
                    "{partialTranscript || finalTranscript || "Listening…"}"
                  </span>
                </>
              ) : (
                <span className="ix-ticker-text">{status}</span>
              )}
            </div>

            {(slowWait || (error && isGeneratingQuestions)) && (
              <div className="ix-slowwait">
                <span>
                  {error ? "Generation hit a snag." : "Still preparing — hang tight."}
                </span>
                <button type="button" onClick={startSession}>
                  Retry
                </button>
              </div>
            )}

            {isEvaluating && (
              <div className="ix-evaluating">
                <span className="ix-evaluating-dots">
                  <span />
                  <span />
                  <span />
                </span>
                Evaluating your answer…
              </div>
            )}

            {/* Control dock */}
            <div className="ix-dock-wrap">
              {isSessionComplete ? (
                <button
                  className="ix-end-btn"
                  id="btn-session-complete"
                  onClick={finishSession}
                >
                  <Flag size={16} />
                  <span>
                    {setNumber === 3
                      ? mode === "practice"
                        ? "View Practice Summary"
                        : "Start Graduation Challenge"
                      : "Return to Dashboard"}
                  </span>
                </button>
              ) : (
                <div className="ix-dock">
                  <button
                    id="btn-toggle-mic"
                    className={`ix-dock-btn${isRecording ? " recording" : ""}`}
                    onClick={toggleMic}
                    disabled={micDisabled}
                    title={isRecording ? "Finish answering" : "Unmute to answer"}
                  >
                    <Mic size={18} />
                    <span>{isRecording ? "Stop" : "Answer"}</span>
                  </button>
                  <button
                    className="ix-dock-btn"
                    disabled
                    title="Camera is not available in this build"
                  >
                    <Video size={18} />
                    <span>Camera</span>
                  </button>
                  <button
                    className="ix-dock-btn"
                    disabled
                    title="Screen share is not available in this build"
                  >
                    <MonitorUp size={18} />
                    <span>Share</span>
                  </button>
                  <button
                    className="ix-dock-btn"
                    disabled
                    title="Chat is not available in this build"
                  >
                    <MessageSquare size={18} />
                    <span>Chat</span>
                  </button>
                  <div className="ix-dock-divider" />
                  <button
                    className="ix-dock-btn"
                    disabled
                    title="Raise hand is not available in this build"
                  >
                    <Hand size={18} />
                    <span>Hand</span>
                  </button>
                  <button
                    id="btn-session-end"
                    className="ix-dock-btn ix-dock-end"
                    onClick={() => navigate("/dashboard")}
                    title="End session and return to Dashboard"
                  >
                    <PhoneOff size={18} />
                    <span>End</span>
                  </button>
                </div>
              )}
            </div>
          </section>
          </main>

          {/* ════ RIGHT SIDEBAR ════ */}
          <aside className="ix-sidebar">
            <div className="ix-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "questions"}
                className={`ix-tab${activeTab === "questions" ? " active" : ""}`}
                onClick={() => setActiveTab("questions")}
              >
                Questions
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "notes"}
                className={`ix-tab${activeTab === "notes" ? " active" : ""}`}
                onClick={() => setActiveTab("notes")}
              >
                Notes
              </button>
            </div>

            <div className="ix-side-body">
              {activeTab === "notes" ? (
                <p className="ix-notes-empty">
                  Notes you capture during the session will be collected here.
                </p>
              ) : (
                <>
                  {answeredRows.map((q) => (
                    <div key={q.index} className="ix-question-row">
                      <span className="ix-row-badge">{String(q.index).padStart(2, "0")}</span>
                      <div className="ix-row-body">
                        <span className="ix-row-title">{q.text}</span>
                        {q.answer && <span className="ix-row-snippet">"{q.answer}"</span>}
                      </div>
                      <Check size={16} className="ix-row-check" />
                    </div>
                  ))}

                  {upcomingRows.length > 0 && answeredRows.length > 0 && (
                    <div className="ix-section-label">UPCOMING QUESTIONS</div>
                  )}

                  {upcomingRows.map((i) => {
                    const t = titleFor(i);
                    return (
                      <div key={i} className="ix-question-row">
                        <span className="ix-row-badge pending">
                          {String(i).padStart(2, "0")}
                        </span>
                        <span className="ix-row-title dim">
                          {t || "Waiting for the interviewer…"}
                        </span>
                        <Clock size={16} className="ix-row-clock" />
                      </div>
                    );
                  })}


                  <div className="ix-section-label">AI FEEDBACK</div>
                  <div className="ix-feedback-card">
                    <div className="ix-feedback-head">
                      <span className={`ix-sentiment ${sentiment.tone}`.trim()}>
                        {sentiment.label}
                      </span>
                      {scores && (
                        <span className={`ix-fscore ${sentiment.tone}`.trim()}>
                          {sentiment.pct}%
                        </span>
                      )}
                    </div>

                    <div className="ix-insight">
                      <Lightbulb size={14} className="amber" />
                      <p>{coachTip}</p>
                    </div>
                    {scores && (
                      <>
                        <div className="ix-insight">
                          <AlertTriangle size={14} className="amber" />
                          <p>Push for concrete examples to lift your depth dimension.</p>
                        </div>
                        <div className="ix-insight">
                          <CheckCircle2 size={14} className="green" />
                          <p>{answeredRows.length} of 5 answers submitted this session.</p>
                        </div>
                        <div className="ix-stats">
                          {Object.entries(scores).map(([name, val]) => (
                            <div key={name} className="ix-stat">
                              <div className="ix-stat-value">{val}/10</div>
                              <div className="ix-stat-label">{name.replace(/_/g, " ")}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
          </div>
        </>
      )}
    </div>
  );
}

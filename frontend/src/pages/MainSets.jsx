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
// - Design: mirrors Dashboard.css (card-in-card, lavender inner card, tokens)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { AnimatePresence } from "framer-motion";
import SetBriefingOverlay from "../components/SetBriefingOverlay";
import Set2TransitionOverlay from "../components/Set2TransitionOverlay";
import Set3TransitionOverlay from "../components/Set3TransitionOverlay";
import AiAnalysisLoader from "../components/AiAnalysisLoader";
import "./MainSets.css";

// ── Set metadata ───────────────────────────────────────────────────────────
const SET_META = {
  1: { label: "Set 1: Personalized", emoji: "🤖", color: "accent" },
  2: { label: "Set 2: Technical Mastery", emoji: "💻", color: "blue" },
  3: { label: "Set 3: Behavioral STAR", emoji: "🎯", color: "green" },
};

export default function MainSets() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = location.state?.voice || "aura-2-luna-en";
  const query = new URLSearchParams(location.search);
  const setNumber = parseInt(query.get("set")) || 1;
  const preview =
    query.get("preview") === "true" || location.pathname.includes("/dev/");

  const meta = SET_META[setNumber] || SET_META[1];

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showBriefing, setShowBriefing] = useState(true);
  const [status, setStatus] = useState("Waiting to start...");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showNextTransition, setShowNextTransition] = useState(false);
  const [userRole, setUserRole] = useState("Frontend");

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
  const isSessionCompleteRef = useRef(false);

  // ── Playback Functions ─────────────────────────────────────────────────────
  const playBase64 = useCallback((base64Data, onEnded, onError) => {
    try {
      fetch(`data:audio/mpeg;base64,${base64Data}`)
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;

          audio.onended = () => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            onEnded();
          };

          audio.onerror = () => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            onError(new Error("Audio playback failed."));
          };

          audio.play().catch((err) => {
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            onError(err);
          });
        })
        .catch(onError);
    } catch (err) {
      onError(err);
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
        })
        .catch((err) => console.error("Error fetching user role:", err));
    }
  }, []);

  // ── WebSocket connection (Starts AFTER briefing) ───────────────────────────
  const startSession = () => {
    setShowBriefing(false);

    if (preview) {
      setIsConnected(true);
      setStatus("Question ready. Click Unmute to answer.");
      setCurrentQuestion(1);
      setCurrentQuestionText(
        setNumber === 1
          ? "Tell me about a challenging technical project you worked on and what your specific role was."
          : setNumber === 2
            ? "Explain the difference between SQL and NoSQL databases, and when you would choose one over the other."
            : "Tell me about a time you worked on a group programming project and how your team divided the tasks.",
      );
      return;
    }

    setStatus(`Connecting to Set ${setNumber} session...`);

    const user = auth.currentUser;
    const uid = user ? user.uid : "anonymous_user";
    const ws = new WebSocket(
      `ws://localhost:5000/ws/set${setNumber}?voice=${voice}&uid=${uid}`,
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
        case "status":
          setStatus(msg.message);
          break;
        case "tts_audio":
          enqueueBase64Audio(msg.data);
          break;
        case "question_text":
          setCurrentQuestionText(msg.text);
          setCurrentQuestion(msg.index);
          setFinalTranscript("");
          setPartialTranscript("");
          finalTranscriptRef.current = "";
          setIsEvaluating(false);
          break;
        case "coach_tip":
          setCoachTip(msg.tip);
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
  };

  const goToNextSet = () => {
    setShowNextTransition(false);
    const nextSet = setNumber + 1;
    navigate(`/interview?set=${nextSet}`, { state: { voice } });
  };

  // ── Reset on route change ──────────────────────────────────────────────────
  useEffect(() => {
    isSessionCompleteRef.current = false;
    setShowBriefing(true);
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

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupAudio();
    };
  }, [location.search, location.pathname]);

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

          setCurrentQuestion((prev) => {
            const nextQ = prev + 1;
            if (nextQ > 5) {
              setIsSessionComplete(true);
              setStatus(`Set ${setNumber} Complete!`);
              return 5;
            }
            setCurrentQuestionText(
              setNumber === 1
                ? `Mock Personalized Question ${nextQ}: How did you handle testing in that project?`
                : setNumber === 2
                  ? `Mock Technical Question ${nextQ}: Explain JavaScript closures and their use cases.`
                  : `Mock Behavioral Question ${nextQ}: Describe a time you disagreed with a teammate's coding style.`,
            );
            setStatus("Question ready. Click Unmute to answer.");
            return nextQ;
          });
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
      wsRef.current?.send(
        JSON.stringify({
          type: "submit_answer",
          final_text: finalTranscriptRef.current,
        }),
      );
      setStatus("Answer submitted. Evaluating...");
    } else {
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
  const statusState = isPlayingAudio
    ? "speaking"
    : isRecording
      ? "listening"
      : "idle";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pt-root">
      {/* ── Overlay gates (Briefing / Transition) ── */}
      <AnimatePresence>
        {showBriefing && (
          <>
            {setNumber === 1 && <SetBriefingOverlay onReady={startSession} />}
            {setNumber === 2 && (
              <Set2TransitionOverlay onReady={startSession} role={userRole} />
            )}
            {setNumber === 3 && (
              <Set3TransitionOverlay onReady={startSession} />
            )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNextTransition && (
          <>
            {setNumber === 1 && (
              <Set2TransitionOverlay onReady={goToNextSet} role={userRole} />
            )}
            {setNumber === 2 && <Set3TransitionOverlay onReady={goToNextSet} />}
          </>
        )}
      </AnimatePresence>

      {/* ── Main interview arena (shown after briefing) ── */}
      {!showBriefing && (
        <>
          {/* ── Top Bar ── */}
          <header className="pt-topbar">
            {/* Brand wordmark — mirrors db-topnav__wordmark */}
            <div className="pt-topbar-brand">ITerview</div>

            {/* Center meta cluster */}
            <div className="pt-topbar-meta">
              {/* Set phase badge — pill, purple tint */}
              <span className="pt-phase-badge">{meta.label}</span>

              {/* Question counter — mirrors db-sessions-chip */}
              <span className="pt-q-counter">
                Question {currentQuestion > 0 ? currentQuestion : "—"} of 5
              </span>

              {/* AI Speaking indicator */}
              {isPlayingAudio && (
                <span className="pt-speaking-chip">
                  <span className="pt-speaking-dot" />
                  AI Speaking
                </span>
              )}
            </div>
          </header>

          {/* ── Interview Arena ── */}
          <main className="ms-main">
            {/* ── Left Column ── */}
            <div className="ms-left-column">
              {/* AI Avatar + Question — white outer → lavender inner (card-in-card) */}
              <div className="ms-card ms-avatar-card">
                <div className="ms-avatar-card-header">
                  <span className="ms-avatar-card-title">Live Session</span>
                  {/* AI engine status badge — mirrors db-ai-status */}
                  {isConnected && (
                    <span
                      className="pt-phase-badge"
                      style={{
                        background: "var(--color-badge-green-bg)",
                        color: "var(--color-badge-green)",
                      }}
                    >
                      AI Connected
                    </span>
                  )}
                </div>

                {/* Lavender inner card — db-inner-card equivalent */}
                <div className="ms-inner-card">
                  {/* Animated avatar orb */}
                  <div className={`ms-avatar-orb ${orbState}`}>
                    {meta.emoji}
                  </div>

                  {/* Question text */}
                  <h2 className="ms-question-text-display">
                    {currentQuestionText || "Preparing your interview..."}
                  </h2>

                  {/* Status pill */}
                  <div className={`pt-status-strip ${statusState}`}>
                    <div className="pt-status-dot" />
                    <span>{status}</span>
                  </div>

                  {/* Error pill */}
                  {error && <div className="ms-error-text">{error}</div>}

                  {/* Evaluating state — lavender tint strip */}
                  {isEvaluating && (
                    <div className="ms-evaluating-strip">
                      <div className="ms-evaluating-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                      Evaluating your answer…
                    </div>
                  )}

                  {/* Primary mic CTA — full-width, mirrors db-btn-primary */}
                  {!isSessionComplete && (
                    <button
                      onClick={toggleMic}
                      disabled={!isConnected || isPlayingAudio || isEvaluating}
                      className={`ms-unmute-btn ${isRecording ? "recording" : ""}`}
                      id="btn-toggle-mic"
                    >
                      {isRecording
                        ? "⏹ Finish Answering"
                        : isEvaluating
                          ? "⏳ Evaluating…"
                          : "🎙 Unmute to Answer"}
                    </button>
                  )}

                  {/* Session complete CTA */}
                  {isSessionComplete && (
                    <button
                      className="pt-btn pt-btn-primary"
                      id="btn-session-complete"
                      onClick={() => {
                        if (setNumber === 3) {
                          navigate("/post-test", { state: { voice } });
                        } else {
                          navigate("/dashboard");
                        }
                      }}
                    >
                      {setNumber === 3
                        ? "🎓 Start Graduation Challenge"
                        : "Return to Dashboard"}
                    </button>
                  )}

                  {/* Mic volume visualizer */}
                  {isRecording && (
                    <div className="ms-volume-visualizer-container">
                      <div className="pt-progress-bar-track">
                        <div
                          className="pt-progress-bar-fill"
                          style={{ width: `${volume}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Participant strip — bottom of left column */}
              <div className="ms-participants-row">
                {/* Candidate card */}
                <div className="ms-card ms-participant-card">
                  <div className="ms-participant-content">
                    <div className="ms-participant-avatar" />
                    <span className="ms-participant-name">You (Candidate)</span>
                  </div>
                </div>

                {/* Empty seat */}
                <div className="ms-card ms-participant-card ms-participant-empty">
                  <div className="ms-participant-content">
                    <span className="ms-participant-name">Empty Seat</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column ── */}
            <div className="ms-right-column">
              {/* Live Transcript Panel */}
              <div className="ms-card ms-transcript-card">
                <div className="ms-card-header">
                  <div className="pt-card-icon accent">💬</div>
                  <span className="pt-card-title">Live Transcript</span>
                </div>
                <div className="ms-card-body ms-transcript-body">
                  {!finalTranscript && !partialTranscript ? (
                    <div className="pt-transcript-empty">
                      Transcripts will appear here…
                    </div>
                  ) : (
                    <>
                      <span className="pt-transcript-final">
                        {finalTranscript}
                      </span>
                      {partialTranscript && (
                        <span className="pt-transcript-partial">
                          {" "}
                          {partialTranscript}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* AI Coach Feedback Panel */}
              <div className="ms-card ms-coach-card">
                <div className="ms-card-header">
                  <div className="ms-card-icon-coach">💡</div>
                  <span className="ms-card-title-coach">AI Coach Feedback</span>
                </div>
                <div className="ms-card-body ms-coach-body">
                  <p className="ms-coach-feedback-text">{coachTip}</p>

                  {/* Score cards — inner-card pattern, one per dimension */}
                  {scores && (
                    <div className="ms-scores-container">
                      {Object.entries(scores).map(([name, score]) => (
                        <div key={name} className="ms-score-card">
                          <div className="ms-score-label">
                            {name.replace(/_/g, " ")}
                          </div>
                          <div className="ms-score-value">{score}/10</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
}

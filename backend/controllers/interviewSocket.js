// backend/controllers/interviewSocket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket traffic controller — Phase 1: STT & TTS Core Integration
//
// Blueprint ref: system-blueprint.md § 7 Modular Backend Structure
//   "controllers/interviewSocket.js: WebSocket traffic controller linking
//    the services together."
//
// Flow implemented (Phase 1):
//   1. Browser connects → server sends the first interview question via TTS
//   2. Browser streams binary audio → sttService → Deepgram → transcript
//      echoed back to browser in real-time
//   3. Browser sends { type: "submit_answer" } → server plays next question
//      via TTS (Phase 2/3 AI evaluation plugged in here later)
//   4. KeepAlive runs every 2 s while STT is active
//
// Message protocol (JSON, browser ↔ server):
//   Browser → Server:
//     Binary frame                    — raw audio chunk from MediaRecorder
//     { type: "start_recording" }     — user opened the mic
//     { type: "stop_recording" }      — user released the mic
//     { type: "submit_answer" }       — user confirmed the transcript (Phase 2)
//
//   Server → Browser:
//     { type: "transcript", text, isFinal }   — live STT result
//     { type: "tts_audio", data: <base64> }   — MP3 bytes for playback
//     { type: "status", message }             — informational updates
//     { type: "error", message }              — error notifications
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");
const { synthesizeSpeech } = require("../services/ttsService");
const { evaluate3CScores } = require("../services/aiEvaluator");
const PreTestSession = require("../models/PreTestSession");
const User = require("../models/User");

/**
 * Splits a text block into separate sentences.
 * Matches any sequence of characters ending with .!? or the end of the text.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== "string") return [];
  const regex = /[^.!?]+(?:[.!?]+|$)/g;
  const matches = text.match(regex);
  if (!matches) return [text];
  return matches.map(s => s.trim()).filter(Boolean);
}

/**
 * Averages 3C scores across all evaluated answers and returns
 * the dimension with the lowest average as the session weakness tag,
 * along with the overall percentage score (0-100%).
 * @param {{ clarity_score: number, correctness_score: number, completeness_score: number }[]} scores
 * @returns {{ weakness_tag: string, percentage: number }}
 */
function computeFinalScores(scores) {
  if (!scores || scores.length === 0) return { weakness_tag: "focus_completeness", percentage: 0 };
  const n = scores.length;
  
  let totalPoints = 0;
  const maxPossiblePoints = n * 30; // 3 dimensions * max 10 pts * N questions

  const sum = { clarity: 0, correctness: 0, completeness: 0 };
  scores.forEach(s => {
    sum.clarity += (s.clarity_score || 0);
    sum.correctness += (s.correctness_score || 0);
    sum.completeness += (s.completeness_score || 0);
    totalPoints += (s.clarity_score || 0) + (s.correctness_score || 0) + (s.completeness_score || 0);
  });

  const avg = {
    clarity:      sum.clarity / n,
    correctness:  sum.correctness / n,
    completeness: sum.completeness / n,
  };

  const percentage = Math.round((totalPoints / maxPossiblePoints) * 100);

  console.log(
    `[AI] 📊 Avg 3C — Clarity: ${avg.clarity.toFixed(2)} | Correctness: ${avg.correctness.toFixed(2)} | Completeness: ${avg.completeness.toFixed(2)} | Overall: ${percentage}%`
  );
  
  const min = Math.min(avg.clarity, avg.correctness, avg.completeness);
  let weakness_tag = "focus_correctness";
  if (min === avg.completeness) weakness_tag = "focus_completeness";
  if (min === avg.clarity)      weakness_tag = "focus_clarity";

  return { weakness_tag, percentage };
}

// Pre-Test questions (blueprint § 3)
const PRE_TEST_QUESTIONS = [
  "Tell me about yourself and your journey in the field of Information Technology so far.",
  "How do you stay updated with the latest trends and rapidly changing technologies in the IT industry?",
  "Describe a time you encountered a difficult technical bug or project hurdle. How did you troubleshoot it?",
  "A team member disagrees with your technical approach to a project. How do you handle this conflict?",
  "Why do you believe you are a strong candidate for a role in this industry, and what is your greatest technical strength?",
];

/**
 * handleInterviewSocket(ws)
 *
 * Called for every new WebSocket connection. Manages the full lifecycle:
 * STT session, keepalive timer, TTS playback, and question progression.
 *
 * @param {import("ws").WebSocket} ws
 * @param {import("http").IncomingMessage} request
 */
function handleInterviewSocket(ws, request) {
  console.log("[WS] 🔌 New interview session connected");

  // Parse requested voice and uid from the URL query string
  const url = new URL(request.url, `http://${request.headers.host}`);
  const voiceModel = url.searchParams.get("voice") || "aura-2-luna-en";
  const firebaseUid = url.searchParams.get("uid") || "anonymous_user";
  const isResetRequested = url.searchParams.get("reset") === "true";

  // ── Session state ─────────────────────────────────────────────────────────
  const sessionId = `pts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`; // unique per WS connection
  let sttSession = null; // Deepgram live connection
  let keepAliveTimer = null; // 2 s keepalive interval
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = ""; // accumulates the current answer
  let preGeneratedNextQuestionAudio = null; // pre-synthesized audio for the next question
  let preGeneratedNextQuestionIndex = -1;  // tracking the question index of pre-generated audio
  let sessionDifficulty = "easy";
  const sessionScores = [];        // accumulates { questionIndex, clarity_score, … } per answer
  const evaluationPromises = [];   // tracks all background AI evaluation promises

  // Performance metrics tracking
  const metrics = {
    ttsLatencies: [],         // in ms
    evaluationLatencies: [],  // in ms
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Send a JSON control message to the browser. */
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  /** Speak a question via TTS and send the MP3 back over the WebSocket. */
  async function speakQuestion(text, label = "TTS") {
    if (ws.readyState !== ws.OPEN) return;
    try {
      send({ type: "status", message: "Generating question audio…" });
      const t0 = Date.now();
      const audioBuffer = await synthesizeSpeech(text, voiceModel);
      if (ws.readyState !== ws.OPEN) return;
      const latency = Date.now() - t0;
      metrics.ttsLatencies.push(latency);
      const base64Audio = audioBuffer.toString("base64");
      send({ type: "tts_audio", data: base64Audio });
      console.log(
        `[TTS] 🔊 Sent audio to user in ${(latency / 1000).toFixed(2)}s — "${text.substring(0, 50)}…"`,
      );
    } catch (err) {
      if (ws.readyState !== ws.OPEN) return;
      console.error("[WS] TTS error:", err.message);
      send({ type: "error", message: `TTS failed: ${err.message}` });
    }
  }



  /** Start the 2 s Deepgram keepalive (blueprint §1). */
  function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(() => {
      if (sttSession) sttSession.keepAlive();
    }, 2000);
  }

  /** Stop the keepalive timer. */
  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  /** Open a fresh Deepgram STT session for the current answer. */
  function openSttSession() {
    fullTranscript = "";

    sttSession = createDeepgramLiveSession(
      // onTranscript
      (transcript, isFinal) => {
        if (transcript || isFinal) {
          // Echo back to the browser for real-time display
          send({ type: "transcript", text: transcript, isFinal });

          if (isFinal && transcript) {
            // Accumulate final segments
            fullTranscript = fullTranscript
              ? `${fullTranscript} ${transcript}`
              : transcript;
          }
        }
      },
      // onError
      (err) => {
        const errMsg = err?.message || String(err) || "Unknown STT error";
        send({ type: "error", message: `STT error: ${errMsg}` });
        stopKeepAlive();
        sttSession = null;
      },
    );

    startKeepAlive();
    isRecording = true;
  }

  /** Close the active STT session. */
  function closeSttSession() {
    stopKeepAlive();
    if (sttSession) {
      sttSession.finish();
      sttSession = null;
    }
    isRecording = false;
  }

  // ── Session startup ───────────────────────────────────────────────────────
  (async () => {
    try {
      // Notify client that session is starting
      send({ type: "status", message: "Session started. Preparing your first question…" });

      // Fetch user difficulty; non‑critical, log errors only
      try {
        const user = await User.findOne({ firebaseUid });
        if (user?.difficulty) {
          sessionDifficulty = user.difficulty;
        }
      } catch (err) {
        console.error("[WS] Failed to fetch user difficulty:", err.message);
      }

      // Check for an active, incomplete pre-test session
      let activeSession = null;
      try {
        if (!isResetRequested) {
          activeSession = await PreTestSession.findOne({ firebaseUid, completedAt: null });
        }
      } catch (err) {
        console.error("[WS] Failed to check for active pre-test session:", err.message);
      }

      if (activeSession) {
        console.log(`[WS] 🔄 Active session found for user: ${firebaseUid}. Resuming session ID: ${activeSession.sessionId} as new session ID: ${sessionId}`);
        try {
          await PreTestSession.findOneAndUpdate(
            { firebaseUid, completedAt: null },
            { sessionId }
          );

          currentQuestionIndex = activeSession.answers.length;
          activeSession.answers.forEach(ans => {
            sessionScores.push({
              questionIndex: ans.questionIndex,
              clarity_score: ans.clarity_score,
              correctness_score: ans.correctness_score,
              completeness_score: ans.completeness_score,
              primary_weakness: ans.primary_weakness,
            });
          });

          console.log(`[WS] Resumed session at question index: ${currentQuestionIndex}`);
          send({ type: "session_resumed", currentQuestionIndex });
        } catch (err) {
          console.error(`[DB] ❌ Failed to update resumed session document:`, err.message);
        }
      } else {
        // Initialise or reset the pre‑test session document in MongoDB
        try {
          await PreTestSession.findOneAndUpdate(
            { firebaseUid },
            {
              sessionId,
              answers: [],
              final_weakness_tag: null,
              baseline_score_percentage: null,
              completedAt: null,
              createdAt: new Date(),
            },
            { upsert: true, returnDocument: "after" }
          );
          console.log(`[DB] ✅ Pre-test session initialized/reset: ${sessionId} for user: ${firebaseUid}`);
        } catch (err) {
          console.error(`[DB] ❌ Failed to initialize/reset session document:`, err.message);
        }
      }

      // Play the first question
      await speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex]);
      send({ type: "status", message: "Question ready. Press the mic button to begin your answer." });
    } catch (fatalErr) {
      console.error("[WS] Fatal session startup error:", fatalErr);
      send({ type: "error", message: `Failed to start session: ${fatalErr.message}` });
      ws.close();
    }
  })();

  // ── Incoming message handler ──────────────────────────────────────────────
  ws.on("message", (data, isBinary) => {
    // ── Binary frame → raw audio chunk ────────────────────────────────────
    if (isBinary) {
      if (sttSession && isRecording) {
        sttSession.sendAudio(data);
      }
      return;
    }

    // ── JSON control message ──────────────────────────────────────────────
    let msg;
    try {
      msg = JSON.parse(data.toString());
      if (!msg || typeof msg !== "object") {
        console.warn("[WS] Received non-object JSON frame, ignoring.");
        return;
      }
    } catch {
      console.warn("[WS] Received non-JSON text frame, ignoring.");
      return;
    }

    console.log(`[WS] ← ${msg.type}`);

    switch (msg.type) {
      // User opened the mic
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening…" });

          // ── Early pre-generate next-question TTS (fire-and-forget) ──────
          const nextIndex = currentQuestionIndex + 1;
          if (ws.readyState === ws.OPEN && nextIndex < PRE_TEST_QUESTIONS.length) {
            // Only trigger if not already pre-generating or pre-generated for this index
            if (preGeneratedNextQuestionIndex !== nextIndex) {
              console.log(`[TTS] 🚀 Early triggering background next-question synthesis for Q${nextIndex + 1}...`);
              preGeneratedNextQuestionIndex = nextIndex;
              preGeneratedNextQuestionAudio = null;
              
              synthesizeSpeech(PRE_TEST_QUESTIONS[nextIndex], voiceModel)
                .then((audioBuffer) => {
                  if (ws.readyState === ws.OPEN && preGeneratedNextQuestionIndex === nextIndex) {
                    preGeneratedNextQuestionAudio = audioBuffer;
                    console.log(`[TTS] ✅ Early background Q${nextIndex + 1} audio ready.`);
                  }
                })
                .catch((err) => {
                  if (preGeneratedNextQuestionIndex === nextIndex) {
                    preGeneratedNextQuestionAudio = null;
                    preGeneratedNextQuestionIndex = -1;
                  }
                  console.error(`[TTS] ❌ Early background TTS pre-generation failed:`, err.message);
                });
            }
          }
        }
        break;

      // User released the mic (but has NOT confirmed yet — Phase 2)
      case "stop_recording":
        closeSttSession();
        send({
          type: "status",
          message:
            "Recording stopped. Review your answer, then confirm to continue.",
        });
        break;

      // User confirmed the transcript → evaluate with AI, speak feedback, then advance
      case "submit_answer": {
        const confirmedText = msg.final_text || fullTranscript;
        const answeredQuestion = PRE_TEST_QUESTIONS[currentQuestionIndex];
        const questionNumber = currentQuestionIndex + 1;
        console.log(
          `[WS] Answer confirmed for Q${questionNumber}: "${confirmedText.substring(0, 80)}…"`,
        );

        // ── Background 3C Evaluation (fire-and-forget) ───────────────────
        // Runs silently while the user moves to the next question.
        // The promise is tracked so we can await it before session_complete.
        const capturedIndex = currentQuestionIndex; // freeze before next_question mutates it
        const evalPromise = (async () => {
          try {
            console.log(`[AI] 🔄 Background 3C evaluation started for Q${questionNumber}...`);
            const tEval0 = Date.now();
            const scores = await evaluate3CScores(answeredQuestion, confirmedText, sessionDifficulty);
            const evalDuration = Date.now() - tEval0;
            metrics.evaluationLatencies.push(evalDuration);

            sessionScores.push({ questionIndex: capturedIndex, ...scores });
            console.log(
              `[AI] ✅ Q${questionNumber} (Evaluated in ${(evalDuration / 1000).toFixed(2)}s) — Clarity: ${scores.clarity_score} | Correctness: ${scores.correctness_score} | Completeness: ${scores.completeness_score} | Tag: ${scores.primary_weakness}`
            );
            // Persist this answer's scores to MongoDB
            await PreTestSession.findOneAndUpdate(
              { sessionId },
              {
                $push: {
                  answers: {
                    questionIndex: capturedIndex,
                    question: answeredQuestion,
                    transcript: confirmedText,
                    ...scores,
                    evaluatedAt: new Date(),
                  },
                },
              }
            );
            console.log(`[DB] ✅ Scores persisted for Q${questionNumber}`);
          } catch (err) {
            console.error(`[AI] ❌ Background evaluation failed for Q${questionNumber}:`, err.message);
            // Push a neutral fallback so the final average is not skewed
            sessionScores.push({ questionIndex: capturedIndex, clarity_score: 6, correctness_score: 6, completeness_score: 6, primary_weakness: "focus_completeness" });
            metrics.evaluationLatencies.push(0);
          }
        })();
        evaluationPromises.push(evalPromise);

        // ── Pre-generate next-question TTS (fire-and-forget) ──────────────
        const nextIndex = currentQuestionIndex + 1;
        if (ws.readyState === ws.OPEN && nextIndex < PRE_TEST_QUESTIONS.length) {
          // Only trigger if not already pre-generating or pre-generated (e.g. from start_recording)
          if (preGeneratedNextQuestionIndex !== nextIndex) {
            console.log(`[TTS] 🚀 Triggering background next-question synthesis for Q${nextIndex + 1}...`);
            preGeneratedNextQuestionIndex = nextIndex;
            preGeneratedNextQuestionAudio = null; // Reset to avoid using stale buffers
            
            synthesizeSpeech(PRE_TEST_QUESTIONS[nextIndex], voiceModel)
              .then((audioBuffer) => {
                // Ensure we only save it if the user hasn't already advanced past this question
                if (ws.readyState === ws.OPEN && preGeneratedNextQuestionIndex === nextIndex) {
                  preGeneratedNextQuestionAudio = audioBuffer;
                  console.log(`[TTS] ✅ Background Q${nextIndex + 1} audio ready.`);
                } else {
                  console.log(`[TTS] ⚠️ Background Q${nextIndex + 1} audio ready, but discarded (user already advanced or disconnected).`);
                }
              })
              .catch((err) => {
                if (preGeneratedNextQuestionIndex === nextIndex) {
                  preGeneratedNextQuestionAudio = null;
                  preGeneratedNextQuestionIndex = -1;
                }
                console.error(`[TTS] ❌ Background TTS pre-generation failed:`, err.message);
              });
          }
        } else {
          preGeneratedNextQuestionAudio = null;
          preGeneratedNextQuestionIndex = -1;
        }

        // Notify client immediately — no blocking wait
        send({ type: "feedback_complete" });

        break;
      }

      // Client requested the next question (transition triggered by UI button click)
      case "next_question": {
        (async () => {
          try {
            currentQuestionIndex++;
            const hasNext = currentQuestionIndex < PRE_TEST_QUESTIONS.length;

            if (hasNext) {
              fullTranscript = "";
              send({
                type: "status",
                message: `Moving to question ${currentQuestionIndex + 1}…`,
              });

              // Send pre-generated question audio immediately if ready and matching the index, otherwise fallback
              if (preGeneratedNextQuestionAudio && preGeneratedNextQuestionIndex === currentQuestionIndex) {
                const base64Audio = preGeneratedNextQuestionAudio.toString("base64");
                send({ type: "tts_audio", data: base64Audio });
                console.log(
                  `[TTS] 🔊 Sent pre-generated question audio to user — "${PRE_TEST_QUESTIONS[currentQuestionIndex].substring(0, 50)}…"`,
                );
                metrics.ttsLatencies.push(0); // 0ms latency since it was pre-cached!
                preGeneratedNextQuestionAudio = null; // Reset
                preGeneratedNextQuestionIndex = -1;
              } else {
                console.warn(`[TTS] ⚠️ Pre-generated TTS was missing, stale, or still synthesizing. Falling back to sequential synthesis.`);
                preGeneratedNextQuestionAudio = null; // Reset
                preGeneratedNextQuestionIndex = -1;
                await speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex], `Q${currentQuestionIndex + 1}/Question`);
              }
            } else {
              // ── All 5 questions answered — finalise session ───────────────
              send({ type: "status", message: "Finalising your Pre-Test results…" });

              // Wait for any still-running AI evaluations before computing the final scores
              await Promise.allSettled(evaluationPromises);

              const { weakness_tag, percentage } = computeFinalScores(sessionScores);
              console.log(`[Session] 🏁 Pre-test complete. Weakness: ${weakness_tag} | Baseline: ${percentage}%`);

              // Persist final result to MongoDB
              try {
                await PreTestSession.findOneAndUpdate(
                  { sessionId },
                  { 
                    final_weakness_tag: weakness_tag,
                    baseline_score_percentage: percentage,
                    completedAt: new Date() 
                  }
                );
                console.log(`[DB] ✅ Session finalised — ${sessionId}`);
              } catch (err) {
                console.error(`[DB] ❌ Failed to finalise session:`, err.message);
              }

              // ── Print Session Performance Metrics ────────────────────────
              const totalTtsLatency = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
              const totalEvalLatency = metrics.evaluationLatencies.reduce((a, b) => a + b, 0);
              const systemLatency = totalTtsLatency + totalEvalLatency;

              console.log(`\n==================================================`);
              console.log(`📊 PRE-TEST PERFORMANCE METRICS`);
              console.log(`Session ID: ${sessionId}`);
              console.log(`--------------------------------------------------`);
              metrics.ttsLatencies.forEach((lat, idx) => {
                console.log(`  Q${idx + 1} TTS Delivery Latency : ${(lat / 1000).toFixed(2)}s ${lat === 0 ? '(Cached/Instant)' : ''}`);
              });
              console.log(`--------------------------------------------------`);
              metrics.evaluationLatencies.forEach((lat, idx) => {
                console.log(`  Q${idx + 1} AI Evaluation Latency: ${(lat / 1000).toFixed(2)}s`);
              });
              console.log(`--------------------------------------------------`);
              console.log(`  Total TTS Latency        : ${(totalTtsLatency / 1000).toFixed(2)}s`);
              console.log(`  Total AI Eval Latency    : ${(totalEvalLatency / 1000).toFixed(2)}s`);
              console.log(`  Overall System Latency   : ${(systemLatency / 1000).toFixed(2)}s (excl. user response time)`);
              console.log(`==================================================\n`);

              send({ type: "status", message: "All questions answered! Pre-test complete." });
              send({ type: "session_complete", weakness_tag, baseline_score: percentage });
            }
          } catch (err) {
            console.error("[WS] Error during next_question progression:", err);
            send({ type: "error", message: `Question transition failed: ${err?.message || err}` });
          }
        })();
        break;
      }

      default:
        console.warn(`[WS] Unknown message type: ${msg.type}`);
    }
  });

  // ── Connection close ──────────────────────────────────────────────────────
  ws.on("close", () => {
    console.log("[WS] 🔌 Client disconnected — cleaning up session");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS] ❌ WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handleInterviewSocket };

// backend/controllers/postTestSocket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket controller for the Post-Test "Graduation Challenge"
//
// This is a near-mirror of interviewSocket.js (Pre-Test), reusing the same
// 5 diagnostic questions so we can do a true pre-vs-post comparison.
// Scores are persisted to PostTestSession instead of PreTestSession.
//
// Route:  ws://localhost:5000/ws/posttest
//
// Message protocol (JSON, browser ↔ server):
//   Browser → Server:
//     Binary frame                    — raw audio chunk from MediaRecorder
//     { type: "start_recording" }     — user opened the mic
//     { type: "stop_recording" }      — user released the mic
//     { type: "submit_answer" }       — user confirmed the transcript
//     { type: "next_question" }       — client requests next question
//
//   Server → Browser:
//     { type: "transcript", text, isFinal }   — live STT result
//     { type: "tts_audio", data: <base64> }   — MP3 bytes for playback
//     { type: "status", message }             — informational updates
//     { type: "error", message }              — error notifications
//     { type: "feedback_complete" }           — answer recorded, ready to continue
//     { type: "session_complete" }            — all 5 questions done
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");
const { synthesizeSpeech } = require("../services/ttsService");
const { evaluate3CScores } = require("../services/aiEvaluator");
const PostTestSession = require("../models/PostTestSession");
const PreTestSession = require("../models/PreTestSession");
const User = require("../models/User");

/**
 * Averages 3C scores across all evaluated answers and returns
 * the dimension with the lowest average as the session weakness tag,
 * along with the overall percentage score (0-100%).
 */
function computeFinalScores(scores) {
  if (!scores || scores.length === 0) return { weakness_tag: "focus_completeness", percentage: 0 };
  const n = scores.length;

  let totalPoints = 0;
  const maxPossiblePoints = n * 30; // 3 dimensions * max 10 pts * N questions

  const sum = { clarity: 0, correctness: 0, completeness: 0 };
  scores.forEach((s) => {
    sum.clarity      += (s.clarity_score || 0);
    sum.correctness  += (s.correctness_score || 0);
    sum.completeness += (s.completeness_score || 0);
    totalPoints      += (s.clarity_score || 0) + (s.correctness_score || 0) + (s.completeness_score || 0);
  });

  const avg = {
    clarity:      sum.clarity / n,
    correctness:  sum.correctness / n,
    completeness: sum.completeness / n,
  };

  const percentage = Math.round((totalPoints / maxPossiblePoints) * 100);

  console.log(
    `[AI/Post] 📊 Avg 3C — Clarity: ${avg.clarity.toFixed(2)} | Correctness: ${avg.correctness.toFixed(2)} | Completeness: ${avg.completeness.toFixed(2)} | Overall: ${percentage}%`
  );

  const min = Math.min(avg.clarity, avg.correctness, avg.completeness);
  let weakness_tag = "focus_correctness";
  if (min === avg.completeness) weakness_tag = "focus_completeness";
  if (min === avg.clarity)      weakness_tag = "focus_clarity";

  return { weakness_tag, percentage };
}

// Same 5 diagnostic questions as the Pre-Test (blueprint § 3)
// This is intentional — identical questions allow true growth measurement.
const POST_TEST_QUESTIONS = [
  "Tell me about yourself and your journey in the field of Information Technology so far.",
  "How do you stay updated with the latest trends and rapidly changing technologies in the IT industry?",
  "Describe a time you encountered a difficult technical bug or project hurdle. How did you troubleshoot it?",
  "A team member disagrees with your technical approach to a project. How do you handle this conflict?",
  "Why do you believe you are a strong candidate for a role in this industry, and what is your greatest technical strength?",
];

/**
 * handlePostTestSocket(ws, request)
 *
 * Called for every new WebSocket connection on /ws/posttest.
 * Manages the full lifecycle: STT session, keepalive, TTS playback,
 * question progression, AI scoring, and final DB persistence.
 */
function handlePostTestSocket(ws, request) {
  console.log("[WS/Post] 🔌 New post-test session connected");

  const url = new URL(request.url, `http://${request.headers.host}`);
  const voiceModel = url.searchParams.get("voice") || "aura-2-luna-en";
  const firebaseUid = url.searchParams.get("uid") || "anonymous_user";

  // ── Session state ────────────────────────────────────────────────────────
  const sessionId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let sttSession = null;
  let keepAliveTimer = null;
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = "";
  let preGeneratedNextQuestionAudio = null;
  let preGeneratedNextQuestionIndex = -1;
  const sessionScores = [];
  const evaluationPromises = [];

  const metrics = {
    ttsLatencies: [],
    evaluationLatencies: [],
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  async function speakQuestion(text) {
    try {
      send({ type: "status", message: "Generating question audio…" });
      const t0 = Date.now();
      const audioBuffer = await synthesizeSpeech(text, voiceModel);
      const latency = Date.now() - t0;
      metrics.ttsLatencies.push(latency);
      const base64Audio = audioBuffer.toString("base64");
      send({ type: "tts_audio", data: base64Audio });
      console.log(
        `[TTS/Post] 🔊 Sent audio in ${(latency / 1000).toFixed(2)}s — "${text.substring(0, 50)}…"`
      );
    } catch (err) {
      console.error("[WS/Post] TTS error:", err.message);
      send({ type: "error", message: `TTS failed: ${err.message}` });
    }
  }

  function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(() => {
      if (sttSession) sttSession.keepAlive();
    }, 2000);
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  function openSttSession() {
    fullTranscript = "";

    sttSession = createDeepgramLiveSession(
      (transcript, isFinal) => {
        if (transcript) {
          send({ type: "transcript", text: transcript, isFinal });
          if (isFinal) {
            fullTranscript = fullTranscript
              ? `${fullTranscript} ${transcript}`
              : transcript;
          }
        }
      },
      (err) => {
        send({ type: "error", message: `STT error: ${err.message}` });
        stopKeepAlive();
        sttSession = null;
      }
    );

    startKeepAlive();
    isRecording = true;
  }

  function closeSttSession() {
    stopKeepAlive();
    if (sttSession) {
      sttSession.finish();
      sttSession = null;
    }
    isRecording = false;
  }

  // ── Session startup ──────────────────────────────────────────────────────
  (async () => {
    send({ type: "status", message: "Graduation Challenge started. Preparing your first question…" });

    // Initialize / reset post-test session document in MongoDB
    try {
      await PostTestSession.findOneAndUpdate(
        { firebaseUid },
        {
          sessionId,
          answers: [],
          final_weakness_tag: null,
          final_score_percentage: null,
          completedAt: null,
          createdAt: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      );
      console.log(`[DB/Post] ✅ Post-test session initialized: ${sessionId} for user: ${firebaseUid}`);
    } catch (err) {
      console.error(`[DB/Post] ❌ Failed to initialize session:`, err.message);
    }

    await speakQuestion(POST_TEST_QUESTIONS[currentQuestionIndex]);
    send({ type: "status", message: "Question ready. Press the mic button to begin your answer." });
  })();

  // ── Incoming message handler ─────────────────────────────────────────────
  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      if (sttSession && isRecording) {
        sttSession.sendAudio(data);
      }
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn("[WS/Post] Received non-JSON text frame, ignoring.");
      return;
    }

    console.log(`[WS/Post] ← ${msg.type}`);

    switch (msg.type) {
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening…" });

          // Early pre-generate next question TTS
          const nextIdx = currentQuestionIndex + 1;
          if (nextIdx < POST_TEST_QUESTIONS.length && preGeneratedNextQuestionIndex !== nextIdx) {
            preGeneratedNextQuestionIndex = nextIdx;
            preGeneratedNextQuestionAudio = null;
            synthesizeSpeech(POST_TEST_QUESTIONS[nextIdx], voiceModel)
              .then((buf) => {
                if (preGeneratedNextQuestionIndex === nextIdx) {
                  preGeneratedNextQuestionAudio = buf;
                  console.log(`[TTS/Post] ✅ Early background Q${nextIdx + 1} audio ready.`);
                }
              })
              .catch((err) => {
                if (preGeneratedNextQuestionIndex === nextIdx) {
                  preGeneratedNextQuestionAudio = null;
                  preGeneratedNextQuestionIndex = -1;
                }
                console.error(`[TTS/Post] ❌ Background pre-gen failed:`, err.message);
              });
          }
        }
        break;

      case "stop_recording":
        closeSttSession();
        send({ type: "status", message: "Recording stopped. Review your answer, then confirm to continue." });
        break;

      case "submit_answer": {
        const confirmedText = msg.final_text || fullTranscript;
        const answeredQuestion = POST_TEST_QUESTIONS[currentQuestionIndex];
        const questionNumber = currentQuestionIndex + 1;
        console.log(`[WS/Post] Answer confirmed for Q${questionNumber}: "${confirmedText.substring(0, 80)}…"`);

        const capturedIndex = currentQuestionIndex;
        const evalPromise = (async () => {
          try {
            console.log(`[AI/Post] 🔄 Background 3C evaluation started for Q${questionNumber}...`);
            const tEval0 = Date.now();
            const scores = await evaluate3CScores(answeredQuestion, confirmedText);
            const evalDuration = Date.now() - tEval0;
            metrics.evaluationLatencies.push(evalDuration);

            sessionScores.push({ questionIndex: capturedIndex, ...scores });
            console.log(
              `[AI/Post] ✅ Q${questionNumber} (${(evalDuration / 1000).toFixed(2)}s) — Clarity: ${scores.clarity_score} | Correctness: ${scores.correctness_score} | Completeness: ${scores.completeness_score}`
            );

            await PostTestSession.findOneAndUpdate(
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
            console.log(`[DB/Post] ✅ Scores persisted for Q${questionNumber}`);
          } catch (err) {
            console.error(`[AI/Post] ❌ Background evaluation failed for Q${questionNumber}:`, err.message);
            sessionScores.push({
              questionIndex: capturedIndex,
              clarity_score: 6, correctness_score: 6, completeness_score: 6,
              primary_weakness: "focus_completeness",
            });
            metrics.evaluationLatencies.push(0);
          }
        })();
        evaluationPromises.push(evalPromise);

        // Pre-generate next question TTS
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < POST_TEST_QUESTIONS.length) {
          if (preGeneratedNextQuestionIndex !== nextIndex) {
            preGeneratedNextQuestionIndex = nextIndex;
            preGeneratedNextQuestionAudio = null;
            synthesizeSpeech(POST_TEST_QUESTIONS[nextIndex], voiceModel)
              .then((buf) => {
                if (preGeneratedNextQuestionIndex === nextIndex) {
                  preGeneratedNextQuestionAudio = buf;
                  console.log(`[TTS/Post] ✅ Background Q${nextIndex + 1} audio ready.`);
                }
              })
              .catch((err) => {
                if (preGeneratedNextQuestionIndex === nextIndex) {
                  preGeneratedNextQuestionAudio = null;
                  preGeneratedNextQuestionIndex = -1;
                }
                console.error(`[TTS/Post] ❌ Background TTS pre-gen failed:`, err.message);
              });
          }
        } else {
          preGeneratedNextQuestionAudio = null;
          preGeneratedNextQuestionIndex = -1;
        }

        send({ type: "feedback_complete" });
        break;
      }

      case "next_question": {
        (async () => {
          currentQuestionIndex++;
          const hasNext = currentQuestionIndex < POST_TEST_QUESTIONS.length;

          if (hasNext) {
            fullTranscript = "";
            send({ type: "status", message: `Moving to question ${currentQuestionIndex + 1}…` });

            if (
              preGeneratedNextQuestionAudio &&
              preGeneratedNextQuestionIndex === currentQuestionIndex
            ) {
              const base64Audio = preGeneratedNextQuestionAudio.toString("base64");
              send({ type: "tts_audio", data: base64Audio });
              console.log(`[TTS/Post] 🔊 Sent pre-generated Q${currentQuestionIndex + 1} audio (cached).`);
              metrics.ttsLatencies.push(0);
              preGeneratedNextQuestionAudio = null;
              preGeneratedNextQuestionIndex = -1;
            } else {
              console.warn(`[TTS/Post] ⚠️ Pre-generated TTS missing. Falling back to synthesis.`);
              preGeneratedNextQuestionAudio = null;
              preGeneratedNextQuestionIndex = -1;
              await speakQuestion(POST_TEST_QUESTIONS[currentQuestionIndex]);
            }
          } else {
            // ── All 5 questions done — finalise session ────────────────────
            send({ type: "status", message: "Finalising your Graduation Challenge results…" });

            await Promise.allSettled(evaluationPromises);

            const { weakness_tag, percentage } = computeFinalScores(sessionScores);
            console.log(
              `[Session/Post] 🎓 Post-test complete. Weakness: ${weakness_tag} | Score: ${percentage}%`
            );
            try {
              await PostTestSession.findOneAndUpdate(
                { sessionId },
                {
                  final_weakness_tag: weakness_tag,
                  final_score_percentage: percentage,
                  completedAt: new Date(),
                }
              );
              console.log(`[DB/Post] ✅ Post-test session finalised — ${sessionId}`);

              // Fetch Pre-Test Baseline to calculate & print comparison logs
              const [preSession, userDoc] = await Promise.all([
                PreTestSession.findOne({ firebaseUid }),
                User.findOne({ firebaseUid }),
              ]);

              const preScore = preSession?.baseline_score_percentage ?? null;
              const preWeakness = preSession?.final_weakness_tag ?? "N/A";
              const preConf = userDoc?.confidenceScore ?? null;

              console.log(`\n==================================================`);
              console.log(`📈 USER GROWTH COMPARISON (PRE VS POST)`);
              console.log(`User UID: ${firebaseUid}`);
              console.log(`--------------------------------------------------`);
              console.log(`Performance Scores:`);
              console.log(`  Pre-Test Score : ${preScore !== null ? `${preScore}%` : "N/A"}`);
              console.log(`  Post-Test Score: ${percentage}%`);
              if (preScore !== null) {
                const diff = percentage - preScore;
                const sign = diff >= 0 ? "+" : "";
                console.log(`  Growth Delta   : ${sign}${diff}% (${diff >= 0 ? "📈 Improvement!" : "📉 Decrease"})`);
              }
              console.log(`--------------------------------------------------`);
              console.log(`Weakness Mitigation:`);
              console.log(`  Pre-Test Primary Weakness : ${preWeakness}`);
              console.log(`  Post-Test Primary Weakness: ${weakness_tag}`);
              console.log(`--------------------------------------------------`);
              console.log(`Confidence Score:`);
              console.log(`  Pre-Test Confidence Score : ${preConf !== null ? `${preConf}/25` : "N/A"}`);
              console.log(`==================================================\n`);

            } catch (err) {
              console.error(`[DB/Post] ❌ Failed to finalise session:`, err.message);
            }

            // Print metrics
            const totalTtsLatency  = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
            const totalEvalLatency = metrics.evaluationLatencies.reduce((a, b) => a + b, 0);
            console.log(`\n==================================================`);
            console.log(`📊 POST-TEST PERFORMANCE METRICS`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`--------------------------------------------------`);
            metrics.ttsLatencies.forEach((lat, i) =>
              console.log(`  Q${i + 1} TTS Delivery Latency : ${(lat / 1000).toFixed(2)}s${lat === 0 ? " (Cached)" : ""}`)
            );
            console.log(`--------------------------------------------------`);
            metrics.evaluationLatencies.forEach((lat, i) =>
              console.log(`  Q${i + 1} AI Evaluation Latency: ${(lat / 1000).toFixed(2)}s`)
            );
            console.log(`--------------------------------------------------`);
            console.log(`  Total TTS Latency     : ${(totalTtsLatency / 1000).toFixed(2)}s`);
            console.log(`  Total AI Eval Latency : ${(totalEvalLatency / 1000).toFixed(2)}s`);
            console.log(`==================================================\n`);

            send({ type: "status", message: "Graduation Challenge complete! Calculating your growth…" });
            send({ type: "session_complete", weakness_tag, final_score: percentage });
          }
        })();
        break;
      }

      default:
        console.warn(`[WS/Post] Unknown message type: ${msg.type}`);
    }
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  ws.on("close", () => {
    console.log("[WS/Post] 🔌 Client disconnected — cleaning up session");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS/Post] ❌ WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handlePostTestSocket };

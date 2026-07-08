// backend/controllers/set2Socket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket traffic controller for Set 2 (Technical Mastery)
//
// Optimized Flow (v2 — Latency Optimization Applied):
//   1. Browser connects → server fetches role & difficulty from User model
//   2. Server generates ALL 5 questions sequentially during loading screen.
//      Q1 TTS synthesis starts concurrently after Q1 is generated.
//   3. Q1 audio is sent instantly when synthesis resolves.
//   4. User presses mic → streams binary audio → Deepgram STT.
//      Background: next-question TTS pre-synthesis fires (fire-and-forget).
//   5. User stops recording → submits answer.
//   6. Server evaluates answer → returns Technical Mastery scores, tip,
//      and a 2-sentence interviewer_reply (no question, no next-topic).
//   7. Server sends coaching tip to frontend.
//   8. Reply is split by sentence → all sentences synthesized concurrently →
//      streamed sequentially to client for instant queue playback.
//   9. Next question audio served from cache (instant) or on-the-fly fallback.
//  10. Repeats for Q2–Q5.
//  11. Session finalised → performance metrics printed → session_complete sent.
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");
const { synthesizeSpeech } = require("../services/ttsService");
const {
  generateSet2Question,
  evaluateSet2Answer,
} = require("../services/aiSet2Generator");
const Set2Session = require("../models/Set2Session");
const User = require("../models/User");

const MAX_QUESTIONS = 5;

/**
 * handleSet2Socket(ws, request)
 * @param {import("ws").WebSocket} ws
 * @param {import("http").IncomingMessage} request
 */
function handleSet2Socket(ws, request) {
  console.log("[WS] 🔌 New Set 2 (Technical Mastery) session connected");

  const url = new URL(request.url, `http://${request.headers.host}`);
  const voiceModel = url.searchParams.get("voice") || "aura-2-luna-en";
  const firebaseUid = url.searchParams.get("uid");

  if (!firebaseUid) {
    ws.send(
      JSON.stringify({ type: "error", message: "Missing uid parameter" }),
    );
    ws.close();
    return;
  }

  // ── Session state ─────────────────────────────────────────────────────────
  const sessionId = `s2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let sttSession = null;
  let keepAliveTimer = null;
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = "";
  let sessionRole = "fullstack";
  let sessionDifficulty = "easy";
  let currentQuestionText = "";
  let sessionDoc = null;

  // ── Pre-fetching & caching (Step 1 & 2) ──────────────────────────────────
  let questions = [];
  let preGeneratedNextQuestionAudio = null;
  let preGeneratedNextQuestionIndex = -1;

  // ── Performance metrics (matching Set 1 pattern) ──────────────────────────
  const startupStart = Date.now();
  const metrics = {
    ttsLatencies: [],         // individual question audio delivery latency
    replyTtsLatencies: [],    // interviewer reply audio synthesis latency
    evaluationLatencies: [],  // AI evaluation latency
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
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
      },
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

  // ── Session startup (Steps 1 & 2 — Upfront Question Generation) ──────────
  (async () => {
    try {
      send({
        type: "status",
        message: "Preparing your technical interview...",
      });

      // 1. Fetch role and difficulty from User
      const user = await User.findOne({ firebaseUid });
      if (user) {
        sessionRole = user.role || "fullstack";
        sessionDifficulty = user.difficulty || "easy";
      }

      // 2. Initialize Set2Session in DB (upsert — one doc per user)
      sessionDoc = await Set2Session.findOneAndUpdate(
        { firebaseUid },
        {
          sessionId,
          role: sessionRole,
          difficulty: sessionDifficulty,
          answers: [],
          avg_problem_solving: null,
          avg_accuracy: null,
          avg_depth: null,
          overall_score_percentage: null,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(
        `[DB] ✅ Set 2 session initialized: ${sessionId} for user: ${firebaseUid}`,
      );

      // 3. Generate ALL 5 questions sequentially.
      //    Start Q1 TTS synthesis as soon as Q1 is ready — runs concurrently
      //    while the LLM generates Q2-5 (cold-start overlap optimization).
      send({
        type: "status",
        message: "Generating your technical questions...",
      });

      const genStart = Date.now();
      let q1SynthesisPromise = null;
      for (let i = 0; i < MAX_QUESTIONS; i++) {
        const q = await generateSet2Question(
          sessionRole,
          sessionDifficulty,
          questions,
        );
        questions.push(q);

        // Fire Q1 TTS concurrently with LLM generation of Q2-5
        if (i === 0) {
          q1SynthesisPromise = synthesizeSpeech(q, voiceModel);
        }
      }
      const totalGenDuration = Date.now() - genStart;
      console.log(`[aiSet2Generator] 🧠 Generated ${questions.length} questions for Set 2 (${sessionRole}, ${sessionDifficulty}) in ${(totalGenDuration / 1000).toFixed(2)}s:`);
      questions.forEach((q, idx) => {
        console.log(`  Q${idx + 1}: "${q}"`);
      });

      currentQuestionText = questions[0];

      // 4. Send question text to frontend
      send({
        type: "question_text",
        text: currentQuestionText,
        index: currentQuestionIndex + 1,
      });

      // 5. Await Q1 audio (should already be resolved or very close)
      const q1AudioBuffer = await q1SynthesisPromise;
      const q1TtsLatency = Date.now() - startupStart;
      metrics.ttsLatencies.push(q1TtsLatency);

      send({ type: "tts_audio", data: q1AudioBuffer.toString("base64") });
      console.log(`[TTS] 🔊 Q1 audio sent in ${(q1TtsLatency / 1000).toFixed(2)}s (total startup)`);

      send({
        type: "status",
        message: "Question ready. Click Unmute to answer.",
      });
    } catch (err) {
      console.error("[WS] Set 2 startup error:", err);
      send({ type: "error", message: "Failed to initialize Set 2." });
    }
  })();

  // ── Incoming message handler ──────────────────────────────────────────────
  ws.on("message", async (data, isBinary) => {
    // Binary frame → raw audio chunk
    if (isBinary) {
      if (sttSession && isRecording) sttSession.sendAudio(data);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      // ── User opened the mic ──────────────────────────────────────────────
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening..." });

          // Step 2 — Background next-question TTS pre-synthesis (fire-and-forget)
          // Triggered on start_recording so synthesis runs during the user's answer.
          const nextIndex = currentQuestionIndex + 1;
          if (nextIndex < MAX_QUESTIONS && preGeneratedNextQuestionIndex !== nextIndex) {
            console.log(`[TTS] 🚀 Early triggering background next-question synthesis for Q${nextIndex + 1}...`);
            preGeneratedNextQuestionIndex = nextIndex;
            preGeneratedNextQuestionAudio = null;

            synthesizeSpeech(questions[nextIndex], voiceModel)
              .then((audioBuffer) => {
                if (preGeneratedNextQuestionIndex === nextIndex) {
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
        break;

      // ── User released the mic ────────────────────────────────────────────
      case "stop_recording":
        closeSttSession();
        send({
          type: "status",
          message:
            "Recording stopped. Review your answer, then confirm to continue.",
        });
        break;

      // ── User confirmed transcript → evaluate, speak feedback, advance ────
      case "submit_answer": {
        const confirmedText = msg.final_text || fullTranscript;
        console.log(`\n--- Set 2 Q${currentQuestionIndex + 1} Processing ---`);
        console.log(`[WS] Transcript: "${confirmedText.substring(0, 80)}..."`);
        send({
          type: "status",
          message: "AI Coach is evaluating your answer...",
        });

        try {
          // 1. Evaluate the answer
          console.time("[Perf] AI Technical Evaluation");
          const evalStart = Date.now();
          const evaluation = await evaluateSet2Answer(
            currentQuestionText,
            confirmedText,
          );
          const evalDuration = Date.now() - evalStart;
          metrics.evaluationLatencies.push(evalDuration);
          console.timeEnd("[Perf] AI Technical Evaluation");
          console.log(
            `[AI] ✅ Technical Mastery Scores — Problem Solving: ${evaluation.problem_solving_score} | Accuracy: ${evaluation.accuracy_score} | Depth: ${evaluation.depth_score}`,
          );

          // 2. Save to DB
          console.time("[Perf] DB Record Save");
          sessionDoc.recordAnswer({
            questionIndex: currentQuestionIndex,
            question: currentQuestionText,
            transcript: confirmedText,
            problem_solving_score: evaluation.problem_solving_score,
            accuracy_score: evaluation.accuracy_score,
            depth_score: evaluation.depth_score,
            tip: evaluation.tip,
          });
          await sessionDoc.save();
          console.timeEnd("[Perf] DB Record Save");

          // 3. Send scores + coaching tip to frontend
          send({
            type: "coach_tip",
            tip: evaluation.tip,
            problem_solving_score: evaluation.problem_solving_score,
            accuracy_score: evaluation.accuracy_score,
            depth_score: evaluation.depth_score,
          });

          currentQuestionIndex++;
          const hasNext = currentQuestionIndex < MAX_QUESTIONS;

          if (hasNext) {
            send({ type: "status", message: "Moving to next question..." });

            // Next question text is already pre-generated
            currentQuestionText = questions[currentQuestionIndex];

            send({
              type: "question_text",
              text: currentQuestionText,
              index: currentQuestionIndex + 1,
            });

            // Step 3 — Sentence-level concurrent reply synthesis
            // Split the interviewer_reply into sentences and synthesize all concurrently.
            // Deliver sequentially so the browser queues them back-to-back.
            console.time("[Perf] Reply TTS Synthesis");
            const replyTtsStart = Date.now();

            const replyText = evaluation.interviewer_reply;
            const replySentences = (replyText.match(/[^.!?]+[.!?]*/g) || [replyText])
              .map((s) => s.trim())
              .filter(Boolean);

            const replyPromises = replySentences.map((sentence) =>
              synthesizeSpeech(sentence, voiceModel)
                .then((buffer) => ({ sentence, buffer }))
                .catch((err) => {
                  console.error(`[TTS] Error synthesizing sentence "${sentence}":`, err.message);
                  return { sentence, buffer: null };
                }),
            );

            for (let i = 0; i < replyPromises.length; i++) {
              const { sentence, buffer } = await replyPromises[i];
              if (buffer) {
                send({ type: "tts_audio", data: buffer.toString("base64") });
                console.log(`[TTS] 🔊 Sent concurrent sentence audio: "${sentence}"`);
              }
            }

            const replyTtsDuration = Date.now() - replyTtsStart;
            metrics.replyTtsLatencies.push(replyTtsDuration);
            console.timeEnd("[Perf] Reply TTS Synthesis");

            // Step 4 — Fallback next-question audio delivery (cache hit or on-the-fly)
            if (
              preGeneratedNextQuestionAudio &&
              preGeneratedNextQuestionIndex === currentQuestionIndex
            ) {
              console.log(`[TTS] 🔊 Sent pre-cached question audio for Q${currentQuestionIndex + 1}`);
              metrics.ttsLatencies.push(0); // instant — 0ms perceived latency
              send({
                type: "tts_audio",
                data: preGeneratedNextQuestionAudio.toString("base64"),
              });
              preGeneratedNextQuestionAudio = null;
              preGeneratedNextQuestionIndex = -1;
            } else {
              console.log(`[TTS] ⚠️ Next question audio not pre-cached. Synthesizing on-the-fly.`);
              console.time("[Perf] Next Question TTS Synthesis");
              const qTtsStart = Date.now();
              const qAudioBuffer = await synthesizeSpeech(
                currentQuestionText,
                voiceModel,
              );
              const qTtsDuration = Date.now() - qTtsStart;
              metrics.ttsLatencies.push(qTtsDuration);
              console.timeEnd("[Perf] Next Question TTS Synthesis");
              send({ type: "tts_audio", data: qAudioBuffer.toString("base64") });
            }

            // Safety-net: trigger background pre-generation of Q(N+1) after delivery
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex < MAX_QUESTIONS && preGeneratedNextQuestionIndex !== nextIndex) {
              console.log(`[TTS] 🚀 Triggering background next-question synthesis for Q${nextIndex + 1}...`);
              preGeneratedNextQuestionIndex = nextIndex;
              preGeneratedNextQuestionAudio = null;

              synthesizeSpeech(questions[nextIndex], voiceModel)
                .then((audioBuffer) => {
                  if (preGeneratedNextQuestionIndex === nextIndex) {
                    preGeneratedNextQuestionAudio = audioBuffer;
                    console.log(`[TTS] ✅ Background Q${nextIndex + 1} audio ready.`);
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

            send({
              type: "status",
              message: "Question ready. Click Unmute to answer.",
            });
          } else {
            // ── All 5 answered — finalise session ─────────────────────────
            send({ type: "status", message: "Finalising Set 2 results..." });

            console.time("[Perf] Finalise Session");
            sessionDoc.finalise();
            await sessionDoc.save();
            console.timeEnd("[Perf] Finalise Session");

            console.log(
              `[Session] 🏁 Set 2 complete. Overall Score: ${sessionDoc.overall_score_percentage}% | Avg Problem Solving: ${sessionDoc.avg_problem_solving} | Avg Accuracy: ${sessionDoc.avg_accuracy} | Avg Depth: ${sessionDoc.avg_depth}`,
            );

            // Step 6 — Session conclusion synthesis (concurrent sentence-level)
            const finalSpeech = `${evaluation.interviewer_reply} That concludes our technical round. Excellent effort!`;
            console.time("[Perf] Final TTS Synthesis");
            const finalTtsStart = Date.now();

            const finalSentences = (finalSpeech.match(/[^.!?]+[.!?]*/g) || [finalSpeech])
              .map((s) => s.trim())
              .filter(Boolean);

            const finalPromises = finalSentences.map((sentence) =>
              synthesizeSpeech(sentence, voiceModel)
                .then((buffer) => ({ sentence, buffer }))
                .catch((err) => {
                  console.error(`[TTS] Error synthesizing sentence "${sentence}":`, err.message);
                  return { sentence, buffer: null };
                }),
            );

            for (let i = 0; i < finalPromises.length; i++) {
              const { sentence, buffer } = await finalPromises[i];
              if (buffer) {
                send({ type: "tts_audio", data: buffer.toString("base64") });
                console.log(`[TTS] 🔊 Sent concurrent final sentence audio: "${sentence}"`);
              }
            }

            const finalTtsDuration = Date.now() - finalTtsStart;
            metrics.replyTtsLatencies.push(finalTtsDuration);
            console.timeEnd("[Perf] Final TTS Synthesis");

            // ── Print Session Performance Metrics ────────────────────────
            const totalQtts = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
            const totalRtts = metrics.replyTtsLatencies.reduce((a, b) => a + b, 0);
            const totalEval = metrics.evaluationLatencies.reduce((a, b) => a + b, 0);
            const systemLatency = totalQtts + totalRtts + totalEval;

            console.log(`\n==================================================`);
            console.log(`📊 SET 2 PERFORMANCE METRICS`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`--------------------------------------------------`);
            metrics.ttsLatencies.forEach((lat, idx) => {
              console.log(`  Q${idx + 1} Question TTS Delivery Latency: ${(lat / 1000).toFixed(2)}s ${lat === 0 ? "(Cached/Instant)" : ""}`);
            });
            console.log(`--------------------------------------------------`);
            metrics.replyTtsLatencies.forEach((lat, idx) => {
              console.log(`  Q${idx + 1} Reply TTS Synthesis Latency  : ${(lat / 1000).toFixed(2)}s`);
            });
            console.log(`--------------------------------------------------`);
            metrics.evaluationLatencies.forEach((lat, idx) => {
              console.log(`  Q${idx + 1} AI Evaluation Latency       : ${(lat / 1000).toFixed(2)}s`);
            });
            console.log(`--------------------------------------------------`);
            console.log(`  Total Question TTS Latency             : ${(totalQtts / 1000).toFixed(2)}s`);
            console.log(`  Total Reply TTS Latency                : ${(totalRtts / 1000).toFixed(2)}s`);
            console.log(`  Total AI Eval Latency                  : ${(totalEval / 1000).toFixed(2)}s`);
            console.log(`  Overall System Latency                 : ${(systemLatency / 1000).toFixed(2)}s (excl. user response time)`);
            console.log(`==================================================\n`);

            send({
              type: "session_complete",
              overall_score_percentage: sessionDoc.overall_score_percentage,
              avg_problem_solving: sessionDoc.avg_problem_solving,
              avg_accuracy: sessionDoc.avg_accuracy,
              avg_depth: sessionDoc.avg_depth,
            });
          }
        } catch (err) {
          console.error("[WS] Set 2 evaluation error:", err);
          send({ type: "error", message: "Failed to evaluate answer." });
        }
        console.log(`-------------------------------------\n`);
        break;
      }

      default:
        break;
    }
  });

  // ── Connection close ──────────────────────────────────────────────────────
  ws.on("close", () => {
    console.log("[WS] 🔌 Set 2 client disconnected — cleaning up session");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS] ❌ Set 2 WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handleSet2Socket };

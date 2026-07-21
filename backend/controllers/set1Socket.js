// backend/controllers/set1Socket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket traffic controller for Set 1 (Personalized Interview)
//
// Flow implemented:
//   1. Browser connects → server fetches weakness from PreTestSession
//   2. Server generates Q1 via aiSet1Generator and sends TTS audio
//   3. User presses mic → streams binary audio → Deepgram STT
//   4. User stops recording → sends { type: "submit_answer" }
//   5. Server evaluates answer → returns 3C scores, tip, and interviewer_reply
//   6. Server sends tip to frontend, speaks interviewer_reply + next question
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");
const { synthesizeSpeech } = require("../services/ttsService");
const {
  generateSet1Question,
  evaluateSet1Answer,
} = require("../services/aiSet1Generator");
const PreTestSession = require("../models/PreTestSession");
const Set1Session = require("../models/Set1Session");
const User = require("../models/User");

const MAX_QUESTIONS = 5;

/**
 * handleSet1Socket(ws)
 * @param {import("ws").WebSocket} ws
 * @param {import("http").IncomingMessage} request
 */
function handleSet1Socket(ws, request) {
  console.log("[WS] 🔌 New Set 1 session connected");

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

  // Session state
  const sessionId = `s1_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let sttSession = null;
  let keepAliveTimer = null;
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = "";
  let sessionWeaknessTag = "focus_completeness"; // default fallback
  let sessionRole = "fullstack";
  let sessionDifficulty = "easy";
  let preTestBaseline = null;
  let currentQuestionText = "";
  let sessionDoc = null;

  // Prefetching and caching variables
  let questions = [];
  let preGeneratedNextQuestionAudio = null;
  let preGeneratedNextQuestionIndex = -1;

  // Performance metrics tracking (matching Set 3 pattern)
  const metrics = {
    questionGenLatencies: [], // per-question LLM latencies (upfront generation)
    ttsLatencies: [],         // individual question audio delivery latency
    replyTtsLatencies: [],    // interviewer reply audio synthesis latency
    evaluationLatencies: [],  // AI evaluation latency
  };

  // Helpers
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  async function speak(text) {
    try {
      const t0 = Date.now();
      const audioBuffer = await synthesizeSpeech(text, voiceModel);
      const latency = Date.now() - t0;
      const base64Audio = audioBuffer.toString("base64");
      send({ type: "tts_audio", data: base64Audio });
      console.log(
        `[TTS] 🔊 Sent audio in ${(latency / 1000).toFixed(2)}s — "${text.substring(0, 50)}…"`,
      );
    } catch (err) {
      console.error("[WS] TTS error:", err.message);
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

  // Startup: Fetch weakness, initialize DB, generate all 5 questions sequentially
  const startupStart = Date.now();
  (async () => {
    try {
      send({
        type: "status",
        message: "Fetching your personalized profile...",
      });

      // 1. Fetch weakness from PreTestSession
      const preTest = await PreTestSession.findOne({ firebaseUid }).sort({
        createdAt: -1,
      });
      if (preTest && preTest.final_weakness_tag) {
        sessionWeaknessTag = preTest.final_weakness_tag;
        preTestBaseline = preTest.baseline_score_percentage;
      }

      // Fetch role and difficulty from User
      const user = await User.findOne({ firebaseUid });
      if (user) {
        sessionRole = user.role || "fullstack";
        sessionDifficulty = user.difficulty || "easy";
      }

      // Allow dev/testing URL override only in non-production environments
      if (process.env.NODE_ENV !== "production") {
        const requestedDifficulty = url.searchParams.get("difficulty");
        if (requestedDifficulty && ["easy", "medium", "hard"].includes(requestedDifficulty.toLowerCase())) {
          sessionDifficulty = requestedDifficulty.toLowerCase();
        }
      }

      // 2. Initialize Set1Session in DB (upsert)
      sessionDoc = await Set1Session.findOneAndUpdate(
        { firebaseUid },
        {
          sessionId,
          weakness_tag: sessionWeaknessTag,
          role: sessionRole,
          difficulty: sessionDifficulty,
          answers: [],
          avg_clarity: null,
          avg_correctness: null,
          avg_completeness: null,
          improvement_score: null,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // 3. Generate all 5 questions sequentially
      send({
        type: "status",
        message: "Generating your personalized questions...",
      });

      const genStart = Date.now();
      let q1SynthesisPromise = null;
      for (let i = 0; i < MAX_QUESTIONS; i++) {
        const qGenStart = Date.now();
        const q = await generateSet1Question(
          sessionWeaknessTag,
          sessionRole,
          sessionDifficulty,
          questions,
        );
        const qGenDuration = Date.now() - qGenStart;
        metrics.questionGenLatencies.push(qGenDuration);
        questions.push(q);

        // Start synthesis for Q1 as soon as it is generated, to overlap LLM generation of Q2-5
        if (i === 0) {
          q1SynthesisPromise = synthesizeSpeech(q, voiceModel);
        }
      }
      const totalGenDuration = Date.now() - genStart;
      console.log(`[aiSet1Generator] 🧠 Generated ${questions.length} questions for Set 1 (${sessionRole}, ${sessionDifficulty}, Weakness: ${sessionWeaknessTag}) in ${(totalGenDuration / 1000).toFixed(2)}s:`);
      questions.forEach((q, idx) => {
        console.log(`  Q${idx + 1}: "${q}"`);
      });

      currentQuestionText = questions[0];

      // 4. Send question text to frontend and speak it
      send({
        type: "question_text",
        text: currentQuestionText,
        index: currentQuestionIndex + 1,
      });

      // Wait for Q1 audio to finish synthesizing and speak it
      const q1AudioBuffer = await q1SynthesisPromise;
      const q1TtsLatency = Date.now() - startupStart;
      metrics.ttsLatencies.push(q1TtsLatency);

      send({ type: "tts_audio", data: q1AudioBuffer.toString("base64") });

      send({
        type: "status",
        message: "Question ready. Click Unmute to answer.",
      });
    } catch (err) {
      console.error("[WS] Startup error:", err);
      send({ type: "error", message: "Failed to initialize Set 1." });
    }
  })();

  // Message Handler
  ws.on("message", async (data, isBinary) => {
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
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening..." });

          // ── Early pre-generate next-question TTS (fire-and-forget) ──────
          const nextIndex = currentQuestionIndex + 1;
          if (nextIndex < MAX_QUESTIONS) {
            if (preGeneratedNextQuestionIndex !== nextIndex) {
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
        }
        break;

      case "stop_recording":
        closeSttSession();
        break;

      case "submit_answer": {
        const confirmedText = msg.final_text || fullTranscript;
        console.log(`\n--- Set 1 Q${currentQuestionIndex + 1} Processing ---`);
        console.log(
          `[WS] Transcript received: "${confirmedText.substring(0, 60)}..."`,
        );
        send({
          type: "status",
          message: "AI Coach is evaluating your answer...",
        });

        try {
          // 1. Evaluate answer
          console.time("[Perf] AI Evaluation");
          const evalStart = Date.now();
          const evaluation = await evaluateSet1Answer(
            currentQuestionText,
            confirmedText,
            sessionDifficulty,
          );
          const evalDuration = Date.now() - evalStart;
          metrics.evaluationLatencies.push(evalDuration);
          console.timeEnd("[Perf] AI Evaluation");

          // 2. Save to DB
          console.time("[Perf] DB Record Save");
          sessionDoc.recordAnswer({
            questionIndex: currentQuestionIndex,
            question: currentQuestionText,
            weakness_tag: sessionWeaknessTag,
            transcript: confirmedText,
            clarity_score: evaluation.clarity_score,
            correctness_score: evaluation.correctness_score,
            completeness_score: evaluation.completeness_score,
            tip: evaluation.tip,
          });
          await sessionDoc.save();
          console.timeEnd("[Perf] DB Record Save");

          // 3. Send tip, 3C scores, interviewer reply and difficulty to frontend/client
          send({
            type: "coach_tip",
            tip: evaluation.tip,
            clarity_score: evaluation.clarity_score,
            correctness_score: evaluation.correctness_score,
            completeness_score: evaluation.completeness_score,
            interviewer_reply: evaluation.interviewer_reply,
            difficulty: sessionDifficulty,
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

            // Synthesize ONLY the interviewer_reply audio sentence-by-sentence concurrently
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

            // Send next question audio (cached or fallback)
            if (
              preGeneratedNextQuestionAudio &&
              preGeneratedNextQuestionIndex === currentQuestionIndex
            ) {
              console.log(`[TTS] 🔊 Sent pre-cached question audio for Q${currentQuestionIndex + 1}`);
              metrics.ttsLatencies.push(0);
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

            // Trigger background pre-generation of Q(N+1) audio early (safety net)
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex < MAX_QUESTIONS) {
              if (preGeneratedNextQuestionIndex !== nextIndex) {
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
            }

            send({
              type: "status",
              message: "Question ready. Click Unmute to answer.",
            });
          } else {
            // End of Set 1
            send({ type: "status", message: "Finalising Set 1 results..." });

            console.time("[Perf] Finalise Session");
            sessionDoc.finalise(preTestBaseline);
            await sessionDoc.save();
            console.timeEnd("[Perf] Finalise Session");

            // Synthesize and speak the final reply sentence-by-sentence concurrently
            const finalSpeech = `${evaluation.interviewer_reply} That concludes our personalized questions for today. Great job!`;
            console.time("[Perf] Final TTS Synthesis");
            const replyTtsStart = Date.now();

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

            const replyTtsDuration = Date.now() - replyTtsStart;
            metrics.replyTtsLatencies.push(replyTtsDuration);
            console.timeEnd("[Perf] Final TTS Synthesis");

            // ── Print Session Performance Metrics ────────────────────────
            const totalQgen = metrics.questionGenLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const totalQtts = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
            const totalRtts = metrics.replyTtsLatencies.reduce((a, b) => a + b, 0);
            const totalEval = metrics.evaluationLatencies.reduce((a, b) => a + b, 0);
            const systemLatency = totalQgen + totalQtts + totalRtts + totalEval;

            console.log(`\n==================================================`);
            console.log(`📊 SET 1 PERFORMANCE METRICS (OPTIMIZED)`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`--------------------------------------------------`);
            metrics.questionGenLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} Upfront Question Gen Latency    : ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            metrics.ttsLatencies.forEach((lat, idx) => {
              console.log(`  Q${idx + 1} Question TTS Delivery Latency: ${(lat / 1000).toFixed(2)}s ${lat === 0 ? '(Cached/Instant)' : ''}`);
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
            console.log(
              `  Total Upfront Q-Gen Latency             : ${(totalQgen / 1000).toFixed(2)}s`,
            );
            console.log(`  Total Question TTS Latency             : ${(totalQtts / 1000).toFixed(2)}s`);
            console.log(`  Total Reply TTS Latency                : ${(totalRtts / 1000).toFixed(2)}s`);
            console.log(`  Total AI Eval Latency                  : ${(totalEval / 1000).toFixed(2)}s`);
            console.log(`  Overall System Latency                 : ${(systemLatency / 1000).toFixed(2)}s (excl. user response time)`);
            console.log(`==================================================\n`);

            send({ type: "session_complete" });
          }
        } catch (err) {
          console.error("[WS] Evaluation error:", err);
          send({ type: "error", message: "Failed to evaluate answer." });
        }
        console.log(`-------------------------------------\n`);
        break;
      }
      default:
        break;
    }
  });

  ws.on("close", () => {
    console.log("[WS] 🔌 Set 1 Client disconnected — cleaning up session");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS] ❌ Set 1 WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handleSet1Socket };

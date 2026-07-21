// backend/controllers/set3Socket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket traffic controller for Set 3 (Behavioral Interview)
//
// OPTIMIZED FLOW (tts_and_prefetching_optimization_plan):
//   Step 1 — Upfront question generation: all 5 Qs generated during loading.
//             Q1 TTS synthesis fires concurrently after Q1 text is ready.
//   Step 2 — Background next-Q TTS caching: Q(N+1) is pre-synthesized in the
//             background while the user is recording answer for Q(N).
//   Step 3 — Sentence-level concurrent reply TTS: interviewer_reply is split
//             into sentences and synthesized in parallel, streamed sequentially.
//   Step 4 — Cache hit/miss fallback: next-Q audio plays instantly from cache,
//             or falls back to on-the-fly synthesis on a cache miss.
//   Step 5 — Evaluator prompt enforces 2-sentence no-question reply (in aiSet3Generator).
//   Step 6 — Session conclusion uses concurrent sentence TTS before session_complete.
//
// Competency order (matches aiSet3Generator.js pillar mapping):
//   Q1 → Teamwork & Collaboration
//   Q2 → Adaptability & Learning Speed
//   Q3 → Conflict Resolution
//   Q4 → Resilience & Handling Failure
//   Q5 → Problem Solving & Initiative
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");
const { synthesizeSpeech } = require("../services/ttsService");
const {
  generateSet3Question,
  evaluateSet3Answer,
  getCompetencyTopic,
} = require("../services/aiSet3Generator");
const Set3Session = require("../models/Set3Session");
const User = require("../models/User");

const MAX_QUESTIONS = 5;

/**
 * handleSet3Socket(ws, request)
 * @param {import("ws").WebSocket} ws
 * @param {import("http").IncomingMessage} request
 */
function handleSet3Socket(ws, request) {
  console.log("[WS] 🔌 New Set 3 (Behavioral) session connected");

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
  const sessionId = `s3_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let sttSession = null;
  let keepAliveTimer = null;
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = "";
  let sessionRole = "fullstack";
  let sessionDifficulty = "easy";
  let currentQuestionText = "";
  let currentCompetency = "";
  let sessionDoc = null;

  // ── Step 1: Upfront question bank (all 5 Qs pre-generated at startup) ─────
  let questions = [];

  // ── Step 2: Background next-Q TTS cache ────────────────────────────────────
  let preGeneratedNextQuestionAudio = null;
  let preGeneratedNextQuestionIndex = -1;

  // ── Performance metrics (matching Set 2 pattern) ──────────────────────────
  const startupStart = Date.now();
  const metrics = {
    questionGenLatencies: [], // per-question LLM latencies (upfront generation)
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

  // ── Step 3: Sentence-level concurrent TTS synthesis helper ────────────────
  /**
   * Splits text into sentences, synthesizes all concurrently, then streams
   * them to the client sequentially to maintain natural speech ordering.
   *
   * @param {string} text        - Full text to synthesize
   * @param {string} [label=""]  - Log label for perf output
   * @returns {Promise<number>}  - Total wall-clock time in ms
   */
  async function speakSentencesConcurrently(text, label = "") {
    const sentences = (text.match(/[^.!?]+[.!?]*/g) || [text])
      .map((s) => s.trim())
      .filter(Boolean);

    const t0 = Date.now();

    // Launch all TTS requests in parallel
    const promises = sentences.map((sentence) =>
      synthesizeSpeech(sentence, voiceModel)
        .then((buffer) => ({ sentence, buffer }))
        .catch((err) => {
          console.error(`[TTS] ❌ Error on "${sentence.substring(0, 40)}…": ${err.message}`);
          return { sentence, buffer: null };
        }),
    );

    // Stream sequentially to the client as each resolves in order
    for (let i = 0; i < promises.length; i++) {
      const { sentence, buffer } = await promises[i];
      if (buffer) {
        send({ type: "tts_audio", data: buffer.toString("base64") });
        if (label) {
          console.log(
            `[TTS] 🔊 ${label} sentence ${i + 1}/${promises.length} sent — "${sentence.substring(0, 50)}…"`,
          );
        }
      }
    }

    return Date.now() - t0;
  }

  // ── Session startup ───────────────────────────────────────────────────────
  // Step 1: Generate all 5 questions upfront during loading.
  // Q1 TTS synthesis fires immediately once Q1 text is ready so LLM
  // generation of Q2-5 and TTS of Q1 run concurrently.
  (async () => {
    try {
      send({
        type: "status",
        message: "Preparing your behavioral interview...",
      });

      // 1. Fetch role and difficulty from User
      const user = await User.findOne({ firebaseUid });
      if (user) {
        sessionRole = user.role || "fullstack";
        sessionDifficulty = user.difficulty || "easy";
      }

      // 2. Initialize Set3Session in DB (upsert — one doc per user)
      sessionDoc = await Set3Session.findOneAndUpdate(
        { firebaseUid },
        {
          sessionId,
          role: sessionRole,
          difficulty: sessionDifficulty,
          answers: [],
          avg_situation: null,
          avg_action: null,
          avg_result: null,
          overall_score_percentage: null,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(
        `[DB] ✅ Set 3 session initialized: ${sessionId} for user: ${firebaseUid}`,
      );

      // 3. Generate all 5 questions upfront, launching Q1 TTS concurrently
      send({
        type: "status",
        message: "Generating your behavioral questions...",
      });

      const askedQuestions = []; // local tracker used during generation
      let q1SynthesisPromise = null;
      const genStart = Date.now();

      for (let i = 0; i < MAX_QUESTIONS; i++) {
        const qGenStart = Date.now();
        const q = await generateSet3Question(askedQuestions, sessionDifficulty);
        const qGenDuration = Date.now() - qGenStart;
        metrics.questionGenLatencies.push(qGenDuration);

        questions.push(q);
        askedQuestions.push(q);

        // Fire Q1 TTS synthesis immediately so it runs while Q2-5 generate
        if (i === 0) {
          q1SynthesisPromise = synthesizeSpeech(q, voiceModel);
        }
      }
      const totalGenDuration = Date.now() - genStart;
      console.log(`[aiSet3Generator] 🧠 Generated ${questions.length} questions for Set 3 (${sessionRole}, ${sessionDifficulty}) in ${(totalGenDuration / 1000).toFixed(2)}s:`);
      questions.forEach((q, idx) => {
        console.log(`  Q${idx + 1}: "${q}"`);
      });

      // 4. Set Q1 as current question and send text to frontend
      currentQuestionText = questions[0];
      currentCompetency = getCompetencyTopic(0);

      send({
        type: "question_text",
        text: currentQuestionText,
        index: 1,
        competency: currentCompetency,
      });

      // 5. Await Q1 TTS (was running concurrently with Q2-5 generation)
      const q1AudioBuffer = await q1SynthesisPromise;
      const q1TtsLatency = Date.now() - startupStart;
      metrics.ttsLatencies.push(q1TtsLatency);

      send({ type: "tts_audio", data: q1AudioBuffer.toString("base64") });
      console.log(
        `[TTS] 🔊 Q1 audio sent in ${(q1TtsLatency / 1000).toFixed(2)}s (total startup)`,
      );

      send({
        type: "status",
        message: "Question ready. Click Unmute to answer.",
      });
    } catch (err) {
      console.error("[WS] Set 3 startup error:", err);
      send({ type: "error", message: "Failed to initialize Set 3." });
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
      // Step 2: Trigger background TTS caching of Q(N+1) while user records
      case "start_recording": {
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening..." });
        }

        // Fire background synthesis of the next question (if not already cached)
        const nextIndex = currentQuestionIndex + 1;
        if (
          nextIndex < MAX_QUESTIONS &&
          preGeneratedNextQuestionIndex !== nextIndex &&
          questions[nextIndex]
        ) {
          preGeneratedNextQuestionIndex = nextIndex;
          preGeneratedNextQuestionAudio = null;

          synthesizeSpeech(questions[nextIndex], voiceModel)
            .then((audioBuffer) => {
              if (preGeneratedNextQuestionIndex === nextIndex) {
                preGeneratedNextQuestionAudio = audioBuffer;
                console.log(
                  `[Cache] ✅ Pre-cached Q${nextIndex + 1} audio ready`,
                );
              }
            })
            .catch((err) => {
              // Reset so submit_answer falls back to on-the-fly synthesis
              if (preGeneratedNextQuestionIndex === nextIndex) {
                preGeneratedNextQuestionAudio = null;
                preGeneratedNextQuestionIndex = -1;
                console.warn(
                  `[Cache] ⚠️ Pre-cache failed for Q${nextIndex + 1}: ${err.message}`,
                );
              }
            });
        }
        break;
      }

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
        console.log(
          `\n--- Set 3 Q${currentQuestionIndex + 1} (${currentCompetency}) Processing ---`,
        );
        console.log(`[WS] Transcript: "${confirmedText.substring(0, 80)}..."`);
        send({
          type: "status",
          message: "AI Coach is evaluating your answer...",
        });

        try {
          // 1. Evaluate the STAR answer
          console.time("[Perf] AI STAR Evaluation");
          const evalStart = Date.now();
          const evaluation = await evaluateSet3Answer(
            currentQuestionText,
            confirmedText,
            sessionDifficulty,
          );
          const evalDuration = Date.now() - evalStart;
          metrics.evaluationLatencies.push(evalDuration);
          console.timeEnd("[Perf] AI STAR Evaluation");
          console.log(
            `[AI] ✅ STAR Scores — Situation: ${evaluation.situation_score} | Action: ${evaluation.action_score} | Result: ${evaluation.result_score}`,
          );

          // 2. Save to DB
          console.time("[Perf] DB Record Save");
          sessionDoc.recordAnswer({
            questionIndex: currentQuestionIndex,
            question: currentQuestionText,
            competency_topic: currentCompetency,
            transcript: confirmedText,
            situation_score: evaluation.situation_score,
            action_score: evaluation.action_score,
            result_score: evaluation.result_score,
            tip: evaluation.tip,
          });
          await sessionDoc.save();
          console.timeEnd("[Perf] DB Record Save");

          // 3. Send STAR scores + coaching tip to frontend
          send({
            type: "coach_tip",
            tip: evaluation.tip,
            situation_score: evaluation.situation_score,
            action_score: evaluation.action_score,
            result_score: evaluation.result_score,
          });

          currentQuestionIndex++;
          const hasNext = currentQuestionIndex < MAX_QUESTIONS;

          if (hasNext) {
            // 4. Advance to next question (already pre-generated upfront)
            currentCompetency = getCompetencyTopic(currentQuestionIndex);
            currentQuestionText = questions[currentQuestionIndex];

            send({
              type: "question_text",
              text: currentQuestionText,
              index: currentQuestionIndex + 1,
              competency: currentCompetency,
            });

            send({ type: "status", message: "Speaking feedback..." });

            // 5. Step 3: Speak interviewer_reply sentence by sentence (concurrent TTS)
            console.time("[Perf] Reply TTS (Concurrent Sentences)");
            const replyTtsStart = Date.now();
            const replyTtsDuration = await speakSentencesConcurrently(
              evaluation.interviewer_reply,
              "Reply",
            );
            metrics.replyTtsLatencies.push(replyTtsDuration);
            console.timeEnd("[Perf] Reply TTS (Concurrent Sentences)");

            // 6. Step 4: Play next-question audio — cache hit or on-the-fly fallback
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

            send({
              type: "status",
              message: "Question ready. Click Unmute to answer.",
            });
          } else {
            // ── All 5 answered — finalise session ─────────────────────────
            send({ type: "status", message: "Finalising Set 3 results..." });

            console.time("[Perf] Finalise Session");
            sessionDoc.finalise();
            await sessionDoc.save();
            console.timeEnd("[Perf] Finalise Session");

            console.log(
              `[Session] 🏁 Set 3 complete. Overall Score: ${sessionDoc.overall_score_percentage}% | Avg Situation: ${sessionDoc.avg_situation} | Avg Action: ${sessionDoc.avg_action} | Avg Result: ${sessionDoc.avg_result}`,
            );

            // Step 6: Concurrent sentence TTS for final closing speech
            const finalSpeech = `${evaluation.interviewer_reply} That concludes our behavioral round. Excellent effort!`;
            console.time("[Perf] Final TTS Synthesis (Concurrent Sentences)");
            const finalTtsStart = Date.now();
            const finalTtsDuration = await speakSentencesConcurrently(
              finalSpeech,
              "Final",
            );
            metrics.replyTtsLatencies.push(finalTtsDuration);
            console.timeEnd("[Perf] Final TTS Synthesis (Concurrent Sentences)");

            // ── Print Session Performance Metrics ────────────────────────
            const totalQgen = metrics.questionGenLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const totalQtts = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
            const totalEval = metrics.evaluationLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const totalRtts = metrics.replyTtsLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const systemLatency =
              totalQgen + totalQtts + totalEval + totalRtts;

            console.log(`\n==================================================`);
            console.log(`📊 SET 3 PERFORMANCE METRICS (OPTIMIZED)`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`--------------------------------------------------`);
            metrics.questionGenLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} Upfront Question Gen Latency    : ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            metrics.ttsLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} Question TTS Delivery Latency: ${(lat / 1000).toFixed(2)}s ${lat === 0 ? "(Cached/Instant)" : ""}`,
              );
            });
            console.log(`--------------------------------------------------`);
            metrics.replyTtsLatencies.forEach((lat, idx) => {
              if (idx < metrics.replyTtsLatencies.length - 1) {
                console.log(
                  `  Q${idx + 1} Reply TTS Synthesis Latency  : ${(lat / 1000).toFixed(2)}s`,
                );
              } else {
                console.log(
                  `  Final Closing Speech TTS Latency   : ${(lat / 1000).toFixed(2)}s`,
                );
              }
            });
            console.log(`--------------------------------------------------`);
            metrics.evaluationLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} AI STAR Evaluation Latency    : ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            console.log(
              `  Total Upfront Q-Gen Latency             : ${(totalQgen / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Total Question TTS Latency             : ${(totalQtts / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Total Reply TTS Latency                : ${(totalRtts / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Total AI Eval Latency                   : ${(totalEval / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Overall System Latency                  : ${(systemLatency / 1000).toFixed(2)}s (excl. user response time)`,
            );
            console.log(`==================================================\n`);

            send({
              type: "session_complete",
              overall_score_percentage: sessionDoc.overall_score_percentage,
              avg_situation: sessionDoc.avg_situation,
              avg_action: sessionDoc.avg_action,
              avg_result: sessionDoc.avg_result,
            });
          }
        } catch (err) {
          console.error("[WS] Set 3 evaluation error:", err);
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
    console.log("[WS] 🔌 Set 3 client disconnected — cleaning up session");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS] ❌ Set 3 WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handleSet3Socket };

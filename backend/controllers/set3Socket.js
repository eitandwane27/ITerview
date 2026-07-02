// backend/controllers/set3Socket.js
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket traffic controller for Set 3 (Behavioral Interview)
//
// Flow implemented:
//   1. Browser connects → server fetches role & difficulty from User model
//   2. Server generates Q1 (Teamwork) via aiSet3Generator and sends TTS audio
//   3. User presses mic → streams binary audio → Deepgram STT
//   4. User stops recording → submits answer
//   5. Server evaluates answer (STAR scoring) → returns scores, tip, interviewer_reply
//   6. Server sends tip to frontend, speaks interviewer_reply + next question
//   7. Repeats for Q2 (Adaptability), Q3 (Conflict), Q4 (Resilience), Q5 (Initiative)
//   8. Session finalised → overall_score_percentage persisted to Set3Session
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
  const askedQuestions = []; // tracks asked question strings for dedup
  let currentQuestionText = "";
  let currentCompetency = "";
  let sessionDoc = null;

  // Performance metrics tracking
  const metrics = {
    questionGenLatencies: [], // time to generate question text via LLM
    ttsLatencies: [], // question or combined reply+question TTS latencies
    replyTtsLatencies: [], // final reply TTS latencies
    evaluationLatencies: [], // AI evaluation latencies
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── Session startup ───────────────────────────────────────────────────────
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

      // 3. Generate Q1 (Teamwork)
      send({
        type: "status",
        message: "Generating your first behavioral question...",
      });
      currentCompetency = getCompetencyTopic(currentQuestionIndex);

      const qGenStart = Date.now();
      currentQuestionText = await generateSet3Question(
        askedQuestions,
        sessionDifficulty,
      );
      const qGenDuration = Date.now() - qGenStart;
      metrics.questionGenLatencies.push(qGenDuration);
      askedQuestions.push(currentQuestionText);

      // 4. Send question text + competency label to frontend, then speak it
      send({
        type: "question_text",
        text: currentQuestionText,
        index: currentQuestionIndex + 1,
        competency: currentCompetency,
      });

      const q1TtsStart = Date.now();
      await speak(currentQuestionText);
      const q1TtsDuration = Date.now() - q1TtsStart;
      metrics.ttsLatencies.push(q1TtsDuration);

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
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening..." });
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
            send({ type: "status", message: "Generating next question..." });

            // 4. Generate next question (competency auto-maps to new index)
            currentCompetency = getCompetencyTopic(currentQuestionIndex);
            console.time("[Perf] AI Question Generation");
            const qGenStart = Date.now();
            const nextQuestion = await generateSet3Question(
              askedQuestions,
              sessionDifficulty,
            );
            const qGenDuration = Date.now() - qGenStart;
            metrics.questionGenLatencies.push(qGenDuration);
            console.timeEnd("[Perf] AI Question Generation");

            currentQuestionText = nextQuestion;
            askedQuestions.push(nextQuestion);

            send({
              type: "question_text",
              text: currentQuestionText,
              index: currentQuestionIndex + 1,
              competency: currentCompetency,
            });

            // 5. Speak interviewer reply + next question
            const combinedSpeechText = `${evaluation.interviewer_reply} ${currentQuestionText}`;
            console.time("[Perf] TTS Synthesis");
            const ttsStart = Date.now();
            await speak(combinedSpeechText);
            const ttsDuration = Date.now() - ttsStart;
            metrics.ttsLatencies.push(ttsDuration);
            console.timeEnd("[Perf] TTS Synthesis");

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

            const finalSpeech = `${evaluation.interviewer_reply} That concludes our behavioral round. Excellent effort!`;
            console.time("[Perf] Final TTS Synthesis");
            const finalTtsStart = Date.now();
            await speak(finalSpeech);
            const finalTtsDuration = Date.now() - finalTtsStart;
            metrics.replyTtsLatencies.push(finalTtsDuration);
            console.timeEnd("[Perf] Final TTS Synthesis");

            // ── Print Session Performance Metrics ────────────────────────
            const totalQgen = metrics.questionGenLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const totalTts = metrics.ttsLatencies.reduce((a, b) => a + b, 0);
            const totalEval = metrics.evaluationLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const finalReplyTts = metrics.replyTtsLatencies.reduce(
              (a, b) => a + b,
              0,
            );
            const systemLatency =
              totalQgen + totalTts + totalEval + finalReplyTts;

            console.log(`\n==================================================`);
            console.log(`📊 SET 3 PERFORMANCE METRICS (UNOPTIMIZED)`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`--------------------------------------------------`);
            metrics.questionGenLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} Question Generation Latency: ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            metrics.ttsLatencies.forEach((lat, idx) => {
              if (idx === 0) {
                console.log(
                  `  Q1 Question TTS Latency             : ${(lat / 1000).toFixed(2)}s`,
                );
              } else {
                console.log(
                  `  Q${idx + 1} Reply + Question TTS Latency     : ${(lat / 1000).toFixed(2)}s`,
                );
              }
            });
            console.log(`--------------------------------------------------`);
            metrics.replyTtsLatencies.forEach((lat, idx) => {
              console.log(
                `  Final Reply TTS Latency            : ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            metrics.evaluationLatencies.forEach((lat, idx) => {
              console.log(
                `  Q${idx + 1} AI STAR Evaluation Latency    : ${(lat / 1000).toFixed(2)}s`,
              );
            });
            console.log(`--------------------------------------------------`);
            console.log(
              `  Total Question Gen Latency             : ${(totalQgen / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Total TTS Synthesis Latency            : ${((totalTts + finalReplyTts) / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Total AI Eval Latency                  : ${(totalEval / 1000).toFixed(2)}s`,
            );
            console.log(
              `  Overall System Latency                 : ${(systemLatency / 1000).toFixed(2)}s (excl. user response time)`,
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

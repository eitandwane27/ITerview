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
const { evaluateAnswer } = require("../services/aiEvaluator");

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

  // Parse requested voice from the URL query string
  const url = new URL(request.url, `http://${request.headers.host}`);
  const voiceModel = url.searchParams.get("voice") || "aura-2-luna-en";

  // ── Session state ─────────────────────────────────────────────────────────
  let sttSession = null; // Deepgram live connection
  let keepAliveTimer = null; // 2 s keepalive interval
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = ""; // accumulates the current answer
  let preGeneratedNextQuestionAudio = null; // pre-synthesized audio for the next question

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Send a JSON control message to the browser. */
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  /** Speak a question via TTS and send the MP3 back over the WebSocket. */
  async function speakQuestion(text, label = "TTS") {
    try {
      send({ type: "status", message: "Generating question audio…" });
      const t0 = Date.now();
      const audioBuffer = await synthesizeSpeech(text, voiceModel);
      const base64Audio = audioBuffer.toString("base64");
      send({ type: "tts_audio", data: base64Audio });
      console.log(
        `[TTS] 🔊 Sent audio to user in ${((Date.now() - t0) / 1000).toFixed(2)}s — "${text.substring(0, 50)}…"`,
      );
    } catch (err) {
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
        if (transcript) {
          // Echo back to the browser for real-time display
          send({ type: "transcript", text: transcript, isFinal });

          if (isFinal) {
            // Accumulate final segments
            fullTranscript = fullTranscript
              ? `${fullTranscript} ${transcript}`
              : transcript;
          }
        }
      },
      // onError
      (err) => {
        send({ type: "error", message: `STT error: ${err.message}` });
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
  // Greet the user and speak the first question immediately on connect.
  (async () => {
    send({
      type: "status",
      message: "Session started. Preparing your first question…",
    });
    await speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex]);
    send({
      type: "status",
      message: "Question ready. Press the mic button to begin your answer.",
    });
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

        // ── Step 1: AI Evaluation + TTS Feedback (Phase 3) ────────────────
        // We wrap in an async IIFE so we can await inside the switch case.
        (async () => {
          const perfSubmit = Date.now(); // [PERF] total submit_answer wall clock
          send({ type: "status", message: "Evaluating your answer…" });

          const nextIndex = currentQuestionIndex + 1;
          const hasNext = nextIndex < PRE_TEST_QUESTIONS.length;

          // Await ONLY the AI evaluation first
          const t1 = Date.now();
          let feedbackText = "";
          try {
            feedbackText = await evaluateAnswer(answeredQuestion, confirmedText);
            console.log(
              `[AI Evaluator] 🤖 Groq AI evaluated answer in ${((Date.now() - t1) / 1000).toFixed(2)}s`,
            );
            console.log(`[AI Feedback] 📝 "${feedbackText.substring(0, 80)}..."`);
          } catch (err) {
            console.error(`[AI] ❌ Groq evaluation failed:`, err.message);
            feedbackText = "There was an error evaluating your answer.";
          }

          // Trigger next-question synthesis in the background (fire-and-forget)
          if (hasNext) {
            console.log(`[TTS] 🚀 Triggering background next-question synthesis for Q${nextIndex + 1}...`);
            synthesizeSpeech(PRE_TEST_QUESTIONS[nextIndex], voiceModel)
              .then((audioBuffer) => {
                preGeneratedNextQuestionAudio = audioBuffer;
                console.log(`[TTS] ✅ Background next-question audio pre-generation completed.`);
              })
              .catch((err) => {
                preGeneratedNextQuestionAudio = null;
                console.error(`[TTS] ❌ Background next-question audio pre-generation failed:`, err.message);
              });
          } else {
            preGeneratedNextQuestionAudio = null;
          }

          // Generate and send the feedback audio buffer sentence-by-sentence in parallel
          if (feedbackText) {
            try {
              send({ type: "status", message: "Generating feedback voice…" });
              const sentences = splitIntoSentences(feedbackText);
              console.log(`[TTS] Splitting feedback into ${sentences.length} sentences for parallel synthesis`);

              // Start all syntheses in parallel
              const sentencePromises = sentences.map((sentence, idx) => {
                return synthesizeSpeech(sentence, voiceModel).then((audioBuffer) => ({
                  index: idx,
                  text: sentence,
                  audioBuffer,
                }));
              });

              // Await and send them in sequential order
              for (const promise of sentencePromises) {
                const { text, audioBuffer } = await promise;
                const base64Audio = audioBuffer.toString("base64");
                send({ type: "tts_audio", data: base64Audio });
                console.log(
                  `[TTS] 🔊 Sent feedback sentence audio to user — "${text.substring(0, 50)}…"`
                );
              }
            } catch (err) {
              console.error(`[AI] ❌ TTS Feedback synthesis failed for Q${questionNumber}:`, err.message);
              send({ type: "error", message: "Feedback audio generation failed." });
            }
          }

          // Send feedback_complete message to client so they can display "Continue" button
          send({ type: "feedback_complete" });

          const totalMs = Date.now() - perfSubmit;
          console.log(
            `[Performance] ⏱  Total processing & latency: ${(totalMs / 1000).toFixed(2)}s`
          );
        })();

        break;
      }

      // Client requested the next question (transition triggered by UI button click)
      case "next_question": {
        (async () => {
          currentQuestionIndex++;
          const hasNext = currentQuestionIndex < PRE_TEST_QUESTIONS.length;

          if (hasNext) {
            fullTranscript = "";
            send({
              type: "status",
              message: `Moving to question ${currentQuestionIndex + 1}…`,
            });

            // Send pre-generated question audio immediately if ready, otherwise fallback
            if (preGeneratedNextQuestionAudio) {
              const base64Audio = preGeneratedNextQuestionAudio.toString("base64");
              send({ type: "tts_audio", data: base64Audio });
              console.log(
                `[TTS] 🔊 Sent pre-generated question audio to user — "${PRE_TEST_QUESTIONS[currentQuestionIndex].substring(0, 50)}…"`,
              );
              preGeneratedNextQuestionAudio = null; // Reset
            } else {
              console.warn(`[TTS] ⚠️ Pre-generated TTS was missing, falling back to sequential synthesis.`);
              await speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex], `Q${currentQuestionIndex + 1}/Question`);
            }
          } else {
            send({
              type: "status",
              message: "All questions answered! Pre-test complete.",
            });
            send({ type: "session_complete" });
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

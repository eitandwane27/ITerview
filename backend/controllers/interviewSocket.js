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
 */
function handleInterviewSocket(ws) {
  console.log("[WS] 🔌 New interview session connected");

  // ── Session state ─────────────────────────────────────────────────────────
  let sttSession = null;        // Deepgram live connection
  let keepAliveTimer = null;    // 2 s keepalive interval
  let currentQuestionIndex = 0;
  let isRecording = false;
  let fullTranscript = "";      // accumulates the current answer

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Send a JSON control message to the browser. */
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  /** Speak a question via TTS and send the MP3 back over the WebSocket. */
  async function speakQuestion(text) {
    try {
      send({ type: "status", message: "Generating question audio…" });
      const audioBuffer = await synthesizeSpeech(text);
      const base64Audio = audioBuffer.toString("base64");
      send({ type: "tts_audio", data: base64Audio });
      console.log(`[WS] 🔊 TTS sent (${audioBuffer.length} bytes) for: "${text.substring(0, 50)}…"`);
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
      }
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
    send({ type: "status", message: "Session started. Preparing your first question…" });
    await speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex]);
    send({ type: "status", message: "Question ready. Press the mic button to begin your answer." });
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
        send({ type: "status", message: "Recording stopped. Review your answer, then confirm to continue." });
        break;

      // User confirmed the transcript → advance to the next question
      // (Phase 3 AI evaluation will be hooked in here later)
      case "submit_answer": {
        const confirmedText = msg.final_text || fullTranscript;
        console.log(`[WS] Answer confirmed: "${confirmedText.substring(0, 80)}…"`);

        currentQuestionIndex++;

        if (currentQuestionIndex < PRE_TEST_QUESTIONS.length) {
          fullTranscript = "";
          send({ type: "status", message: `Moving to question ${currentQuestionIndex + 1}…` });
          speakQuestion(PRE_TEST_QUESTIONS[currentQuestionIndex]);
        } else {
          send({ type: "status", message: "All questions answered! Pre-test complete." });
          send({ type: "session_complete" });
        }
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

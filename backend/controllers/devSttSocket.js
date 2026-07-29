// backend/controllers/devSttSocket.js
// ─────────────────────────────────────────────────────────────────────────────
// DEV ONLY — STT Test Bench WebSocket Controller
//
// Proxies incoming binary audio streams directly to Deepgram without:
//   - Generating any TTS audio
//   - Writing or reading to MongoDB (PreTestSession/etc.)
//   - Simulating any question-flow/interview steps
// ─────────────────────────────────────────────────────────────────────────────

const { createDeepgramLiveSession } = require("../services/sttService");

function handleDevSttSocket(ws) {
  console.log("[WS-DEV] 🔌 STT Testbench connected");

  let sttSession = null;
  let isRecording = false;

  // Helpers
  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function openSttSession() {
    sttSession = createDeepgramLiveSession(
      // onTranscript
      (transcript, isFinal) => {
        if (transcript) {
          send({ type: "transcript", text: transcript, isFinal });
        } else if (isFinal) {
          // Send empty final utterance markers
          send({ type: "transcript", text: "", isFinal: true });
        }
      },
      // onError
      (err) => {
        send({ type: "error", message: `STT error: ${err.message}` });
        sttSession = null;
        isRecording = false;
      },
      // onEvent (raw Deepgram payload)
      (event) => {
        send({ type: "flux_event", event });
      }
    );
    isRecording = true;
  }

  function closeSttSession() {
    if (sttSession) {
      sttSession.finish();
      sttSession = null;
    }
    isRecording = false;
  }

  // Socket communication
  ws.on("message", (data, isBinary) => {
    // 1. Audio stream chunks
    if (isBinary) {
      if (sttSession && isRecording) {
        sttSession.sendAudio(data);
      }
      return;
    }

    // 2. Control messages (only start/stop recording, clear, etc.)
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    console.log(`[WS-DEV] ← ${msg.type}`);

    switch (msg.type) {
      case "start_recording":
        if (!isRecording) {
          openSttSession();
          send({ type: "status", message: "Listening..." });
        }
        break;

      case "stop_recording":
        closeSttSession();
        send({ type: "status", message: "Stopped." });
        break;

      default:
        console.warn(`[WS-DEV] Unknown control message: ${msg.type}`);
    }
  });

  ws.on("close", () => {
    console.log("[WS-DEV] 🔌 STT Testbench disconnected");
    closeSttSession();
  });

  ws.on("error", (err) => {
    console.error("[WS-DEV] WebSocket error:", err.message);
    closeSttSession();
  });
}

module.exports = { handleDevSttSocket };

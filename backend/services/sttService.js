// backend/services/sttService.js
// ─────────────────────────────────────────────────────────────────────────────
// Deepgram STT — Live WebSocket "Listen" Service (Flux model via @deepgram/sdk)
//
// Refactored to match standard Deepgram v2 Flux SDK configuration:
//   const deepgram = new DeepgramClient({ apiKey });
//   const socket = await deepgram.listen.v2.createConnection({
//     model: "flux-general-en",
//     eot_threshold: 0.7,
//     eot_timeout_ms: 5000,
//     encoding: "linear16",
//     sample_rate: 16000,
//   });
// ─────────────────────────────────────────────────────────────────────────────

const { DeepgramClient } = require("@deepgram/sdk");

/**
 * createDeepgramLiveSession
 *
 * Opens a Deepgram STT WebSocket (Flux general model v2) using the official
 * Deepgram SDK and returns a lightweight controller object to stream audio.
 *
 * @param {(transcript: string, isFinal: boolean) => void} onTranscript
 *   Called whenever Deepgram returns a transcript segment or turn event.
 *   `isFinal` is true when the utterance/turn is complete.
 *
 * @param {(err: Error) => void} onError
 *   Called on any fatal connection / stream error.
 *
 * @param {(event: any) => void} [onEvent]
 *   Optional callback to receive raw event payloads from Deepgram.
 *
 * @returns {{ sendAudio, keepAlive, finish }}
 */
function createDeepgramLiveSession(onTranscript, onError, onEvent) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    onError(new Error("DEEPGRAM_API_KEY is not set in environment"));
    return null;
  }

  // Max audio chunks to buffer while waiting for connection (50 × 250ms ≈ 12.5s)
  const MAX_QUEUE_SIZE = 50;

  const deepgram = new DeepgramClient({ apiKey });
  let socket = null;
  let isOpen = false;
  // Guard: set to true by finish() so a connection resolved after finish() is immediately closed
  let isCancelled = false;
  let audioQueue = [];
  let currentTurnInterimText = "";

  deepgram.listen.v2
    .createConnection({
      model: "flux-general-en",
      eot_threshold: 0.7,
      eot_timeout_ms: 5000,
      encoding: "linear16",
      sample_rate: 16000,
    })
    .then((conn) => {
      // If finish() was called before the connection resolved, close the orphaned conn immediately
      if (isCancelled) {
        console.log("[STT] 🛑 Connection resolved after finish() was called; closing immediately.");
        try { conn.close(); } catch (_) { /* ignore */ }
        return;
      }
      socket = conn;

      socket.on("open", () => {
        isOpen = true;
        console.log("[STT] ✅ Deepgram Flux WS opened via DeepgramClient SDK");
        // Flush any audio chunks buffered while connection was opening
        while (audioQueue.length > 0) {
          const chunk = audioQueue.shift();
          try {
            socket.sendMedia(chunk);
          } catch (e) {
            console.error("[STT] Error sending buffered chunk:", e.message);
          }
        }
      });

      socket.on("message", (data) => {
        if (typeof onEvent === "function") {
          onEvent(data);
        }

        if (data.event === "StartOfTurn") {
          console.log(`[STT] 🎙️ StartOfTurn (Turn ${data.turn_index})`);
          currentTurnInterimText = "";
          return;
        }

        if (data.event === "EndOfTurn") {
          console.log(
            `[STT] 🔇 EndOfTurn (Turn ${data.turn_index}, Confidence: ${data.end_of_turn_confidence})`
          );
          const finalTurnText =
            (data.transcript ? data.transcript.trim() : "") ||
            currentTurnInterimText.trim();
          if (finalTurnText) {
            onTranscript(finalTurnText, true);
          } else {
            onTranscript("", true);
          }
          currentTurnInterimText = "";
          return;
        }

        // Extract transcript from Flux payload or fallback channel alternative
        const transcript =
          data.transcript ??
          data?.channel?.alternatives?.[0]?.transcript ??
          "";

        if (!transcript) return;

        currentTurnInterimText = transcript.trim();
        const isFinal = data.is_final === true;

        if (!isFinal) {
          if (process.env.STT_DEBUG === "true") {
            console.log(`[STT] interim: "${transcript}"`);
          }
          onTranscript(transcript, false);
        } else {
          console.log(`[STT] ✅ FINAL: "${transcript}"`);
          onTranscript(transcript, true);
          currentTurnInterimText = "";
        }
      });

      socket.on("error", (err) => {
        console.error("[STT] ❌ Deepgram error:", err);
        isOpen = false;
        onError(err);
      });

      socket.on("close", () => {
        isOpen = false;
        console.log("[STT] 🔌 Deepgram WS closed");
      });

      socket.connect();
    })
    .catch((err) => {
      isOpen = false;
      console.error("[STT] ❌ Failed to create Deepgram connection:", err.message);
      onError(err);
    });

  return {
    /**
     * Pipe a raw audio chunk from the browser into Deepgram.
     * @param {Buffer | ArrayBuffer} chunk
     */
    sendAudio(chunk) {
      // Drop audio silently if this session has already been torn down
      if (isCancelled) return;

      if (socket && isOpen) {
        try {
          socket.sendMedia(chunk);
        } catch (e) {
          console.error("[STT] Error sending media chunk:", e.message);
        }
      } else {
        // Enforce cap: evict oldest chunk if queue is full to prevent unbounded growth
        if (audioQueue.length >= MAX_QUEUE_SIZE) {
          audioQueue.shift();
        }
        audioQueue.push(chunk);
      }
    },

    /**
     * Send ping frame to keep connection alive.
     */
    keepAlive() {
      if (socket && isOpen) {
        try {
          socket.ping();
        } catch (e) {
          // ignore
        }
      }
    },

    /**
     * Gracefully close the Deepgram connection.
     */
    finish() {
      // Mark cancelled first so the async .then() callback can detect it
      isCancelled = true;
      isOpen = false;
      audioQueue = [];
      if (socket) {
        try {
          socket.close();
        } catch (e) {
          // ignore
        }
        socket = null;
      }
    },
  };
}

module.exports = { createDeepgramLiveSession };

// backend/services/sttService.js
// ─────────────────────────────────────────────────────────────────────────────
// Deepgram STT — Live WebSocket "Listen" service
//
// Blueprint ref: system-blueprint.md § Phase 1
//   "Client streams binary audio via WebSocket to Node.js backend.
//    Backend pipes this to Deepgram (nova-3 model)."
//   "KeepAlive: Backend pings Deepgram every 2s to prevent WebSocket
//    timeout during AI or TTS processing."
//
// Usage:
//   const { createDeepgramLiveSession } = require("./sttService");
//   const session = createDeepgramLiveSession(onTranscript, onError);
//   session.sendAudio(binaryChunk);   // call with raw PCM/WebM audio
//   session.keepAlive();              // call on a 2 s interval
//   session.finish();                 // call when the user stops speaking
// ─────────────────────────────────────────────────────────────────────────────

const WebSocket = require("ws");

/**
 * createDeepgramLiveSession
 *
 * Opens a Deepgram STT WebSocket and returns a thin controller object so the
 * caller (interviewSocket) can pipe audio into it and receive transcripts.
 *
 * @param {(transcript: string, isFinal: boolean) => void} onTranscript
 *   Called whenever Deepgram returns a transcript segment.
 *   `isFinal` is true when the utterance is complete.
 *
 * @param {(err: Error) => void} onError
 *   Called on any fatal connection / stream error.
 *
 * @returns {{ sendAudio, keepAlive, finish }}
 */
function createDeepgramLiveSession(onTranscript, onError) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    onError(new Error("DEEPGRAM_API_KEY is not set in environment"));
    return null;
  }

  // ── Open a live transcription connection using raw WebSockets ──────────────
  const url =
    "wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&interim_results=true&utterance_end_ms=1500&encoding=linear16&sample_rate=16000&channels=1";

  const live = new WebSocket(url, ["token", apiKey]);

  // ── Event listeners ───────────────────────────────────────────────────────
  live.on("open", () => {
    console.log("[STT] ✅ Deepgram live connection opened");
  });

  live.on("message", (data) => {
    try {
      const response = JSON.parse(data.toString());

      if (response.type === "UtteranceEnd") {
        console.log("[STT] 🔇 UtteranceEnd received");
        onTranscript("", true); // empty final to signal end-of-utterance
        return;
      }

      const channel = response?.channel;
      const transcript = channel?.alternatives?.[0]?.transcript ?? "";

      if (!transcript) return;

      const isFinal = response.is_final === true;
      console.log(`[STT] ${isFinal ? "FINAL" : "interim"}: "${transcript}"`);
      onTranscript(transcript, isFinal);
    } catch (e) {
      console.error("[STT] ⚠️ Error parsing Deepgram message:", e.message);
    }
  });

  live.on("error", (err) => {
    console.error("[STT] ❌ Deepgram error:", err);
    onError(err);
  });

  live.on("close", () => {
    console.log("[STT] 🔒 Deepgram live connection closed");
  });

  // ── Public controller ─────────────────────────────────────────────────────
  return {
    /**
     * Pipe a raw audio chunk from the browser into Deepgram.
     * @param {Buffer | ArrayBuffer} chunk
     */
    sendAudio(chunk) {
      if (live.readyState === WebSocket.OPEN) {
        live.send(chunk);
      }
    },

    /**
     * Blueprint §1 keepAlive — call this every 2 s while waiting for AI/TTS
     * so Deepgram doesn't time out the WebSocket.
     */
    keepAlive() {
      if (live.readyState === WebSocket.OPEN) {
        live.send(JSON.stringify({ type: "KeepAlive" }));
      }
    },

    /**
     * Gracefully close the Deepgram connection when the user is done.
     */
    finish() {
      if (live.readyState === WebSocket.OPEN) {
        // Send a CloseStream message to let Deepgram finish processing
        live.send(JSON.stringify({ type: "CloseStream" }));
      }
    },
  };
}

module.exports = { createDeepgramLiveSession };

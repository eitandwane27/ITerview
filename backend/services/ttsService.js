// backend/services/ttsService.js
// ─────────────────────────────────────────────────────────────────────────────
// Deepgram TTS — REST "Speak" service
//
// Blueprint ref: system-blueprint.md § Phase 1 – TTS Generation (Speak)
//   "Backend requests audio buffer from Deepgram TTS via REST API and
//    streams it back to the client."
//
// Voice model : aura-2-luna-en
// Endpoint    : POST https://api.deepgram.com/v1/speak?model=aura-2-luna-en
// Auth        : Bearer  DEEPGRAM_API_KEY  (never sent to the frontend)
// ─────────────────────────────────────────────────────────────────────────────

const https = require("https");

// Global persistent HTTPS agent to reuse TCP/TLS connections
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
});

/**
 * synthesizeSpeech(text)
 *
 * Calls the Deepgram TTS REST API and resolves with a Buffer containing
 * the raw MP3 audio.  The route layer is responsible for piping / sending
 * that buffer to the HTTP client.
 *
 * @param {string} text  — The text to convert to speech (max ~2000 chars).
 * @returns {Promise<Buffer>} — MP3 audio bytes from Deepgram.
 */
function synthesizeSpeech(text, voiceModel = "aura-2-luna-en") {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return reject(new Error("DEEPGRAM_API_KEY is not set in environment"));
    }

    if (!text || typeof text !== "string" || text.trim() === "") {
      return reject(
        new Error("synthesizeSpeech: 'text' must be a non-empty string"),
      );
    }

    // ── Request body ──────────────────────────────────────────────────────
    const body = JSON.stringify({ text: text.trim() });

    // ── Request options ───────────────────────────────────────────────────
    const options = {
      hostname: "api.deepgram.com",
      path: `/v1/speak?model=${voiceModel}`,
      method: "POST",
      agent: keepAliveAgent,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    // ── Make the request ──────────────────────────────────────────────────
    const perfStart = Date.now(); // [PERF] wall-clock start
    let firstByteMs = null;       // [PERF] time-to-first-byte

    const req = https.request(options, (res) => {
      // Non-2xx response → collect error body and reject
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          reject(
            new Error(
              `Deepgram TTS returned HTTP ${res.statusCode}: ${errBody}`,
            ),
          );
        });
        return;
      }

      // Collect the binary chunks
      const chunks = [];
      res.on("data", (chunk) => {
        if (firstByteMs === null) {
          firstByteMs = Date.now() - perfStart;
          console.log(`[TTS] ⏱  Deepgram started responding in ${(firstByteMs / 1000).toFixed(2)}s`);
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const totalMs = Date.now() - perfStart;
        const bufferKb = (Buffer.concat(chunks).length / 1024).toFixed(1);
        console.log(
          `[TTS] ✅ Audio generated completely in ${(totalMs / 1000).toFixed(2)}s (Size: ${bufferKb} KB)`
        );
        resolve(Buffer.concat(chunks));
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Deepgram TTS request failed: ${err.message}`));
    });

    // Write body and close the request
    req.write(body);
    req.end();
  });
}

/**
 * streamSpeech(text, voiceModel, onChunk, onEnd, onError)
 *
 * Calls the Deepgram TTS API with chunked response and streams the chunks
 * to the onChunk callback in real-time.
 *
 * @param {string} text - The text to speak.
 * @param {string} voiceModel - The voice model to use.
 * @param {Function} onChunk - Callback when a binary chunk is received.
 * @param {Function} onEnd - Callback when streaming completes.
 * @param {Function} onError - Callback when an error occurs.
 */
function streamSpeech(text, voiceModel = "aura-2-luna-en", onChunk, onEnd, onError) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return onError(new Error("DEEPGRAM_API_KEY is not set in environment"));
  }

  if (!text || typeof text !== "string" || text.trim() === "") {
    return onError(new Error("streamSpeech: 'text' must be a non-empty string"));
  }

  const body = JSON.stringify({ text: text.trim() });
  const options = {
    hostname: "api.deepgram.com",
    path: `/v1/speak?model=${voiceModel}`,
    method: "POST",
    agent: keepAliveAgent,
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const perfStart = Date.now();
  let firstByteMs = null;

  const req = https.request(options, (res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      let errBody = "";
      res.on("data", (chunk) => (errBody += chunk));
      res.on("end", () => {
        onError(new Error(`Deepgram TTS returned HTTP ${res.statusCode}: ${errBody}`));
      });
      return;
    }

    res.on("data", (chunk) => {
      if (firstByteMs === null) {
        firstByteMs = Date.now() - perfStart;
        console.log(`[TTS] ⏱  Deepgram started responding in ${(firstByteMs / 1000).toFixed(2)}s`);
      }
      onChunk(chunk);
    });

    res.on("end", () => {
      const totalMs = Date.now() - perfStart;
      console.log(`[TTS] ✅ Streaming completed in ${(totalMs / 1000).toFixed(2)}s`);
      onEnd();
    });
  });

  req.on("error", (err) => {
    onError(new Error(`Deepgram TTS request failed: ${err.message}`));
  });

  req.write(body);
  req.end();
}

module.exports = { synthesizeSpeech, streamSpeech };

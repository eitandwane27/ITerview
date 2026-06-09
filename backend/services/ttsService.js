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
function synthesizeSpeech(text) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return reject(new Error("DEEPGRAM_API_KEY is not set in environment"));
    }

    if (!text || typeof text !== "string" || text.trim() === "") {
      return reject(new Error("synthesizeSpeech: 'text' must be a non-empty string"));
    }

    // ── Request body ──────────────────────────────────────────────────────
    const body = JSON.stringify({ text: text.trim() });

    // ── Request options ───────────────────────────────────────────────────
    const options = {
      hostname: "api.deepgram.com",
      path: "/v1/speak?model=aura-2-luna-en",
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    // ── Make the request ──────────────────────────────────────────────────
    const req = https.request(options, (res) => {
      // Non-2xx response → collect error body and reject
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          reject(
            new Error(
              `Deepgram TTS returned HTTP ${res.statusCode}: ${errBody}`
            )
          );
        });
        return;
      }

      // Collect the binary chunks
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });

    req.on("error", (err) => {
      reject(new Error(`Deepgram TTS request failed: ${err.message}`));
    });

    // Write body and close the request
    req.write(body);
    req.end();
  });
}

module.exports = { synthesizeSpeech };

// backend/routes/ttsRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// TTS Route — keeps server.js clean (blueprint § 7 Modular Backend Structure)
//
// Mounted at : /api/tts          (registered in server.js)
//
// POST /api/tts/speak
//   Body : { "text": "Hello, let's start your interview." }
//   Returns : audio/mpeg binary stream (MP3)
//
// The frontend fetches this endpoint, receives the MP3 bytes, and plays
// them through an <audio> element or the Web Audio API.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { synthesizeSpeech } = require("../services/ttsService");

// POST /api/tts/speak
router.post("/speak", async (req, res) => {
  const { text } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "'text' field is required and must be a non-empty string." });
  }

  try {
    console.log(`[TTS] Synthesizing speech for: "${text.substring(0, 60)}…"`);

    const audioBuffer = await synthesizeSpeech(text);

    // ── Stream audio back to the client ─────────────────────────────────
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      // Prevent the browser from caching different texts under the same URL
      "Cache-Control": "no-store",
    });

    res.send(audioBuffer);
    console.log(`[TTS] ✅ Streamed ${audioBuffer.length} bytes of audio`);
  } catch (err) {
    console.error("[TTS] ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

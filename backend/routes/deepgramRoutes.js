const express = require("express");
const router = express.Router();

// GET /api/deepgram/token
// Securely serves the Deepgram API key to the frontend.
// This keeps the key out of frontend code while allowing the browser
// to open a WebSocket directly to Deepgram (same pattern as the prototype).
router.get("/token", (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DEEPGRAM_API_KEY not set on server" });
  }
  res.json({ token: apiKey });
});

module.exports = router;

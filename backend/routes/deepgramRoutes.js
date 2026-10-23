const express = require("express");
const router = express.Router();

// GET /api/deepgram/token
// Mint a short-lived usage token. The long-lived key stays on the server.
// School authentication is enforced by the /api/deepgram mount in server.js.
router.get("/token", async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Speech service is not configured" });
  }
  try {
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: 30 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Log only our own messages and the HTTP status, never provider bodies.
      if (response.status === 401 || response.status === 403) {
        console.error(`[Deepgram] Token grant rejected (HTTP ${response.status}). Check DEEPGRAM_API_KEY; token grants require a valid key with Member permissions or higher.`);
        return res.status(502).json({ error: "Speech service is not configured correctly. Please contact support." });
      }
      console.error(`[Deepgram] Token grant failed (HTTP ${response.status}).`);
      return res.status(502).json({ error: "Could not initialize speech service. Please try again." });
    }
    const grant = await response.json();
    if (typeof grant.access_token !== 'string' || !grant.access_token.trim() ||
        grant.access_token === apiKey || !Number.isFinite(grant.expires_in) ||
        grant.expires_in <= 0 || grant.expires_in > 30) {
      throw new Error('Invalid token grant');
    }
    return res.json({ token: grant.access_token, expiresIn: grant.expires_in });
  } catch (error) {
    // Provider bodies/errors may contain credentials; never return or log them.
    console.error(error?.name === 'TimeoutError'
      ? '[Deepgram] Token grant timed out.'
      : '[Deepgram] Token grant request failed or returned an invalid grant.');
    return res.status(502).json({ error: "Could not initialize speech service. Please try again." });
  }
});

module.exports = router;

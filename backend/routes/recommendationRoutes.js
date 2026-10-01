const express = require("express");
const {
  MAX_MESSAGE_LENGTH,
  AssistantUnavailableError,
  createRecommendationReply,
  getRoleCatalogue,
} = require("../services/roleRecommendationService");

const router = express.Router();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestWindows = new Map();

function limitPublicChat(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = requestWindows.get(key);

  if (requestWindows.size > 1000) {
    for (const [storedKey, window] of requestWindows) {
      if (now - window.startedAt >= WINDOW_MS) requestWindows.delete(storedKey);
    }
  }

  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: "You have reached the chat limit. Please try again in a few minutes.",
    });
  }

  current.count += 1;
  return next();
}

router.get("/roles", (req, res) => {
  res.json({ roles: getRoleCatalogue() });
});

router.post("/chat", limitPublicChat, express.json({ limit: "12kb" }), async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "A message is required." });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    });
  }

  try {
    const result = await createRecommendationReply({
      message,
      history: req.body?.history,
    });
    const recommendedRole = result.recommendedRoleId
      ? getRoleCatalogue().find((role) => role.id === result.recommendedRoleId)
      : null;

    return res.json({ ...result, recommendedRole });
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      return res.status(503).json({ error: error.message });
    }
    console.error("[RoleRecommendation] Request failed");
    return res.status(500).json({
      error: "The ITerview assistant is temporarily unavailable. Please try again.",
    });
  }
});

router.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "The chat request is too large. Please start a new conversation." });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The chat request must contain valid JSON." });
  }
  return next(error);
});

module.exports = router;

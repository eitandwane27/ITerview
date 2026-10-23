const express = require("express");
const {
  MAX_MESSAGE_LENGTH,
  MAX_WEB_SEARCH_CALLS,
  AssistantUnavailableError,
  createRecommendationReply,
  getRoleCatalogue,
} = require("../services/roleRecommendationService");
const { isWebSearchConfigured } = require("../services/chatbotWebSearchService");
const { createGuestChatLimit } = require("../middleware/guestChatLimit");

function createRecommendationRouter({ limitChat = createGuestChatLimit() } = {}) {
  const router = express.Router();

  router.get("/roles", (req, res) => {
    res.json({ roles: getRoleCatalogue() });
  });

  // Configuration status only; no credentials, provider requests, or search credits.
  router.get("/capabilities", (req, res) => {
    res.json({ webSearchEnabled: isWebSearchConfigured(), maxSearchesPerReply: MAX_WEB_SEARCH_CALLS });
  });

  router.post("/chat", express.json({ limit: "12kb" }), (req, res, next) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!message) {
      return res.status(400).json({ error: "A message is required." });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      });
    }

    return next();
  }, limitChat, async (req, res) => {
    const message = req.body.message.trim();
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

  return router;
}

module.exports = createRecommendationRouter();
module.exports.createRecommendationRouter = createRecommendationRouter;

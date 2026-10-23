const express = require("express");
const { requireSchoolUser } = require("../middleware/schoolAuth");
const { createGuestChatLimit } = require("../middleware/guestChatLimit");
const { COACH_CHAT_LIMITS } = require("../services/guestChatLimitService");
const { loadCoachProgress } = require("../services/coachProgressService");
const { MAX_MESSAGE_LENGTH, createRecommendationReply, AssistantUnavailableError } = require("../services/roleRecommendationService");

function createCoachRouter({ authenticate = requireSchoolUser, loadProgress = loadCoachProgress,
  reply = createRecommendationReply, limitChat = createGuestChatLimit({
    getIdentity: req => `account-coach:${req.auth.uid}`, audience: "coach", limits: COACH_CHAT_LIMITS,
  }) } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.query.uid && req.query.uid !== req.auth.uid) {
      return res.status(403).json({ error: "You can only review your own progress." });
    }
    next();
  });
  router.get("/context", async (req, res) => {
    try {
      const progress = await loadProgress(req.auth.uid);
      return res.json({ context: progress.snapshot });
    } catch {
      return res.status(503).json({ error: "Your progress could not be loaded. Please try again." });
    }
  });
  router.post("/chat", express.json({ limit: "12kb" }), (req, res, next) => {
    if ([req.body?.uid, req.body?.firebaseUid].some(uid => uid && uid !== req.auth.uid)) {
      return res.status(403).json({ error: "You can only review your own progress." });
    }
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Enter a message of 1–${MAX_MESSAGE_LENGTH} characters.` });
    }
    next();
  }, limitChat, async (req, res) => {
    try {
      // Always read fresh server-owned context. Body/history cannot select an
      // account, supply progress, or grant permissions to the model.
      const progress = await loadProgress(req.auth.uid);
      const result = await reply({ message: req.body.message.trim(), history: req.body.history }, {
        progressContext: progress.context, allowWebSearch: true,
      });
      return res.json({ reply: result.reply, mode: result.mode, context: progress.snapshot,
        ...(result.sources ? { sources: result.sources } : {}),
        ...(result.searchStatus ? { searchStatus: result.searchStatus } : {}),
      });
    } catch (error) {
      return res.status(503).json({ error: error instanceof AssistantUnavailableError
        ? error.message : "Your coach could not load your progress or respond. Please try again." });
    }
  });
  router.use((error, req, res, next) => {
    if (error.type === "entity.too.large" || error.type === "entity.parse.failed") {
      return res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: "The coach request is invalid or too large. Please shorten your message." });
    }
    next(error);
  });
  return router;
}

module.exports = createCoachRouter();
module.exports.createCoachRouter = createCoachRouter;

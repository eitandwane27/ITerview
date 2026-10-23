const { consumeGuestChat, GUEST_CHAT_LIMITS } = require("../services/guestChatLimitService");

function createGuestChatLimit({ consume = consumeGuestChat, getIdentity = req => req.ip || req.socket.remoteAddress, audience = "guest", limits = GUEST_CHAT_LIMITS } = {}) {
  return async function limitGuestChat(req, res, next) {
    try {
      const result = await consume(getIdentity(req), { limits });
      if (result.allowed) return next();
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      const wait = minutes >= 60
        ? `${Math.ceil(minutes / 60)} hour${minutes > 60 ? "s" : ""}`
        : `${minutes} minute${minutes === 1 ? "" : "s"}`;
      const quota = result.limit === "daily"
        ? `${limits.dailyLimit}-message daily ${audience} limit` : `${limits.windowLimit}-message ${audience} limit for this 30-minute window`;
      res.set("Retry-After", String(result.retryAfterSeconds));
      res.set("Cache-Control", "no-store");
      return res.status(429).json({
        error: `You have reached the ${quota}. Please try again in ${wait}.`,
        limit: result.limit,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    } catch {
      // Do not expose IPs, database details, or credentials in logs/responses.
      res.set("Retry-After", "60");
      return res.status(503).json({ error: "The ITerview assistant is temporarily unavailable. Please try again shortly." });
    }
  };
}

module.exports = { createGuestChatLimit };

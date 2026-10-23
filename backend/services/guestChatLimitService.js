const { createHash } = require("node:crypto");
const GuestChatUsage = require("../models/GuestChatUsage");

const DAILY_LIMIT = 30;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MESSAGE_WINDOW_LIMIT = 10;
const MESSAGE_WINDOW_MS = 30 * 60 * 1000;
const GUEST_CHAT_LIMITS = Object.freeze({ dailyLimit: DAILY_LIMIT, windowLimit: MESSAGE_WINDOW_LIMIT });
const COACH_CHAT_LIMITS = Object.freeze({ dailyLimit: 50, windowLimit: 15 });

function guestKey(address) {
  if (typeof address !== "string" || !address.trim()) throw new Error("Missing guest address");
  // Normalize IPv4-mapped addresses; never persist the raw address or trust a
  // caller-supplied guest ID / forwarded header here.
  const normalized = address.trim().toLowerCase().replace(/^::ffff:/, "");
  return createHash("sha256").update(normalized).digest("hex");
}

function usageUpdate(now, limits) {
  const resetDaily = { $lte: [{ $ifNull: ["$dailyStartedAt", new Date(0)] }, new Date(now.getTime() - DAILY_WINDOW_MS)] };
  const resetWindow = { $lte: [{ $ifNull: ["$windowStartedAt", new Date(0)] }, new Date(now.getTime() - MESSAGE_WINDOW_MS)] };
  return [
    { $set: {
      dailyCount: { $cond: [resetDaily, 0, "$dailyCount"] },
      windowCount: { $cond: [resetWindow, 0, "$windowCount"] },
    } },
    { $set: { requestAllowed: { $and: [
      { $lt: ["$dailyCount", limits.dailyLimit] },
      { $lt: ["$windowCount", limits.windowLimit] },
    ] } } },
    { $set: {
      dailyStartedAt: { $cond: [{ $and: ["$requestAllowed", resetDaily] }, now, "$dailyStartedAt"] },
      windowStartedAt: { $cond: [{ $and: ["$requestAllowed", resetWindow] }, now, "$windowStartedAt"] },
    } },
    { $set: {
      dailyCount: { $add: ["$dailyCount", { $cond: ["$requestAllowed", 1, 0] }] },
      windowCount: { $add: ["$windowCount", { $cond: ["$requestAllowed", 1, 0] }] },
      // Retain the record until BOTH windows expire. TTL removal is cleanup;
      // admission resets expired windows even before MongoDB's TTL sweep runs.
      expiresAt: { $max: [
        { $add: ["$dailyStartedAt", DAILY_WINDOW_MS] },
        { $add: ["$windowStartedAt", MESSAGE_WINDOW_MS] },
      ] },
    } },
  ];
}

function quotaResult(usage, now, limits) {
  if (usage.requestAllowed) return { allowed: true };
  const dailyRemaining = usage.dailyCount >= limits.dailyLimit
    ? new Date(usage.dailyStartedAt).getTime() + DAILY_WINDOW_MS - now.getTime() : 0;
  const windowRemaining = usage.windowCount >= limits.windowLimit
    ? new Date(usage.windowStartedAt).getTime() + MESSAGE_WINDOW_MS - now.getTime() : 0;
  return {
    allowed: false,
    limit: dailyRemaining >= windowRemaining ? "daily" : "window",
    retryAfterSeconds: Math.max(1, Math.ceil(Math.max(dailyRemaining, windowRemaining) / 1000)),
  };
}

async function consumeGuestChat(address, { model = GuestChatUsage, now = new Date(), limits = GUEST_CHAT_LIMITS } = {}) {
  // Fail closed when persistence is down, rather than silently spending AI/search
  // credits without a quota. No unbounded Mongoose buffering during startup.
  if (model.db.readyState !== 1) throw new Error("Guest quota storage unavailable");
  const filter = { _id: guestKey(address) };
  const pipeline = usageUpdate(now, limits);
  const options = { upsert: true, returnDocument: "after", updatePipeline: true, maxTimeMS: 3000 };
  let usage;
  try {
    usage = await model.findOneAndUpdate(filter, pipeline, options).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Two first requests may both try to create the same _id. Retry against the
    // winner's document; the atomic update still enforces both limits.
    usage = await model.findOneAndUpdate(filter, pipeline, { ...options, upsert: false }).lean();
  }
  if (!usage) throw new Error("Guest quota storage unavailable");
  return quotaResult(usage, now, limits);
}

module.exports = {
  consumeGuestChat, guestKey, DAILY_LIMIT, DAILY_WINDOW_MS,
  MESSAGE_WINDOW_LIMIT, MESSAGE_WINDOW_MS,
  GUEST_CHAT_LIMITS, COACH_CHAT_LIMITS,
};

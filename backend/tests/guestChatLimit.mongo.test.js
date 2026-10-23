const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
const mongoose = require("mongoose");
const GuestChatUsage = require("../models/GuestChatUsage");
const {
  consumeGuestChat, guestKey, DAILY_WINDOW_MS, MESSAGE_WINDOW_MS, COACH_CHAT_LIMITS,
} = require("../services/guestChatLimitService");

// Opt in with a test Mongo URI. All writes use a unique temporary collection;
// no production records or AI/search providers are touched.
test("MongoDB guest quotas enforce both windows atomically and persist", {
  skip: !process.env.CHATBOT_LIMIT_TEST_MONGO_URI,
}, async (t) => {
  const collection = `guest_chat_quota_test_${randomUUID().replaceAll("-", "")}`;
  const connection = mongoose.createConnection(process.env.CHATBOT_LIMIT_TEST_MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try { await connection.asPromise(); } catch {
    await connection.close().catch(() => {});
    throw new Error("Test MongoDB connection unavailable");
  }
  t.after(async () => {
    try {
      assert.match(collection, /^guest_chat_quota_test_[a-f0-9]{32}$/);
      await connection.dropCollection(collection);
    } finally { await connection.close(); }
  });
  const model = connection.model("GuestChatQuotaTest", GuestChatUsage.schema, collection);
  await model.init();
  const start = new Date("2026-10-11T12:00:00Z");
  const take = (ip, ms = 0) => consumeGuestChat(ip, { model, now: new Date(start.getTime() + ms) });

  await t.test("10 per window, 30 per day; rejected requests do not spend quota", async () => {
    const ip = "192.0.2.10";
    for (let i = 0; i < 10; i += 1) assert.deepEqual(await take(ip), { allowed: true });
    assert.deepEqual(await take(ip, 1000), { allowed: false, limit: "window", retryAfterSeconds: 1799 });
    const rejected = await model.findById(guestKey(ip)).lean();
    assert.equal(rejected.dailyCount, 10);
    assert.equal(rejected.windowCount, 10);
    assert.deepEqual(await take(ip, MESSAGE_WINDOW_MS - 1), { allowed: false, limit: "window", retryAfterSeconds: 1 });
    for (let i = 0; i < 10; i += 1) assert.deepEqual(await take(ip, MESSAGE_WINDOW_MS), { allowed: true });
    for (let i = 0; i < 10; i += 1) assert.deepEqual(await take(ip, 2 * MESSAGE_WINDOW_MS), { allowed: true });
    assert.deepEqual(await take(ip, 3 * MESSAGE_WINDOW_MS), {
      allowed: false, limit: "daily", retryAfterSeconds: (DAILY_WINDOW_MS - 3 * MESSAGE_WINDOW_MS) / 1000,
    });
    assert.deepEqual(await take(ip, DAILY_WINDOW_MS - 1), { allowed: false, limit: "daily", retryAfterSeconds: 1 });
    assert.deepEqual(await take(ip, DAILY_WINDOW_MS), { allowed: true });
    const reset = await model.findById(guestKey(ip)).lean();
    assert.equal(reset.dailyCount, 1);
    assert.equal(reset.windowCount, 1);
  });

  await t.test("parallel first requests cannot exceed ten", async () => {
    const results = await Promise.all(Array.from({ length: 35 }, () => take("192.0.2.20")));
    assert.equal(results.filter((result) => result.allowed).length, 10);
    assert.equal(results.filter((result) => !result.allowed).length, 25);
    const stored = await model.findById(guestKey("192.0.2.20")).lean();
    assert.equal(stored.dailyCount, 10);
    assert.equal(stored.windowCount, 10);
    assert.ok(stored.expiresAt >= new Date(start.getTime() + DAILY_WINDOW_MS));
    assert.equal(JSON.stringify(stored).includes("192.0.2.20"), false);
  });

  await t.test("coach accounts admit 15 per window and 50 per day without changing guest quotas", async () => {
    const key = "account-coach:quota-test-user";
    const takeCoach = ms => consumeGuestChat(key, { model, limits: COACH_CHAT_LIMITS, now: new Date(start.getTime() + ms) });
    const first = await Promise.all(Array.from({ length: 25 }, () => takeCoach(0)));
    assert.equal(first.filter(result => result.allowed).length, 15);
    assert.equal(first.filter(result => !result.allowed).length, 10);
    assert.equal((await takeCoach(1000)).limit, "window");
    for (const window of [1, 2]) {
      for (let i = 0; i < 15; i += 1) assert.equal((await takeCoach(window * MESSAGE_WINDOW_MS)).allowed, true);
    }
    for (let i = 0; i < 5; i += 1) assert.equal((await takeCoach(3 * MESSAGE_WINDOW_MS)).allowed, true);
    assert.deepEqual(await takeCoach(3 * MESSAGE_WINDOW_MS), {
      allowed: false, limit: "daily", retryAfterSeconds: (DAILY_WINDOW_MS - 3 * MESSAGE_WINDOW_MS) / 1000,
    });
    assert.equal((await model.findById(guestKey(key)).lean()).dailyCount, 50);
    assert.equal((await takeCoach(DAILY_WINDOW_MS)).allowed, true);
    // The same person using guest chat has a separate IP allowance.
    assert.equal((await take("192.0.2.99")).allowed, true);
  });

  await t.test("independent IPs and client reloads keep the expected quotas", async () => {
    assert.deepEqual(await take("192.0.2.21"), { allowed: true });
    // A new model over the persisted collection simulates a new backend process.
    const reloaded = connection.model("ReloadedGuestChatQuotaTest", GuestChatUsage.schema, collection);
    assert.equal((await consumeGuestChat("192.0.2.20", { model: reloaded, now: start })).allowed, false);
    assert.equal((await consumeGuestChat("::ffff:192.0.2.20", { model: reloaded, now: start })).allowed, false);
  });

  await t.test("a short window spanning the daily reset still applies", async () => {
    const ip = "192.0.2.30";
    assert.equal((await take(ip)).allowed, true);
    for (let i = 0; i < 10; i += 1) assert.equal((await take(ip, DAILY_WINDOW_MS - 1000)).allowed, true);
    assert.deepEqual(await take(ip, DAILY_WINDOW_MS), { allowed: false, limit: "window", retryAfterSeconds: 1799 });
    const stored = await model.findById(guestKey(ip)).lean();
    // Denied requests must not start the next daily allowance early.
    assert.equal(stored.dailyStartedAt.getTime(), start.getTime());
    assert.equal(stored.dailyCount, 0);
    assert.equal(stored.expiresAt.getTime(), start.getTime() + DAILY_WINDOW_MS - 1000 + MESSAGE_WINDOW_MS);
    const next = DAILY_WINDOW_MS - 1000 + MESSAGE_WINDOW_MS;
    assert.equal((await take(ip, next)).allowed, true);
    assert.equal((await model.findById(guestKey(ip)).lean()).dailyStartedAt.getTime(), start.getTime() + next);
  });
});

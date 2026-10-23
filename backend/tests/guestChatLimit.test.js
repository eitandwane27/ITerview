const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createGuestChatLimit } = require("../middleware/guestChatLimit");
const { consumeGuestChat, guestKey, COACH_CHAT_LIMITS } = require("../services/guestChatLimitService");

function response() {
  return {
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("daily exhaustion returns a readable wait, quota type, and Retry-After", async () => {
  let providerCalls = 0;
  const res = response();
  const limit = createGuestChatLimit({ consume: async (address) => {
    assert.equal(address, "192.0.2.1");
    return { allowed: false, limit: "daily", retryAfterSeconds: 82800 };
  } });
  await limit({ ip: "192.0.2.1" }, res, () => { providerCalls += 1; });
  assert.equal(providerCalls, 0);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "82800");
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.body.limit, "daily");
  assert.match(res.body.error, /30-message daily guest limit.*23 hours/);
});

test("guest quota failures stop the request without exposing storage details", async () => {
  const res = response();
  let providerCalls = 0;
  const limit = createGuestChatLimit({ consume: async () => { throw new Error("private database details"); } });
  await limit({ ip: "192.0.2.1" }, res, () => { providerCalls += 1; });
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["Retry-After"], "60");
  assert.equal(providerCalls, 0);
  assert.doesNotMatch(JSON.stringify(res.body), /private database/);
});

test("coach policy reaches storage and reports its own daily and window allowances", async () => {
  for (const [kind, expected] of [["daily", /50-message daily coach limit/], ["window", /15-message coach limit for this 30-minute window/]]) {
    const res = response();
    const limit = createGuestChatLimit({ audience: "coach", limits: COACH_CHAT_LIMITS,
      getIdentity: req => `account-coach:${req.auth.uid}`,
      consume: async (key, options) => {
        assert.equal(key, "account-coach:verified-user");
        assert.deepEqual(options.limits, { dailyLimit: 50, windowLimit: 15 });
        return { allowed: false, limit: kind, retryAfterSeconds: 60 };
      },
    });
    await limit({ auth: { uid: "verified-user" } }, res, () => assert.fail("Quota must block"));
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, expected);
  }
});

test("IP keys normalize mapped IPv4 and do not store raw addresses", () => {
  assert.equal(guestKey("::ffff:192.0.2.1"), guestKey("192.0.2.1"));
  assert.notEqual(guestKey("192.0.2.1"), guestKey("192.0.2.2"));
  assert.match(guestKey("192.0.2.1"), /^[a-f0-9]{64}$/);
  assert.throws(() => guestKey(undefined));
});

test("disconnected quota storage fails closed without buffering a query", async () => {
  await assert.rejects(consumeGuestChat("192.0.2.1", {
    model: { db: { readyState: 0 }, findOneAndUpdate() { assert.fail("Must not buffer a write"); } },
  }), /storage unavailable/);
});

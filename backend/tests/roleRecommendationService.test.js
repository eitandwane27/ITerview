const assert = require("node:assert/strict");
const { test } = require("node:test");
const { VALID_ROLES } = require("../config/roleConfig");
const { buildSystemPrompt } = require("../services/chatbotPrompt");
const {
  AssistantUnavailableError,
  createRecommendationReply,
  getRoleCatalogue,
} = require("../services/roleRecommendationService");

test("public role catalogue stays aligned with roleConfig", () => {
  const catalogue = getRoleCatalogue();

  assert.deepEqual(
    catalogue.map((role) => role.id),
    VALID_ROLES
  );
  assert.ok(catalogue.every((role) => role.label && role.topics.length > 0));
  assert.ok(catalogue.every((role) => role.avoidList === undefined));
});

test("chat uses native thinking and returns only the final answer", async () => {
  let payload;
  const client = { chat: { completions: { create: async (input) => {
    payload = input;
    return { choices: [{ finish_reason: "stop", message: {
      reasoning_content: "Synthetic private reasoning marker: do not expose this.",
      content: JSON.stringify({ reply: "Backend Developer fits your interest in APIs and databases.", recommendedRoleId: "backend", confidence: "high" }),
    } }] };
  } } } };
  const result = await createRecommendationReply({ message: "I enjoy APIs and databases." }, { client });
  assert.equal(payload.messages[0].content, buildSystemPrompt());
  assert.deepEqual(payload.thinking, { type: "enabled" });
  assert.equal(payload.reasoning_effort, "high");
  assert.ok(payload.max_tokens >= 4096);
  assert.equal(payload.temperature, undefined);
  assert.equal(result.recommendedRoleId, "backend");
  assert.equal(result.mode, "ai-thinking");
  assert.equal(JSON.stringify(result).includes("private reasoning marker"), false);
});

test("truncated or malformed thinking responses never become scripted recommendations", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const choice of [
    { finish_reason: "length", message: { content: '{"reply":"incomplete' } },
    { finish_reason: "stop", message: { content: "invalid JSON" } },
    { finish_reason: "stop", message: { content: null, reasoning_content: "Only thinking" } },
  ]) {
    const client = { chat: { completions: { create: async () => ({ choices: [choice] }) } } };
    await assert.rejects(createRecommendationReply({ message: "I enjoy APIs and databases." }, { client }), AssistantUnavailableError);
  }
});

test("nothing recovers from one empty final reply without exposing reasoning", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  let calls = 0;
  const payloads = [];
  const client = { chat: { completions: { create: async (payload) => {
    payloads.push(payload);
    calls += 1;
    return { choices: [{ finish_reason: "stop", message: calls === 1
      ? { content: null, reasoning_content: "Synthetic private reasoning" }
      : { content: JSON.stringify({ reply: "That's okay. What part feels least frustrating to try?", recommendedRoleId: null, confidence: "low" }) },
    }] };
  } } } };
  const result = await createRecommendationReply({ message: "nothing", history: [
    { role: "assistant", content: "What part of a project do you enjoy building?" },
  ] }, { client });
  assert.equal(calls, 2);
  assert.equal(result.recommendedRoleId, null);
  assert.equal(result.mode, "ai-thinking");
  assert.equal(logged[0][1].reason, "empty_reply");
  assert.equal(logged[0][1].retrying, true);
  assert.equal(logged[0][1].contentCharacters, 0);
  assert.equal(logged[0][1].hasReasoning, true);
  assert.deepEqual(payloads.map(payload => payload.response_format.type), ["json_object", "text"]);
  assert.deepEqual(payloads[1].thinking, { type: "enabled" });
  assert.equal(payloads[1].reasoning_effort, "high");
  assert.equal(payloads[1].max_tokens, payloads[0].max_tokens);
  assert.ok(payloads[1].messages[0].content.startsWith(buildSystemPrompt()));
  assert.match(payloads[1].messages[0].content, /Example of the required format/);
  assert.deepEqual(payloads[1].messages[1], payloads[0].messages[1]);
  assert.equal(JSON.stringify([logged, result]).includes("private reasoning"), false);
});

test("JSON output recovery handles whitespace and missing choices", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const firstCompletion of [
    { choices: [{ finish_reason: "stop", message: { content: " \n\t " } }] },
    { choices: [] },
  ]) {
    const payloads = [];
    const client = { chat: { completions: { create: async payload => {
      payloads.push(payload);
      return payloads.length === 1 ? firstCompletion : { choices: [{ finish_reason: "stop", message: {
        content: JSON.stringify({ reply: "Cybersecurity fits your security interests.", recommendedRoleId: "cyber-security", confidence: "high" }),
      } }] };
    } } } };
    const result = await createRecommendationReply({ message: "i want to be a white hacker" }, { client });
    assert.equal(result.recommendedRoleId, "cyber-security");
    assert.equal(payloads.length, 2);
    assert.equal(payloads[1].response_format.type, "text");
  }
});

test("invalid JSON receives a different output request and can recover", async (t) => {
  t.mock.method(console, "error", () => {});
  const payloads = [];
  const client = { chat: { completions: { create: async payload => {
    payloads.push(payload);
    return { choices: [{ finish_reason: "stop", message: {
      content: payloads.length === 1 ? "invalid JSON" : JSON.stringify({ reply: "You can practice answers aloud.", recommendedRoleId: null }),
    } }] };
  } } } };
  const result = await createRecommendationReply({ message: "How does ITerview work?" }, { client });
  assert.equal(result.reply, "You can practice answers aloud.");
  assert.deepEqual(payloads.map(payload => payload.response_format.type), ["json_object", "text"]);
});

test("output recovery still rejects unsupported tracks, malformed JSON, and secrets", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  for (const finalContent of [
    JSON.stringify({ reply: "Try this track", recommendedRoleId: "unsupported" }),
    "Here is a plain text answer",
    JSON.stringify({ reply: "sk-synthetic0123456789", recommendedRoleId: "backend" }),
  ]) {
    let calls = 0;
    const client = { chat: { completions: { create: async () => {
      calls += 1;
      return { choices: [{ finish_reason: "stop", message: { content: calls === 1 ? null : finalContent } }] };
    } } } };
    const request = createRecommendationReply({ message: "Help me choose a track" }, { client });
    if (finalContent.includes("synthetic")) {
      const result = await request;
      assert.equal(result.mode, "guarded");
      assert.equal(result.recommendedRoleId, null);
      assert.equal(result.reply.includes("synthetic"), false);
    } else {
      await assert.rejects(request, error => error.reason === "invalid_reply");
    }
    assert.equal(calls, 2);
  }
  assert.equal(JSON.stringify(logged).includes("synthetic"), false);
});

test("provider content filtering is distinguished and never retried", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  let calls = 0;
  const client = { chat: { completions: { create: async () => {
    calls += 1;
    return { choices: [{ finish_reason: "content_filter", message: { content: null } }] };
  } } } };
  await assert.rejects(createRecommendationReply({ message: "Hello" }, { client }),
    error => error.reason === "provider_content_filter");
  assert.equal(calls, 1);
  assert.equal(logged[0][1].finishReason, "content_filter");
  assert.equal(logged[0][1].retrying, false);
});

test("failure metadata logs fixed categories and numeric counts without provider text", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  const marker = "sk-synthetic0123456789";
  const client = { chat: { completions: { create: async () => ({
    id: marker,
    model: marker,
    choices: [{ finish_reason: marker, message: { content: marker, reasoning_content: marker } }],
    usage: { completion_tokens: 32, completion_tokens_details: { reasoning_tokens: marker } },
  }) } } };
  await assert.rejects(createRecommendationReply({ message: "Hello" }, { client }),
    error => error.reason === "unexpected_finish");
  const metadata = logged[0][1];
  assert.equal(metadata.finishReason, "unknown");
  assert.equal(metadata.choiceCount, 1);
  assert.equal(metadata.completionTokens, 32);
  assert.equal(metadata.reasoningTokens, null);
  assert.equal(metadata.hasReasoning, true);
  assert.equal(JSON.stringify(logged).includes(marker), false);
});

test("invalid JSON retries once and persistent invalid output stays unavailable", async (t) => {
  t.mock.method(console, "error", () => {});
  let calls = 0;
  const client = { chat: { completions: { create: async () => {
    calls += 1;
    return { choices: [{ finish_reason: "stop", message: { content: "not JSON" } }] };
  } } } };
  await assert.rejects(createRecommendationReply({ message: "nothing" }, { client }),
    error => error instanceof AssistantUnavailableError && error.reason === "invalid_reply");
  assert.equal(calls, 2);
});

test("temporary provider failure retries inside the original deadline", async (t) => {
  t.mock.method(console, "error", () => {});
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const timeouts = [];
  const formats = [];
  const client = { chat: { completions: { create: async (payload, options) => {
    timeouts.push(options.timeout);
    formats.push(payload.response_format.type);
    if (timeouts.length === 1) {
      now += 1000;
      throw Object.assign(new Error("Synthetic provider body"), { status: 503 });
    }
    return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ reply: "Let's try a small practice step.", recommendedRoleId: null }) } }] };
  } } } };
  const result = await createRecommendationReply({ message: "nothing" }, { client });
  assert.ok(result.reply);
  assert.deepEqual(timeouts, [60000, 59000]);
  assert.deepEqual(formats, ["json_object", "json_object"]);
});

test("authentication, balance, rate limit, and timeout errors do not retry or leak details", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));
  for (const [metadata, reason] of [
    [{ status: 401 }, "provider_auth"],
    [{ status: 402 }, "provider_balance"],
    [{ status: 429 }, "provider_rate_limit"],
    [{ name: "APIConnectionTimeoutError" }, "provider_timeout"],
  ]) {
    let calls = 0;
    const client = { chat: { completions: { create: async () => {
      calls += 1;
      throw Object.assign(new Error("sk-synthetic0123456789"), metadata);
    } } } };
    await assert.rejects(createRecommendationReply({ message: "nothing" }, { client }),
      error => error.reason === reason);
    assert.equal(calls, 1);
    assert.equal(logged.at(-1)[1].retrying, false);
    assert.equal(logged.at(-1)[1].reason, reason);
  }
  assert.equal(JSON.stringify(logged).includes("synthetic"), false);
});

test("insufficient deadline budget stops recovery before a second provider call", async (t) => {
  t.mock.method(console, "error", () => {});
  let now = 0;
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const client = { chat: { completions: { create: async () => {
    calls += 1;
    now = 59999;
    return { choices: [{ finish_reason: "stop", message: { content: null } }] };
  } } } };
  await assert.rejects(createRecommendationReply({ message: "nothing" }, { client }), AssistantUnavailableError);
  assert.equal(calls, 1);
});

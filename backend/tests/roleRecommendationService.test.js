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

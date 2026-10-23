const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  buildDeepSeekRequest,
} = require("../services/voiceAgentAiService");
const {
  buildVoiceAgentSettings,
} = require("../services/voiceAgentService");
const knowledge = require("../services/chatbotKnowledgeService");

const ENV_KEYS = [
  "DEEPSEEK_MODEL",
  "DEEPSEEK_API_KEY",
  "PUBLIC_BASE_URL",
  "VOICE_AGENT_CARTESIA_MODEL_ID",
  "VOICE_AGENT_CARTESIA_SPEED",
  "VOICE_AGENT_CARTESIA_VOICE_ID",
  "VOICE_AGENT_DEEPSEEK_MODEL",
  "VOICE_AGENT_LLM_ENDPOINT_URL",
  "VOICE_AGENT_LLM_PROXY_TOKEN",
  "VOICE_AGENT_PROMPT",
];

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("DeepSeek adapter always disables native thinking", () => {
  process.env.VOICE_AGENT_DEEPSEEK_MODEL = "deepseek-flash";

  const request = buildDeepSeekRequest({
    model: "wrong-model",
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
    thinking: { type: "enabled" },
  });

  assert.equal(request.model, "deepseek-flash");
  assert.deepEqual(request.thinking, { type: "disabled" });
  assert.equal(request.stream, true);
});

test("Voice Agent settings keep Flux, DeepSeek, and managed Cartesia isolated", () => {
  process.env.VOICE_AGENT_LLM_ENDPOINT_URL =
    "https://example.test/api/voice-agent/llm";
  process.env.VOICE_AGENT_LLM_PROXY_TOKEN = "test-token";
  process.env.VOICE_AGENT_DEEPSEEK_MODEL = "deepseek-flash";

  const settings = buildVoiceAgentSettings();

  assert.equal(settings.type, "Settings");
  assert.deepEqual(settings.audio.input, {
    encoding: "linear16",
    sample_rate: 16000,
  });
  assert.equal(settings.agent.listen.provider.version, "v2");
  assert.equal(settings.agent.listen.provider.model, "flux-general-en");
  assert.equal(settings.agent.think.provider.model, "deepseek-flash");
  assert.equal(settings.agent.think.provider.reasoning_mode, "none");
  assert.equal(
    settings.agent.think.endpoint.url,
    "https://example.test/api/voice-agent/llm",
  );
  assert.equal(settings.agent.speak.provider.type, "cartesia");
  assert.equal(settings.agent.speak.provider.model_id, "sonic-3");
  assert.equal(
    settings.agent.speak.provider.voice.id,
    "b7d50908-b17c-442d-ad8d-810c63997ed9",
  );
  assert.equal(settings.agent.speak.endpoint, undefined);
});

test("Voice Agent calls DeepSeek directly when no proxy endpoint is configured", () => {
  delete process.env.VOICE_AGENT_LLM_ENDPOINT_URL;
  delete process.env.VOICE_AGENT_LLM_PROXY_TOKEN;
  process.env.DEEPSEEK_API_KEY = "direct-test-key";

  const settings = buildVoiceAgentSettings();

  assert.equal(
    settings.agent.think.endpoint.url,
    "https://api.deepseek.com/chat/completions",
  );
  assert.equal(
    settings.agent.think.endpoint.headers.authorization,
    "Bearer direct-test-key",
  );
  assert.equal(settings.agent.think.provider.reasoning_mode, "none");
});

function readVoiceKnowledge(prompt) {
  return JSON.parse(prompt.split("Public iTerview reference data (JSON):\n")[1]);
}

test("Nikki receives the same public guide and full role catalogue as the chatbot", () => {
  delete process.env.VOICE_AGENT_PROMPT;
  const prompt = buildVoiceAgentSettings().agent.think.prompt;
  const reference = readVoiceKnowledge(prompt);
  const catalogue = knowledge.getRoleCatalogue();

  assert.ok(prompt.startsWith("Your name is Nikki."));
  assert.ok(prompt.includes("usually respond with three to six spoken sentences"));
  assert.ok(prompt.includes("Ask no more than one question at a time"));
  assert.ok(reference.guide.length > 0);
  assert.deepEqual(reference.guide, knowledge.loadSystemGuide());
  assert.ok(catalogue.length > 0);
  assert.equal(reference.roleCount, catalogue.length);
  assert.deepEqual(reference.roles, catalogue);
});

test("custom Nikki personality prompts retain the shared product knowledge", () => {
  process.env.VOICE_AGENT_PROMPT = "You are Nikki. Keep this custom personality.";
  const prompt = buildVoiceAgentSettings().agent.think.prompt;

  assert.ok(prompt.startsWith(`${process.env.VOICE_AGENT_PROMPT}\n\n`));
  assert.deepEqual(readVoiceKnowledge(prompt).roles, knowledge.getRoleCatalogue());
});

test("assessment preservation guidance survives custom personalities and unavailable progress", () => {
  for (const personality of [undefined, "You are Nikki. Keep this custom personality."]) {
    if (personality === undefined) delete process.env.VOICE_AGENT_PROMPT;
    else process.env.VOICE_AGENT_PROMPT = personality;
    for (const progressContext of [null, { preTestScore: 60, postTestScore: null, nextStage: 'posttest' }]) {
      const prompt = buildVoiceAgentSettings({ progressContext }).agent.think.prompt;
      assert.match(prompt, /Starting fresh practice resets only Sets 1-3/);
      assert.match(prompt, /Never advise retaking or clearing the pre-test because the post-test is unfinished/);
      assert.match(prompt, /An unfinished assessment resumes its saved answers/);
      assert.match(prompt, /one research pair per participant/);
      assert.match(prompt, /This reloads your read-only snapshot; it does not restart practice, erase answers, or reset research assessments/);
      const guide = readVoiceKnowledge(prompt).guide.map(section => section.content).join('\n');
      assert.match(guide, /Starting fresh practice resets only Sets 1-3/);
    }
  }
});

test("new voice sessions refresh their role count and topics from the catalogue", (t) => {
  const catalogue = knowledge.getRoleCatalogue();
  const getCatalogue = t.mock.method(knowledge, "getRoleCatalogue", () => catalogue.slice(0, 1));
  const first = readVoiceKnowledge(buildVoiceAgentSettings().agent.think.prompt);
  getCatalogue.mock.mockImplementation(() => catalogue.slice(0, 2));
  const second = readVoiceKnowledge(buildVoiceAgentSettings().agent.think.prompt);

  assert.equal(first.roleCount, 1);
  assert.deepEqual(first.roles, catalogue.slice(0, 1));
  assert.equal(second.roleCount, 2);
  assert.deepEqual(second.roles, catalogue.slice(0, 2));
});

test("an unavailable guide does not remove Nikki's role knowledge or stop session setup", (t) => {
  t.mock.method(knowledge, "loadSystemGuide", () => null);
  const reference = readVoiceKnowledge(buildVoiceAgentSettings().agent.think.prompt);

  assert.deepEqual(reference.guide, []);
  assert.equal(reference.roleCount, knowledge.getRoleCatalogue().length);
  assert.deepEqual(reference.roles, knowledge.getRoleCatalogue());
});

const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  buildDeepSeekRequest,
} = require("../services/voiceAgentAiService");
const {
  buildVoiceAgentSettings,
} = require("../services/voiceAgentService");

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

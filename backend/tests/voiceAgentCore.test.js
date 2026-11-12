const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  buildDeepSeekRequest,
} = require("../services/voiceAgentAiService");
const {
  buildVoiceAgentSettings,
} = require("../services/voiceAgentService");
const knowledge = require("../services/chatbotKnowledgeService");

test('sign-out has one farewell step after the queued action is accepted', () => {
  const think = buildVoiceAgentSettings().agent.think;
  const tool = think.functions.find(item => item.name === 'sign_out');
  assert.deepEqual(tool.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(tool.defer_until_eot, true);
  assert.match(think.prompt, /call sign_out FIRST/);
  assert.match(think.prompt, /Do not speak a preamble or farewell before the tool call/);
  assert.match(tool.description, /After its scheduled result, speak the requested farewell exactly once/);
  assert.doesNotMatch(think.prompt, /SAY a short, warm goodbye aloud first/);
  assert.match(think.prompt, /Goodbye alone.*does not authorize signing out/);
  assert.match(think.prompt, /other than explicitly requested sign-out through sign_out/);
});

test('Nikki has bounded Dashboard and Playground tools with clarification and success guidance', () => {
  const settings = buildVoiceAgentSettings();
  const tool = settings.agent.think.functions.find(item => item.name === 'open_practice_history');
  assert.deepEqual(tool.parameters.properties, {});
  assert.equal(tool.parameters.additionalProperties, false);
  assert.match(settings.agent.think.prompt, /Wait for the tool result before saying History is open/);
  assert.match(settings.agent.think.prompt, /does not refresh your saved progress snapshot/);
  const progress = settings.agent.think.functions.find(item => item.name === 'open_my_progress');
  assert.deepEqual(progress.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(progress.defer_until_eot, true);
  assert.match(settings.agent.think.prompt, /Wait for the tool result before saying My Progress is open/);
  assert.match(settings.agent.think.prompt, /General questions about scores or improvement alone do not request this tab/);
  assert.match(settings.agent.think.prompt, /Current page awareness supports Practice History, Practice Again, Interview Prep and My Progress/);
  const prep = settings.agent.think.functions.find(item => item.name === 'configure_interview_prep');
  assert.equal(prep.parameters.additionalProperties, false);
  assert.deepEqual(prep.parameters.properties.action.enum, ['configure', 'start', 'resume']);
  assert.match(settings.agent.think.prompt, /Omitted settings stay unchanged/);
  assert.match(settings.agent.think.prompt, /without repetitive confirmation/);
  assert.match(settings.agent.think.prompt, /never discard it to satisfy a change/);
  const practiceAgain = settings.agent.think.functions.find(item => item.name === 'open_practice_again');
  assert.deepEqual(practiceAgain.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(practiceAgain.defer_until_eot, true);
  assert.match(settings.agent.think.prompt, /Wait for the tool result before saying Practice Again is open/);
  assert.match(settings.agent.think.prompt, /A general wish to practise again does not by itself request this tab/);
  assert.match(settings.agent.think.prompt, /it does not start or restart practice, select a question or change saved data/);
  assert.match(practiceAgain.description, /bounded current page context/);
  assert.match(settings.agent.think.prompt, /only Start practice in that dialog begins one-question voice practice/);
  assert.match(settings.agent.think.prompt, /cannot remove\/restore a question or change assessment scores/);
  const coach = settings.agent.think.functions.find(item => item.name === 'open_ai_coach');
  assert.deepEqual(coach.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(coach.defer_until_eot, true);
  assert.match(settings.agent.think.prompt, /Wait for the tool result before saying AI Coach is open/);
  assert.match(settings.agent.think.prompt, /General requests for coaching or help do not by themselves request navigation/);
  assert.match(settings.agent.think.prompt, /it does not send or reset a coach chat, type a message, start practice, change saved data, or supply the tab's contents or conversation/);
  assert.match(settings.agent.think.prompt, /AI Coach text conversation and this Nikki voice conversation are separate/);
  const returning = settings.agent.think.functions.find(item => item.name === 'return_to_playground');
  assert.deepEqual(returning.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.equal(returning.defer_until_eot, true);
  assert.match(settings.agent.think.prompt, /For an ambiguous "go back"/);
  assert.match(settings.agent.think.prompt, /Do not call a navigation tool until the destination is resolved/);
  assert.match(settings.agent.think.prompt, /A short confirmation answers that question/);
  assert.match(settings.agent.think.prompt, /keeps the same voice conversation connected/);
});

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

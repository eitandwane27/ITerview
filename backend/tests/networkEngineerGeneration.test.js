const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { getQuestionTopicIndex } = require('../utils/questionTopicCoverage');
const { getEasySet1QuestionIssue } = require('../utils/easySet1QuestionGuard');
const { getMediumSet1QuestionIssue, getMediumSet2QuestionIssue } = require('../utils/mediumQuestionGuard');
const { getHardSet1QuestionIssue } = require('../utils/hardSet1QuestionGuard');
const { getEasySet2QuestionIssue } = require('../utils/easySet2QuestionGuard');
const { getHardSet2QuestionIssue } = require('../utils/hardSet2QuestionGuard');
const { SET1_FALLBACK_SUPPLEMENTS } = require('../config/set1QuestionFallbacks');
const networkFallbacks = require('../config/roles/networkEngineerFallbacks');

// Only the provider boundary is replaced. Real prompts, guards, scope selection,
// speech cleanup, recovery banks, and history tracking run without credentials.
function harness(set, output) {
  const filename = path.resolve(__dirname, `../services/aiSet${set}Generator.js`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  loaded.require = id => id !== 'openai' ? normalRequire(id) : { OpenAI: class {
    chat = { completions: { create: async request => {
      requests.push(structuredClone(request));
      if (output instanceof Error) throw output;
      return { choices: [{ message: { content: output } }] };
    } } };
  } };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests, generate: set === 1 ? loaded.exports.generateSet1Question : loaded.exports.generateSet2Question };
}

const set1Guards = { easy: getEasySet1QuestionIssue, medium: getMediumSet1QuestionIssue, hard: getHardSet1QuestionIssue };
const set2Guards = { easy: getEasySet2QuestionIssue, medium: getMediumSet2QuestionIssue, hard: getHardSet2QuestionIssue };
const network = ROLE_CONFIG['network-engineer'];

test('easy correctness rejects a causal explanation while preserving clarity and comparison', () => {
  const question = 'Why might a wireless connection be slower than a wired connection?';
  assert.ok(getEasySet1QuestionIssue(question, 'focus_correctness'));
  assert.equal(getEasySet1QuestionIssue(question, 'focus_clarity'), null);
  assert.equal(getEasySet1QuestionIssue('How does TCP delivery differ from UDP delivery?', 'focus_correctness'), null);
});

test('medium correctness reserves mechanism explanations for clarity', () => {
  const question = 'How does TCP use acknowledgements to provide reliable ordered delivery?';
  assert.ok(getMediumSet1QuestionIssue(question, 'focus_correctness'));
  assert.equal(getMediumSet1QuestionIssue(question, 'focus_clarity'), null);
  assert.equal(getMediumSet1QuestionIssue('How does TCP ordering differ from UDP delivery?', 'focus_correctness'), null);
});

test('network premise guard rejects false firewall and blocked-link failover assumptions', () => {
  const { getTechnicalPremiseIssue } = require('../utils/technicalQuestionPremise');
  assert.ok(getTechnicalPremiseIssue('A reply bypasses the firewall entirely; how does that cause the reply to be dropped?'));
  assert.ok(getTechnicalPremiseIssue('A stateful firewall receives a reply on a different interface; why does it drop the reply?'));
  assert.ok(getTechnicalPremiseIssue('A spanning tree blocked link later fails; how does this restore connectivity?'));
  assert.equal(getTechnicalPremiseIssue('A reply crosses a stateful firewall requiring connection state that it lacks; what happens to the reply?'), null);
  assert.equal(getTechnicalPremiseIssue('The forwarding link fails and spanning tree can converge on a redundant link; how does that restore connectivity?'), null);
});

test('network evidence guards require DNS observations and explicit route withdrawal', () => {
  const { getTechnicalPremiseIssue } = require('../utils/technicalQuestionPremise');
  const dns = 'A user can ping a server by address but hostname access fails; what does this suggest about DNS?';
  assert.ok(getTechnicalPremiseIssue(dns));
  assert.ok(getMediumSet1QuestionIssue(dns, 'focus_correctness'));
  assert.ok(getTechnicalPremiseIssue(dns.replace(' about DNS', '')));
  assert.ok(getTechnicalPremiseIssue('A more specific installed route has an unusable next hop; why does a less specific route get chosen?'));
  assert.equal(getTechnicalPremiseIssue('A DNS lookup fails; what resolver setting should you check first?'), null);
  assert.equal(getTechnicalPremiseIssue('The more specific route is withdrawn because its next hop is unreachable; what installed route can provide fallback forwarding?'), null);
});


test('every Network Engineer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(network, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(network, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of networkFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('Network Engineer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === network.id).label, network.label);
  assert.match(buildSystemPrompt(), /"id": "network-engineer"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try Network Engineer.', recommendedRoleId: network.id })).recommendedRoleId, network.id);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Network Engineer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(network, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[network.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, network.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Network Engineer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /A successful outbound path does not prove a reply path exists/);
    }
  });

  test(`Network Engineer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(network, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(network.id, difficulty, history);
      assert.ok(networkFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /Network Engineer/);
  });
}

test('Network Engineer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = network.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, network.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = network.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(network.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('Network Engineer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', network.id, 'easy', [])
      : provider.generate(network.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});

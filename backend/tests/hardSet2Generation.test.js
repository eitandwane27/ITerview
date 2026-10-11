const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { HARD_TECHNICAL_FALLBACKS } = require('../config/hardTechnicalFallbacks');
const { HARD_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
const { getHardSet2QuestionIssue: guard } = require('../utils/hardSet2QuestionGuard');
const { sanitizeTTS } = require('../utils/ttsSanitizer');
const variety = require('../utils/technicalQuestionVariety');
const { getQuestionTopicCoverage, getQuestionTopicIndex, rememberQuestionTopic } = require('../utils/questionTopicCoverage');
const { selectTechnicalQuestionFallback } = require('../utils/technicalQuestionFallback');
const { technicalQuestionProvider } = require('./fixtures/technicalQuestionProvider');

function providerHarness(outputs, { roleData, sanitizer } = {}) {
  const filename = path.resolve(__dirname, '../services/aiSet2Generator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  loaded.require = id => {
    if (id === 'openai') return { OpenAI: class {
      chat = { completions: { create: async request => {
        requests.push(structuredClone(request));
        const output = typeof outputs === 'function' ? outputs(request, requests.length) : outputs.shift();
        if (output instanceof Error) throw output;
        return { choices: [{ message: { content: output } }] };
      } } };
    } };
    if (id === '../config/roleConfig' && roleData) return {
      ...normalRequire(id), getRoleConfig: () => roleData,
    };
    if (id === '../utils/ttsSanitizer' && sanitizer) return { sanitizeTTS: sanitizer };
    return normalRequire(id);
  };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests, ...loaded.exports };
}

test('every hard role has eight calibrated formats and a separate spoken fallback covering every topic', () => {
  for (const role of Object.values(ROLE_CONFIG)) {
    const config = getRoleSetConfig(role, 'set2', 'hard');
    assert.deepEqual(new Set(config.hardExamples.map(variety.getTechnicalQuestionFormat)), new Set(HARD_TECHNICAL_FORMATS));
    const bank = HARD_TECHNICAL_FALLBACKS[role.id];
    assert.deepEqual(new Set(bank.map(([, q]) => variety.getTechnicalQuestionFormat(q))), new Set(HARD_TECHNICAL_FORMATS));
    assert.equal(new Set(bank.map(([topic]) => topic)).size, config.topicScope.length);
    for (const q of config.hardExamples) {
      assert.equal(guard(q), null, q);
      assert.equal(guard(sanitizeTTS(q)), null, q);
    }
    for (const [topic, q] of bank) {
      assert.ok(!config.hardExamples.includes(q), 'fallback content stays separate from calibration');
      const index = config.topicScope.findIndex(scope => scope.split(':')[0] === topic);
      assert.ok(index >= 0, topic);
      assert.notEqual(getQuestionTopicIndex(q, [config.topicKeywords[index]]), -1, q);
      assert.equal(guard(q), null, q);
      assert.equal(guard(sanitizeTTS(q)), null, q);
    }
  }
});

test('hard rejects recall, compound tasks, code, walkthroughs, excess length, and normalized repeats', () => {
  for (const q of [
    'What is a database transaction?', 'What does CORS mean?', 'Should a server hash passwords?',
    'How does a transaction work and when should you add an index?',
    'How does a transaction work and explain server rendering?',
    'What causes this error? How should you fix it?',
    'Walk me through an application from start to finish?',
    'Design an entire enterprise application?',
    'Which command should configure a connection pool?',
    'Which method calls database.query()?',
    'How does `rendering` work?', 'Which localStorage setting keeps a session?',
    'Name three test cases for retries?', `How does ${'a '.repeat(67)}transaction work?`,
  ]) assert.ok(guard(q), q);
  const q = ROLE_CONFIG.backend.set2.hardExamples[0];
  assert.ok(guard(q, [q.toUpperCase().replace('?', '.')]), q);
  assert.ok(guard(q, [], 'testing'));
  assert.match(guard(ROLE_CONFIG.backend.set2.hardExamples[1], [], 'concept'), /causal explanation/);
  assert.equal(guard('A create response is lost after its write succeeds; what should prevent a duplicate retry and why?'), null);
});

for (const roleId of Object.keys(ROLE_CONFIG)) {
  test(`${roleId} hard live generation balances topics and formats independently`, async t => {
    t.mock.method(Math, 'random', () => 0);
    const harness = providerHarness((request, index) => technicalQuestionProvider(
      request.messages[0].content, ROLE_CONFIG, roleId, 'hard', index));
    const history = [];
    for (let i = 0; i < 5; i++) history.push(await harness.generateSet2Question(roleId, 'hard', history));
    assert.equal(harness.requests.length, 5);
    assert.equal(new Set(history.map(variety.getTechnicalQuestionFormat)).size, 5);
    const config = getRoleSetConfig(ROLE_CONFIG[roleId], 'set2', 'hard');
    assert.equal(getQuestionTopicCoverage(history, config.topicKeywords, config.topicScope).filter(n => n > 0).length, 5);
    for (const request of harness.requests) {
      const prompt = request.messages[0].content;
      assert.match(prompt, /at most THREE connected reasoning steps/);
      assert.match(prompt, /never exceeding 45/);
      const selected = prompt.match(/SELECTED QUESTION FORMAT: (\w+)/)[1];
      const benchmarks = prompt.split('ADVANCED JUNIOR TECHNICAL BENCHMARKS')[1].split('These examples guide')[0];
      for (const example of config.hardExamples) {
        if (benchmarks.includes(example)) assert.equal(variety.getTechnicalQuestionFormat(example), selected);
      }
    }
  });

  test(`${roleId} hard fallback keeps eight unused formats, diverse topics, and no repeats`, () => {
    const config = getRoleSetConfig(ROLE_CONFIG[roleId], 'set2', 'hard');
    for (const randomValue of [0, 0.5, 0.999]) {
      const history = [];
      for (let i = 0; i < 8; i++) {
        const format = variety.selectTechnicalQuestionFormat('hard', history, () => randomValue);
        const counts = getQuestionTopicCoverage(history, config.topicKeywords, config.topicScope);
        const selected = config.topicScope[counts.indexOf(Math.min(...counts))];
        const fallback = selectTechnicalQuestionFallback(roleId, 'hard', config, history, selected, format.id);
        assert.ok(fallback, `${roleId} question ${i + 1}`);
        assert.equal(guard(fallback.question, history), null);
        rememberQuestionTopic(history, fallback.question, fallback.topic);
        variety.rememberTechnicalQuestionFormat(history, fallback.question, fallback.format);
        history.push(fallback.question);
        if (i === 4) assert.equal(getQuestionTopicCoverage(history, config.topicKeywords, config.topicScope).filter(n => n > 0).length, 5);
      }
      assert.equal(new Set(history).size, 8);
      assert.equal(new Set(history.map(variety.getTechnicalQuestionFormat)).size, 8);
    }
  });
}

test('hard repairs raw and sanitized violations without spending coverage on drafts', async t => {
  t.mock.method(Math, 'random', () => 0);
  t.mock.method(console, 'warn', () => {});
  const good = HARD_TECHNICAL_FALLBACKS.frontend[0][1];
  const rawHarness = providerHarness([good.replace('rendering', '`rendering`'), good]);
  assert.equal(await rawHarness.generateSet2Question('frontend', 'hard'), good);
  assert.equal(rawHarness.requests.length, 2);
  assert.match(rawHarness.requests[1].messages.at(-1).content, /plain spoken English/);
  let calls = 0;
  const sanitizedHarness = providerHarness([good, good], {
    sanitizer: q => ++calls === 1 ? 'What is rendering?' : q,
  });
  assert.equal(await sanitizedHarness.generateSet2Question('frontend', 'hard'), good);
  assert.equal(sanitizedHarness.requests.length, 2);
  assert.equal(variety.selectTechnicalQuestionFormat('hard', [], () => 0).id, 'concept');
});

test('hard accepts another allowed topic immediately and records its actual topic and format', async t => {
  t.mock.method(Math, 'random', () => 0);
  t.mock.method(console, 'warn', () => {});
  const role = structuredClone(ROLE_CONFIG.frontend);
  role.set2.difficultyTopics.hard = {
    topicScope: ['Rendering performance', 'JavaScript execution'], topicKeywords: [['rendering'], ['microtask']],
  };
  const history = ['Why should rendering finish before displaying a completed view?'];
  const good = 'How does rendering provide visible content before application scripts load?';
  const harness = providerHarness([good], { roleData: role });
  assert.equal(await harness.generateSet2Question('frontend', 'hard', history), good);
  assert.match(harness.requests[0].messages[0].content, /targeting this topic: "JavaScript execution"/);
  assert.equal(harness.requests.length, 1);
  history.push(good);
  assert.deepEqual(getQuestionTopicCoverage(history, [['rendering'], ['microtask']], role.set2.difficultyTopics.hard.topicScope), [2, 0]);
  assert.ok(!variety.getLeastUsedTechnicalFormats('hard', history).includes('concept'));
});

test('hard exhausts three repairs into a reviewed fallback, or errors when no eligible bank exists', async t => {
  t.mock.method(Math, 'random', () => 0);
  t.mock.method(console, 'warn', () => {});
  const bad = 'What is rendering?';
  const harness = providerHarness([bad, bad, bad]);
  const history = [];
  const result = await harness.generateSet2Question('frontend', 'hard', history);
  assert.equal(harness.requests.length, 3);
  assert.ok(HARD_TECHNICAL_FALLBACKS.frontend.some(([, q]) => q === result));
  assert.notEqual(result, bad);
  const role = structuredClone(ROLE_CONFIG.frontend);
  role.id = 'no-bank-test';
  const noBank = providerHarness([bad, bad, bad], { roleData: role });
  await assert.rejects(noBank.generateSet2Question(role.id, 'hard'), /suitable hard technical question/);
  assert.equal(noBank.requests.length, 3);
  const config = getRoleSetConfig(ROLE_CONFIG.frontend, 'set2', 'hard');
  const exhausted = HARD_TECHNICAL_FALLBACKS.frontend.map(([, q]) => q.toUpperCase().replace('?', '.'));
  assert.equal(selectTechnicalQuestionFallback('frontend', 'hard', config, exhausted), null);
  for (const output of ['', new Error('Provider unavailable')]) {
    const failing = providerHarness([output]);
    await assert.rejects(failing.generateSet2Question('frontend', 'hard'), /empty question|Provider unavailable/);
    assert.equal(failing.requests.length, 1);
  }
});

test('hard scoring and fallback coaching match each task without senior delivery penalties', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  for (const q of ROLE_CONFIG.backend.set2.hardExamples) {
    const format = variety.getTechnicalQuestionFormat(q);
    const harness = providerHarness([JSON.stringify({ problem_solving_score: 4, accuracy_score: 4, depth_score: 4 })]);
    const empty = await harness.evaluateSet2Answer(q, '', 'hard');
    assert.equal(empty.accuracy_score, 1);
    assert.equal(harness.requests.length, 0);
    const fallback = await harness.evaluateSet2Answer(q, 'A partial answer', 'hard');
    assert.equal(fallback.tip, empty.tip);
    const prompt = harness.requests[0].messages[0].content;
    assert.match(prompt, new RegExp(`REQUESTED TECHNICAL FORMAT: ${format}`));
    assert.match(prompt, /at most three connected reasoning steps/);
    assert.match(prompt, /Do not lower technical scores for hesitation/);
    assert.match(prompt, /contradictory or underspecified premise/);
    assert.doesNotMatch(prompt, /Strict, unyielding|senior-level depth|heavily penalized/);
  }
});

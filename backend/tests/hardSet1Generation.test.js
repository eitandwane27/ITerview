const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { getHardSet1QuestionIssue: guard } = require('../utils/hardSet1QuestionGuard');
const { sanitizeTTS } = require('../utils/ttsSanitizer');
const { getQuestionTopicCoverage, getQuestionTopicIndex } = require('../utils/questionTopicCoverage');
const { hardSet1QuestionProvider } = require('./fixtures/hardSet1QuestionProvider');
const { getEvaluatorRubric } = require('../config/evaluatorRubrics');

function providerHarness(outputs, { roleData, sanitizer } = {}) {
  const filename = path.resolve(__dirname, '../services/aiSet1Generator.js');
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

test('every role has spoken hard benchmarks for each 3C and six list-friendly categories', () => {
  for (const role of Object.values(ROLE_CONFIG)) {
    for (const [focus, questions] of Object.entries(role.set1.hardExamples)) {
      const scope = getRoleSetConfig(role, 'set1', 'hard', focus);
      assert.equal(scope.topicScope.length, 6);
      assert.equal(questions.length, scope.topicScope.length);
      for (const [index, question] of questions.entries()) {
        assert.equal(guard(question, focus), null, `${role.id}: ${question}`);
        assert.equal(guard(sanitizeTTS(question), focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, [scope.topicKeywords[index]]), -1, question);
      }
    }
    assert.notDeepEqual(getRoleSetConfig(role, 'set1', 'hard', 'focus_completeness').topicScope,
      getRoleSetConfig(role, 'set1', 'hard', 'focus_clarity').topicScope);
  }
});

test('hard 3C wording rejects stacked tasks, code, recall, walkthroughs, long questions, and repeats', () => {
  const misses = [
    'How does a transaction work and when should you use it?',
    'How does a transaction work? Give an example.',
    'Explain database transactions, describe a failure case?',
    'Walk me through an entire database transaction from start to finish?',
    'How would you design a complete enterprise system?',
    'What is a database index?',
    'What does ACID stand for?',
    'Does a transaction prevent every lost update?',
    'How does `password` hashing prevent offline guessing?',
    'How does request.save() handle database errors?',
    'How does the userToken field identify a session?',
    `Why ${'does '.repeat(67)}a transaction need rollback?`,
  ];
  for (const question of misses) assert.ok(guard(question, 'focus_clarity'), question);
  const question = ROLE_CONFIG.backend.set1.hardExamples.focus_correctness[0];
  assert.ok(guard(question, 'focus_correctness', [question.toUpperCase().replace('?', '.') ]));
});

test('hard focus boundaries preserve mechanism, precise comparison or outcome, and three-item completeness', () => {
  assert.ok(guard('How does optimistic locking differ from pessimistic locking?', 'focus_clarity'));
  assert.equal(guard('How does optimistic locking differ from pessimistic locking?', 'focus_correctness'), null);
  assert.ok(guard('Why does checking record ownership protect private data?', 'focus_correctness'));
  assert.ok(guard('Name three safeguards for stored passwords?', 'focus_correctness'));
  assert.ok(guard('Which response should control search results?', 'focus_clarity'));
  assert.ok(guard('Explain three protections for stored passwords?', 'focus_clarity'));
  for (const question of [
    'Name two safeguards for stored passwords?',
    'Name three safeguards for stored passwords, including unique salts?',
    'Name three safeguards for stored passwords with an explanation for each?',
    'Name three safeguards for stored passwords and their purposes?',
    'Name three safeguards for stored passwords and why each helps?',
    'Name three safeguards for stored passwords and two API authorization checks?',
  ]) assert.ok(guard(question, 'focus_completeness'), question);
  assert.equal(guard('Name three safeguards for stored passwords?', 'focus_completeness'), null);
  assert.equal(guard('What are three safeguards for stored passwords?', 'focus_completeness'), null);
});

for (const role of Object.values(ROLE_CONFIG)) {
  for (const focus of Object.keys(role.set1.hardExamples)) {
    test(`${role.id} hard ${focus} covers six topics without changing its 3C task`, async () => {
      const history = [];
      const harness = providerHarness((request, call) =>
        hardSet1QuestionProvider(request.messages[0].content, ROLE_CONFIG, role.id, focus, call));
      for (let index = 0; index < 6; index++) {
        const question = await harness.generateSet1Question(focus, role.id, 'hard', history);
        assert.equal(guard(question, focus, history), null);
        history.push(question);
      }
      const scope = getRoleSetConfig(role, 'set1', 'hard', focus);
      assert.deepEqual(getQuestionTopicCoverage(history, scope.topicKeywords, scope.topicScope), Array(6).fill(1));
      assert.equal(harness.requests.length, 6);
      for (const request of harness.requests) {
        assert.match(request.messages[0].content, /ADVANCED JUNIOR 3C/);
        assert.match(request.messages[0].content, /at most THREE connected reasoning steps/);
        assert.doesNotMatch(request.messages.at(-1).content, /benchmark examples above/);
      }
    });
  }
}

test('hard repairs code before sanitation, focus violations, and off-topic drafts without spending coverage', async t => {
  t.mock.method(console, 'warn', () => {});
  let accepted;
  const history = [];
  const harness = providerHarness((request, call) => {
    accepted = hardSet1QuestionProvider(request.messages[0].content, ROLE_CONFIG, 'backend');
    return call === 1 ? 'How does `unsafeCode` hide invalid syntax from the speech sanitizer?'
      : call === 2 ? 'How does a media query keep a layout usable on small screens?' : accepted;
  }, { sanitizer: question => question.includes('unsafeCode') ? accepted : sanitizeTTS(question) });
  assert.equal(await harness.generateSet1Question('focus_clarity', 'backend', 'hard', history), accepted);
  assert.equal(harness.requests.length, 3);
  assert.match(harness.requests[1].messages.at(-1).content, /without code/);
  assert.match(harness.requests[2].messages.at(-1).content, /allowed hard topics/);
  history.push(accepted);
  const scope = getRoleSetConfig(ROLE_CONFIG.backend, 'set1', 'hard', 'focus_clarity');
  assert.equal(getQuestionTopicCoverage(history, scope.topicKeywords, scope.topicScope).reduce((a, b) => a + b), 1);
});

test('hard validates sanitized wording as well as raw wording and retains the same topic during repair', async t => {
  t.mock.method(console, 'warn', () => {});
  let sanitationCalls = 0;
  const harness = providerHarness(request =>
    hardSet1QuestionProvider(request.messages[0].content, ROLE_CONFIG, 'frontend', 'focus_completeness'), {
    sanitizer: question => ++sanitationCalls === 1 ? question.replace('three', 'two') : sanitizeTTS(question),
  });
  const question = await harness.generateSet1Question('focus_completeness', 'frontend', 'hard');
  assert.match(question, /^(?:Name|List) three/);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[0].messages[0].content, harness.requests[1].messages[0].content);
  assert.match(harness.requests[1].messages.at(-1).content, /exactly three/);
});

test('hard exhausts two repairs into a checked 3C fallback and propagates provider or empty responses immediately', async t => {
  t.mock.method(console, 'warn', () => {});
  const invalid = providerHarness(Array(3).fill('Name two safeguards for stored passwords?'));
  const question = await invalid.generateSet1Question('focus_completeness', 'backend', 'hard');
  assert.equal(guard(question, 'focus_completeness'), null);
  assert.equal(invalid.requests.length, 3);
  for (const response of ['', '   ', new Error('Synthetic provider failure')]) {
    const harness = providerHarness([response]);
    await assert.rejects(harness.generateSet1Question('focus_clarity', 'backend', 'hard'));
    assert.equal(harness.requests.length, 1);
  }
});

test('hard uses restored history and repairs normalized repeats', async t => {
  t.mock.method(console, 'warn', () => {});
  const scope = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'hard', 'focus_completeness');
  const history = scope.hardExamples.focus_completeness.slice(0, 5).map(q => q.toUpperCase().replace('?', '.'));
  const harness = providerHarness([scope.hardExamples.focus_completeness[0], scope.hardExamples.focus_completeness[5]]);
  assert.equal(await harness.generateSet1Question('focus_completeness', 'fullstack', 'hard', history),
    scope.hardExamples.focus_completeness[5]);
  assert.equal(harness.requests.length, 2);
  assert.ok(harness.requests[0].messages[0].content.includes(`targeting this topic: "${scope.topicScope[5]}"`));
});

test('new roles inherit hard 3C validation without hard-coded generator content', async () => {
  const roleData = structuredClone(ROLE_CONFIG.backend);
  roleData.id = 'qa-test';
  roleData.label = 'QA Test Engineer';
  roleData.set1.difficultyTopics.hard = { topicScope: ['Defect reproduction: explaining reliable evidence'], topicKeywords: [['defect', 'reproduction']] };
  roleData.set1.hardExamples.focus_clarity = ['How does reliable defect reproduction help confirm that a fix addresses the observed failure?'];
  const question = roleData.set1.hardExamples.focus_clarity[0];
  const harness = providerHarness([question], { roleData });
  assert.equal(await harness.generateSet1Question('focus_clarity', 'qa-test', 'hard'), question);
  assert.ok(harness.requests[0].messages[0].content.includes('QA Test Engineer'));
});

test('hard 3C scoring is independent and task-aware with fresh-graduate shared anchors', async t => {
  t.mock.method(console, 'log', () => {});
  const output = JSON.stringify({ clarity_score: 4, correctness_score: 5, completeness_score: 2,
    tip: 'Include the third distinct safeguard.', interviewer_reply: 'Your first two safeguards are relevant. Add one more distinct safeguard.' });
  const harness = providerHarness([output]);
  const result = await harness.evaluateSet1Answer('Name three safeguards for stored passwords?', 'Unique salts and a slow password hash.', 'hard');
  assert.equal(result.correctness_score, 5);
  assert.equal(result.completeness_score, 2);
  const prompt = harness.requests[0].messages[0].content;
  assert.match(prompt, /HARD SET 1 SCORING: ADVANCED JUNIOR 3C/);
  assert.match(prompt, /THREE distinct relevant items/);
  assert.match(prompt, /never penalize technical correctness solely for delivery/);
  assert.match(prompt, /without an unsolicited reason/);
  assert.doesNotMatch(prompt, /unyielding|senior-level depth|heavily penalized/);
  assert.match(getEvaluatorRubric('hard'), /Fresh IT Graduate/);
  assert.match(getEvaluatorRubric('hard'), /FRESH GRADUATE SCORE ANCHORS/);
  assert.match(prompt, /FRESH GRADUATE SCORE ANCHORS/);
  assert.doesNotMatch(getEvaluatorRubric('hard'), /unyielding|senior-level depth|heavily penalized/);
});

test('hard fallback coaching keeps three-item lists bounded and empty answers avoid an AI call', async t => {
  t.mock.method(console, 'error', () => {});
  const harness = providerHarness(Array(2).fill(JSON.stringify({ clarity_score: 4, correctness_score: 4, completeness_score: 4 })));
  const list = await harness.evaluateSet1Answer('Name three safeguards for stored passwords?', 'A partial answer.', 'hard');
  assert.match(list.tip, /three distinct relevant items/);
  const mechanism = await harness.evaluateSet1Answer('Why does an index increase database write costs?', 'A partial answer.', 'hard');
  assert.match(mechanism.tip, /specific mechanism, distinction, or outcome/);
  const empty = await harness.evaluateSet1Answer('Name three safeguards for stored passwords?', '', 'hard');
  assert.deepEqual([empty.clarity_score, empty.correctness_score, empty.completeness_score], [1, 1, 1]);
  assert.equal(harness.requests.length, 2);
});

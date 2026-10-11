const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { normalizeQuestionDraft, getQuestionSentenceIssue } = require('../utils/questionWording');
const { getEasySet1QuestionIssue } = require('../utils/easySet1QuestionGuard');
const { getMediumSet1QuestionIssue, getMediumSet2QuestionIssue } = require('../utils/mediumQuestionGuard');
const { getHardSet1QuestionIssue } = require('../utils/hardSet1QuestionGuard');
const { getEasySet2QuestionIssue } = require('../utils/easySet2QuestionGuard');
const { getHardSet2QuestionIssue } = require('../utils/hardSet2QuestionGuard');
const { getBehavioralQuestionIssue } = require('../utils/behavioralQuestionGuard');
const { BEHAVIORAL_COMPETENCIES } = require('../config/behavioralInterviewConfig');
const { selectSet1QuestionFallback } = require('../utils/set1QuestionFallback');
const { getQuestionTopicCoverage, getQuestionTopicIndex } = require('../utils/questionTopicCoverage');
const { sanitizeTTS } = require('../utils/ttsSanitizer');

function failingProviderHarness() {
  const filename = path.resolve(__dirname, '../services/aiSet1Generator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  const requests = [];
  let output = 'Walk me through an entire application from start to finish?';
  loaded.require = id => id !== 'openai' ? originalRequire(id) : { OpenAI: class {
    chat = { completions: { create: async request => {
      requests.push(structuredClone(request));
      if (output instanceof Error) throw output;
      return { choices: [{ message: { content: typeof output === 'function' ? output(request) : output } }] };
    } } };
  } };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { ...loaded.exports, requests, output(value) { output = value; } };
}

test('presentation normalization handles quotes and numbering without hiding code or extra tasks', () => {
  assert.equal(normalizeQuestionDraft('1. “Why does cache invalidation prevent stale reads?”'), 'Why does cache invalidation prevent stale reads?');
  assert.equal(normalizeQuestionDraft('"What does Node.js do?"'), 'What does Node js do?');
  assert.match(normalizeQuestionDraft('"Which method calls record.save()?"'), /record\.save\(\)/);
  assert.match(normalizeQuestionDraft('How does a transaction work? Write code.'), /Write code/);
});

test('one short context sentence is allowed across technical sets while two tasks remain blocked', () => {
  for (const guard of [getEasySet1QuestionIssue, getMediumSet1QuestionIssue, getHardSet1QuestionIssue,
    getEasySet2QuestionIssue, getMediumSet2QuestionIssue, getHardSet2QuestionIssue]) {
    // Pass no focus/format to exercise only the shared spoken task boundary.
    assert.equal(guard('A record is cached. Why does invalidating its cache prevent stale reads?'), null, guard.name);
    assert.ok(guard('Why invalidate a cache? Explain a database index.'), guard.name);
  }
  assert.ok(getQuestionSentenceIssue('A cache exists. A save succeeds. Why invalidate the cache?'));
});

test('hard clarity accepts natural explanation wording rather than rejecting context words or polite openers', () => {
  for (const question of [
    'Could you explain how cache invalidation changes what users see after a confirmed save?',
    'In your own words, explain how rolling back an optimistic update restores the interface after a rejected save?',
    'Explain why the server must check record ownership even when the browser hides another user\'s edit controls?',
    'How does cache invalidation prevent stale reads and why does that protect the displayed save result?',
  ]) assert.equal(getHardSet1QuestionIssue(question, 'focus_clarity'), null, question);
  assert.ok(getHardSet1QuestionIssue('Name three reasons for cache invalidation?', 'focus_clarity'));
  assert.ok(getHardSet1QuestionIssue('How does caching work and when should a password be hashed?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Explain the difference between authenticating a user and authorizing access to a record?', 'focus_correctness'), null);
});

test('mentions of steps do not turn a concept, mechanism, or focused action into a walkthrough', () => {
  const cases = [
    [getEasySet1QuestionIssue, 'What is the purpose of repeating steps in a loop?', 'focus_clarity'],
    [getMediumSet1QuestionIssue, 'Why does a transaction roll back earlier steps when a later write fails?', 'focus_clarity'],
    [getHardSet1QuestionIssue, 'Why do transactions keep related database steps together?', 'focus_clarity'],
    [getHardSet1QuestionIssue, 'Explain why transaction steps must succeed together?', 'focus_clarity'],
    [getHardSet1QuestionIssue, 'A transaction contains several write steps. Why does rollback protect atomicity?', 'focus_clarity'],
    [getEasySet2QuestionIssue, 'What is the purpose of repeating steps in a loop?', [], 'purpose'],
    [getMediumSet2QuestionIssue, 'How does rollback undo earlier database steps in an atomic transaction?', [], 'concept'],
    [getMediumSet2QuestionIssue, 'A required email is missing; what should the first validation step check?', [], 'application'],
    [getHardSet2QuestionIssue, 'How does rollback undo earlier database steps in an atomic transaction?', [], 'concept'],
  ];
  for (const [guard, question, ...args] of cases) {
    assert.equal(guard(question, ...args), null, `${guard.name}: ${question}`);
    assert.equal(guard(sanitizeTTS(question), ...args), null, `${guard.name}: sanitized ${question}`);
  }
});

test('actual requests for procedural steps still trigger walkthrough repairs at every technical tier', () => {
  for (const guard of [getEasySet1QuestionIssue, getMediumSet1QuestionIssue, getHardSet1QuestionIssue,
    getEasySet2QuestionIssue, getMediumSet2QuestionIssue, getHardSet2QuestionIssue]) {
    for (const question of [
      'Explain the steps to implement a login form?',
      'How would you explain the steps to submit a form?',
      'Describe the database transaction steps?',
      'What are the steps for implementing authentication?',
      'Which steps would you follow to build a form?',
      'Walk me through a form submission from start to finish?',
      'Explain form submission step by step?',
    ]) assert.match(guard(question) || '', /walkthrough/i, `${guard.name}: ${question}`);
  }
});

test('hard Set 1 serves a valid steps explanation on its first draft without repair or fallback', async t => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(Math, 'random', () => 0);
  const harness = failingProviderHarness();
  const question = 'Why do transactions keep related database steps together?';
  harness.output(question);
  assert.equal(await harness.generateSet1Question('focus_clarity', 'backend', 'hard'), question);
  assert.equal(harness.requests.length, 1);
});

test('modest extra context beyond the old word limits remains usable before and after speech cleanup', () => {
  const easy = 'What is the purpose of a variable when a beginner needs to keep a student name available while a simple classroom program displays the same name in several places on the screen?';
  const medium = 'A route starts a database lookup for the correct matching record and tries to send that record to the browser before the lookup has finished returning its result to the route; what should the route wait for before it sends its response?';
  const hard = 'Two requests read the same record version before either request finishes saving, and the server checks the submitted version against the current stored version before accepting each write; how does this version check prevent the later request from silently overwriting the changes already saved by the first request when both users edit the same record in this application?';
  const behavioral = 'Recall a time you contributed to a group assignment when the people involved had different schedules during a busy week and needed to coordinate their work around other ordinary school activities while sharing responsibility for a clear common goal that required each person to finish their part before the group could put its work together. What did you do to contribute, and what was the outcome for the group?';
  for (const [guard, question, oldLimit, args] of [
    [getEasySet1QuestionIssue, easy, 30, ['focus_clarity']],
    [getEasySet2QuestionIssue, easy, 30, [[], ['purpose']]],
    [getMediumSet1QuestionIssue, medium, 40, ['focus_correctness']],
    [getMediumSet2QuestionIssue, medium, 40, [[], ['application']]],
    [getHardSet1QuestionIssue, hard, 55, ['focus_clarity']],
    [getHardSet2QuestionIssue, hard, 55, [[], ['concept']]],
    [getBehavioralQuestionIssue, behavioral, 65, [BEHAVIORAL_COMPETENCIES[0], [], null, { requireEvidenceProbe: true }]],
  ]) {
    assert.ok(question.split(/\s+/).length > oldLimit, `${guard.name}: exercises extra room`);
    assert.equal(guard(question, ...args), null, guard.name);
    assert.equal(guard(sanitizeTTS(question), ...args), null, `${guard.name}: speech cleanup`);
  }
});

test('natural list openers preserve the exact item count for every Set 1 difficulty', () => {
  for (const [guard, count] of [[getEasySet1QuestionIssue, 2], [getMediumSet1QuestionIssue, 2], [getHardSet1QuestionIssue, 3]]) {
    const number = count === 3 ? 'three' : 'two';
    assert.equal(guard(`What are ${number} safeguards for stored passwords?`, 'focus_completeness'), null);
    assert.equal(guard(`Could you list ${number} safeguards for stored passwords?`, 'focus_completeness'), null);
    assert.equal(guard(`Could you mention ${number} safeguards for stored passwords?`, 'focus_completeness'), null);
    assert.ok(guard(`Could you mention ${number} safeguards for stored passwords?`, 'focus_correctness'));
    assert.ok(guard(`Name ${count === 3 ? 'two' : 'three'} safeguards for stored passwords?`, 'focus_completeness'));
    assert.ok(guard(`Name ${number} safeguards for stored passwords and explain each one?`, 'focus_completeness'));
  }
});

test('hard technical questions accept polite explanation requests while retaining recall and yes-or-no checks', () => {
  assert.equal(getHardSet2QuestionIssue('Can you explain how rollback prevents partial writes in an atomic transaction?', [], ['concept']), null);
  assert.equal(getHardSet2QuestionIssue('Could you mention two test cases for duplicate-write prevention during retries?', [], ['testing']), null);
  assert.ok(getHardSet2QuestionIssue('Can you explain what a transaction means?', [], ['concept']));
  assert.ok(getHardSet2QuestionIssue('Does a transaction prevent every lost update?', [], ['concept']));
});

test('behavioral accepts an ordinary alternative opener while retaining past-event evidence and competency', () => {
  const question = 'Share an experience when you worked with teammates on a shared task. What did you do, and what was the outcome?';
  assert.equal(getBehavioralQuestionIssue(question, BEHAVIORAL_COMPETENCIES[0], [], null, { requireEvidenceProbe: true }), null);
  assert.ok(getBehavioralQuestionIssue('Share an experience when you worked with teammates on a shared task?',
    BEHAVIORAL_COMPETENCIES[0], [], null, { requireEvidenceProbe: true }));
  assert.ok(getBehavioralQuestionIssue('What would you do if a team member disagreed with you?', BEHAVIORAL_COMPETENCIES[0]));
});

for (const role of Object.values(ROLE_CONFIG)) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    test(`${role.id} ${difficulty} has five distinct validated fallbacks for every 3C`, () => {
      for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
        const data = getRoleSetConfig(role, 'set1', difficulty, focus);
        const history = [];
        for (let index = 0; index < 5; index++) {
          const fallback = selectSet1QuestionFallback(role.id, difficulty, focus, data, history, data.topicScope[0]);
          assert.ok(fallback, `${focus}, question ${index + 1}`);
          assert.notEqual(getQuestionTopicIndex(fallback.question, data.topicKeywords), -1);
          assert.equal(fallback.question, sanitizeTTS(fallback.question));
          history.push(fallback.question);
        }
        assert.equal(new Set(history.map(q => q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())).size, 5);
      }
    });
  }
}

test('reported fullstack hard clarity failure produces five checked questions after repeated unsuitable drafts', async t => {
  t.mock.method(console, 'warn', () => {});
  const harness = failingProviderHarness();
  const history = [];
  for (let index = 0; index < 5; index++) {
    const question = await harness.generateSet1Question('focus_clarity', 'fullstack', 'hard', history);
    assert.equal(getHardSet1QuestionIssue(question, 'focus_clarity', history), null);
    assert.doesNotMatch(question, /Walk me through/);
    history.push(question);
  }
  assert.equal(harness.requests.length, 15);
  const data = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'hard', 'focus_clarity');
  assert.equal(getQuestionTopicCoverage(history, data.topicKeywords, data.topicScope).filter(count => count === 1).length, 5);
});

test('normalization reaches generation and actual topic memory follows a valid first draft from another role topic', async t => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(Math, 'random', () => 0);
  const harness = failingProviderHarness();
  const history = [];
  const data = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'hard', 'focus_clarity');
  let actualTopic;
  harness.output(request => {
    const selected = request.messages[0].content.match(/specifically targeting this topic: "(.+?)"/)?.[1];
    const index = (data.topicScope.indexOf(selected) + 1) % data.topicScope.length;
    actualTopic = data.topicScope[index];
    return `1. "${data.hardExamples.focus_clarity[index]}"`;
  });
  const question = await harness.generateSet1Question('focus_clarity', 'fullstack', 'hard', history);
  history.push(question);
  const coverage = getQuestionTopicCoverage(history, data.topicKeywords, data.topicScope);
  assert.equal(harness.requests.length, 1);
  assert.equal(coverage[data.topicScope.indexOf(actualTopic)], 1);
  assert.equal(coverage.reduce((a, b) => a + b), 1);
});

test('fallback exhaustion, another role, provider failures, and empty responses never return unsafe drafts', async t => {
  t.mock.method(console, 'warn', () => {});
  const data = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'hard', 'focus_clarity');
  const history = [...data.hardExamples.focus_clarity];
  assert.equal(selectSet1QuestionFallback('unreviewed-role', 'hard', 'focus_clarity', data, [], data.topicScope[0]), null);
  const harness = failingProviderHarness();
  await assert.rejects(harness.generateSet1Question('focus_clarity', 'fullstack', 'hard', history), /suitable hard/);
  for (const output of ['', new Error('Provider unavailable')]) {
    const failed = failingProviderHarness();
    failed.output(output);
    await assert.rejects(failed.generateSet1Question('focus_clarity', 'fullstack', 'hard'));
    assert.equal(failed.requests.length, 1);
  }
});

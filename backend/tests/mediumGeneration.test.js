const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { validateRoleConfig } = require('../config/validateRoleConfig');
const { getMediumSet1QuestionIssue, getMediumSet2QuestionIssue } = require('../utils/mediumQuestionGuard');
const { getEasySet2QuestionIssue } = require('../utils/easySet2QuestionGuard');
const { getQuestionTopicIndex, getQuestionTopicCoverage } = require('../utils/questionTopicCoverage');
const { sanitizeTTS } = require('../utils/ttsSanitizer');
const technicalVariety = require('../utils/technicalQuestionVariety');
const { TECHNICAL_QUESTION_FORMATS } = require('../config/technicalQuestionFormats');

function providerHarness(set, outputs, roleData) {
  const filename = path.resolve(__dirname, `../services/aiSet${set}Generator.js`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  loaded.require = id => {
    if (id === 'openai') return { OpenAI: class {
      chat = { completions: { create: async request => {
        requests.push(structuredClone(request));
        const output = outputs.shift();
        if (output instanceof Error) throw output;
        return { choices: [{ message: { content: output } }] };
      } } };
    } };
    if (id === '../config/roleConfig' && roleData) return {
      ...normalRequire(id), getRoleConfig: () => roleData,
    };
    if (id === '../utils/technicalQuestionVariety' && set === 2) return {
      ...normalRequire(id), selectTechnicalQuestionFormat(_difficulty, history) {
        const question = outputs.find(output => typeof output === 'string'
          && !getMediumSet2QuestionIssue(output, history)) || '';
        const format = technicalVariety.getTechnicalQuestionFormat(question);
        return { id: format, instruction: TECHNICAL_QUESTION_FORMATS[format] };
      },
    };
    return normalRequire(id);
  };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests,
    generate: set === 1 ? (role, difficulty, history = [], focus = 'focus_clarity') =>
      loaded.exports.generateSet1Question(focus, role, difficulty, history) : loaded.exports.generateSet2Question,
    evaluate: loaded.exports[`evaluateSet${set}Answer`] };
}

test('every medium role benchmark is a usable spoken single-task question', () => {
  validateRoleConfig(ROLE_CONFIG);
  for (const role of Object.values(ROLE_CONFIG)) {
    for (const [focus, questions] of Object.entries(role.set1.mediumExamples)) {
      for (const question of questions) {
        assert.equal(getMediumSet1QuestionIssue(question, focus), null, `${role.id}: ${question}`);
        assert.equal(getMediumSet1QuestionIssue(sanitizeTTS(question), focus), null, question);
      }
    }
    for (const question of role.set2.mediumExamples) {
      assert.equal(getMediumSet2QuestionIssue(question), null, `${role.id}: ${question}`);
      assert.equal(getMediumSet2QuestionIssue(sanitizeTTS(question)), null, question);
    }
  }
});

test('medium rejects compound tasks, walkthroughs, code, excess length, and exact repeats', () => {
  const misses = [
    'How does middleware work and when should you use it?',
    'Which action fixes the form, explain your choice?',
    'Which browser storage keeps that preference, and for how long?',
    'Which action fixes the form? Why does it work?',
    'Walk me through a form submission from start to finish?',
    'Explain the steps to investigate a rendering issue?',
    'Which method should call element.addEventListener()?',
    'Which `display` property should change?',
    'Which exact syntax should update the page?',
    'Which command should create the database?',
    `When ${'a '.repeat(49)}request fails, what should change?`,
  ];
  for (const question of misses) {
    assert.ok(getMediumSet1QuestionIssue(question, 'focus_correctness'), question);
    assert.ok(getMediumSet2QuestionIssue(question), question);
  }
  const question = 'A route responds before its database lookup finishes; what should it wait for?';
  const previous = [question.toUpperCase().replace('?', '.')];
  assert.ok(getMediumSet1QuestionIssue(question, 'focus_correctness', previous));
  assert.ok(getMediumSet2QuestionIssue(question, previous));
});

test('medium preserves Set 1 focus rules while technical Set 2 allows varied formats', () => {
  assert.ok(getMediumSet1QuestionIssue('What is the difference between margin and padding?', 'focus_clarity'));
  assert.equal(getMediumSet1QuestionIssue('What is the difference between margin and padding?', 'focus_correctness'), null);
  assert.ok(getMediumSet1QuestionIssue('Name three useful request details?', 'focus_completeness'));
  assert.ok(getMediumSet1QuestionIssue('Name two request details, such as method or path?', 'focus_completeness'));
  assert.equal(getMediumSet1QuestionIssue('Name two request details to check against a defined route?', 'focus_completeness'), null);
  for (const question of [
    'What is middleware?', 'Explain the difference between local and session storage?',
    'How does middleware work?', 'How does local storage differ from session storage?',
  ]) {
    assert.equal(getMediumSet2QuestionIssue(question), null, question);
  }
  const diagnosis = 'A script fails to select an element because it runs too early; when should it run?';
  assert.equal(getMediumSet2QuestionIssue(diagnosis), null);
  assert.ok(getEasySet2QuestionIssue(diagnosis));
});

test('misses from the live Medium review are rejected without banning focused comparisons', () => {
  assert.ok(getMediumSet1QuestionIssue(
    'Name two semantic elements and the region each one marks?', 'focus_completeness'));
  assert.ok(getMediumSet1QuestionIssue(
    'A user submits a form and a second request asks for a missing record; which status codes fit each case?', 'focus_correctness'));
  assert.ok(getMediumSet1QuestionIssue(
    'When should an API return a not found response?', 'focus_clarity'));
  assert.ok(getMediumSet1QuestionIssue(
    'What happens to the items when flex wrap is set?', 'focus_correctness'));
  assert.equal(getMediumSet1QuestionIssue(
    'What happens to the items when flex wrap is set to wrap?', 'focus_correctness'), null);
  assert.ok(getMediumSet2QuestionIssue(
    'A user submits a profile update with an empty username field; what should happen before saving the change?'));
  assert.equal(getMediumSet2QuestionIssue(
    'A required username field is empty; what should happen before saving the change?'), null);
  assert.equal(getMediumSet1QuestionIssue(
    'How does a missing record differ from a failed lookup when choosing a response?', 'focus_correctness'), null);
  assert.ok(getMediumSet1QuestionIssue(
    'When a record does not exist, which HTTP response status should the server return?', 'focus_clarity'));
  assert.ok(getMediumSet2QuestionIssue(
    'The form sends userEmail but the server expects email; what should change?'));
  assert.ok(getMediumSet2QuestionIssue(
    'Two class rules set different colors on the same button; which color shows?'));
  assert.equal(getMediumSet2QuestionIssue(
    'Two equally specific class rules set different colors on the same button; which color shows?'), null);
  assert.ok(getMediumSet2QuestionIssue(
    'One database lookup returns no record and a separate query fails; what should the server report in each case?'));
  assert.ok(getMediumSet1QuestionIssue(
    'Why is structured form data converted into JSON text for the request body?', 'focus_clarity'));
  assert.equal(getMediumSet1QuestionIssue(
    'Why encode structured form data as JSON text when the request body uses JSON?', 'focus_clarity'), null);
  assert.ok(getMediumSet1QuestionIssue(
    'A form submits a user record with an empty email field; which HTTP status should the backend return?', 'focus_correctness'));
  assert.equal(getMediumSet1QuestionIssue(
    'A form submits a user record with an empty required email field; which HTTP status should the backend return?', 'focus_correctness'), null);
});

test('live Medium histories identify status responses, display feedback, and script timing', () => {
  const fullstack = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'medium');
  assert.equal(getQuestionTopicIndex(
    'A request asks for a record that does not exist; which HTTP status code fits?', fullstack.topicKeywords), 1);
  const listing = getRoleSetConfig(ROLE_CONFIG.fullstack, 'set1', 'medium', 'focus_completeness');
  assert.equal(getQuestionTopicIndex(
    'Name two useful details to display after a form submission is rejected?', listing.topicKeywords), 1);
  const frontend = getRoleSetConfig(ROLE_CONFIG.frontend, 'set2', 'medium');
  assert.equal(getQuestionTopicIndex(
    'A script in the page head tries to change text in a paragraph that appears later; what timing change would fix this?', frontend.topicKeywords), 5);
});

test('medium scopes explicitly separate sets and list-friendly focus for all roles', () => {
  for (const role of Object.values(ROLE_CONFIG)) {
    const conceptual = getRoleSetConfig(role, 'set1', 'medium', 'focus_clarity');
    const listing = getRoleSetConfig(role, 'set1', 'medium', 'focus_completeness');
    const technical = getRoleSetConfig(role, 'set2', 'medium');
    assert.notDeepEqual(conceptual.topicScope, getRoleSetConfig(role, 'set1', 'easy').topicScope);
    assert.notDeepEqual(listing.topicScope, conceptual.topicScope);
    assert.notDeepEqual(technical.topicScope, conceptual.topicScope);
    assert.equal(listing.topicScope.length, listing.topicKeywords.length);
    assert.equal(technical.topicScope.length, technical.topicKeywords.length);
  }
});

test('medium prompts use each role and focus scope without blacklisting calibration examples', async () => {
  for (const role of Object.values(ROLE_CONFIG)) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = role.set1.mediumExamples[focus][0];
      const harness = providerHarness(1, [question]);
      assert.equal(await harness.generate(role.id, 'medium', [], focus), question);
      const request = harness.requests[0];
      const scope = request.messages[0].content.split('ALLOWED TOPICS')[1].split('PREFERRED TOPIC FOCUS')[0];
      for (const topic of getRoleSetConfig(role, 'set1', 'medium', focus).topicScope) assert.ok(scope.includes(topic));
      assert.match(request.messages[1].content, /first interview question/);
      if (focus === 'focus_completeness') assert.match(request.messages[0].content, /exactly TWO distinct relevant/);
    }
    const harness = providerHarness(2, [role.set2.mediumExamples[0]]);
    await harness.generate(role.id, 'medium');
    const request = harness.requests[0];
    const scope = request.messages[0].content.split('ALLOWED TOPICS')[1].split('PREFERRED TOPIC FOCUS')[0];
    for (const topic of getRoleSetConfig(role, 'set2', 'medium').topicScope) assert.ok(scope.includes(topic));
    assert.match(request.messages[1].content, /first technical interview question/);
  }
});

for (const set of [1, 2]) {
  test(`Set ${set} medium repairs unsuitable wording while preserving role, topic, focus, and history`, async () => {
    const good = set === 1
      ? 'How does a media query adapt a page layout to a smaller screen?'
      : 'A flexbox row is too wide for a phone; what adjustment would let its items fit?';
    const history = ['Which CSS rule applies when specificity is equal?'];
    const harness = providerHarness(set, ['How does layout work and why is it useful?', good]);
    assert.equal(await harness.generate('frontend', 'medium', history), good);
    assert.equal(harness.requests.length, 2);
    assert.equal(harness.requests[0].messages[0].content, harness.requests[1].messages[0].content);
    assert.ok(harness.requests[1].messages[1].content.includes(history[0]));
    assert.match(harness.requests[1].messages.at(-1).content, /Remove the appended task/);
    assert.match(harness.requests[1].messages.at(-1).content, /same role.*difficulty/);
    assert.match(harness.requests[0].messages[0].content, /at most TWO reasoning steps/);
    assert.doesNotMatch(harness.requests[0].messages[1].content, /semantic HTML|middleware/i);
  });

  test(`Set ${set} medium fails after bounded repairs and propagates provider failures immediately`, async () => {
    const bad = 'Walk me through a form submission from start to finish?';
    const noBankRole = structuredClone(ROLE_CONFIG.frontend);
    noBankRole.id = 'no-bank-test';
    const harness = providerHarness(set, [bad, bad, bad], noBankRole);
    await assert.rejects(harness.generate('frontend', 'medium'), /suitable medium.*Please retry/);
    assert.equal(harness.requests.length, 3);
    for (const output of ['', '{}', new Error('Provider unavailable')]) {
      const failed = providerHarness(set, [output]);
      await assert.rejects(failed.generate('frontend', 'medium'));
      assert.equal(failed.requests.length, 1);
    }
  });

  test(`Set ${set} medium repairs code-bearing drafts before sanitization hides the violation`, async () => {
    const good = set === 1 ? 'How does a click listener respond to a button press?'
      : 'A preview should change while a user types; which event should update it?';
    const harness = providerHarness(set, ['Which method uses element.addEventListener()?', good]);
    assert.equal(await harness.generate('frontend', 'medium'), good);
    assert.equal(harness.requests.length, 2);
    assert.match(harness.requests[1].messages.at(-1).content, /without code syntax/);
  });

  test(`Set ${set} medium repairs an exact repeat with case and punctuation differences`, async () => {
    const repeated = 'A route responds before its database lookup finishes; what should it wait for?';
    const good = set === 1 ? 'Why does a route validate required fields before saving a registration?'
      : 'A required email field is empty; what should the server do before saving the registration?';
    const harness = providerHarness(set, [repeated, good]);
    assert.equal(await harness.generate('backend', 'medium', [repeated.toUpperCase().replace('?', '.')]), good);
    assert.equal(harness.requests.length, 2);
    assert.match(harness.requests[1].messages.at(-1).content, /already-asked question/);
  });

  if (set === 1) test('Set 1 hard uses its own 3C standard without inheriting the medium standard', async () => {
    const question = 'Why can a long chain of promise microtasks delay the browser from responding to keyboard input?';
    const roleData = structuredClone(ROLE_CONFIG.frontend);
    roleData.set1.difficultyTopics.hard = { topicScope: ['Browser scheduling and responsiveness'], topicKeywords: [['microtask', 'browser']] };
    const harness = providerHarness(set, [question], roleData);
    assert.equal(await harness.generate('frontend', 'hard'), question);
    assert.equal(harness.requests.length, 1);
    assert.match(harness.requests[0].messages[0].content, /HARD SET 1: ADVANCED JUNIOR 3C PRACTICE/);
    assert.doesNotMatch(harness.requests[0].messages[0].content, /JUNIOR (?:CONCEPTUAL|TECHNICAL) APPLICATION STANDARD/);
  });

  test(`Set ${set} medium scoring and fallback coaching match the requested task`, async t => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const harness = providerHarness(set, [JSON.stringify({ clarity_score: 5, correctness_score: 5, completeness_score: 5,
      problem_solving_score: 5, accuracy_score: 5, depth_score: 5 }), JSON.stringify({ clarity_score: 4, correctness_score: 4, completeness_score: 4, problem_solving_score: 4, accuracy_score: 4, depth_score: 4 })]);
    for (let i = 0; i < 2; i++) {
      const evaluated = await harness.evaluate('What should the route wait for?', 'The completed database lookup.', 'medium');
      assert.doesNotMatch(evaluated.tip, /trade.off|syntax|step by step|more detail|property|method/);
    }
    const prompt = harness.requests[0].messages[0].content;
    assert.match(prompt, /DIFFICULTY SCORING RUBRIC: MEDIUM/);
    assert.match(prompt, set === 1 ? /MEDIUM SET 1 SCORING/ : /MEDIUM TECHNICAL SCORING/);
    assert.match(prompt, /unsolicited/);
    assert.doesNotMatch(prompt, /missing trade-offs caps|EASY APPLICATION SCORING/);
  });
}

test('medium topic coverage counts each question once using whole words and focused target terms', () => {
  const keywords = [['data', 'format'], ['database', 'record'], ['middleware', 'logging']];
  assert.deepEqual(getQuestionTopicCoverage([
    'Which database stores a record?', 'How does middleware provide logging?',
  ], keywords), [0, 1, 1]);
  assert.equal(getQuestionTopicIndex('Which data format would carry database records?', keywords), 0);
});

test('medium restored-history coverage chooses an uncovered category', async () => {
  for (const set of [1, 2]) {
    const role = structuredClone(ROLE_CONFIG.frontend);
    role[`set${set}`].difficultyTopics.medium = {
      topicScope: ['CSS rule matching', 'Script timing'], topicKeywords: [['css', 'rule'], ['script', 'ready']],
    };
    const good = set === 1 ? 'How does waiting until a page is ready help a script select its elements?'
      : 'A script selects an element before it exists; when should the script run instead?';
    const outputs = [good];
    const harness = providerHarness(set, outputs, role);
    assert.equal(await harness.generate('frontend', 'medium', ['Which CSS rule applies to this class?']), good);
    assert.match(harness.requests[0].messages[0].content, /targeting this topic: "Script timing"/);
    assert.equal(harness.requests.length, 1);
  }
});

test('live batch topic memory prevents incidental database words from repeating or rejecting async questions', async t => {
  t.mock.method(Math, 'random', () => 0);
  for (const set of [1, 2]) {
    const role = structuredClone(ROLE_CONFIG.backend);
    const topics = ['Async timing', 'Database results'];
    const keywordLists = [['async', 'await'], ['database', 'record', 'query']];
    role[`set${set}`].difficultyTopics.medium = { topicScope: topics, topicKeywords: keywordLists };
    const questions = set === 1 ? [
      'Why must a route wait for its database query before using the record?',
      'How does a route handle a database query that finds no matching record?',
    ] : [
      'A route responds before its database query finishes; what should it wait for?',
      'A database query completes with no matching record; what should the route report?',
    ];
    const harness = providerHarness(set, [...questions], role);
    const history = [];
    history.push(await harness.generate('backend', 'medium', history));
    assert.deepEqual(getQuestionTopicCoverage(history, keywordLists, topics), [1, 0]);
    history.push(await harness.generate('backend', 'medium', history));
    assert.deepEqual(getQuestionTopicCoverage(history, keywordLists, topics), [1, 1]);
    assert.match(harness.requests[1].messages[0].content, /targeting this topic: "Database results"/);
    assert.equal(harness.requests.length, 2);
    // A restored array has no process-local memory and uses keyword fallback.
    assert.deepEqual(getQuestionTopicCoverage([...history], keywordLists, topics), [0, 2]);
  }
});

test('a non-web role inherits medium standards without generator-specific role content', async () => {
  const role = structuredClone(ROLE_CONFIG.fullstack);
  role.id = 'qa-test';
  role.label = 'QA Tester';
  for (const set of [1, 2]) {
    role[`set${set}`].difficultyTopics.medium = {
      topicScope: ['Test outcomes: comparing actual results against a stated expected outcome'],
      topicKeywords: [['test', 'expected', 'actual', 'result']],
    };
    role[`set${set}`].mediumExamples = set === 1 ? {
      focus_clarity: ['How does an expected outcome help you evaluate a test result?'],
      focus_correctness: ['How does an actual result differ from an expected result?'],
      focus_completeness: ['Name two details useful when reporting a failed test?'],
    } : ['A test returns an error instead of its expected success message; what outcome should you report?'];
  }
  for (const set of [1, 2]) {
    const good = set === 1 ? role.set1.mediumExamples.focus_clarity[0] : role.set2.mediumExamples[0];
    const harness = providerHarness(set, [good], role);
    assert.equal(await harness.generate(role.id, 'medium'), good);
    const scope = harness.requests[0].messages[0].content.split('ALLOWED TOPICS')[1].split('PREFERRED TOPIC FOCUS')[0];
    assert.match(scope, /Test outcomes/);
    assert.doesNotMatch(scope, /JSON|CSS|database/);
  }
});

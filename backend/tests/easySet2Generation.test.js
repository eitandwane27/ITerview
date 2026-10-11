const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { getEasySet2QuestionIssue } = require('../utils/easySet2QuestionGuard');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { validateRoleConfig } = require('../config/validateRoleConfig');
const { sanitizeTTS } = require('../utils/ttsSanitizer');
const { getEasySet2TopicIndex, getEasySet2TopicCoverage } = require('../utils/easySet2TopicCoverage');

function providerHarness(outputs, roleData, format) {
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
        const output = outputs.shift();
        if (output instanceof Error) throw output;
        return { choices: [{ message: { content: output } }] };
      } } };
    } };
    if (id === '../config/roleConfig' && roleData) return {
      ...normalRequire(id), getRoleConfig: () => roleData,
    };
    if (id === '../utils/technicalQuestionVariety' && format) return {
      ...normalRequire(id), selectTechnicalQuestionFormat: () => ({ id: format,
        instruction: require('../config/technicalQuestionFormats').TECHNICAL_QUESTION_FORMATS[format] }),
    };
    return normalRequire(id);
  };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests, ...loaded.exports };
}

function selectedTopic(request) {
  return request.messages[0].content.split('PREFERRED TOPIC FOCUS:')[1].split('CRITICAL TTS RULE:')[0];
}

const { getTechnicalQuestionFormat, selectTechnicalQuestionFormat, rememberTechnicalQuestionFormat,
  getTechnicalVarietyIssue } = require('../utils/technicalQuestionVariety');
const { getQuestionTopicCoverage } = require('../utils/questionTopicCoverage');
const { getMediumSet2QuestionIssue } = require('../utils/mediumQuestionGuard');


test('easy accepts concepts, purposes, comparisons, predictions, tests, and open actions', () => {
  validateRoleConfig(ROLE_CONFIG);
  for (const role of Object.values(ROLE_CONFIG)) {
    const formats = new Set();
    for (const question of role.set2.easyExamples) {
      formats.add(getTechnicalQuestionFormat(question));
      assert.equal(getEasySet2QuestionIssue(question), null, question);
      assert.equal(getEasySet2QuestionIssue(sanitizeTTS(question)), null, question);
    }
    assert.equal(formats.size, 6, role.id);
  }
});

test('easy still rejects code, compound requests, walkthroughs, diagnosis, and advanced recall', () => {
  for (const question of [
    'What is an API and why would you use it?',
    'Which event handles a click? How would you add it?',
    'Walk me through submitting a form from start to finish?',
    'Why is a button click handler not working?',
    'Which command would you run to create a database?',
    'Which CSS property would arrange buttons in a row?',
    'Which HTML element uses the exact syntax?',
    'Which method calls element.addEventListener()?',
    'Which tag displays <h1> on a page?',
    'What does the userName field contain?',
    'Which API endpoint returns available courses?',
    'Which JavaScript loop would print every number?',
    'What should a client do to convert JSON text?',
    'What is ' + 'a '.repeat(37) + 'variable?',
  ]) assert.ok(getEasySet2QuestionIssue(question), question);
});

test('another allowed format is accepted on its first draft and its actual format is remembered', async () => {
  const good = 'Which event would handle a click?';
  const harness = providerHarness([good], null, 'purpose');
  const history = [];
  assert.equal(await harness.generateSet2Question('frontend', 'easy', history), good);
  assert.equal(harness.requests.length, 1);
  history.push(good);
  assert.ok(!require('../utils/technicalQuestionVariety').getLeastUsedTechnicalFormats('easy', history).includes('application'));
});

test('natural comparison and prediction wording is accepted without literal prompt stems', () => {
  for (const [question, format] of [
    ['How are margin and padding different around a button?', 'comparison'],
    ['If the font size increases, what will happen to the text?', 'prediction'],
    ['If the font size increases, what would you expect to see?', 'prediction'],
    ['What would be the outcome of increasing the font size?', 'prediction'],
  ]) {
    assert.equal(getTechnicalQuestionFormat(question), format, question);
    assert.equal(getEasySet2QuestionIssue(question, [], format), null, question);
  }
});

for (const difficulty of ['easy', 'medium']) {
  test(difficulty + ' accepts a different format immediately after the reported first three questions', async t => {
    const history = [
      'How does a click event differ from a typing event on a web page?',
      'What is a variable used for in JavaScript?',
      'Why is it useful for a web page to adapt its layout on a smaller phone screen?',
    ];
    const role = structuredClone(ROLE_CONFIG.frontend);
    role.set2.difficultyTopics[difficulty] = {
      topicScope: ['Form controls and labels'], topicKeywords: [['form', 'label', 'input']],
    };
    const recovered = 'Name two checks for a required form input?';
    const warnings = [];
    t.mock.method(console, 'warn', (...args) => warnings.push(args));
    const harness = providerHarness([recovered,
      'When a user types into a form input, what will happen to its value?'], role, 'prediction');
    history.push(await harness.generateSet2Question('frontend', difficulty, history));
    assert.equal(harness.requests.length, 1);
    assert.equal(warnings.length, 0);
    // Acceptance records its actual format, so Q5 still prefers an unused kind.
    assert.notEqual(selectTechnicalQuestionFormat(difficulty, history, () => 0).id, 'testing');
    history.push(await harness.generateSet2Question('frontend', difficulty, history));
    assert.equal(history.length, 5);
    assert.equal(new Set(history.map(getTechnicalQuestionFormat)).size, 5);
  });
}

test('a valid repeated format is accepted immediately while unsafe drafts still fail without a bank', async t => {
  t.mock.method(console, 'warn', () => {});
  const role = structuredClone(ROLE_CONFIG.frontend);
  role.id = 'no-bank-test';
  const harness = providerHarness([
    'What is HTML?', 'What is HTML?', 'What is HTML?',
  ], role, 'prediction');
  assert.equal(await harness.generateSet2Question('frontend', 'easy', ['What does a variable do?']), 'What is HTML?');
  assert.equal(harness.requests.length, 1);
  const unsafe = providerHarness([
    'Name two checks and explain the results?', 'Name two checks and explain the results?', 'Name two checks and explain the results?',
  ], role, 'prediction');
  await assert.rejects(unsafe.generateSet2Question('frontend', 'easy', ['What does a variable do?']), /suitable easy/);
});

test('easy topic overlap does not reject a valid question about the selected category', async () => {
  const role = structuredClone(ROLE_CONFIG.frontend);
  role.set2.difficultyTopics.easy = {
    topicScope: ['Form controls', 'HTML content'],
    topicKeywords: [['form', 'label', 'input'], ['html', 'heading', 'paragraph']],
  };
  const question = 'Name two checks for a form input below an HTML heading and paragraph?';
  const harness = providerHarness([question], role, 'testing');
  assert.equal(await harness.generateSet2Question('frontend', 'easy', ['What is an HTML heading or paragraph?']), question);
  assert.equal(harness.requests.length, 1);
});

test('repairs retain role, selected topic, format, and question history', async () => {
  const previous = ['What does HTML describe on a page?'];
  const good = 'Why does a text input need a label?';
  const harness = providerHarness(['Why does an input need a label and what should it say?', good], null, 'purpose');
  assert.equal(await harness.generateSet2Question('frontend', 'easy', previous), good);
  assert.equal(harness.requests.length, 2);
  assert.match(harness.requests[1].messages.at(-1).content, /Remove the appended task.*same role and difficulty.*purpose/s);
  assert.ok(harness.requests[1].messages[1].content.includes(previous[0]));
});

test('raw code drafts are rejected before sanitization can hide them', async () => {
  const good = 'What does an API let two applications do?';
  const harness = providerHarness(['What does client.fetch() do?', good], null, 'concept');
  assert.equal(await harness.generateSet2Question('backend', 'easy'), good);
  assert.equal(harness.requests.length, 2);
  assert.match(harness.requests[1].messages.at(-1).content, /plain spoken English/);
});

test('exact repeats stay blocked while two-choice variety is a preference', () => {
  assert.match(getEasySet2QuestionIssue('what is html.', ['What is HTML?']), /already-asked/);
  const history = ['To retrieve records, would you use GET or POST?'];
  assert.equal(getEasySet2QuestionIssue('To change a record, would you update or delete it?', history), null);
  assert.equal(getEasySet2QuestionIssue('How does reading a record differ from deleting it?', history), null);
  assert.equal(getEasySet2QuestionIssue('Which operation would change a saved address?', history), null);
});

test('flexible technical formats retain two-item test requests without blocking concept questions about checks', () => {
  for (const guard of [getEasySet2QuestionIssue, getMediumSet2QuestionIssue]) {
    assert.match(guard('Name three checks for a required form input?', [], ['concept', 'application', 'testing']), /exactly two/);
    assert.equal(guard('Mention two checks for a required form input?', [], ['testing']), null);
    assert.equal(guard('What does a required input check do?', [], ['concept']), null);
  }
});

test('storage contradictions and field mismatches lost in spoken text are rejected in technical modes', () => {
  for (const guard of [getEasySet2QuestionIssue, getMediumSet2QuestionIssue]) {
    assert.ok(guard('A theme should persist after closing the browser but clear when the tab closes; which storage fits?'));
    assert.ok(guard('A form sends a field named full name but the backend expects full name; what should change?'));
    assert.equal(guard('A form sends a name field but the backend expects student name; what should change?'), null);
  }
  assert.equal(getMediumSet2QuestionIssue('A theme should survive page reloads but clear when its tab closes; which storage fits?'), null);
});

test('ambiguous easy choices still require relevant conditions', () => {
  for (const question of [
    'Should the server return the exam results or report a missing record?',
    'Before saving a record, should the app check the name field or the email field?',
    'Would a larger font size or another color make a heading stand out?',
    'Should the frontend or backend prepare the list?',
  ]) assert.ok(getEasySet2QuestionIssue(question), question);
  assert.equal(getEasySet2QuestionIssue('The requested record exists; should the server return it or report it missing?'), null);
});

test('a covered allowed topic can pass immediately and coverage records the actual topic', async () => {
  const role = structuredClone(ROLE_CONFIG.backend);
  role.set2.difficultyTopics.easy = {
    topicScope: ['Data formats', 'Database operations'],
    topicKeywords: [['json', 'format'], ['database', 'record']],
  };
  const harness = providerHarness(['What does the JSON format represent?', 'What does a database record contain?'], role, 'concept');
  const history = ['Why is JSON a useful data format?'];
  const accepted = await harness.generateSet2Question('backend', 'easy', history);
  assert.equal(accepted, 'What does the JSON format represent?');
  assert.equal(harness.requests.length, 1);
  history.push(accepted);
  assert.deepEqual(getQuestionTopicCoverage(history, role.set2.difficultyTopics.easy.topicKeywords, role.set2.difficultyTopics.easy.topicScope), [2, 0]);
  assert.match(selectedTopic(harness.requests[0]), /Database operations/);
});

test('topic coverage uses whole words and counts each question only once', () => {
  const keywords = [['data', 'format'], ['database', 'record']];
  assert.deepEqual(getQuestionTopicCoverage(['What does a database record store?'], keywords), [0, 1]);
  assert.equal(getEasySet2TopicIndex('Which data format would carry database records?', keywords), 0);
});

for (const difficulty of ['easy', 'medium']) {
  test(difficulty + ' produces five different formats in a session through the real planner', async () => {
    const role = structuredClone(ROLE_CONFIG.backend);
    // One topic isolates format coverage; topic coverage is tested separately.
    role.set2.difficultyTopics[difficulty] = {
      topicScope: ['Validation of required input'], topicKeywords: [['field', 'validation', 'input']],
    };
    const samples = {
      concept: 'What does validating a required field mean?',
      purpose: 'Why should an application validate a required field?',
      comparison: 'How does a required field differ from an optional field?',
      prediction: 'What happens to invalid input when validation rejects it?',
      testing: 'Name two test cases for an input field that is required?',
      application: 'A required field is empty; what should the application request?',
      diagnosis: 'Validation accepts an empty required field; what should you check first?',
      decision: 'Why would you prefer rejecting missing required input to silently saving incomplete data?',
    };
    const outputs = [];
    // Provider uses the requested format. Generator, validation, history, and
    // retries remain real; this does not claim to test a live model's quality.
    Object.defineProperty(outputs, 'shift', { value() {
      const prompt = harness.requests.at(-1).messages[0].content;
      return samples[prompt.match(/SELECTED QUESTION FORMAT: (\w+)/)[1]];
    } });
    const harness = providerHarness(outputs, role);
    const history = [];
    for (let i = 0; i < 5; i++) history.push(await harness.generateSet2Question('backend', difficulty, history));
    assert.equal(new Set(history.map(getTechnicalQuestionFormat)).size, 5);
    assert.equal(harness.requests.length, 5);
    const otherSession = selectTechnicalQuestionFormat(difficulty, [], () => 0);
    assert.equal(otherSession.id, 'concept');
  });
}

test('restored histories choose an unused format and rejected drafts do not consume a slot', () => {
  const history = [
    'What does input validation mean?', 'Why does a form need validation?',
    'How does a required field differ from an optional field?',
    'What happens to input when validation rejects it?',
  ];
  assert.equal(selectTechnicalQuestionFormat('easy', history, () => 0).id, 'testing');
  getTechnicalVarietyIssue('Which event handles clicks?', history, 'testing');
  assert.equal(selectTechnicalQuestionFormat('easy', history, () => 0).id, 'testing');
  const liveHistory = ['A differently worded accepted question?'];
  rememberTechnicalQuestionFormat(liveHistory, liveHistory[0], 'purpose');
  assert.equal(selectTechnicalQuestionFormat('easy', liveHistory, () => 0).id, 'concept');
});

test('non-web roles inherit format rules without web-specific content', async () => {
  const role = structuredClone(ROLE_CONFIG.backend);
  role.id = 'support-test';
  role.label = 'IT Support Trainee';
  role.avoidList = 'Stay within computer equipment.';
  role.difficultyAvoidLists = {};
  role.set2.difficultyTopics.easy = { topicScope: ['Output devices'], topicKeywords: [['printer', 'monitor']] };
  role.set2.easyExamples = ['What does a printer do?'];
  const harness = providerHarness(['What does a printer do?'], role, 'concept');
  await harness.generateSet2Question(role.id, 'easy');
  const prompt = harness.requests[0].messages[0].content;
  assert.match(prompt, /IT Support Trainee|INTRODUCTORY TECHNICAL VARIETY STANDARD/);
  assert.doesNotMatch(prompt, /CSS|JavaScript|student records|CLASSROOM-LEVEL QUESTION STANDARD/);
});

test('three unsuitable drafts use a reviewed fallback without returning a rejected question', async t => {
  t.mock.method(console, 'warn', () => {});
  const harness = providerHarness(Array(3).fill('What is an API and why is it useful?'), null, 'concept');
  const result = await harness.generateSet2Question('backend', 'easy');
  const { TECHNICAL_QUESTION_FALLBACKS } = require('../config/technicalQuestionFallbacks');
  assert.ok(TECHNICAL_QUESTION_FALLBACKS.backend.easy.some(([, question]) => question === result));
  assert.equal(harness.requests.length, 3);
});

test('empty, sanitized-empty, and provider failures propagate immediately', async () => {
  for (const output of ['', '   ', '<div>', new Error('Provider unavailable')]) {
    const harness = providerHarness([output]);
    await assert.rejects(harness.generateSet2Question('frontend', 'easy'));
    assert.equal(harness.requests.length, 1);
  }
});

test('technical scoring uses the requested format without requiring unsolicited detail', async t => {
  t.mock.method(console, 'log', () => {});
  for (const difficulty of ['easy', 'medium']) {
    const harness = providerHarness([JSON.stringify({ problem_solving_score: 5, accuracy_score: 5, depth_score: 5 })]);
    await harness.evaluateSet2Answer('Name two test cases for a required email field?', 'One empty, one valid.', difficulty);
    const prompt = harness.requests[0].messages[0].content;
    assert.match(prompt, /REQUESTED TECHNICAL FORMAT: testing/);
    assert.match(prompt, /one case is incomplete/);
    assert.match(prompt, /unsolicited/);
    assert.match(prompt, /Do not praise an incorrect answer as correct/);
    assert.match(prompt, /Do not infer detailed reasoning|A requested mechanism/);
  }
});

test('fallback coaching matches explanation, comparison, and testing questions', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [question, expected] of [
    ['How does margin differ from padding?', /key difference/],
    ['Name two test cases for a required field?', /two distinct/],
    ['Why does a field need validation?', /purpose/],
  ]) {
    const harness = providerHarness([JSON.stringify({ problem_solving_score: 4, accuracy_score: 4, depth_score: 4 })]);
    assert.match((await harness.evaluateSet2Answer(question, 'An answer.', 'easy')).tip, expected);
    const empty = providerHarness([]);
    assert.match((await empty.evaluateSet2Answer(question, '', 'medium')).tip, expected);
    assert.equal(empty.requests.length, 0);
  }
});

test('hard generation and scoring receive advanced-junior technical variety rules', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(Math, 'random', () => 0);
  const question = 'How does server rendering make content available before application scripts finish loading?';
  const harness = providerHarness([question, JSON.stringify({ problem_solving_score: 4, accuracy_score: 4, depth_score: 4 })], undefined, 'concept');
  assert.equal(await harness.generateSet2Question('frontend', 'hard'), question);
  await harness.evaluateSet2Answer(question, 'A detailed answer.', 'hard');
  assert.match(harness.requests[0].messages[0].content, /SELECTED QUESTION FORMAT: concept/);
  assert.match(harness.requests[0].messages[0].content, /ADVANCED JUNIOR TECHNICAL VARIETY STANDARD/);
  assert.match(harness.requests[1].messages[0].content, /REQUESTED TECHNICAL FORMAT: concept/);
  assert.doesNotMatch(harness.requests[1].messages[0].content, /Strict, unyielding|senior-level depth/);
});

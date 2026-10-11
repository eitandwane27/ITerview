const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { getEasySet1QuestionIssue } = require('../utils/easySet1QuestionGuard');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { validateRoleConfig } = require('../config/validateRoleConfig');

function providerHarness(outputs) {
  const filename = path.resolve(__dirname, '../services/aiSet1Generator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  loaded.require = id => id === 'openai' ? { OpenAI: class {
    chat = { completions: { create: async request => {
      requests.push(structuredClone(request));
      const output = outputs.shift();
      if (output instanceof Error) throw output;
      return { choices: [{ message: { content: output } }] };
    } } };
  } } : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests, generate: loaded.exports.generateSet1Question };
}

test('recognizable misses from the live frontend batch are rejected', () => {
  const misses = [
    ['focus_clarity', 'How would you explain the steps to make a button change some text on a page when the user clicks it?'],
    ['focus_clarity', 'How would you explain what padding does to an element compared to what margin does?'],
    ['focus_clarity', 'How would you explain what a boolean value is and when you would use one in a simple program?'],
    ['focus_correctness', 'What CSS property do you set on a container to arrange its child items in a row?'],
    ['focus_completeness', 'Name two HTML form elements that let a user type information?'],
    ['focus_completeness', 'Name three CSS flexbox properties used to arrange items in a row?'],
    ['focus_completeness', 'Name two things a JavaScript function can do when a user clicks a button on a webpage?'],
  ];
  for (const [focus, question] of misses) assert.ok(getEasySet1QuestionIssue(question, focus), question);
});

test('small single-task questions and correctness comparisons remain usable', () => {
  const questions = [
    ['focus_clarity', 'What is HTML used for?'],
    ['focus_clarity', 'What is a boolean value?'],
    ['focus_clarity', 'What is flexbox used for?'],
    ['focus_correctness', 'What is the difference between margin and padding in CSS?'],
    ['focus_correctness', 'What is the purpose of a label element in an HTML form?'],
    ['focus_completeness', 'Name two HTML tags used to show text content on a page?'],
    ['focus_completeness', 'Name two basic types of values a JavaScript variable can store?'],
    ['focus_completeness', 'Name two details a student registration form could collect?'],
  ];
  for (const [focus, question] of questions) assert.equal(getEasySet1QuestionIssue(question, focus), null, question);
});

test('easy and hard completeness use their own list-friendly focus scopes', () => {
  for (const role of Object.values(ROLE_CONFIG)) {
    const base = getRoleSetConfig(role, 'set1', 'easy', 'focus_clarity');
    const listing = getRoleSetConfig(role, 'set1', 'easy', 'focus_completeness');
    assert.notDeepEqual(listing.topicScope, base.topicScope);
    assert.equal(listing.topicKeywords.length, listing.topicScope.length);
    for (const difficulty of ['hard']) {
      assert.notDeepEqual(getRoleSetConfig(role, 'set1', difficulty, 'focus_completeness').topicScope,
        getRoleSetConfig(role, 'set1', difficulty).topicScope);
    }
  }
  const frontend = getRoleSetConfig(ROLE_CONFIG.frontend, 'set1', 'easy', 'focus_completeness');
  assert.equal(frontend.topicScope.some(topic => /flexbox|function|click/i.test(topic)), false);
});

test('malformed focus scopes fail startup validation', () => {
  for (const damage of [
    role => { role.set1.difficultyTopics.easy.focusTopics = []; },
    role => { role.set1.difficultyTopics.easy.focusTopics.unknown = role.set1.difficultyTopics.easy; },
    role => { role.set1.difficultyTopics.easy.focusTopics.focus_completeness.topicKeywords.pop(); },
    role => { role.set2.difficultyTopics.easy.focusTopics = role.set1.difficultyTopics.easy.focusTopics; },
  ]) {
    const registry = structuredClone(ROLE_CONFIG);
    damage(registry.frontend);
    assert.throws(() => validateRoleConfig(registry), /focusTopics/);
  }
});

test('a live-batch compound question is repaired before being returned', async () => {
  const harness = providerHarness([
    'What is a boolean value and when would you use one?',
    'What is a boolean value?',
  ]);
  assert.equal(await harness.generate('focus_clarity', 'frontend', 'easy'), 'What is a boolean value?');
  assert.equal(harness.requests.length, 2);
  const repair = harness.requests[1].messages.at(-1).content;
  assert.match(repair, /Remove the appended task/);
  assert.match(repair, /same role, difficulty, and focus/);
});

test('completeness prompt uses only the configured list-friendly scope', async () => {
  const harness = providerHarness(['Name two CSS properties that change how text looks?']);
  await harness.generate('focus_completeness', 'frontend', 'easy');
  const prompt = harness.requests[0].messages[0].content;
  const allowedTopics = prompt.split('ALLOWED TOPICS')[1].split('PREFERRED TOPIC FOCUS')[0];
  assert.match(allowedTopics, /Form information/);
  assert.doesNotMatch(allowedTopics, /flexbox|page interaction/i);
});

test('completeness repairs answer giveaways and balances away from an already-tested category', async () => {
  const harness = providerHarness([
    'Name two basic JavaScript value types, such as strings or numbers?',
    'Name two details a student registration form could collect?',
  ]);
  const previous = [
    'Name two HTML tags for text?',
    'Name two basic JavaScript value types?',
    'Name two CSS properties for text styling?',
    'Name two kinds of content a page can display?',
  ];
  assert.equal(await harness.generate('focus_completeness', 'frontend', 'easy', previous),
    'Name two details a student registration form could collect?');
  assert.equal(harness.requests.length, 2);
  assert.match(harness.requests[0].messages[0].content.split('PREFERRED TOPIC FOCUS:')[1].split('QUESTION TYPE')[0],
    /Form information/);
  assert.match(harness.requests[1].messages.at(-1).content, /Remove the suggested answers/);
});

test('repeated invalid output uses a checked fallback after three attempts instead of returning it', async () => {
  const harness = providerHarness(Array(3).fill('Name three CSS flexbox properties used to arrange items in a row?'));
  const question = await harness.generate('focus_completeness', 'frontend', 'easy');
  assert.equal(getEasySet1QuestionIssue(question, 'focus_completeness'), null);
  assert.doesNotMatch(question, /flexbox/);
  assert.equal(harness.requests.length, 3);
});

test('easy topic balancing counts coverage instead of keyword density', async () => {
  const harness = providerHarness(['Name two server response outcomes?']);
  await harness.generate('focus_completeness', 'backend', 'easy', [
    'Name two checks for a required email field?',
    'Name two HTTP methods used to retrieve and submit data?',
    'Name two database operations that change stored records?',
    'Name two fields a student record in a database could contain?',
  ]);
  const target = harness.requests[0].messages[0].content.split('PREFERRED TOPIC FOCUS:')[1].split('QUESTION TYPE')[0];
  assert.match(target, /Server responses/);
});

test('incidental message wording does not mark the separate response-message topic as covered', async () => {
  const harness = providerHarness(['Name two kinds of messages shown after a form submission?']);
  await harness.generate('focus_completeness', 'fullstack', 'easy', [
    'Name two everyday details a student registration form could send to the backend?',
    'Name two basic operations an application can perform on stored records?',
    'Name two basic kinds of messages exchanged when a page asks a server for data?',
    'Name two main parts of a web application?',
  ]);
  const target = harness.requests[0].messages[0].content.split('PREFERRED TOPIC FOCUS:')[1].split('QUESTION TYPE')[0];
  assert.match(target, /Response messages/);
});

test('a constrained missing-record outcome list is repaired to general outcomes', async () => {
  const harness = providerHarness([
    'Name two response outcomes when a requested record does not exist?',
    'Name two general outcomes a server can report after a request?',
  ]);
  assert.equal(await harness.generate('focus_completeness', 'backend', 'easy'),
    'Name two general outcomes a server can report after a request?');
  assert.equal(harness.requests.length, 2);
});

test('empty and provider-error responses do not trigger quality repairs', async () => {
  for (const output of ['', new Error('Provider unavailable')]) {
    const harness = providerHarness([output]);
    await assert.rejects(harness.generate('focus_clarity', 'frontend', 'easy'));
    assert.equal(harness.requests.length, 1);
  }
});

test('medium permits a simple mechanism beyond easy concept questions', async () => {
  for (const difficulty of ['medium']) {
    const question = 'How does a media query adapt a page layout to a smaller screen?';
    const harness = providerHarness([question]);
    assert.equal(await harness.generate('focus_clarity', 'frontend', difficulty), question);
    assert.equal(harness.requests.length, 1);
  }
});

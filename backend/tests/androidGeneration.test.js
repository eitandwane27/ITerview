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
const androidFallbacks = require('../config/roles/androidFallbacks');

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
const android = ROLE_CONFIG['android'];

test('permission denial predicts access rather than an unspecified camera launch outcome', () => {
  assert.ok(getEasySet1QuestionIssue('If an app is denied permission to use the camera, what happens when it tries to open the camera?', 'focus_correctness'));
  assert.equal(getEasySet1QuestionIssue('Camera permission is denied; what access does the app have to the protected camera capability?', 'focus_correctness'), null);
});

test('unobserved list predictions account for other recomposition triggers', () => {
  const invalid = 'A screen displays a list stored in an ordinary collection, and code adds a new item directly without any observed state update. What does the displayed list show after that change?';
  assert.ok(getMediumSet1QuestionIssue(invalid, 'focus_correctness'));
  assert.equal(getMediumSet1QuestionIssue('Compose reads an unobserved list; with no other recomposition triggers, what refresh does mutating that list alone schedule?', 'focus_correctness'), null);
});

test('scope cancellation predictions explicitly require cooperative children', () => {
  assert.ok(getHardSet1QuestionIssue('A view model scope is cleared while a child coroutine is suspended in a network call; what happens to that child?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('A view model scope is cleared; what happens to its cooperative suspended child coroutine?', 'focus_correctness'), null);
  assert.ok(getHardSet1QuestionIssue('Why does cancelling a view model scope stop its suspended child coroutine even though the child is not directly cancelled?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does cancelling a view model scope stop its cooperative suspended child coroutine?', 'focus_clarity'), null);
});

test('screen destruction does not automatically clear a retained model scope', () => {
  assert.ok(getHardSet1QuestionIssue('Name three cancellation checks for a coroutine in a view model scope when the screen is destroyed?', 'focus_completeness'));
  assert.equal(getHardSet1QuestionIssue('Name three cancellation checks for a cooperative coroutine when its view model scope is cleared?', 'focus_completeness'), null);
  assert.ok(getHardSet1QuestionIssue('Name three draft restoration checks for a text field after the activity is recreated following an ordinary rotation?', 'focus_completeness'));
  assert.equal(getHardSet1QuestionIssue('Name three draft restoration checks after system initiated process death?', 'focus_completeness'), null);
});

test('changed composition effect keys intentionally cause restarts', () => {
  assert.ok(getHardSet1QuestionIssue('Name three composition effect checks that prevent a launched effect from repeating when its key changes during recomposition?', 'focus_completeness'));
  assert.equal(getHardSet1QuestionIssue('Name three composition effect checks when a request repeats during recomposition?', 'focus_completeness'), null);
});

test('hard completeness does not prefill the three requested checks', () => {
  assert.ok(getHardSet1QuestionIssue('Name three cancellation checks for a coroutine, covering scope ownership, cooperative suspension, and child job cleanup?', 'focus_completeness'));
  assert.ok(getHardSet1QuestionIssue('Name three screen reader action checks that confirm a visible icon button exposes a usable name, role, and activation behavior?', 'focus_completeness'));
  assert.ok(getHardSet1QuestionIssue('Name three screen reader action checks that confirm a custom control exposes its name, role and activation behavior?', 'focus_completeness'));
  assert.equal(getHardSet1QuestionIssue('Name three accessibility checks for an icon action used with a screen reader?', 'focus_completeness'), null);
});

test('easy correctness does not substitute a purpose explanation', () => {
  assert.ok(getEasySet1QuestionIssue('What is the purpose of using a text resource instead of a hardcoded string in an Android app?', 'focus_correctness'));
  assert.equal(getEasySet1QuestionIssue('How does a text resource differ from an image resource in an Android app?', 'focus_correctness'), null);
  assert.equal(getEasySet1QuestionIssue('What is the purpose of a text resource in an Android app?', 'focus_clarity'), null);
  assert.equal(getEasySet1QuestionIssue('What is the purpose of a label element in an HTML form?', 'focus_correctness'), null);
});

test('worker success needs explicit server acceptance for a remote save prediction', () => {
  assert.ok(getHardSet2QuestionIssue('An offline edit appears locally and the sync worker reports success; what outcome follows for the local pending edit and the confirmed server copy?'));
  assert.equal(getHardSet2QuestionIssue('An offline edit appears locally, then the server confirms its acceptance and the worker reports success; what outcome follows for its pending synchronization status?'), null);
  assert.equal(getHardSet2QuestionIssue('A sync worker reports success without server confirmation; what confirmation should you check before labeling the offline edit saved remotely?'), null);
});

test('Android explanations keep distinct scheduling and write outcomes separate', () => {
  assert.ok(getHardSet1QuestionIssue('Why does work manager keep a deferrable task scheduled after process recreation, and how do constraints decide when it runs?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does work manager keep deferrable background work scheduled after process recreation?', 'focus_clarity'), null);
  assert.ok(getHardSet2QuestionIssue('How does cancelling a parent coroutine scope stop its suspended child work, and why does that cancellation not undo a server write the child already sent?'));
  assert.equal(getHardSet2QuestionIssue('Why does cancelling a cooperative client coroutine fail to establish that an already sent server write was undone?'), null);
});

test('every Android Developer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(android, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(android, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of androidFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('Android Developer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === android.id).label, android.label);
  assert.match(buildSystemPrompt(), /"id": "android"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try Android Developer.', recommendedRoleId: android.id })).recommendedRoleId, android.id);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Android Developer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(android, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[android.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, android.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Android Developer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Coroutines do not automatically execute on a background thread/);
    }
  });

  test(`Android Developer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(android, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(android.id, difficulty, history);
      assert.ok(androidFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /Android Developer/);
  });
}

test('Android Developer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = android.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, android.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = android.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(android.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('Android Developer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', android.id, 'easy', [])
      : provider.generate(android.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('Android Developer has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = android.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(android, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(android.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('Android Developer Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [android.set2[difficulty + 'Examples'], androidFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('Android Developer raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of android.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...android.set2[difficulty + 'Examples'], ...androidFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('Android Developer empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', android.id, 'easy', [])
      : provider.generate(android.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

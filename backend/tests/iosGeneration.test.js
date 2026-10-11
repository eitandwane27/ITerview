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
const iosFallbacks = require('../config/roles/iosFallbacks');

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
const ios = ROLE_CONFIG['ios'];

test('a hard correctness comparison cannot append a request to state checks', () => {
  assert.ok(getHardSet1QuestionIssue('Compare a visible icon with its screen reader evidence, and state the three checks for accessible interaction?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does a visible icon differ from screen reader evidence that its action has an accessible name?', 'focus_correctness'), null);
});

test('hard correctness cannot sequence a cycle explanation and a reference comparison', () => {
  assert.ok(getHardSet1QuestionIssue('A stored closure strongly captures its controller; explain the reference cycle, then compare weak and checked unowned captures?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does weak closure capture differ from checked unowned capture after the target is deallocated?', 'focus_correctness'), null);
});

test('screen departure alone does not establish independent Swift task cancellation', () => {
  assert.ok(getHardSet1QuestionIssue('A Swift task downloads a file, the user leaves the screen, and it never checks cancellation; what happens to the download?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('A Swift task is cancelled while its computation never checks cancellation; what immediate stopping guarantee exists?', 'focus_correctness'), null);
});

test('valid identity and persistence wording maps to the scoped hard topic', () => {
  assert.equal(getQuestionTopicIndex("Why can changing a view's identity reset locally owned interface state?", ios.set1.difficultyTopics.hard.topicKeywords), 5);
  assert.equal(getQuestionTopicIndex('Why does displayed content fail to prove the record was durably persisted?', ios.set1.difficultyTopics.hard.topicKeywords), 3);
});

test('reusing view identity is not a premise for resetting local state', () => {
  assert.ok(getHardSet1QuestionIssue("Why can a row's local state reset when the list reuses a view identity for a different item?", 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why can reusing a view identity for a different item preserve old local state?', 'focus_clarity'), null);
});

test('hard clarity cannot append a naming task to its explanation', () => {
  assert.ok(getHardSet1QuestionIssue('Explain why a strong stored closure cycle retains its owning controller, naming the capture strength and owner?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Explain why a stored closure strongly capturing its owning controller can retain that controller?', 'focus_clarity'), null);
});

test('hard correctness does not request three accessibility evidence items', () => {
  assert.ok(getHardSet1QuestionIssue('An icon button lacks an accessible label; what name, role, and activation evidence must a screen reader report?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('An icon button lacks an accessible label; what programmatic naming property is missing?', 'focus_correctness'), null);
});

test('a missing explicit label does not determine a complete screen reader announcement', () => {
  assert.ok(getHardSet1QuestionIssue('A button has no accessible label or trait; what does the screen reader announce for that button?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('A button has no accessible label; what explicit naming property is missing?', 'focus_correctness'), null);
  assert.equal(getQuestionTopicIndex('A current request identifier differs from the completed result identifier; what result should be rejected?', ios.set1.difficultyTopics.hard.topicKeywords), 2);
});

test('navigation path updates and pushes are not intrinsically different operations', () => {
  assert.ok(getMediumSet2QuestionIssue('How does updating a navigation path differ from pushing a single screen onto the navigation stack?'));
  assert.equal(getMediumSet2QuestionIssue('How does removing the top navigation path entry differ from appending a new destination?', []), null);
});

test('navigation history does not establish a departed screen object lifetime', () => {
  assert.ok(getEasySet1QuestionIssue('What happens to the screen you leave behind when you open a new screen in a navigation stack?', 'focus_correctness'));
  assert.equal(getEasySet1QuestionIssue('A navigation stack appends details after a list; what entry immediately precedes details?', 'focus_correctness'), null);
});

test('navigation entry replacement alone does not establish changed view identity', () => {
  assert.ok(getHardSet1QuestionIssue('Why does replacing a navigation path entry reset locally owned state?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does replacing a navigation path entry that changes view identity reset locally owned state?', 'focus_clarity'), null);
});

test('closure lifetime predictions require stated capture strength', () => {
  assert.ok(getHardSet1QuestionIssue('A controller owns a stored closure that captures it; what happens to its lifetime?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('A controller owns a stored closure that strongly captures it; what happens to its lifetime?', 'focus_correctness'), null);
});

test('an existing strong closure capture cannot simultaneously assume target deallocation', () => {
  assert.ok(getHardSet1QuestionIssue('A stored closure strongly captures its controller; compare the strong and checked unowned references once the controller is deallocated?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does a weak reference differ from a checked unowned reference after the target is deallocated?', 'focus_correctness'), null);
});

test('releasing one strong capture does not establish the target lifetime', () => {
  assert.ok(getHardSet1QuestionIssue('A strong capture is explicitly released; compare what happens when a closure later accesses its owner through weak versus checked unowned references?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('The target is deallocated after its strong capture is released; compare later weak access with checked unowned access?', 'focus_correctness'), null);
});

test('user defaults cached updates do not supply durable save confirmation checks', () => {
  assert.ok(getHardSet1QuestionIssue('Name three save confirmation checks that verify a user defaults edit is durably persisted?', 'focus_completeness'));
  assert.equal(getHardSet1QuestionIssue('Name three persistent record save checks before reporting an edit as saved?', 'focus_completeness'), null);
  assert.equal(getHardSet1QuestionIssue('Why does cached user defaults readback fail to prove an edit is durably persisted?', 'focus_clarity'), null);
});

test('cooperative cancellation predictions distinguish Swift tasks from system background work', () => {
  assert.ok(getHardSet1QuestionIssue('A background task is cancelled while its loop never checks cancellation; what happens to the loop?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('A Swift task is cancelled while its loop never checks cancellation; what happens to the loop?', 'focus_correctness'), null);
});

test('every iOS Developer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(ios, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(ios, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of iosFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('iOS Developer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === ios.id).label, ios.label);
  assert.match(buildSystemPrompt(), /"id": "ios"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try iOS Developer.', recommendedRoleId: ios.id })).recommendedRoleId, ios.id);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`iOS Developer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(ios, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[ios.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, ios.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /iOS Developer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Swift task cancellation is cooperative/);
    }
  });

  test(`iOS Developer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(ios, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(ios.id, difficulty, history);
      assert.ok(iosFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /iOS Developer/);
  });
}

test('iOS Developer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = ios.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, ios.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = ios.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(ios.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('iOS Developer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', ios.id, 'easy', [])
      : provider.generate(ios.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('iOS Developer has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = ios.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(ios, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(ios.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('iOS Developer Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [ios.set2[difficulty + 'Examples'], iosFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('iOS Developer raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of ios.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...ios.set2[difficulty + 'Examples'], ...iosFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('iOS Developer empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', ios.id, 'easy', [])
      : provider.generate(ios.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

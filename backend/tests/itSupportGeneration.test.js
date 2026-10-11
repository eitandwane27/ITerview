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
const itSupportFallbacks = require('../config/roles/itSupportFallbacks');

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
const itSupport = ROLE_CONFIG['it-support'];

test('post-clear name lookup checks do not reconstruct missing pre-change evidence', () => {
  assert.ok(getHardSet2QuestionIssue('Clearing the local DNS cache makes a site resolve; name two checks that show whether the earlier failure was cached data or a resolver problem?'));
  assert.equal(getHardSet2QuestionIssue('Cache and direct resolver answers were captured before clearing the local DNS cache; name two checks for the earlier failure evidence?'), null);
  assert.equal(getHardSet2QuestionIssue('After clearing the local DNS cache, what current resolver answer should be checked first?'), null);
});

test('one-user restoration can coexist with an ongoing wider incident', () => {
  assert.ok(getHardSet2QuestionIssue('One user prints again while other users still report queued jobs; what evidence tells whether this is a workaround for one user or a wider incident?'));
  assert.equal(getHardSet2QuestionIssue('One user prints again while other users still report queued jobs; what remaining incident impact should be recorded?'), null);
});

test('unsaved restart predictions state the content recovery behavior', () => {
  assert.ok(getHardSet2QuestionIssue('A user has unsaved work before an approved restart; what outcome follows for that unsaved work?'));
  assert.ok(getHardSet1QuestionIssue('An editor restores previous sessions after a restart and prompts before closing; what happens to unsaved changes after an unexpected restart?', 'focus_correctness'));
  assert.equal(getHardSet2QuestionIssue('A restart discards unsaved local edits and recovery is disabled; what happens to those edits?'), null);
  assert.equal(getHardSet1QuestionIssue('An editor automatically saves unsaved content before restarting; what happens to that content after the restart?', 'focus_correctness'), null);
  assert.equal(getHardSet2QuestionIssue('Why should unsaved work be preserved before a disruptive restart?'), null);
});

test('hard correctness compares evidence without requesting separate conclusions for each source', () => {
  assert.ok(getHardSet1QuestionIssue('A browser reaches a site while a name lookup test fails; what does each result prove?', 'focus_correctness'));
  assert.ok(getHardSet1QuestionIssue('Two recovery sources are supplied; what authorization does each source establish?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does a successful ping differ from evidence that a user application works?', 'focus_correctness'), null);
});

test('ticket classification does not imply an unstated priority rule', () => {
  assert.ok(getMediumSet2QuestionIssue('What does classifying a ticket as an incident rather than a service request change about how it is prioritized?'));
  assert.equal(getMediumSet2QuestionIssue('Why does incident classification alone not determine priority without impact and urgency?'), null);
  assert.equal(getMediumSet2QuestionIssue('Policy ranks incidents above service requests; what priority ordering follows from classifying this interruption as an incident?'), null);
});

test('recovery comparisons require channel verification rather than manager title assumptions', () => {
  assert.ok(getHardSet2QuestionIssue('How does verifying identity through a manager verbal confirmation differ in risk from an independent trusted record during account recovery?'));
  assert.equal(getHardSet2QuestionIssue('How does an unverified manager confirmation differ from an independent trusted record for account recovery?'), null);
  assert.equal(getHardSet2QuestionIssue('How does an authenticated manager confirmation differ from an independent trusted record as an identity evidence source?'), null);
});

test('every IT Support example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(itSupport, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(itSupport, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of itSupportFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('IT Support is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === itSupport.id).label, itSupport.label);
  assert.match(buildSystemPrompt(), /"id": "it-support"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try IT Support.', recommendedRoleId: itSupport.id })).recommendedRoleId, itSupport.id);
  const knowledge = require('../services/chatbotKnowledgeService').getRoleCatalogue();
  assert.equal(knowledge.find(role => role.id === itSupport.id).label, 'IT Support / Service Desk');
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`IT Support ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(itSupport, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[itSupport.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, itSupport.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /IT Support/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Follow an approved identity verification/);
    }
  });

  test(`IT Support ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(itSupport, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(itSupport.id, difficulty, history);
      assert.ok(itSupportFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /IT Support/);
  });
}

test('IT Support examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = itSupport.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, itSupport.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = itSupport.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(itSupport.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('IT Support provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', itSupport.id, 'easy', [])
      : provider.generate(itSupport.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('IT Support has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = itSupport.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(itSupport, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(itSupport.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('IT Support Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [itSupport.set2[difficulty + 'Examples'], itSupportFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('IT Support raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of itSupport.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...itSupport.set2[difficulty + 'Examples'], ...itSupportFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('IT Support empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', itSupport.id, 'easy', [])
      : provider.generate(itSupport.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

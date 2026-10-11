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
const devopsFallbacks = require('../config/roles/devopsFallbacks');

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
const devops = ROLE_CONFIG['devops'];

test('container removal predictions state volume retention', () => {
  assert.ok(getMediumSet1QuestionIssue('Why does a container keep its data after removal when stored in a mounted volume?', 'focus_clarity'));
  assert.equal(getMediumSet1QuestionIssue('Why does a container keep its data after removal when its mounted volume is retained?', 'focus_clarity'), null);
});

test('container restarts and environment updates are not interchangeable', () => {
  assert.ok(getMediumSet2QuestionIssue('Why would you prefer restarting a container over changing its environment variables when it reads settings only at startup?'));
  assert.equal(getMediumSet2QuestionIssue('Why would you prefer recreating a container with updated environment values over restarting it with unchanged settings?', []), null);
});

test('state locking protects shared state rather than plan file replacements', () => {
  assert.ok(getHardSet1QuestionIssue('Why does enabled state locking prevent one plan from overwriting the other?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does supported Terraform state locking coordinate two cooperating writers to the same state?', 'focus_clarity'), null);
});

test('migration state alone does not prove application behavior after rollback', () => {
  assert.ok(getHardSet1QuestionIssue('Why does rolling back only a container image fail to restore previous application behavior after a migration?', 'focus_clarity'));
  assert.ok(getHardSet1QuestionIssue('After a migration, why does restoring the old image alone fail to restore the previous application behavior?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does rolling back only a container image leave an applied database migration unchanged?', 'focus_clarity'), null);
});

test('failed readiness with passing liveness does not trigger an assumed restart', () => {
  assert.ok(getHardSet2QuestionIssue('A readiness probe fails while the liveness probe keeps passing; why would you prefer fixing readiness over letting the restart policy recreate the container?'));
  assert.equal(getHardSet2QuestionIssue('A readiness probe fails while liveness passes; what readiness evidence should you check first?', []), null);
});

test('probe failure counts identify the failing probe consistently', () => {
  assert.ok(getHardSet1QuestionIssue('The readiness probe fails while the liveness probe keeps passing; what happens to the container during the first two failures?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('The readiness probe fails while the liveness probe keeps passing; what happens to traffic eligibility during the first two readiness failures?', 'focus_correctness'), null);
});

test('recovery outcome comparisons require a permitted data loss bound', () => {
  assert.ok(getHardSet2QuestionIssue('A restore is missing two hours of writes; what outcome follows when you compare it against the stated recovery point requirement?'));
  assert.equal(getHardSet2QuestionIssue('A restore is missing two hours of writes and the maximum permitted data loss is one hour; what outcome follows for recovery compliance?', []), null);
});

test('token comparisons state server support before predicting duplicate effects', () => {
  assert.ok(getHardSet2QuestionIssue('After a lost response, how does retrying with the same operation token differ from retrying with a new one in terms of duplicate effects?'));
  assert.equal(getHardSet2QuestionIssue('The server supports deduplication for equivalent requests within its token lifetime; how does retrying with the same operation token differ from using a new one?', []), null);
});

test('valid shared state and average measurement wording is recognized', () => {
  assert.equal(getQuestionTopicIndex('Two writers share one infrastructure as code state file; what happens while the supported lock is held?', devops.set1.difficultyTopics.hard.topicKeywords), 0);
  assert.equal(getQuestionTopicIndex('A healthy average response time hides slow requests; what measurement limit should you check first?', devops.set2.difficultyTopics.hard.topicKeywords), 4);
  assert.equal(getQuestionTopicIndex('A request times out; name two checks before retrying with the same operation token?', devops.set2.difficultyTopics.hard.topicKeywords), 2);
});

test('every DevOps Engineer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(devops, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(devops, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of devopsFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('DevOps Engineer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === devops.id).label, devops.label);
  assert.match(buildSystemPrompt(), /"id": "devops"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try DevOps Engineer.', recommendedRoleId: devops.id })).recommendedRoleId, devops.id);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`DevOps Engineer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(devops, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[devops.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, devops.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /DevOps Engineer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /State locking only coordinates/);
    }
  });

  test(`DevOps Engineer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(devops, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(devops.id, difficulty, history);
      assert.ok(devopsFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /DevOps Engineer/);
  });
}

test('DevOps Engineer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = devops.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, devops.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = devops.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(devops.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('DevOps Engineer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', devops.id, 'easy', [])
      : provider.generate(devops.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('DevOps Engineer has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = devops.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(devops, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(devops.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('DevOps Engineer Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [devops.set2[difficulty + 'Examples'], devopsFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('DevOps Engineer raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of devops.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...devops.set2[difficulty + 'Examples'], ...devopsFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('DevOps Engineer empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', devops.id, 'easy', [])
      : provider.generate(devops.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

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
const gameFallbacks = require('../config/roles/gameDeveloperFallbacks');

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
const game = ROLE_CONFIG['game-developer'];

test('easy technical loop guard permits game loop concepts and still rejects loop variant selection', () => {
  assert.equal(getEasySet2QuestionIssue('What does a game loop update during play?'), null);
  assert.equal(getEasySet2QuestionIssue('What is a game loop used for?'), null);
  assert.equal(getEasySet2QuestionIssue('What happens to game loop updates when the game stops updating?'), null);
  assert.ok(getEasySet2QuestionIssue('Which loop should you use to repeat this operation?'));
  assert.ok(getEasySet2QuestionIssue('What loop variant should you use for these values?'));
});

test('hard correctness rejects an appended yes-or-no task while accepting one focused comparison', () => {
  const invalid = 'What does an interpolated physics pose represent between snapshots, and does it change collision state?';
  assert.ok(getHardSet1QuestionIssue(invalid, 'focus_correctness'));
  const valid = 'How does rendering an interpolated physics pose differ from advancing the actual simulation toward a future pose?';
  assert.equal(getHardSet1QuestionIssue(valid, 'focus_correctness'), null);
});

test('game lifetime predictions require countdown resumption rather than assuming reuse restarts a timer', () => {
  const invalid = 'A pooled projectile is reactivated without resetting its lifetime countdown; what happens to its new activation?';
  const valid = 'A pooled projectile retains an almost expired lifetime and resumes its countdown on reuse; what happens to its new activation?';
  assert.ok(getHardSet1QuestionIssue(invalid, 'focus_correctness'));
  assert.ok(getHardSet2QuestionIssue(invalid));
  assert.equal(getHardSet1QuestionIssue(valid, 'focus_correctness'), null);
  assert.equal(getHardSet2QuestionIssue(valid), null);
  assert.equal(getHardSet2QuestionIssue('Why must a pooled object reset its lifetime before reuse when the previous activation nearly expired?'), null);
});

test('long render frame predictions require simulation advancement conditions', () => {
  const invalid = 'The display interpolates completed physics poses; if a frame takes much longer than usual, what does the player see?';
  const valid = 'The display interpolates between two completed physics poses with no additional physics ticks; if a frame takes much longer than usual, what does the display show?';
  assert.ok(getHardSet2QuestionIssue(invalid));
  assert.ok(getHardSet2QuestionIssue('Physics runs at a fixed step while rendering interpolates two completed poses; if a frame takes much longer than one physics step, what does the displayed pose show?'));
  assert.equal(getHardSet2QuestionIssue(valid), null);
  assert.equal(getHardSet2QuestionIssue('How does interpolation between completed physics snapshots smooth visual motion without advancing collision simulation?'), null);
});

test('every Game Developer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(game, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(game, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of gameFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('Game Developer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === game.id).label, game.label);
  assert.match(buildSystemPrompt(), /"id": "game-developer"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try Game Developer.', recommendedRoleId: game.id })).recommendedRoleId, game.id);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Game Developer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(game, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[game.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, game.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Game Developer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Fixed physics steps do not guarantee deterministic replay/);
    }
  });

  test(`Game Developer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(game, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(game.id, difficulty, history);
      assert.ok(gameFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /Game Developer/);
  });
}

test('Game Developer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = game.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, game.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = game.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(game.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('Game Developer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', game.id, 'easy', [])
      : provider.generate(game.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('Game Developer has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = game.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(game, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(game.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('Game Developer Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [game.set2[difficulty + 'Examples'], gameFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('Game Developer raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of game.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...game.set2[difficulty + 'Examples'], ...gameFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('Game Developer empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', game.id, 'easy', [])
      : provider.generate(game.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

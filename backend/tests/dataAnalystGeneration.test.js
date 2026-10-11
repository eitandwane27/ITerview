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
const dataAnalystFallbacks = require('../config/roles/dataAnalystFallbacks');

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
const dataAnalyst = ROLE_CONFIG['data-analyst'];

test('spoken source reproduction and volunteer aliases retain their hard topic', () => {
  const keywords = dataAnalyst.set2.difficultyTopics.hard.topicKeywords;
  assert.equal(getQuestionTopicIndex('What should be preserved so original results could be reproduced?', keywords), 5);
  assert.equal(getQuestionTopicIndex('Students volunteered through a sign-up sheet; what coverage checks support generalization?', keywords), 2);
  assert.equal(getQuestionTopicIndex('What evidence separates a tutoring effect from self-selection?', keywords), 3);
});

test('volunteer sampling leaves representativeness unproven without proving bias', () => {
  assert.ok(getHardSet1QuestionIssue('Why does a very large volunteer survey still fail to represent the wider student population?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does a very large volunteer survey alone fail to establish representativeness of the wider student population?', 'focus_clarity'), null);
});

test('unequal group sizes alone do not guarantee an incorrect equal average of rates', () => {
  assert.ok(getHardSet1QuestionIssue('Why does averaging two group pass rates equally misstate the overall rate when eligible group sizes differ?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why can averaging two group pass rates equally misstate the overall rate when eligible group sizes differ?', 'focus_clarity'), null);
});

test('record grain determines row count meaning rather than necessarily changing a quantity sum', () => {
  assert.ok(getMediumSet1QuestionIssue('Why does one row per order item change what a total quantity represents?', 'focus_clarity'));
  assert.equal(getMediumSet1QuestionIssue('Why does one row per order item change what a row count represents?', 'focus_clarity'), null);
});

test('Data Analyst clarity rejects an appended numbered explanation list', () => {
  assert.ok(getHardSet1QuestionIssue('Explain why observational correlation alone cannot establish causation, naming three alternative explanations?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why does observational correlation alone leave uncertainty about whether a treatment caused the observed outcome?', 'focus_clarity'), null);
  assert.equal(getHardSet1QuestionIssue('Name three causal evidence checks before attributing observational correlation to a treatment?', 'focus_completeness'), null);
});

test('an extreme observation alone does not establish mean versus median ordering', () => {
  assert.ok(getMediumSet1QuestionIssue('House prices are mostly between two hundred thousand and three hundred thousand, with one outlier at five million; how does the mean compare with the median?', 'focus_correctness'));
  assert.equal(getMediumSet1QuestionIssue('How does the mean differ from the median in sensitivity to an extreme outlier?', 'focus_correctness'), null);
});

test('changed source files alone do not determine a specific result difference', () => {
  assert.ok(getHardSet1QuestionIssue("Two analysts apply identical cleaning instructions, but one uses a saved source snapshot and the other an updated file; how do their results compare?", 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does retaining a source snapshot differ from keeping only transformation instructions when source records change?', 'focus_correctness'), null);
});

test('every Data Analyst example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(dataAnalyst, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(dataAnalyst, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of dataAnalystFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('Data Analyst is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === dataAnalyst.id).label, dataAnalyst.label);
  assert.match(buildSystemPrompt(), /"id": "data-analyst"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try Data Analyst.', recommendedRoleId: dataAnalyst.id })).recommendedRoleId, dataAnalyst.id);
  const knowledge = require('../services/chatbotKnowledgeService').getRoleCatalogue();
  assert.equal(knowledge.find(role => role.id === dataAnalyst.id).label, 'Data Analyst');
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Data Analyst ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(dataAnalyst, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[dataAnalyst.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, dataAnalyst.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Data Analyst/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /Observational correlation alone/);
    }
  });

  test(`Data Analyst ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(dataAnalyst, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(dataAnalyst.id, difficulty, history);
      assert.ok(dataAnalystFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /Data Analyst/);
  });
}

test('Data Analyst examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = dataAnalyst.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, dataAnalyst.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = dataAnalyst.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(dataAnalyst.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('Data Analyst provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', dataAnalyst.id, 'easy', [])
      : provider.generate(dataAnalyst.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('Data Analyst has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = dataAnalyst.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(dataAnalyst, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(dataAnalyst.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('Data Analyst Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [dataAnalyst.set2[difficulty + 'Examples'], dataAnalystFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('Data Analyst raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of dataAnalyst.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...dataAnalyst.set2[difficulty + 'Examples'], ...dataAnalystFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('Data Analyst empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', dataAnalyst.id, 'easy', [])
      : provider.generate(dataAnalyst.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

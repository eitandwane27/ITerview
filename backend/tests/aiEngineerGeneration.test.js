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
const aiEngineerFallbacks = require('../config/roles/aiEngineerFallbacks');

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
const aiEngineer = ROLE_CONFIG['ai-engineer'];

test('current retrieval evidence does not guarantee correctness after fine tuning', () => {
  assert.ok(getHardSet2QuestionIssue('When policy facts change, how does supplying current text through retrieval keep answers accurate while a fine-tuned model alone would not?'));
  assert.ok(getHardSet2QuestionIssue('When policy facts change, how does fine tuning alone cause stale answers while retrieval of current text prevents that staleness?'));
  assert.equal(getHardSet2QuestionIssue('Why can retrieval of current policy text help a fine-tuned model answer changing facts without guaranteeing accuracy?'), null);
});

test('controller prediction fixtures state a known setting instead of asking for a project resource', () => {
  const { technicalQuestionProvider } = require('./fixtures/technicalQuestionProvider');
  for (const role of Object.values(ROLE_CONFIG)) {
    const topics = getRoleSetConfig(role, 'set2', 'easy').topicScope;
    for (const topic of topics) {
      const question = technicalQuestionProvider(`SELECTED QUESTION FORMAT: prediction\nPrefer targeting this topic: "${topic}"`, ROLE_CONFIG, role.id, 'easy', 1);
      assert.equal(getEasySet2QuestionIssue(question), null, question);
    }
  }
});

test('generation retry outcomes need an application response selection policy', () => {
  assert.ok(getMediumSet2QuestionIssue('A generation request times out, so the app retries it; what happens to the answer if the first attempt actually completed?'));
  assert.equal(getMediumSet2QuestionIssue('A generation request times out; what completion status should the app check before a retry?'), null);
  assert.equal(getMediumSet2QuestionIssue('A generation request times out; the app displays only the first completed response; both attempts finish; what happens to the answer?'), null);
});

test('injection wording does not establish disclosure without execution evidence', () => {
  assert.ok(getHardSet2QuestionIssue("A retrieved document contains hidden instructions requesting another user private notes; what outcome follows, and why does filtering the answer afterward not prevent exposure?"));
  assert.equal(getHardSet2QuestionIssue('Why does labeling untrusted text alone leave private document authorization dependent on application enforcement?'), null);
  assert.equal(getHardSet2QuestionIssue('A retrieved page contains hidden instructions; the application blocks all unauthorized tool calls; what happens to a requested unauthorized tool execution?'), null);
  assert.ok(getHardSet2QuestionIssue("A retrieved document contains the instruction to ignore access rules and reveal another user private notes; what outcome follows?"));
});

test('retriever cutoff exclusion is distinct from an included candidate ranked too low', () => {
  assert.ok(getHardSet1QuestionIssue('A retrieval system returns the top five passages and the correct passage ranks eighth; how does this ranking failure differ from a missing candidate failure?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does a relevant passage absent from reranker candidates differ from an included passage ranked too low for final context?', 'focus_correctness'), null);
});

test('hard correctness cannot hide binary recall after a context semicolon', () => {
  assert.ok(getHardSet1QuestionIssue('A reranker receives ten passages and the relevant one is eighth; is that a missing candidate or a poor ranking failure?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does an included retrieval candidate ranked too low differ from one absent from the reranker input?', 'focus_correctness'), null);
});

test('failure comparisons do not append remedies and loop bounds do not append cache repair', () => {
  assert.ok(getHardSet1QuestionIssue('A reranker receives the relevant passage while another misses it; how do these failures differ in cause and in the fix each requires?', 'focus_correctness'));
  assert.equal(getHardSet1QuestionIssue('How does an included retrieval candidate ranked too low differ from one absent from the reranker input?', 'focus_correctness'), null);
  assert.ok(getHardSet2QuestionIssue('An assistant loops up to five times and reuses cached passages; what should be done to bound the loop while keeping the cache valid?'));
  assert.equal(getHardSet2QuestionIssue('An agent keeps retrying retrieval when evidence is missing; what resource budget safeguard should bound the loop?'), null);
});

test('timeout ambiguity does not append a second safeguard explanation in clarity', () => {
  assert.ok(getHardSet1QuestionIssue('Explain why a timeout alone does not prove the booking was never committed, and why a stable idempotency key enforced by the server prevents a duplicate?', 'focus_clarity'));
  assert.equal(getHardSet1QuestionIssue('Why can a booking tool timeout leave uncertainty about whether its side effect was committed?', 'focus_clarity'), null);
});

test('spoken evaluation, model parameters and disclosure retain their intended topics', () => {
  const keywords = aiEngineer.set2.difficultyTopics.hard.topicKeywords;
  assert.equal(getQuestionTopicIndex('You tune prompts against twenty cases; what does that reported accuracy fail to represent?', keywords), 3);
  assert.equal(getQuestionTopicIndex('How does adapting model parameters differ from supplying current reference text?', keywords), 4);
  assert.equal(getQuestionTopicIndex('Why does enforcement prevent disclosure of admin notes?', keywords), 1);
  assert.equal(getQuestionTopicIndex('For a streamed model response, how does time to first visible text differ from total completion time?', keywords), 5);
});

test('every AI Engineer example and recovery entry passes its tier guard and topic mapping', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(aiEngineer, 'set1', difficulty, focus);
      for (const [index, question] of data[`${difficulty}Examples`][focus].entries()) {
        assert.equal(set1Guards[difficulty](question, focus), null, question);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
        assert.equal(getQuestionTopicIndex(question, data.topicKeywords), index, question);
      }
    }
    const data = getRoleSetConfig(aiEngineer, 'set2', difficulty);
    for (const question of data[`${difficulty}Examples`]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1, question);
    }
    for (const [prefix, question] of aiEngineerFallbacks[difficulty]) {
      assert.equal(set2Guards[difficulty](question), null, question);
      const index = getQuestionTopicIndex(question, data.topicKeywords);
      assert.notEqual(index, -1, question);
      assert.equal(data.topicScope[index].split(':')[0], prefix, question);
    }
  }
});

test('AI Engineer is exposed to the recommendation prompt and accepted as a recommended role', () => {
  const { buildSystemPrompt, getRoleCatalogue, normalizeModelReply } = require('../services/roleRecommendationService');
  assert.equal(getRoleCatalogue().find(role => role.id === aiEngineer.id).label, aiEngineer.label);
  assert.match(buildSystemPrompt(), /"id": "ai-engineer"/);
  assert.equal(normalizeModelReply(JSON.stringify({ reply: 'Try AI Engineer.', recommendedRoleId: aiEngineer.id })).recommendedRoleId, aiEngineer.id);
  const knowledge = require('../services/chatbotKnowledgeService').getRoleCatalogue();
  assert.equal(knowledge.find(role => role.id === aiEngineer.id).label, 'AI Engineer');
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`AI Engineer ${difficulty} Set 1 recovers five distinct scoped questions for every focus`, async t => {
    t.mock.method(console, 'warn', () => {});
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const provider = harness(1, 'Walk me through an entire testing process from start to finish?');
      const data = getRoleSetConfig(aiEngineer, 'set1', difficulty, focus);
      const bank = [...data[`${difficulty}Examples`][focus],
        ...(SET1_FALLBACK_SUPPLEMENTS[aiEngineer.id][difficulty]?.[focus] || [])];
      const history = [];
      for (let index = 0; index < 5; index++) {
        const question = await provider.generate(focus, aiEngineer.id, difficulty, history);
        assert.ok(bank.includes(question));
        assert.equal(set1Guards[difficulty](question, focus, history), null);
        assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
        history.push(question);
      }
      assert.equal(new Set(history).size, 5);
      assert.equal(provider.requests.length, 15);
      for (const request of provider.requests) assert.match(request.messages[0].content, /AI Engineer/);
      for (const request of provider.requests) assert.match(request.messages[0].content, /A reranker can reorder/);
    }
  });

  test(`AI Engineer ${difficulty} Set 2 recovers five distinct questions from its own reviewed bank`, async t => {
    t.mock.method(console, 'warn', () => {});
    const provider = harness(2, 'Walk me through an entire testing process from start to finish?');
    const data = getRoleSetConfig(aiEngineer, 'set2', difficulty);
    const history = [];
    for (let index = 0; index < 5; index++) {
      const question = await provider.generate(aiEngineer.id, difficulty, history);
      assert.ok(aiEngineerFallbacks[difficulty].some(([, reviewed]) => reviewed === question));
      assert.equal(set2Guards[difficulty](question, history), null);
      assert.notEqual(getQuestionTopicIndex(question, data.topicKeywords), -1);
      history.push(question);
    }
    assert.equal(new Set(history).size, 5);
    assert.equal(provider.requests.length, 15);
    for (const request of provider.requests) assert.match(request.messages[0].content, /AI Engineer/);
  });
}

test('AI Engineer examples are deliverable on the first draft at each tier and focus', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const question = aiEngineer.set1[`${difficulty}Examples`][focus][0];
      const provider = harness(1, question);
      assert.equal(await provider.generate(focus, aiEngineer.id, difficulty, []), question);
      assert.equal(provider.requests.length, 1);
    }
    const question = aiEngineer.set2[`${difficulty}Examples`][0];
    const provider = harness(2, question);
    assert.equal(await provider.generate(aiEngineer.id, difficulty, []), question);
    assert.equal(provider.requests.length, 1);
  }
});

test('AI Engineer provider outages propagate without disguising them as reviewed fallback success', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, new Error('Provider unavailable'));
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', aiEngineer.id, 'easy', [])
      : provider.generate(aiEngineer.id, 'easy', []), /Provider unavailable/);
    assert.equal(provider.requests.length, 1);
  }
});


test('AI Engineer has explicit focus scopes and distinct applied technical scopes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const base = aiEngineer.set1.difficultyTopics[difficulty];
    assert.equal(base.topicScope.length, 6);
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      const data = getRoleSetConfig(aiEngineer, 'set1', difficulty, focus);
      assert.equal(data.topicScope.length, 6);
      assert.ok(data.topicScope.every(topic => topic.includes(':')));
      assert.equal(data[difficulty + 'Examples'][focus].length, 6);
    }
    assert.notDeepEqual(aiEngineer.set2.difficultyTopics[difficulty].topicScope, base.topicScope);
  }
});

test('AI Engineer Set 2 covers each allowed format in examples and recovery banks', () => {
  const { getTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
  const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const formats = difficulty === 'easy' ? EASY_TECHNICAL_FORMATS : MEDIUM_TECHNICAL_FORMATS;
    for (const bank of [aiEngineer.set2[difficulty + 'Examples'], aiEngineerFallbacks[difficulty].map(([, question]) => question)]) {
      assert.deepEqual(new Set(bank.map(getTechnicalQuestionFormat)), new Set(formats), difficulty);
    }
  }
});

test('AI Engineer raw and speech-sanitized examples and recovery remain usable', () => {
  const { sanitizeTTS } = require('../utils/ttsSanitizer');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const focus of ['focus_clarity', 'focus_correctness', 'focus_completeness']) {
      for (const question of aiEngineer.set1[difficulty + 'Examples'][focus]) {
        assert.equal(sanitizeTTS(question), question);
        assert.equal(set1Guards[difficulty](sanitizeTTS(question), focus), null);
      }
    }
    for (const question of [...aiEngineer.set2[difficulty + 'Examples'], ...aiEngineerFallbacks[difficulty].map(([, q]) => q)]) {
      assert.equal(sanitizeTTS(question), question);
      assert.equal(set2Guards[difficulty](sanitizeTTS(question)), null);
    }
  }
});

test('AI Engineer empty provider output retains generation errors', async () => {
  for (const set of [1, 2]) {
    const provider = harness(set, '');
    await assert.rejects(set === 1 ? provider.generate('focus_clarity', aiEngineer.id, 'easy', [])
      : provider.generate(aiEngineer.id, 'easy', []), /empty|no.*question/i);
    assert.equal(provider.requests.length, 1);
  }
});

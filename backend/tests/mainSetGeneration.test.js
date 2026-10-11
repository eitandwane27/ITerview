const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { ROLE_CONFIG, VALID_ROLES, getRoleSetConfig, getRoleRestrictions } = require('../config/roleConfig');
const { resolveSetDifficulty } = require('../config/interviewConfig');
const { validateRoleConfig } = require('../config/validateRoleConfig');
const { BEHAVIORAL_COMPETENCIES } = require('../config/behavioralInterviewConfig');
const { BEHAVIORAL_QUESTION_ANGLES } = require('../config/behavioralQuestionAngles');
const { createBehavioralQuestionVariety } = require('../utils/behavioralQuestionVariety');
const { technicalQuestionProvider } = require('./fixtures/technicalQuestionProvider');
const { hardSet1QuestionProvider } = require('./fixtures/hardSet1QuestionProvider');
const technicalVariety = require('../utils/technicalQuestionVariety');
const { TECHNICAL_QUESTION_FORMATS } = require('../config/technicalQuestionFormats');

// Exercise the controllers and real prompt builders used by MainSets, with
// provider, speech, and persistence boundaries replaced. No credentials or
// external services are used, and generated text is deliberately synthetic.
function loadWithDependencies(relativePath, dependencies) {
  const filename = path.resolve(__dirname, relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(dependencies, id) ? dependencies[id] : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports;
}

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  messages = [];

  send(payload) {
    const message = JSON.parse(payload);
    this.messages.push(message);
    this.emit('sent', message);
  }

  close() {
    this.readyState = 3;
    this.emit('close');
  }

  waitFor(predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Main-set startup timed out')), 2000);
      const finish = (error) => {
        clearTimeout(timer);
        this.off('sent', inspect);
        if (error) reject(error);
        else resolve();
      };
      const inspect = (message) => {
        if (message.type === 'error') finish(new Error(message.message));
        if (predicate(message)) finish();
      };
      this.on('sent', inspect);
      this.messages.forEach(inspect);
    });
  }

  waitUntilReady() {
    return this.waitFor(message => message.type === 'status' && message.message.startsWith('Question ready.'));
  }
}

function createHarness(set, { role, difficulty, unlockedDifficulty = difficulty,
  registry = ROLE_CONFIG, existing = null, providerError = null, emptyResponse = false,
  generatedOutputs = null, evaluationOutput = null, completedSets = null } = {}) {
  const requests = [];
  const writes = [];
  const historyWrites = [];
  let stored = existing && structuredClone(existing);
  const generator = loadWithDependencies(`../services/aiSet${set}Generator.js`, {
    openai: { OpenAI: class {
      chat = { completions: { create: async (request) => {
        requests.push(structuredClone(request));
        if (providerError) throw providerError;
        const evaluation = { clarity_score: 4, correctness_score: 4, completeness_score: 4,
          problem_solving_score: 4, accuracy_score: 4, depth_score: 4,
          situation_score: 4, action_score: 4, result_score: 4,
          tip: 'Include a concrete example.', interviewer_reply: 'That was clear. Keep practicing.' };
        return { choices: [{ message: { content: emptyResponse ? '' : request.response_format
          ? (typeof evaluationOutput === 'function' ? evaluationOutput(request) : evaluationOutput) ?? JSON.stringify(evaluation) : generatedOutputs
            ? typeof generatedOutputs === 'function' ? generatedOutputs(request, requests.length) : generatedOutputs.shift() : set === 3
              ? BEHAVIORAL_QUESTION_ANGLES.flat().find(angle => request.messages[0].content.includes(`Practice angle: ${angle.id}\n`)).example
              : set === 2 ? technicalQuestionProvider(request.messages[0].content, registry,
                existing?.role || role, existing?.difficulty || unlockedDifficulty, requests.length)
              : (existing?.difficulty || unlockedDifficulty) === 'hard'
                ? hardSet1QuestionProvider(request.messages[0].content, registry,
                  existing?.role || role, 'focus_clarity', requests.length)
                : `Generated question ${requests.length}?` } }] };
      } } };
    } },
    '../config/roleConfig': { getRoleConfig: (id) => registry[id] || registry.fullstack,
      getRoleSetConfig, getRoleRestrictions },
    '../utils/behavioralQuestionVariety': { behavioralQuestionVariety: createBehavioralQuestionVariety(() => 0.999) },
    ...(generatedOutputs && set === 2 ? {
      '../utils/technicalQuestionVariety': { ...technicalVariety,
        selectTechnicalQuestionFormat(_difficulty, history) {
          const guard = require('../utils/mediumQuestionGuard').getMediumSet2QuestionIssue;
          const question = generatedOutputs.find(output => !guard(output, history)) || generatedOutputs[0] || '';
          const id = technicalVariety.getTechnicalQuestionFormat(question);
          return { id, instruction: TECHNICAL_QUESTION_FORMATS[id] };
        } },
    } : {}),
  });
  const sessionModel = {
    findOne: async () => existing && structuredClone(existing),
    findOneAndUpdate: async (_query, update) => {
      writes.push(structuredClone(update));
      if (update.$push) stored.answers.push(structuredClone(update.$push.answers));
      else stored = { _id: `test-set-${set}`, ...stored, ...structuredClone(update.$set || update) };
      const document = structuredClone(stored);
      if (set === 3 && completedSets) {
        const methods = require('../models/Set3Session').schema.methods;
        document.computeAverages = methods.computeAverages;
        document.finalise = methods.finalise;
      }
      return document;
    },
  };
  const controller = loadWithDependencies(`../controllers/set${set}Socket.js`, {
    '../services/interviewSettings': loadWithDependencies('../services/interviewSettings.js', {
      '../config/roleConfig': { VALID_ROLES: Object.keys(registry), getRoleMetadata: id => registry[id] && ({
        label: registry[id].label, setTopics: { set1: registry[id].set1.topicScope, set2: registry[id].set2.topicScope },
      }) },
    }),
    '../services/sttService': { createDeepgramLiveSession() { throw new Error('Unexpected STT call'); } },
    '../services/ttsService': { synthesizeSpeech: async () => Buffer.from('synthetic audio') },
    [`../services/aiSet${set}Generator`]: generator,
    '../models/User': {
      findOne: async () => ({ role, difficulty, unlockedDifficulty }),
      findOneAndUpdate: async (_query, update) => { historyWrites.push(structuredClone(update)); },
    },
    '../models/PreTestSession': { findOne: () => ({ sort: async () => ({
      final_weakness_tag: 'focus_clarity', baseline_score_percentage: 60,
    }) }) },
    '../models/Set1Session': completedSets ? { findOne: async () => completedSets[0] } : sessionModel,
    '../models/Set2Session': completedSets ? { findOne: async () => completedSets[1] } : sessionModel,
    '../models/Set3Session': sessionModel,
  });
  const socket = new FakeSocket();
  return {
    requests, writes, historyWrites, socket,
    get stored() { return stored; },
    start() {
      controller[`handleSet${set}Socket`](socket, {
        url: `/ws/set${set}?uid=generation-test-user&mode=practice`,
        headers: { host: 'localhost:5000' },
      });
      return socket.waitUntilReady();
    },
  };
}

const additionalRole = structuredClone(ROLE_CONFIG.backend);
additionalRole.id = 'qa-test';
additionalRole.label = 'QA Test Engineer';
additionalRole.avoidList = 'Do not ask about software implementation or unrelated development topics.';
additionalRole.difficultyAvoidLists = {};
for (const set of ['set1', 'set2']) {
  additionalRole[set].topicScope = ['Test planning', 'Defect reporting'];
  additionalRole[set].topicKeywords = [['test', 'plan'], ['defect', 'report']];
  delete additionalRole[set].difficultyTopics;
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const question = 'What information belongs in a defect report?';
    additionalRole[set][`${difficulty}Examples`] = set === 'set1'
      ? { focus_clarity: [question], focus_correctness: [question], focus_completeness: [question] }
      : [question];
  }
}
const extendedRegistry = { ...ROLE_CONFIG, 'qa-test': additionalRole };
validateRoleConfig(extendedRegistry);
// The extra registry role must also supply focused hard tasks for each topic.
additionalRole.set1.hardExamples.focus_clarity = [
  'How does test planning connect acceptance requirements to the behaviors checked before release?',
  'Why does a defect report need reproducible evidence before a developer can confirm the reported behavior?',
  'How does test planning expose acceptance requirements that have no corresponding verification before release?',
  'How does a reproducible defect report help a developer confirm an application failure in a second environment?',
  'Why does test planning prioritize high-risk requirements when the time available for verification is limited?',
  'How does a defect report with observed behavior help a developer confirm that a proposed fix addresses the failure?',
];

test('Set 2 quality failure without a fallback bank does not save or deliver rejected questions', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const harness = createHarness(2, { role: 'qa-test', registry: extendedRegistry, difficulty: 'easy',
    generatedOutputs: Array(3).fill('What is an API and why is it useful?') });
  t.after(() => harness.socket.close());
  await assert.rejects(harness.start(), /Failed to initialize/);
  assert.equal(harness.requests.length, 3);
  assert.equal(harness.writes.length, 1);
  assert.deepEqual(harness.stored.questions, []);
  assert.equal(harness.socket.messages.some(m => m.type === 'question_text' || m.type === 'tts_audio'), false);
});

for (const role of ['frontend', 'backend', 'fullstack']) {
  for (const difficulty of ['easy', 'medium']) {
    test(`Set 2 ${role} ${difficulty} persists and delivers reviewed fallbacks after quality repairs fail`, async t => {
      for (const method of ['log', 'error', 'warn']) t.mock.method(console, method, () => {});
      const bad = 'What is an API and why is it useful?';
      const harness = createHarness(2, { role, difficulty, generatedOutputs: Array(15).fill(bad) });
      t.after(() => harness.socket.close());
      await harness.start();
      assert.equal(harness.requests.length, 15);
      assert.equal(harness.stored.questions.length, 5);
      assert.equal(new Set(harness.stored.questions).size, 5);
      assert.equal(new Set(harness.stored.questions.map(technicalVariety.getTechnicalQuestionFormat)).size, 5);
      const bank = require('../config/technicalQuestionFallbacks').TECHNICAL_QUESTION_FALLBACKS[role][difficulty];
      assert.ok(harness.stored.questions.every(question => bank.some(([, entry]) => entry === question)));
      assert.equal(harness.stored.questions.includes(bad), false);
      assert.equal(harness.socket.messages.find(message => message.type === 'question_text').text,
        harness.stored.questions[0]);
      assert.ok(harness.socket.messages.some(message => message.type === 'tts_audio'));
    });
  }
}

test('Set 2 hard saves and delivers reviewed fallbacks after exhausting repairs', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const rejected = 'What is rendering?';
  const harness = createHarness(2, { role: 'frontend', difficulty: 'hard',
    generatedOutputs: Array(15).fill(rejected) });
  t.after(() => harness.socket.close());
  await harness.start();
  const bank = require('../config/hardTechnicalFallbacks').HARD_TECHNICAL_FALLBACKS.frontend.map(([, q]) => q);
  assert.equal(harness.requests.length, 15);
  assert.equal(harness.stored.questions.length, 5);
  assert.equal(new Set(harness.stored.questions).size, 5);
  assert.equal(new Set(harness.stored.questions.map(technicalVariety.getTechnicalQuestionFormat)).size, 5);
  assert.ok(harness.stored.questions.every(q => bank.includes(q) && q !== rejected));
  assert.equal(harness.socket.messages.find(m => m.type === 'question_text').text, harness.stored.questions[0]);
  assert.ok(harness.socket.messages.some(m => m.type === 'tts_audio'));
});

test('Set 2 saves and delivers repaired questions rather than rejected drafts', async t => {
  t.mock.method(console, 'log', () => {});
  const questions = [0, 1, 2, 4, 5].map(index => ROLE_CONFIG.frontend.set2.easyExamples[index]);
  const role = structuredClone(ROLE_CONFIG.frontend);
  role.set2.difficultyTopics.easy = { topicScope: ['Page fundamentals'], topicKeywords: [['fundamentals']] };
  const harness = createHarness(2, { role: 'frontend', difficulty: 'easy',
    registry: { ...ROLE_CONFIG, frontend: role },
    generatedOutputs: ['What is CSS and why is it useful?', ...questions] });
  t.after(() => harness.socket.close());
  await harness.start();
  assert.equal(harness.requests.length, 6);
  assert.deepEqual(harness.stored.questions, questions);
  assert.equal(harness.socket.messages.find(m => m.type === 'question_text').text, questions[0]);
});

for (const set of [1, 2, 3]) {
  for (const role of [...VALID_ROLES, 'qa-test']) {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      test(`MainSets Set ${set} startup: ${role}, ${difficulty}`, async (t) => {
        t.mock.method(console, 'log', () => {});
        const harness = createHarness(set, { role, difficulty, registry: extendedRegistry });
        t.after(() => harness.socket.close());
        await harness.start();
        assert.equal(harness.requests.length, 5, JSON.stringify(harness.requests.map(request => request.messages.at(-1).content)));
        assert.equal(harness.stored.role, role);
        assert.equal(harness.stored.difficulty, resolveSetDifficulty(`set${set}`, difficulty));
        assert.equal(harness.stored.mode, 'practice');
        assert.equal(harness.stored.questions.length, 5);
        assert.equal(harness.socket.messages.find(m => m.type === 'session_meta').role, role);
        assert.equal(harness.socket.messages.find(m => m.type === 'session_meta').roleLabel, extendedRegistry[role].label);
        assert.equal(harness.socket.messages.find(m => m.type === 'question_text').text,
          harness.stored.questions[0]);
        assert.ok(harness.socket.messages.some(m => m.type === 'tts_audio'));
        for (const [index, request] of harness.requests.entries()) {
          const prompt = request.messages[0].content;
          if (set !== 3) {
            assert.ok(prompt.includes(extendedRegistry[role].label));
            assert.ok(prompt.includes(`${difficulty[0].toUpperCase()}${difficulty.slice(1)} (`));
            for (const topic of getRoleSetConfig(extendedRegistry[role], `set${set}`, difficulty,
              set === 1 ? 'focus_clarity' : undefined).topicScope) {
              assert.ok(prompt.includes(topic));
            }
            if (role === 'qa-test') {
              assert.equal(prompt.includes('GOOD EXAMPLES — Generate questions exactly like these:'), false);
              assert.equal(prompt.includes('CSS class'), false);
              assert.equal(prompt.includes('database query'), false);
            }
          } else {
            // Set 3 has one entry-level profile, independent of legacy difficulty.
            assert.ok(prompt.includes('Entry Level / Fresh Graduate'));
          }
          for (const previous of harness.stored.questions.slice(0, index)) {
            assert.ok(request.messages[1].content.includes(previous));
          }
        }
      });
    }
  }

  test(`MainSets Set ${set} clamps difficulty to the unlocked level`, async (t) => {
    t.mock.method(console, 'log', () => {});
    const harness = createHarness(set, { role: 'backend', difficulty: 'hard', unlockedDifficulty: 'easy' });
    t.after(() => harness.socket.close());
    await harness.start();
    assert.equal(harness.stored.difficulty, 'easy');
    assert.equal(harness.socket.messages.find(m => m.type === 'session_meta').difficulty, 'easy');
  });

  test(`MainSets Set ${set} resumes its stored question bank without new AI calls`, async (t) => {
    t.mock.method(console, 'log', () => {});
    const questions = Array.from({ length: 5 }, (_, index) => `Saved question ${index + 1}?`);
    const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'backend',
      difficulty: 'easy', isCompleted: false, questions, answers: [{ question: questions[0] }] };
    const harness = createHarness(set, { role: 'backend', difficulty: 'easy', existing });
    t.after(() => harness.socket.close());
    await harness.start();
    assert.equal(harness.requests.length, 0);
    assert.equal(harness.writes.length, 1);
    const question = harness.socket.messages.find(m => m.type === 'question_text');
    assert.equal(question.index, 2);
    assert.equal(question.text, questions[1]);
    assert.deepEqual(harness.stored.questions, questions);
  });

  test(`MainSets Set ${set} surfaces a provider failure without saving an incomplete bank`, async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const harness = createHarness(set, { role: 'frontend', difficulty: 'easy',
      providerError: new Error('Synthetic provider failure') });
    t.after(() => harness.socket.close());
    await assert.rejects(harness.start(), /Failed to initialize/);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.writes.length, 1);
    assert.deepEqual(harness.stored.questions, []);
    assert.equal(harness.socket.messages.some(m => m.type === 'question_text'), false);
  });

  test(`MainSets Set ${set} restores its snapshot for metadata, scoring, and answer persistence`, async (t) => {
    for (const method of ['log', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
    const questions = Array.from({ length: 5 }, (_, index) => `Saved question ${index + 1}?`);
    const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'frontend', mode: 'diagnostic',
      difficulty: 'easy', weakness_tag: 'focus_correctness', isCompleted: false,
      questions, answers: [{ question: questions[0] }] };
    const harness = createHarness(set, { role: 'backend', difficulty: 'hard', existing });
    t.after(() => harness.socket.close());
    await harness.start();
    const metadata = harness.socket.messages.find(m => m.type === 'session_meta');
    assert.equal(metadata.role, 'frontend');
    assert.equal(metadata.difficulty, 'easy');
    assert.equal(metadata.mode, 'diagnostic');
    if (set === 1) assert.equal(metadata.weakness, 'focus_correctness');
    harness.socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'A clear answer.' })), false);
    await harness.socket.waitFor(message => message.type === 'question_text' && message.index === 3);
    assert.equal(harness.requests.length, 1);
    assert.ok(harness.requests[0].messages[0].content.includes(set === 3
      ? 'ENTRY-LEVEL BEHAVIORAL EVIDENCE RUBRIC' : 'DIFFICULTY SCORING RUBRIC: EASY'));
    assert.equal(harness.stored.answers[1].question, questions[1]);
    if (set === 1) assert.equal(harness.stored.answers[1].weakness_tag, 'focus_correctness');
    if (set === 3) assert.ok(harness.stored.answers[1].competency_topic.includes('Adaptability'));
  });

  test(`MainSets Set ${set} rejects an unavailable fresh role before creating a session`, async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const harness = createHarness(set, { role: 'retired-role', difficulty: 'easy' });
    t.after(() => harness.socket.close());
    await assert.rejects(harness.start(), /target role is unavailable/);
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.requests.length, 0);
  });

  test(`MainSets Set ${set} regenerates a missing bank using the saved role and difficulty`, async (t) => {
    t.mock.method(console, 'log', () => {});
    const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'frontend', mode: 'practice',
      difficulty: 'easy', weakness_tag: 'focus_correctness', isCompleted: false,
      questions: [], answers: [{ question: 'Previously answered question?' }] };
    const harness = createHarness(set, { role: 'backend', difficulty: 'hard', existing });
    t.after(() => harness.socket.close());
    await harness.start();
    assert.equal(harness.requests.length, 4);
    assert.equal(harness.stored.questions[0], existing.answers[0].question);
    for (const request of harness.requests) {
      assert.ok(request.messages[0].content.includes(set === 3 ? 'Entry Level / Fresh Graduate' : 'Easy (Entry Level / Fresh Graduate)'));
      if (set !== 3) assert.ok(request.messages[0].content.includes('Frontend Developer'));
    }
  });

  test(`MainSets Set ${set} rejects empty AI output instead of substituting a different role's question`, async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const harness = createHarness(set, { role: 'backend', difficulty: 'easy', emptyResponse: true });
    t.after(() => harness.socket.close());
    await assert.rejects(harness.start(), /Failed to initialize/);
    assert.deepEqual(harness.stored.questions, []);
  });
}

for (const set of [1, 2]) {
  test(`Set ${set} medium quality failure does not persist or deliver a rejected bank`, async t => {
    for (const method of ['log', 'error']) t.mock.method(console, method, () => {});
    const harness = createHarness(set, { role: 'qa-test', registry: extendedRegistry, difficulty: 'medium',
      generatedOutputs: Array(3).fill('Walk me through a form submission from start to finish?') });
    t.after(() => harness.socket.close());
    await assert.rejects(harness.start(), /Failed to initialize/);
    assert.equal(harness.requests.length, 3);
    assert.deepEqual(harness.stored.questions, []);
    assert.equal(harness.socket.messages.some(message => message.type === 'question_text'), false);
  });

  test(`Set ${set} medium persists the repaired bank and excludes rejected drafts`, async t => {
    t.mock.method(console, 'log', () => {});
    const questions = set === 1 ? [
      ...ROLE_CONFIG.backend.set1.mediumExamples.focus_clarity,
      'Why does a route validate required fields before saving a registration?',
      'How do environment settings keep database credentials separate from application code?',
    ] : ROLE_CONFIG.backend.set2.mediumExamples.slice(0, 5);
    const harness = createHarness(set, { role: 'backend', difficulty: 'medium',
      generatedOutputs: ['Walk me through a form submission from start to finish?', ...questions] });
    t.after(() => harness.socket.close());
    await harness.start();
    assert.equal(harness.requests.length, 6);
    assert.deepEqual(harness.stored.questions, questions);
    assert.equal(harness.stored.difficulty, 'medium');
  });
}

test('Set 1 hard quality failure never persists or delivers rejected drafts', async t => {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
  const harness = createHarness(1, { role: 'qa-test', registry: extendedRegistry, difficulty: 'hard',
    generatedOutputs: Array(3).fill('How does a transaction work and when should it be used?') });
  t.after(() => harness.socket.close());
  await assert.rejects(harness.start(), /Failed to initialize/);
  assert.equal(harness.requests.length, 3);
  assert.deepEqual(harness.stored.questions, []);
  assert.equal(harness.socket.messages.some(message => message.type === 'question_text'), false);
});

test('Set 1 hard persists repaired questions and evaluates with its independent 3C rubric', async t => {
  for (const method of ['log', 'warn', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
  const questions = [];
  const harness = createHarness(1, { role: 'backend', difficulty: 'hard',
    generatedOutputs: (request, call) => {
      if (call === 1) return 'Walk me through a full transaction from start to finish?';
      const question = hardSet1QuestionProvider(request.messages[0].content, ROLE_CONFIG, 'backend', 'focus_clarity');
      questions.push(question);
      return question;
    } });
  t.after(() => harness.socket.close());
  await harness.start();
  assert.equal(harness.requests.length, 6);
  assert.deepEqual(harness.stored.questions, questions);
  assert.equal(harness.stored.difficulty, 'hard');
  assert.equal(harness.stored.weakness_tag, 'focus_clarity');
  assert.equal(harness.socket.messages.find(message => message.type === 'question_text').text, questions[0]);
  harness.socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'A concise causal explanation.' })), false);
  await harness.socket.waitFor(message => message.type === 'question_text' && message.index === 2);
  assert.match(harness.requests.at(-1).messages[0].content, /HARD SET 1 SCORING: ADVANCED JUNIOR 3C/);
  assert.equal(harness.stored.answers[0].weakness_tag, 'focus_clarity');
  assert.equal(harness.stored.answers[0].question, questions[0]);
});

test('legacy Set 3 banks labeled hard resume with easy metadata and scoring without losing answers', async (t) => {
  for (const method of ['log', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
  const questions = Array.from({ length: 5 }, (_, index) => `Saved behavioral question ${index + 1}?`);
  const existing = { _id: 'legacy-set3', sessionId: 'old-owner', role: 'frontend', mode: 'practice',
    difficulty: 'hard', isCompleted: false, questions, answers: [{ question: questions[0], situation_score: 3 }] };
  const harness = createHarness(3, { role: 'backend', difficulty: 'hard', existing });
  t.after(() => harness.socket.close());
  await harness.start();
  assert.equal(harness.stored.difficulty, 'easy');
  assert.deepEqual(harness.stored.answers, existing.answers);
  assert.deepEqual(harness.stored.questions, questions);
  harness.socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'A clear answer.' })), false);
  await harness.socket.waitFor(message => message.type === 'question_text' && message.index === 3);
  assert.ok(harness.requests[0].messages[0].content.includes('ENTRY-LEVEL BEHAVIORAL EVIDENCE RUBRIC'));
});

test('Set 3 completes the bank with checked fallbacks without saving rejected drafts', async t => {
  for (const method of ['log', 'error', 'warn']) t.mock.method(console, method, () => {});
  const harness = createHarness(3, { role: 'backend', difficulty: 'hard',
    generatedOutputs: Array(15).fill('What are your strengths?') });
  t.after(() => harness.socket.close());
  await harness.start();
  assert.equal(harness.requests.length, 15);
  assert.deepEqual(harness.stored.questions, BEHAVIORAL_QUESTION_ANGLES.map(angles => `${angles[0].example.slice(0, -1)}?`));
  assert.equal(harness.socket.messages.some(message => message.type === 'question_text'), true);
});

test('Set 3 stores only accepted questions after a repair', async t => {
  t.mock.method(console, 'log', () => {});
  const questions = BEHAVIORAL_QUESTION_ANGLES.map(angles => angles[0].example);
  const harness = createHarness(3, { role: 'frontend', difficulty: 'easy',
    generatedOutputs: ['Tell me about a time you successfully led a team.', ...questions] });
  t.after(() => harness.socket.close());
  await harness.start();
  assert.equal(harness.requests.length, 6);
  assert.deepEqual(harness.stored.questions, questions.map(question => `${question.slice(0, -1)}?`));
});

test('Set 3 invalid evaluator output does not persist invented scores or advance the question', async t => {
  for (const method of ['log', 'error', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
  const questions = BEHAVIORAL_COMPETENCIES.map(item => item.examples[0]);
  const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'backend', mode: 'practice',
    difficulty: 'easy', isCompleted: false, questions, answers: [] };
  const harness = createHarness(3, { role: 'backend', difficulty: 'easy', existing,
    evaluationOutput: '{"situation_score": 4}' });
  t.after(() => harness.socket.close());
  await harness.start();
  const failure = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { harness.socket.off('sent', inspect); reject(new Error('Evaluation failure was not surfaced')); }, 2000);
    const inspect = message => {
      if (message.type === 'error') {
        clearTimeout(timer);
        harness.socket.off('sent', inspect);
        resolve(message);
      }
    };
    harness.socket.on('sent', inspect);
  });
  harness.socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'I shared notes with the group.' })), false);
  await failure;
  assert.deepEqual(harness.stored.answers, []);
  assert.equal(harness.socket.messages.filter(message => message.type === 'question_text').length, 1);
  assert.ok(harness.requests[0].messages[0].content.includes('Selected competency: Teamwork & Collaboration'));
});

for (const set of [1, 2]) {
  for (const bad of ['bad JSON', '{}', 'null', '[]', 'missing', 'string', 'fractional', 'range', 'provider failure']) {
    test('Set ' + set + ' rejects ' + bad + ' scores without saving or advancing, then retries the same answer', async t => {
      for (const method of ['log', 'error', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
      const keys = set === 1 ? ['clarity_score', 'correctness_score', 'completeness_score'] : ['problem_solving_score', 'accuracy_score', 'depth_score'];
      const valid = Object.fromEntries(keys.map(key => [key, 4]));
      const broken = { ...valid };
      if (bad === 'missing') delete broken[keys[0]];
      if (bad === 'string') broken[keys[0]] = '4';
      if (bad === 'fractional') broken[keys[0]] = 4.5;
      if (bad === 'range') broken[keys[0]] = 6;
      const invalid = ['bad JSON', '{}', 'null', '[]'].includes(bad) ? bad : JSON.stringify(broken);
      let attempts = 0;
      const questions = Array.from({ length: 5 }, (_, i) => 'Saved question ' + (i + 1) + '?');
      const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'backend', mode: 'practice',
        difficulty: 'easy', isCompleted: false, questions, answers: [] };
      const harness = createHarness(set, { role: 'backend', difficulty: 'easy', existing,
        evaluationOutput: () => {
          if (++attempts === 1) {
            if (bad === 'provider failure') throw new Error('Provider unavailable');
            return invalid;
          }
          return JSON.stringify(valid);
        } });
      t.after(() => harness.socket.close());
      await harness.start();
      const failure = new Promise(resolve => harness.socket.once('sent', function inspect(message) {
        if (message.type === 'error') resolve(message);
        else harness.socket.once('sent', inspect);
      }));
      const submit = JSON.stringify({ type: 'submit_answer', final_text: 'My original answer.' });
      harness.socket.emit('message', Buffer.from(submit), false);
      const message = await failure;
      assert.equal(message.code, 'EVALUATION_FAILED');
      assert.deepEqual(harness.stored.answers, []);
      assert.equal(harness.socket.messages.filter(message => message.type === 'question_text').length, 1);
      // waitFor also inspects past messages; the expected failure is consumed.
      harness.socket.messages = harness.socket.messages.filter(message => message.type !== 'error');
      harness.socket.emit('message', Buffer.from(submit), false);
      await harness.socket.waitFor(message => message.type === 'question_text' && message.index === 2);
      assert.equal(harness.stored.answers.length, 1);
      assert.equal(harness.stored.answers[0].transcript, 'My original answer.');
      assert.equal(harness.stored.answers[0].questionIndex, 0);
      assert.equal(harness.stored.answers[0][keys[0]], 4);
    });
  }
}

test('Set 3 completion archives the unrounded combined score for future unlock decisions', async t => {
  for (const method of ['log', 'error', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
  const questions = BEHAVIORAL_COMPETENCIES.map(item => item.examples[0]);
  const existing = { _id: 'saved-session', sessionId: 'old-owner', role: 'backend', mode: 'practice',
    difficulty: 'easy', isCompleted: false, questions, answers: [[3,3,3],[3,3,4],[4,4,4],[4,4,4]].map((scores, questionIndex) => ({
      questionIndex, situation_score: scores[0], action_score: scores[1], result_score: scores[2],
    })) };
  const harness = createHarness(3, { role: 'backend', difficulty: 'easy', existing, completedSets: [
    { isCompleted: true, avg_clarity: 3.6, avg_correctness: 3.6, avg_completeness: 3.8 },
    { isCompleted: true, avg_problem_solving: 3.8, avg_accuracy: 3.8, avg_depth: 4 },
  ] });
  t.after(() => harness.socket.close());
  await harness.start();
  harness.socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'I shared my notes with the team.' })), false);
  await harness.socket.waitFor(message => message.type === 'session_complete');
  assert.equal(harness.historyWrites.length, 1);
  const attempt = harness.historyWrites[0].$push.practiceHistory.$each[0];
  assert.ok(Math.abs(attempt.overallScorePercentage - 74.66666666666667) < 1e-10);
  assert.equal(attempt.overallScorePercentage >= 75, false);
});

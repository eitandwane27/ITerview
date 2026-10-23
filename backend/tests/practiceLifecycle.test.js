const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { setImmediate: nextTurn } = require('node:timers/promises');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { calculatePracticeScores } = require('../utils/practiceScoring');
const { getResultsSummary, getActivePracticeSession } = require('../services/userProgressService');
const { NEXT_QUESTION_TRANSITIONS } = require('../utils/interviewTransition');

const dimensions = [['clarity', 'correctness', 'completeness'],
  ['problem_solving', 'accuracy', 'depth'], ['situation', 'action', 'result']];
const questions = Array.from({ length: 5 }, (_, i) => `Question ${i + 1}?`);

test('Mongoose preserves shared attempt identity in sets and archived history', () => {
  for (const set of [1, 2, 3]) {
    const Model = require(`../models/Set${set}Session`);
    assert.equal(new Model({ attemptId: 'persisted-run' }).toObject().attemptId, 'persisted-run');
  }
  const User = require('../models/User');
  const user = new User({ practiceHistory: [{ attemptId: 'persisted-run', overallScorePercentage: 80 }] });
  assert.equal(user.toObject().practiceHistory[0].attemptId, 'persisted-run');
});
function session(set, count = 5, extra = {}) {
  return { _id: `set${set}`, firebaseUid: 'test', sessionId: 'old', attemptId: 'attempt-a',
    role: 'backend', difficulty: 'easy', mode: 'practice', questions, isCompleted: count === 5,
    answers: questions.slice(0, count).map((question, questionIndex) => ({ question, questionIndex,
      ...Object.fromEntries(dimensions[set - 1].map(key => [`${key}_score`, 4])) })),
    ...Object.fromEntries(dimensions[set - 1].map(key => [`avg_${key}`, 4])), ...extra };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(t, set, { initial = session(set, 0), evaluate, onSave, failFinalization = false,
  first = session(1), second = session(2) } = {}) {
  for (const method of ['log', 'error', 'time', 'timeEnd']) t.mock.method(console, method, () => {});
  const db = { 1: structuredClone(first), 2: structuredClone(second), 3: null };
  db[set] = structuredClone(initial);
  let failed = false;
  const evaluations = [], tts = [], writes = [], history = [];
  let activeSocket;
  function document(n) {
    if (!db[n]) return null;
    const doc = structuredClone(db[n]);
    Object.assign(doc, require(`../models/Set${n}Session`).schema.methods);
    return doc;
  }
  const models = Object.fromEntries([1, 2, 3].map(n => [`../models/Set${n}Session`, {
    findOne: async () => document(n),
    findOneAndUpdate: async (filter, update) => {
      const doc = db[n];
      if (filter._id && (!doc || filter._id !== doc._id || filter.sessionId !== doc.sessionId ||
        (filter.isCompleted === false && doc.isCompleted) ||
        doc.answers.some(a => a.questionIndex === filter['answers.questionIndex']?.$ne))) return null;
      writes.push({ n, filter: structuredClone(filter), update: structuredClone(update) });
      if (update.$set?.isCompleted && failFinalization && !failed) {
        failed = true;
        throw new Error('Synthetic finalization failure');
      }
      if (update.$push) {
        doc.answers.push(structuredClone(update.$push.answers));
        onSave?.(activeSocket, doc);
      } else db[n] = { ...doc, ...structuredClone(update.$set || update) };
      return document(n);
    },
  }]));
  const filename = path.resolve(__dirname, `../controllers/set${set}Socket.js`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const dependencies = { ...models,
    '../services/sttService': { createDeepgramLiveSession() { throw new Error('Unexpected STT'); } },
    '../services/ttsService': { synthesizeSpeech: async text => {
      assert.equal(typeof text, 'string'); tts.push(text); return Buffer.from(text);
    } },
    [`../services/aiSet${set}Generator`]: {
      [`generateSet${set}Question`]: async (...args) => `New question ${(args.at(-1)?.length || 0) + 1}?`,
      [`evaluateSet${set}Answer`]: async (...args) => {
        evaluations.push(args);
        if (evaluate) await evaluate(args);
        return { ...Object.fromEntries(dimensions[set - 1].map(key => [`${key}_score`, 4])),
          tip: 'Example tip', interviewer_reply: 'Good answer.' };
      }, getCompetencyTopic: i => `Competency ${i}`,
    },
    '../models/PreTestSession': { findOne: () => ({ sort: async () => null }) },
    '../models/User': { findOne: async () => ({ role: 'frontend', difficulty: 'hard',
      unlockedDifficulty: 'hard', practiceHistory: history }),
    findOneAndUpdate: async (filter, update) => {
      const attempt = update.$push.practiceHistory.$each[0];
      assert.equal(filter['practiceHistory.attemptId'].$ne, attempt.attemptId);
      if (!history.some(item => item.attemptId === attempt.attemptId)) history.push(attempt);
    } },
  };
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = id => Object.hasOwn(dependencies, id) ? dependencies[id] : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  function connect(query = '') {
    const socket = new EventEmitter();
    Object.assign(socket, { OPEN: 1, readyState: 1, messages: [] });
    socket.send = payload => socket.messages.push(JSON.parse(payload));
    socket.close = () => { socket.readyState = 3; socket.emit('close'); };
    socket.submit = text => socket.emit('message', Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: text })), false);
    activeSocket = socket;
    t.after(() => socket.close());
    loaded.exports[`handleSet${set}Socket`](socket,
      { auth: { uid: 'test' }, url: `/ws/set${set}?mode=practice${query}`, headers: { host: 'localhost' } });
    return socket;
  }
  return { db, connect, evaluations, tts, writes, history };
}
async function settle() { await nextTurn(); await nextTurn(); }

for (const set of [1, 2]) {
  test(`Set ${set} plays reply, varied connector, then next question, with no connector at completion`, async t => {
    const h = harness(t, set, { initial: session(set, 2) });
    const socket = h.connect();
    await settle();
    const transitions = [];
    for (const questionIndex of [2, 3, 4]) {
      const start = socket.messages.length;
      socket.submit('My answer');
      await settle();
      const messages = socket.messages.slice(start);
      const spoken = messages.filter(message => message.type === 'tts_audio')
        .map(message => Buffer.from(message.data, 'base64').toString());
      assert.equal(spoken[0], 'Good answer.');
      assert.equal(messages.find(message => message.type === 'coach_tip').interviewer_reply, 'Good answer.');
      if (questionIndex < 4) {
        assert.equal(spoken.length, 3);
        assert.ok(NEXT_QUESTION_TRANSITIONS.includes(spoken[1]));
        assert.equal(spoken[2], questions[questionIndex + 1]);
        transitions.push(spoken[1]);
      } else {
        assert.equal(spoken.some(text => NEXT_QUESTION_TRANSITIONS.includes(text)), false);
        assert.equal(messages.some(message => message.type === 'session_complete'), true);
      }
    }
    assert.notEqual(transitions[0], transitions[1]);
  });
}

for (const set of [1, 2, 3]) {
  for (const order of [[0, 1], [1, 0]]) {
    test(`Set ${set} rejects overlapping evaluations in resolution order ${order}`, async t => {
      const gates = [deferred(), deferred()];
      let calls = 0;
      const h = harness(t, set, { evaluate: () => gates[calls++].promise });
      const socket = h.connect(); await settle();
      socket.submit('First answer'); socket.submit('Overlapping answer');
      assert.equal(h.evaluations.length, 1);
      for (const index of order) { gates[index].resolve(); await settle(); }
      assert.equal(h.db[set].answers.length, 1);
      assert.equal(h.db[set].answers[0].questionIndex, 0);
      assert.equal(h.db[set].answers[0].question, h.evaluations[0][0]);
      assert.equal(h.db[set].answers[0].transcript, 'First answer');
      assert.equal(h.db[set].answers.some(a => a.questionIndex === 1), false);
      assert.equal(socket.messages.filter(m => m.type === 'question_text').at(-1).index, 2);
    });
  }
  test(`Set ${set} can retry evaluation failure against the same question`, async t => {
    let calls = 0;
    const h = harness(t, set, { evaluate: async () => { if (!calls++) throw new Error('Provider failed'); } });
    const socket = h.connect(); await settle();
    socket.submit('My answer'); await settle(); socket.submit('My answer'); await settle();
    assert.equal(h.evaluations.length, 2);
    assert.equal(h.db[set].answers.length, 1);
    assert.equal(h.evaluations[0][0], h.evaluations[1][0]);
  });
  for (const order of [[0, 1], [1, 0]]) {
    test(`Set ${set} accepts only the owning socket in evaluation order ${order}`, async t => {
      const gates = [deferred(), deferred()];
      let calls = 0;
      const h = harness(t, set, { evaluate: () => gates[calls++].promise });
      const oldSocket = h.connect(); await settle();
      oldSocket.submit('Old socket');
      const owner = h.connect(); await settle();
      owner.submit('Current owner');
      assert.equal(h.evaluations.length, 2);
      for (const index of order) { gates[index].resolve(); await settle(); }
      assert.equal(h.db[set].answers.length, 1);
      assert.equal(h.db[set].answers[0].questionIndex, 0);
      assert.equal(h.db[set].answers[0].question, questions[0]);
      assert.equal(h.db[set].answers[0].transcript, 'Current owner');
    });
  }
  for (const failFinalization of [false, true]) {
    test(`Set ${set} recovers fifth-answer disconnect, failed finalization=${failFinalization}`, async t => {
      const h = harness(t, set, { initial: session(set, 4), failFinalization,
        onSave: (socket, doc) => { if (doc.answers.length === 5) socket.close(); } });
      const socket = h.connect(); await settle();
      socket.submit('Fifth answer'); await settle();
      assert.equal(h.db[set].answers.length, 5);
      assert.equal(h.db[set].isCompleted, !failFinalization);
      const resumed = h.connect(); await settle();
      assert.equal(h.db[set].isCompleted, true);
      assert.equal(resumed.messages.filter(m => m.type === 'session_complete').length, 1);
      assert.equal(resumed.messages.some(m => m.type === 'question_text'), false);
      const finalTtsCount = h.tts.length;
      const repeated = h.connect(); await settle();
      assert.equal(repeated.messages.filter(m => m.type === 'session_complete').length, 1);
      assert.equal(h.tts.length, finalTtsCount);
      assert.equal(h.db[set].answers.length, 5);
      if (set === 3) assert.equal(h.history.length, 1);
    });
  }
  test(`Set ${set} finalizes five already-saved answers without a question bank`, async t => {
    const h = harness(t, set, { initial: session(set, 5, { isCompleted: false, questions: [] }) });
    const socket = h.connect(); await settle();
    assert.equal(h.db[set].isCompleted, true);
    assert.equal(socket.messages.some(m => m.type === 'session_complete'), true);
    assert.equal(h.tts.length, 0);
  });
  test(`Set ${set} refuses duplicate saved question identities on resume`, async t => {
    const initial = session(set, 5, { isCompleted: false });
    initial.answers[4].questionIndex = 3;
    const h = harness(t, set, { initial });
    const socket = h.connect(); await settle();
    assert.equal(h.db[set].isCompleted, false);
    assert.equal(socket.messages.some(m => m.type === 'error'), true);
    assert.equal(h.tts.length, 0);
  });
}

for (const change of ['attemptId', 'role', 'difficulty']) {
  test(`a different ${change} cannot contribute to a completed practice run`, () => {
    const sets = [session(1), session(2), session(3)];
    sets[1][change] = { attemptId: 'old-attempt', role: 'frontend', difficulty: 'medium' }[change];
    const result = calculatePracticeScores(...sets);
    assert.equal(result.completedSetCount, 1);
    assert.equal(result.setScores.set2, null);
    assert.equal(result.setScores.set3, null);
  });
}
for (const set of [2, 3]) {
  test(`Set ${set} replaces a stale same-role session and inherits Set 1 settings`, async t => {
    const h = harness(t, set, { initial: session(set, 2, { attemptId: 'old-attempt' }) });
    const socket = h.connect(); await settle();
    assert.equal(h.db[set].attemptId, 'attempt-a');
    assert.equal(h.db[set].role, 'backend');
    assert.equal(h.db[set].difficulty, 'easy');
    assert.equal(h.db[set].answers.length, 0);
    assert.equal(socket.messages.find(m => m.type === 'question_text').index, 1);
  });
  test(`Set ${set} refuses to start with an unassociated legacy Set 1`, async t => {
    const h = harness(t, set, { first: session(1, 5, { attemptId: undefined }) });
    const socket = h.connect(); await settle();
    assert.equal(socket.messages.some(m => m.type === 'error'), true);
    assert.equal(h.writes.length, 0);
  });
  test(`Set ${set} cannot reset a completed set within the same attempt`, async t => {
    const h = harness(t, set, { initial: session(set) });
    const socket = h.connect('&reset=true'); await settle();
    assert.equal(h.db[set].answers.length, 5);
    assert.equal(h.writes.length, 0);
    assert.equal(socket.messages.some(m => m.type === 'session_complete'), true);
  });
}
for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`a ${difficulty} technical attempt keeps Set 3 on Easy`, async t => {
    const h = harness(t, 3, { initial: null, first: session(1, 5, { difficulty }),
      second: session(2, 5, { difficulty }) });
    const socket = h.connect(); await settle();
    assert.equal(h.db[3].difficulty, 'easy');
    assert.equal(h.db[3].attemptId, 'attempt-a');
    assert.equal(h.db[3].role, 'backend');
    assert.equal(socket.messages.some(m => m.type === 'question_text'), true);
  });
}
test('starting another Set 1 gives the same role a new attempt ID', async t => {
  const h = harness(t, 1, { initial: session(1) });
  const socket = h.connect('&reset=true'); await settle();
  assert.notEqual(h.db[1].attemptId, 'attempt-a');
  assert.equal(h.db[1].answers.length, 0);
  assert.equal(calculatePracticeScores(h.db[1], h.db[2], session(3)).completedSetCount, 0);
  assert.equal(socket.messages.find(m => m.type === 'question_text').index, 1);
});

test('discarding an unfinished attempt generates new questions and rejects its old socket', async t => {
  const h = harness(t, 1, { initial: session(1, 2) });
  const oldSocket = h.connect(); await settle();
  // The reset endpoint deletes all three working set documents.
  for (const set of [1, 2, 3]) h.db[set] = null;
  const fresh = h.connect('&launch=fresh-after-discard'); await settle();
  assert.notEqual(h.db[1].attemptId, 'attempt-a');
  assert.equal(h.db[1].launchId, 'fresh-after-discard');
  assert.deepEqual(h.db[1].answers, []);
  assert.equal(h.db[1].questions.length, 5);
  assert.equal(h.db[1].questions[0], 'New question 1?');
  assert.equal(fresh.messages.find(m => m.type === 'question_text').index, 1);
  oldSocket.submit('Answer from the discarded attempt'); await settle();
  assert.deepEqual(h.db[1].answers, []);
  fresh.submit('First fresh answer'); await settle();
  assert.equal(h.db[1].answers[0].question, 'New question 1?');
  assert.equal(h.db[1].answers[0].transcript, 'First fresh answer');
});

test('an intentional launch gets a server attempt ID and reconnecting cannot restart it', async t => {
  const h = harness(t, 1, { initial: session(1) });
  h.connect('&launch=browser-launch'); await settle();
  const attemptId = h.db[1].attemptId;
  assert.notEqual(attemptId, 'attempt-a');
  assert.notEqual(attemptId, 'browser-launch');
  assert.equal(h.db[1].launchId, 'browser-launch');
  h.connect('&launch=browser-launch'); await settle();
  assert.equal(h.db[1].attemptId, attemptId);
  assert.equal(h.db[1].answers.length, 0);
  h.db[1] = session(1, 5, { attemptId, launchId: 'browser-launch' });
  const completed = h.connect('&launch=browser-launch'); await settle();
  assert.equal(completed.messages.some(m => m.type === 'session_complete'), true);
  assert.equal(h.db[1].attemptId, attemptId);
  h.connect('&launch=next-browser-launch'); await settle();
  assert.notEqual(h.db[1].attemptId, attemptId);
});

test('summary and resume ignore old Sets 2–3 after only a new Set 1 completes', async t => {
  const data = { User: { difficulty: 'medium', unlockedDifficulty: 'easy' },
    Set1Session: session(1, 5, { attemptId: 'attempt-b' }), Set2Session: session(2), Set3Session: session(3),
    PreTestSession: { completedAt: new Date() } };
  for (const name of ['User', 'PreTestSession', 'PostTestSession', 'Set1Session', 'Set2Session', 'Set3Session']) {
    const model = require(`../models/${name}`);
    t.mock.method(model, 'findOne', () => ({ select: fields => Promise.resolve(data[name] ?
      Object.fromEntries(fields.split(' ').filter(key => key in data[name]).map(key => [key, data[name][key]])) : null) }));
  }
  const User = require('../models/User');
  const update = t.mock.method(User, 'updateOne', async () => { throw new Error('Unexpected unlock'); });
  const summary = await getResultsSummary('test');
  assert.equal(summary.practiceProgress.completedSetCount, 1);
  assert.equal(summary.unlocked, false);
  assert.equal(summary.setScores.set2.completed, false);
  assert.equal(summary.questionBreakdowns.set3.questions.length, 0);
  assert.equal(update.mock.callCount(), 0);
  const active = await getActivePracticeSession('test');
  assert.equal(active.activeSet, 2);
  assert.equal(active.hasResumableSession, false);
});

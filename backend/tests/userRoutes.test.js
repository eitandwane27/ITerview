const assert = require('node:assert/strict');
const { test } = require('node:test');
const router = require('../routes/userRoutes');
const models = [
  require('../models/User'),
  require('../models/PreTestSession'),
  require('../models/Set1Session'),
  require('../models/Set2Session'),
  require('../models/Set3Session'),
  require('../models/PostTestSession'),
];

// Run the real route handlers with database reads stubbed; no account or
// database is created or changed by these regression tests.
async function getRoute(t, path, records, { method = 'get', body: requestBody = {}, expectedStatus = 200 } = {}) {
  for (const model of models) {
    t.mock.method(model, 'findOne', () => {
      const query = Promise.resolve(records[model.modelName] ?? null);
      query.select = () => query;
      return query;
    });
  }
  return callRoute(path, { method, requestBody, expectedStatus });
}

async function callRoute(path, { method = 'get', requestBody = {}, expectedStatus = 200 } = {}) {
  const handler = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
  let status;
  let body;
  await handler(
    { auth: { uid: 'test-user' }, query: { uid: 'test-user' }, params: { firebaseUid: 'test-user' }, body: requestBody },
    {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );
  assert.equal(status, expectedStatus);
  return body;
}

test('each confidence survey keeps its first complete submission and calculates its own total', async t => {
  const [User] = models;
  const firebaseUid = 'test-user';
  const email = 'student@spcba.edu.ph';
  const saved = { firebaseUid, email };
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, { upsert }) => {
    assert.equal(filter.firebaseUid, firebaseUid);
    const scoreField = Object.keys(filter).find(key => key !== 'firebaseUid');
    assert.equal(filter[scoreField], null);
    if (saved[scoreField] == null) return { ...Object.assign(saved, update.$set) };
    if (upsert) throw Object.assign(new Error('Duplicate UID'), { code: 11000, keyPattern: { firebaseUid: 1 } });
    return null;
  });
  t.mock.method(User, 'findOne', async filter => {
    assert.deepEqual(filter, { firebaseUid });
    return saved;
  });
  const submit = (path, answers, expectedStatus) => callRoute(path, {
    method: 'post', requestBody: { firebaseUid, email, answers, confidenceScore: 99 }, expectedStatus,
  });
  const answersFor = score => Array.from({ length: 5 }, (_, i) => ({ questionId: `q${i + 1}`, score }));
  for (const [path, scoreField, answersField, firstScore] of [
    ['/pretest', 'confidenceScore', 'preConfidenceAnswers', 3],
    ['/posttest', 'postConfidenceScore', 'postConfidenceAnswers', 4],
  ]) {
    const answers = answersFor(firstScore);
    await submit(path, [...answers.slice(0, 4), answers[0]], 400);
    assert.equal(saved[scoreField], undefined);
    assert.equal((await submit(path, answers)).user[scoreField], firstScore * 5);
    const { user } = await submit(path, answersFor(5));
    assert.equal(user[scoreField], firstScore * 5);
    assert.deepEqual(user[answersField], answers);
  }
});

const completedPreTest = {
  completedAt: new Date('2026-09-01'),
  baseline_score_percentage: 0,
};
const attemptMetadata = { attemptId: 'route-run', role: 'backend', difficulty: 'easy' };
const completedSet = { ...attemptMetadata, isCompleted: true, mode: 'diagnostic' };
const completedPostTest = { completedAt: new Date('2026-09-02') };
const completedInterview = {
  PreTestSession: completedPreTest,
  Set1Session: completedSet,
  Set2Session: completedSet,
  Set3Session: completedSet,
  PostTestSession: completedPostTest,
};

const journeyCases = [
  {
    name: 'fresh account starts pre-test setup, without a MainSets session',
    records: { User: { confidenceScore: null } },
    expected: ['likert-pre', false, false],
  },
  {
    name: 'missing legacy confidence score still starts pre-test setup',
    records: { User: {} },
    expected: ['likert-pre', false, false],
  },
  {
    name: 'completed confidence survey proceeds to microphone setup',
    records: { User: { confidenceScore: 0 } },
    expected: ['mic-test', false, false],
  },
  {
    name: 'unfinished pre-test resumes its saved answers',
    records: { PreTestSession: { completedAt: null, answers: [{}, {}] } },
    expected: ['pretest', false, true],
    answersCount: 2,
  },
  {
    name: 'completed pre-test unlocks Set 1 even with a zero baseline',
    records: { PreTestSession: completedPreTest },
    expected: ['mainsets', false, false],
    activeSet: 1,
  },
  {
    name: 'completed Set 1 proceeds to Set 2',
    records: { PreTestSession: completedPreTest, Set1Session: completedSet },
    expected: ['mainsets', true, false],
    activeSet: 2,
  },
  {
    name: 'explicitly started MainSets session keeps its existing resume state',
    records: {
      Set1Session: { ...attemptMetadata, isCompleted: false, answers: [{}], mode: 'practice' },
    },
    expected: ['mainsets', true, true],
    activeSet: 1,
    answersCount: 1,
  },
  ...[null, undefined].map((score) => ({
    name: `missing post-survey score (${score}) requires final confidence check`,
    records: { ...completedInterview, User: { postConfidenceScore: score } },
    expected: ['likert-post', false, false],
  })),
  {
    name: 'completed post-survey accepts a zero score',
    records: { ...completedInterview, User: { postConfidenceScore: 0 } },
    expected: ['complete', false, false],
  },
  {
    name: 'an unfinished drill never becomes a resumable curriculum session',
    records: {
      ...completedInterview,
      User: { postConfidenceScore: 0 },
      Set1Session: { ...attemptMetadata, isCompleted: false, answers: [{}], mode: 'drill' },
    },
    expected: ['complete', false, false],
  },
];

for (const { name, records, expected, activeSet, answersCount } of journeyCases) {
  test(name, async (t) => {
    const result = await getRoute(t, '/active-practice-session', records);
    assert.deepEqual(
      [result.nextStage, result.hasActiveSession, result.hasResumableSession],
      expected
    );
    if (activeSet !== undefined) assert.equal(result.activeSet, activeSet);
    if (answersCount !== undefined) assert.equal(result.answersCount, answersCount);
  });
}

for (const researchComplete of [false, true]) {
  test(`discard persists across dashboard reads, research complete=${researchComplete}`, async (t) => {
    const records = {
      User: { confidenceScore: 20, postConfidenceScore: researchComplete ? 20 : null,
        practiceHistory: [{ attemptId: 'archived-run', overallScorePercentage: 80 }] },
      PreTestSession: completedPreTest,
      PostTestSession: researchComplete ? completedPostTest : null,
      Set1Session: { ...completedSet, mode: researchComplete ? 'practice' : 'diagnostic' },
      Set2Session: { ...completedSet, isCompleted: false, answers: [{ questionIndex: 0 }] },
      Set3Session: { ...completedSet, attemptId: 'older-run' },
    };
    for (const model of models.filter(model => /^Set[123]Session$/.test(model.modelName))) {
      t.mock.method(model, 'deleteMany', async filter => {
        assert.deepEqual(filter, { firebaseUid: 'test-user' });
        delete records[model.modelName];
        return { deletedCount: 1 };
      });
    }
    const reset = await getRoute(t, '/reset-practice-session', records, {
      method: 'post', body: { firebaseUid: 'test-user' },
    });
    const refreshed = await getRoute(t, '/active-practice-session', records);
    assert.deepEqual(reset.activeSession, refreshed);
    assert.equal(refreshed.hasActiveSession, false);
    assert.equal(refreshed.hasResumableSession, false);
    assert.equal(refreshed.nextStage, researchComplete ? 'complete' : 'mainsets');
    assert.equal(records.User.practiceHistory.length, 1);
    for (const model of models.filter(model => /^Set[123]Session$/.test(model.modelName))) {
      assert.equal(model.deleteMany.mock.callCount(), 1);
      assert.equal(records[model.modelName], undefined);
    }
  });
}

for (const [name, preTest, expected] of [
  ['absent pre-test', null, false],
  ['missing score', { completedAt: null }, false],
  ['null score', { completedAt: null, baseline_score_percentage: null }, false],
  ['zero score', { baseline_score_percentage: 0 }, true],
  ['completion timestamp', { completedAt: completedPreTest.completedAt }, true],
]) {
  test(`profile diagnostic status: ${name}`, async (t) => {
    const result = await getRoute(t, '/:firebaseUid', {
      User: { firebaseUid: 'test-user' },
      PreTestSession: preTest,
    });
    assert.equal(result.hasCompletedDiagnostic, expected);
  });
}

test('results summary restores difficulty progress from the latest completed attempt', async (t) => {
  const result = await getRoute(t, '/results-summary', {
    User: {
      difficulty: 'easy',
      unlockedDifficulty: 'easy',
      practiceHistory: [
        {
          attemptNumber: 1,
          completedAt: new Date('2026-09-20T06:42:00Z'),
          difficulty: 'easy',
          overallScorePercentage: 28,
        },
      ],
    },
  });

  assert.deepEqual(result.practiceProgress, {
    source: 'latest-completed-attempt',
    role: null,
    difficulty: 'easy',
    attemptNumber: 1,
    completedSetCount: 3,
    completedAllSets: true,
    scoreOutOf5: 1.4,
    scorePercentage: 28,
  });
  assert.equal(result.sessionAverages.practiceSetsAverage.scoreOutOf5, 1.4);
  assert.equal(result.unlocked, false);
});

test('results summary restores archived per-set scores when the snapshot is available', async (t) => {
  const result = await getRoute(t, '/results-summary', {
    User: {
      difficulty: 'easy',
      unlockedDifficulty: 'easy',
      practiceHistory: [
        {
          attemptNumber: 2,
          completedAt: new Date('2026-09-21T06:42:00Z'),
          difficulty: 'easy',
          overallScorePercentage: 60,
          setScores: { set1: 2.5, set2: 3, set3: 3.5 },
          starBreakdown: { situation: 3.4, action: 3.6, result: 3.5 },
        },
      ],
    },
  });

  assert.deepEqual(
    [result.setScores.set1.score, result.setScores.set2.score, result.setScores.set3.score],
    [2.5, 3, 3.5]
  );
  assert.deepEqual(
    [
      result.setScores.set1.completed,
      result.setScores.set2.completed,
      result.setScores.set3.completed,
    ],
    [true, true, true]
  );
  assert.deepEqual(result.starBreakdown, { situation: 3.4, action: 3.6, result: 3.5 });
});

for (const { score, difficulty, unlockedDifficulty, expectedTier, expectedUnlock } of [
  { score: 70, difficulty: 'easy', unlockedDifficulty: 'easy', expectedTier: 'easy', expectedUnlock: false },
  { score: 74.9, difficulty: 'easy', unlockedDifficulty: 'easy', expectedTier: 'easy', expectedUnlock: false },
  { score: 75, difficulty: 'easy', unlockedDifficulty: 'easy', expectedTier: 'medium', expectedUnlock: true },
  { score: 74.9, difficulty: 'medium', unlockedDifficulty: 'medium', expectedTier: 'medium', expectedUnlock: false },
  { score: 75, difficulty: 'medium', unlockedDifficulty: 'medium', expectedTier: 'hard', expectedUnlock: true },
  { score: 70, difficulty: 'easy', unlockedDifficulty: 'hard', expectedTier: 'hard', expectedUnlock: false },
  { score: 80, difficulty: 'easy', unlockedDifficulty: 'hard', expectedTier: 'hard', expectedUnlock: true },
]) {
  test(`${difficulty} practice at ${score}% with ${unlockedDifficulty} unlocked retains or advances to ${expectedTier}`, async t => {
    const writes = [];
    t.mock.method(models[0], 'updateOne', async (query, update) => {
      writes.push({ query, update });
      return { modifiedCount: 1 };
    });
    t.mock.method(console, 'log', () => {});
    const user = { difficulty, unlockedDifficulty, practiceHistory: [{
      attemptNumber: 1, completedAt: new Date('2026-10-10'), difficulty,
      overallScorePercentage: score,
    }] };
    const result = await getRoute(t, '/results-summary', {
      User: user,
      // Research checks never influence the practice unlock decision.
      PreTestSession: { baseline_score_percentage: expectedUnlock ? 0 : 100 },
      PostTestSession: { final_score_percentage: expectedUnlock ? 0 : 100 },
    });
    assert.equal(result.unlockThreshold, 75);
    assert.equal(result.unlocked, expectedUnlock);
    assert.equal(user.unlockedDifficulty, expectedTier);
    assert.equal(writes.length, expectedTier === unlockedDifficulty ? 0 : 1);
    if (writes.length) assert.deepEqual(writes[0].update, { $set: { unlockedDifficulty: expectedTier } });
  });
}

test('high scores in only two live sets cannot unlock a difficulty', async t => {
  const update = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
  const result = await getRoute(t, '/results-summary', {
    User: { difficulty: 'easy', unlockedDifficulty: 'easy' },
    PreTestSession: { baseline_score_percentage: 100 },
    PostTestSession: { final_score_percentage: 100 },
    Set1Session: { ...attemptMetadata, isCompleted: true, avg_clarity: 5, avg_correctness: 5, avg_completeness: 5 },
    Set2Session: { ...attemptMetadata, isCompleted: true, avg_problem_solving: 5, avg_accuracy: 5, avg_depth: 5 },
    Set3Session: { ...attemptMetadata, isCompleted: false },
  });
  assert.equal(result.unlockThreshold, 75);
  assert.equal(result.unlocked, false);
  assert.equal(result.practiceProgress.completedSetCount, 2);
  assert.equal(update.mock.callCount(), 0);
});

for (const [score, expectedUnlock] of [[3.5, false], [3.749, false], [3.75, true], [4, true]]) {
  test(`three completed live sets averaging ${score}/5 use the 75% practice threshold`, async t => {
    const update = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
    t.mock.method(console, 'log', () => {});
    const result = await getRoute(t, '/results-summary', {
      User: { difficulty: 'easy', unlockedDifficulty: 'easy' },
      Set1Session: { ...attemptMetadata, isCompleted: true, difficulty: 'easy', avg_clarity: score, avg_correctness: score, avg_completeness: score },
      Set2Session: { ...attemptMetadata, isCompleted: true, difficulty: 'easy', avg_problem_solving: score, avg_accuracy: score, avg_depth: score },
      Set3Session: { ...attemptMetadata, isCompleted: true, avg_situation: score, avg_action: score, avg_result: score },
    });
    assert.equal(result.unlockThreshold, 75);
    assert.equal(result.unlocked, expectedUnlock);
    assert.equal(result.practiceProgress.completedSetCount, 3);
    assert.equal(update.mock.callCount(), expectedUnlock ? 1 : 0);
  });
}

test('74.67% live practice does not unlock after set-score rounding', async t => {
  const update = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
  const result = await getRoute(t, '/results-summary', {
    User: { difficulty: 'easy', unlockedDifficulty: 'easy' },
    Set1Session: { ...attemptMetadata, isCompleted: true, avg_clarity: 3.6, avg_correctness: 3.6, avg_completeness: 3.8 },
    Set2Session: { ...attemptMetadata, isCompleted: true, avg_problem_solving: 3.8, avg_accuracy: 3.8, avg_depth: 4 },
    Set3Session: { ...attemptMetadata, isCompleted: true, avg_situation: 3.6, avg_action: 3.6, avg_result: 3.8 },
  });
  assert.equal(result.practiceProgress.scorePercentage, 74.7);
  assert.equal(result.unlocked, false);
  assert.equal(update.mock.callCount(), 0);
});

test('rounded display of 75% in history cannot unlock a raw result below 75%', async t => {
  const update = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
  const result = await getRoute(t, '/results-summary', {
    User: { difficulty: 'easy', unlockedDifficulty: 'easy', practiceHistory: [
      { attemptNumber: 1, difficulty: 'easy', overallScorePercentage: 74.99 },
    ] },
  });
  assert.equal(result.practiceProgress.scorePercentage, 75);
  assert.equal(result.unlocked, false);
  assert.equal(update.mock.callCount(), 0);
});

function historyRecords(score = 4) {
  const base = { ...attemptMetadata, isCompleted: true, role: 'backend', difficulty: 'medium' };
  return {
    User: { firebaseUid: 'test-user', role: 'frontend', difficulty: 'hard', unlockedDifficulty: 'medium', focusArea: 'clarity', practiceHistory: [{ attemptNumber: 4, overallScorePercentage: 60 }] },
    Set1Session: { ...base, avg_clarity: score, avg_correctness: score, avg_completeness: score },
    Set2Session: { ...base, avg_problem_solving: score, avg_accuracy: score, avg_depth: score },
    Set3Session: { ...base, difficulty: 'easy', avg_situation: score, avg_action: score, avg_result: score, final_weakness_tag: 'focus_action' },
  };
}

const forgedHistoryPayload = { firebaseUid: 'test-user', role: 'fullstack', difficulty: 'hard', focusArea: 'correctness',
  overallScorePercentage: 100, setScores: { set1: 5, set2: 5, set3: 5 },
  threeCBreakdown: { clarity: 5 }, starBreakdown: { action: 5 }, weaknessTag: 'forged' };

for (const [name, change, expectedStatus] of [
  ['missing UID', records => records, 400],
  ['unknown user', records => { delete records.User; }, 404],
  ['no completed sets', records => { delete records.Set1Session; delete records.Set2Session; delete records.Set3Session; }, 409],
  ['only two completed sets', records => { records.Set3Session.isCompleted = false; }, 409],
  ['invalid stored scores', records => { records.Set2Session.avg_accuracy = null; }, 409],
  ['mixed roles', records => { records.Set3Session.role = 'frontend'; }, 409],
  ['mixed technical difficulties', records => { records.Set2Session.difficulty = 'easy'; }, 409],
  ['different attempts with the same role and tier', records => { records.Set2Session.attemptId = 'older-run'; }, 409],
  ['missing shared attempt identity', records => { delete records.Set1Session.attemptId; }, 409],
]) {
  test('practice history rejects ' + name + ' without saving caller scores', async t => {
    const records = historyRecords();
    change(records);
    const save = t.mock.method(models[0], 'findOneAndUpdate', async () => { throw new Error('Unexpected history write'); });
    await getRoute(t, '/practice-history', records, { method: 'post', body: name === 'missing UID' ? {} : forgedHistoryPayload, expectedStatus });
    assert.equal(save.mock.callCount(), 0);
    assert.deepEqual(records.User?.practiceHistory || [], records.User ? [{ attemptNumber: 4, overallScorePercentage: 60 }] : []);
  });
}

test('practice history retries do not append the same attempt twice', async t => {
  const records = historyRecords();
  records.User.practiceHistory.push({ attemptId: records.Set1Session.attemptId, overallScorePercentage: 80 });
  const save = t.mock.method(models[0], 'findOneAndUpdate', async () => { throw new Error('Unexpected duplicate'); });
  const result = await getRoute(t, '/practice-history', records, {
    method: 'post', body: forgedHistoryPayload, expectedStatus: 200,
  });
  assert.equal(result.practiceHistory.length, 2);
  assert.equal(save.mock.callCount(), 0);
});

for (const [score, shouldUnlock] of [[3, false], [3.749, false], [3.75, true], [4, true]]) {
  test('practice history saves backend score ' + score + '/5 and uses it after live sets are removed', async t => {
    t.mock.method(console, 'log', () => {});
    const records = historyRecords(score);
    const save = t.mock.method(models[0], 'findOneAndUpdate', async (_filter, update) => {
      records.User.practiceHistory.push(...update.$push.practiceHistory.$each);
      return records.User;
    });
    const upgrade = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
    const result = await getRoute(t, '/practice-history', records, { method: 'post', body: forgedHistoryPayload, expectedStatus: 201 });
    const attempt = result.practiceHistory.at(-1);
    assert.equal(attempt.attemptNumber, 5);
    assert.equal(attempt.role, 'backend');
    assert.equal(attempt.difficulty, 'medium');
    assert.equal(attempt.focusArea, 'clarity');
    assert.equal(attempt.weaknessTag, 'focus_action');
    assert.ok(Math.abs(attempt.overallScorePercentage - score * 20) < 1e-10);
    assert.deepEqual(attempt.setScores, { set1: score, set2: score, set3: score });
    assert.equal(attempt.threeCBreakdown.clarity, score);
    assert.equal(attempt.starBreakdown.action, score);
    assert.equal(save.mock.calls[0].arguments[1].$push.practiceHistory.$slice, -20);
    const summary = await getRoute(t, '/results-summary', { User: records.User });
    assert.equal(summary.unlocked, shouldUnlock);
    assert.equal(upgrade.mock.callCount(), shouldUnlock ? 1 : 0);
  });
}

test('practice history uses original answer scores over rounded session averages', async t => {
  t.mock.method(console, 'log', () => {});
  const records = historyRecords(5);
  records.Set1Session.answers = [{ clarity_score: 3, correctness_score: 3, completeness_score: 3 }];
  records.Set2Session.answers = [{ problem_solving_score: 3, accuracy_score: 3, depth_score: 3 }];
  records.Set3Session.answers = [{ situation_score: 3, action_score: 3, result_score: 3 }];
  t.mock.method(models[0], 'findOneAndUpdate', async (_filter, update) => ({ practiceHistory: update.$push.practiceHistory.$each }));
  const result = await getRoute(t, '/practice-history', records, { method: 'post', body: forgedHistoryPayload, expectedStatus: 201 });
  assert.equal(result.practiceHistory[0].overallScorePercentage, 60);
});

test('a caller cannot relabel a passing Easy attempt as Medium to unlock Hard', async t => {
  t.mock.method(console, 'log', () => {});
  const records = historyRecords(4);
  records.Set1Session.difficulty = 'easy';
  records.Set2Session.difficulty = 'easy';
  t.mock.method(models[0], 'findOneAndUpdate', async (_filter, update) => {
    records.User.practiceHistory.push(...update.$push.practiceHistory.$each);
    return records.User;
  });
  const upgrade = t.mock.method(models[0], 'updateOne', async () => ({ modifiedCount: 1 }));
  const result = await getRoute(t, '/practice-history', records, {
    method: 'post', body: { ...forgedHistoryPayload, difficulty: 'medium' }, expectedStatus: 201,
  });
  assert.equal(result.practiceHistory.at(-1).difficulty, 'easy');
  const summary = await getRoute(t, '/results-summary', { User: records.User });
  assert.equal(summary.targetDifficulty, 'Easy');
  assert.equal(records.User.unlockedDifficulty, 'medium');
  assert.equal(upgrade.mock.callCount(), 0);
});

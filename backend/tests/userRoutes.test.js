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
async function getRoute(t, path, records) {
  for (const model of models) {
    t.mock.method(model, 'findOne', () => {
      const query = Promise.resolve(records[model.modelName] ?? null);
      query.select = () => query;
      return query;
    });
  }
  const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
  let status;
  let body;
  await handler(
    { query: { uid: 'test-user' }, params: { firebaseUid: 'test-user' } },
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
  assert.equal(status, 200);
  return body;
}

const completedPreTest = {
  completedAt: new Date('2026-09-01'),
  baseline_score_percentage: 0,
};
const completedSet = { isCompleted: true, mode: 'diagnostic' };
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
    expected: ['mainsets', true, false],
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
      Set1Session: { isCompleted: false, answers: [{}], mode: 'practice' },
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
      Set1Session: { isCompleted: false, answers: [{}], mode: 'drill' },
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

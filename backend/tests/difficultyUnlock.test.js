const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getResultsSummary } = require('../services/userProgressService');
const User = require('../models/User');
const models = ['PreTestSession', 'PostTestSession', 'Set1Session', 'Set2Session', 'Set3Session']
  .map(name => require(`../models/${name}`));

function records(difficulty) {
  return {
    User: { difficulty: 'medium', unlockedDifficulty: 'medium' },
    Set1Session: { attemptId: 'unlock-run', role: 'backend', isCompleted: true, difficulty, avg_clarity: 4, avg_correctness: 4, avg_completeness: 4 },
    Set2Session: { attemptId: 'unlock-run', role: 'backend', isCompleted: true, difficulty, avg_problem_solving: 4, avg_accuracy: 4, avg_depth: 4 },
    Set3Session: { attemptId: 'unlock-run', role: 'backend', isCompleted: true, difficulty: 'easy', avg_situation: 4, avg_action: 4, avg_result: 4 },
  };
}

function stubReads(t, data) {
  for (const model of [User, ...models]) {
    t.mock.method(model, 'findOne', () => ({
      select(fields) {
        const record = data[model.modelName];
        // Honor projections so missing difficulty fields in the query fail.
        return Promise.resolve(record ? Object.fromEntries(fields.split(' ')
          .filter(key => key in record).map(key => [key, record[key]])) : null);
      },
    }));
  }
}

for (const [difficulty, expectedTier, expectedUnlock] of [
  ['easy', 'medium', true], ['medium', 'hard', true], ['hard', 'medium', true],
  [undefined, 'medium', false], ['invalid', 'medium', false],
]) {
  test(`completed ${difficulty} evidence with Medium selected yields ${expectedTier}`, async t => {
    const data = records(difficulty);
    stubReads(t, data);
    const update = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
    const result = await getResultsSummary('test');
    assert.equal(result.unlockedDifficulty, expectedTier);
    assert.equal(result.unlocked, expectedUnlock);
    assert.equal(update.mock.callCount(), expectedTier === 'hard' ? 1 : 0);
    if (difficulty === 'easy') assert.equal(result.targetDifficulty, 'Easy');
  });
}

test('mixed technical difficulties cannot advance a tier', async t => {
  const data = records('medium');
  data.Set1Session.difficulty = 'easy';
  stubReads(t, data);
  const update = t.mock.method(User, 'updateOne', async () => { throw new Error('Unexpected upgrade'); });
  const result = await getResultsSummary('test');
  assert.equal(result.unlocked, false);
  assert.equal(update.mock.callCount(), 0);
});

for (const [score, expectedUnlock] of [[3.749, false], [3.75, true]]) {
  test(`completed Medium evidence at ${score * 20}% respects the raw threshold`, async t => {
    const data = records('medium');
    for (const record of [data.Set1Session, data.Set2Session, data.Set3Session]) {
      for (const key of Object.keys(record)) if (key.startsWith('avg_')) record[key] = score;
    }
    stubReads(t, data);
    const update = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
    const result = await getResultsSummary('test');
    assert.equal(result.unlocked, expectedUnlock);
    assert.equal(result.unlockedDifficulty, expectedUnlock ? 'hard' : 'medium');
    assert.equal(update.mock.callCount(), expectedUnlock ? 1 : 0);
  });
}

test('an archive without difficulty cannot borrow the profile selection', async t => {
  const data = { User: { difficulty: 'medium', unlockedDifficulty: 'medium',
    practiceHistory: [{ attemptNumber: 1, overallScorePercentage: 80 }] } };
  stubReads(t, data);
  const update = t.mock.method(User, 'updateOne', async () => { throw new Error('Unexpected upgrade'); });
  const result = await getResultsSummary('test');
  assert.equal(result.unlocked, false);
  assert.equal(update.mock.callCount(), 0);
});

for (const order of [[0, 1], [1, 0]]) {
  test(`concurrent Easy and Medium unlocks remain monotonic in order ${order}`, async t => {
    let storedTier = 'easy';
    // Both requests read the same old tier; their completed evidence differs.
    t.mock.method(User, 'findOne', () => ({ select: fields => Promise.resolve(
      fields === 'unlockedDifficulty' ? { unlockedDifficulty: storedTier } :
        { difficulty: 'medium', unlockedDifficulty: 'easy', practiceHistory: [] }) }));
    for (const model of models.slice(0, 2)) t.mock.method(model, 'findOne', () => ({ select: async () => null }));
    for (const model of models.slice(2)) {
      let calls = 0;
      t.mock.method(model, 'findOne', () => {
        const data = records(calls++ === 0 ? 'easy' : 'medium');
        return { select: async () => data[model.modelName] };
      });
    }
    const pending = [];
    t.mock.method(User, 'updateOne', (filter, update) => new Promise(resolve => {
      pending.push(() => {
        const matches = filter.unlockedDifficulty.$in.includes(storedTier);
        if (matches) storedTier = update.$set.unlockedDifficulty;
        resolve({ matchedCount: matches ? 1 : 0 });
      });
    }));
    const requests = [getResultsSummary('test'), getResultsSummary('test')];
    // Both reads reach the atomic update before either update is applied.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length, 2);
    for (const index of order) pending[index]();
    const results = await Promise.all(requests);
    assert.equal(storedTier, 'hard');
    assert.equal(results[1].unlockedDifficulty, 'hard');
    if (order[0] === 1) assert.equal(results[0].unlockedDifficulty, 'hard');
  });
}

test('read-only summaries never persist an eligible advancement', async t => {
  stubReads(t, records('medium'));
  const update = t.mock.method(User, 'updateOne', async () => { throw new Error('Unexpected write'); });
  const result = await getResultsSummary('test', { persistUnlock: false });
  assert.equal(result.unlocked, true);
  assert.equal(result.unlockedDifficulty, 'medium');
  assert.equal(update.mock.callCount(), 0);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculatePracticeScores } = require('../utils/practiceScoring');

const completedSets = () => [
  { isCompleted: true, avg_clarity: 3.6, avg_correctness: 3.6, avg_completeness: 3.8 },
  { isCompleted: true, avg_problem_solving: 3.8, avg_accuracy: 3.8, avg_depth: 4 },
  { isCompleted: true, avg_situation: 3.6, avg_action: 3.6, avg_result: 3.8 },
];

test('74.67% stays below the threshold through the live and archive calculation', () => {
  const result = calculatePracticeScores(...completedSets());
  assert.equal(result.completedSetCount, 3);
  assert.ok(Math.abs(result.overallScorePercentage - 74.66666666666667) < 1e-10);
  assert.equal(result.overallScorePercentage >= 75, false);
  assert.equal(JSON.parse(JSON.stringify(result)).overallScorePercentage >= 75, false);
});

test('original answer scores take precedence over rounded dimension averages', () => {
  const sets = completedSets();
  const keys = [['clarity', 'correctness', 'completeness'], ['problem_solving', 'accuracy', 'depth'], ['situation', 'action', 'result']];
  sets.forEach((set, index) => {
    keys[index].forEach(key => { set[`avg_${key}`] = 3.75; });
    set.answers = [{}, { ...Object.fromEntries(keys[index].map(key => [`${key}_score`, 3])) }];
  });
  assert.equal(calculatePracticeScores(...sets).overallScorePercentage, 60);
});

test('exactly 75% qualifies while missing or invalid set averages do not count as completed', () => {
  const sets = completedSets();
  sets.forEach(set => Object.keys(set).filter(key => key.startsWith('avg_')).forEach(key => { set[key] = 3.75; }));
  assert.equal(calculatePracticeScores(...sets).overallScorePercentage, 75);
  sets[2].avg_action = null;
  assert.equal(calculatePracticeScores(...sets).completedSetCount, 2);
});

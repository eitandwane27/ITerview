const DIMENSIONS = [
  ['clarity', 'correctness', 'completeness'],
  ['problem_solving', 'accuracy', 'depth'],
  ['situation', 'action', 'result'],
];

const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;

function getSetScore(session, dimensions) {
  if (!session?.isCompleted) return null;
  // Prefer original answer scores so rounded stored dimension averages cannot
  // change the unlock decision. Older sessions may only have averages.
  const scored = (session.answers || []).filter(answer =>
    dimensions.every(key => validScore(answer[`${key}_score`])));
  if (scored.length) {
    return scored.reduce((total, answer) => total +
      dimensions.reduce((sum, key) => sum + answer[`${key}_score`], 0), 0) /
      (scored.length * dimensions.length);
  }
  const averages = dimensions.map(key => session[`avg_${key}`]);
  return averages.every(validScore)
    ? averages.reduce((sum, score) => sum + score, 0) / dimensions.length
    : null;
}

function calculatePracticeScores(set1, set2, set3) {
  const scores = [set1, set2, set3].map((session, index) => getSetScore(session, DIMENSIONS[index]));
  const completed = scores.filter(score => score !== null);
  return {
    setScores: { set1: scores[0], set2: scores[1], set3: scores[2] },
    completedSetCount: completed.length,
    // Keep full precision through persistence and threshold comparison.
    overallScorePercentage: completed.length
      ? completed.reduce((sum, score) => sum + score * 20, 0) / completed.length
      : null,
  };
}

module.exports = { calculatePracticeScores };

const { DIFFICULTIES } = require('../config/interviewConfig');

function hasAttemptIdentity(set) {
  return typeof set?.attemptId === 'string' && set.attemptId.length > 0 &&
    typeof set.role === 'string' && set.role.length > 0 && DIFFICULTIES.includes(set.difficulty);
}

// Set 1 owns the technical settings. Behavioral calibration stays Easy.
function belongsToAttempt(first, candidate, setNumber) {
  return hasAttemptIdentity(first) && hasAttemptIdentity(candidate) &&
    candidate.attemptId === first.attemptId && candidate.role === first.role &&
    candidate.difficulty === (setNumber === 3 ? 'easy' : first.difficulty);
}

function getAttemptSets(set1, set2, set3) {
  const second = belongsToAttempt(set1, set2, 2) ? set2 : null;
  return [set1, second, second && belongsToAttempt(set1, set3, 3) ? set3 : null];
}

// Never infer the next position from array length alone: duplicates or gaps
// must not finalize a set or skip a question on resume.
function savedAnswerCount(session, limit = 5) {
  const answers = session.answers || [];
  if (answers.length > limit || answers.some((answer, index) =>
    answer.questionIndex !== index || typeof answer.question !== 'string' ||
    (session.questions?.[index] && answer.question !== session.questions[index]))) {
    throw new Error('Saved question identities are invalid. Restart this practice run.');
  }
  return answers.length;
}

module.exports = { hasAttemptIdentity, belongsToAttempt, getAttemptSets, savedAnswerCount };

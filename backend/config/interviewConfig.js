// Shared capabilities used by the catalogue, debug routes, and live sessions.
const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Combined score across completed Sets 1–3 required to unlock the next tier.
const DIFFICULTY_UNLOCK_THRESHOLD = 75;
// Set 3 uses one entry-level behavioral profile; easy remains its compatible
// storage/catalogue value, not a separate technical difficulty rubric.
const SET_DIFFICULTIES = { set1: DIFFICULTIES, set2: DIFFICULTIES, set3: ['easy'] };

function resolveSetDifficulty(set, difficulty) {
  const supported = SET_DIFFICULTIES[set];
  if (!supported) throw new Error(`Unknown interview set: ${set}`);
  return supported.includes(difficulty) ? difficulty : supported[0];
}

module.exports = { DIFFICULTIES, DIFFICULTY_UNLOCK_THRESHOLD, SET_DIFFICULTIES, resolveSetDifficulty };

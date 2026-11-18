const CONFIDENCE_ITEM_COUNT = 5;
const CONFIDENCE_SCALE_MAX = 4;
const LEGACY_CONFIDENCE_SCALE_MAX = 5;

// Totals saved before the scale was recorded used the original 1–5 survey.
function readConfidenceRating(total, scaleMax = LEGACY_CONFIDENCE_SCALE_MAX) {
  if (scaleMax !== CONFIDENCE_SCALE_MAX && scaleMax !== LEGACY_CONFIDENCE_SCALE_MAX) return null;
  if (!Number.isInteger(total) || total < CONFIDENCE_ITEM_COUNT || total > CONFIDENCE_ITEM_COUNT * scaleMax) return null;
  return { total, scaleMax };
}

module.exports = { CONFIDENCE_ITEM_COUNT, CONFIDENCE_SCALE_MAX, readConfidenceRating };

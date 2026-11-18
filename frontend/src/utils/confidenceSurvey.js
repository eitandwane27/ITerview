export const CONFIDENCE_ITEM_COUNT = 5;
export const CONFIDENCE_SCALE_MAX = 4;
const LEGACY_CONFIDENCE_SCALE_MAX = 5;

export function readConfidenceRating(total, scaleMax = LEGACY_CONFIDENCE_SCALE_MAX) {
  if (scaleMax !== CONFIDENCE_SCALE_MAX && scaleMax !== LEGACY_CONFIDENCE_SCALE_MAX) return null;
  if (!Number.isInteger(total) || total < CONFIDENCE_ITEM_COUNT || total > CONFIDENCE_ITEM_COUNT * scaleMax) return null;
  return { total, scaleMax, mean: total / CONFIDENCE_ITEM_COUNT };
}

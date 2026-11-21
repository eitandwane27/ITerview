const { Schema, model } = require('mongoose');

const score = { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger };
const scores = {
  clarity_score: score,
  correctness_score: score,
  completeness_score: score,
};

const trialSchema = new Schema({
  ...scores,
  scoredAt: { type: Date, required: true },
}, { _id: false });

const ratingSchema = new Schema({
  ...scores,
  raterCode: String, // Retain codes already recorded in the study.
  ratedAt: { type: Date, required: true },
}, { _id: false });

const correctionSchema = new Schema({
  previousRating: { type: ratingSchema, required: true },
  correctedAt: { type: Date, required: true },
  correctedBy: { type: String, required: true },
  resetCriterion: { type: String, enum: Object.keys(scores) },
  reset: Boolean,
}, { _id: false });

module.exports = model('ScoringStudyResult', new Schema({
  _id: String,
  protocol: { type: String, required: true },
  modelName: { type: String, required: true },
  trials: { type: [trialSchema], default: [] },
  rating: { type: ratingSchema, default: null },
  // Keep the previous full rating available for the audit history and legacy partial resets.
  resetCriteria: { type: [String], enum: Object.keys(scores), default: [] },
  ratingHistory: { type: [correctionSchema], default: [] },
}));

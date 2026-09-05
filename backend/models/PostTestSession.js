// backend/models/PostTestSession.js
// Mirrors PreTestSession.js — stores per-answer 3C scores for the Post-Test
// (Graduation Challenge) session, enabling pre-vs-post comparison on /results.

const mongoose = require("mongoose");

// One scored answer per question
const answerResultSchema = new mongoose.Schema(
  {
    questionIndex:      { type: Number, required: true },   // 0–4
    question:           { type: String, required: true },
    transcript:         { type: String, required: true },
    clarity_score:      { type: Number, min: 1, max: 5 },
    correctness_score:  { type: Number, min: 1, max: 5 },
    completeness_score: { type: Number, min: 1, max: 5 },
    primary_weakness:   { type: String },                   // per-answer lowest dim
    evaluatedAt:        { type: Date, default: Date.now },
  },
  { _id: false }
);

const postTestSessionSchema = new mongoose.Schema({
  // Ties to the user's account - unique to ensure only one document exists per user
  firebaseUid:        { type: String, required: true, unique: true },

  // Active WebSocket connection session ID
  sessionId:          { type: String, required: true },

  // Array of up to 5 scored answers (pushed as each evaluation completes)
  answers:            { type: [answerResultSchema], default: [] },

  // Computed after all 5 answers are evaluated
  final_weakness_tag:       { type: String, default: null },
  final_score_percentage:   { type: Number, default: null },
  completedAt:              { type: Date,   default: null },
  createdAt:                { type: Date,   default: Date.now },
});

// Creates the "posttestsessions" collection in iterview_official
module.exports = mongoose.model("PostTestSession", postTestSessionSchema);

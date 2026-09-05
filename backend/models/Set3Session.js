// backend/models/Set3Session.js
// Tracks a single user's Set 3 behavioral interview session.
// Questions are mapped 1-to-1 to behavioral competency pillars (index 0–4):
//   0 → Teamwork & Collaboration
//   1 → Adaptability & Learning Speed
//   2 → Conflict Resolution
//   3 → Resilience & Handling Failure
//   4 → Problem Solving & Initiative
// Answers are scored using STAR dimensions: situation, action, result.

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema: one AI-generated behavioral question + the user's scored answer
// ─────────────────────────────────────────────────────────────────────────────
const set3AnswerSchema = new mongoose.Schema(
  {
    // Position in the session (0-indexed, 0–4 for 5 questions)
    questionIndex: { type: Number, required: true },

    // The dynamically generated behavioral question text
    question: { type: String, required: true },

    // The behavioral competency pillar this question targets
    competency_topic: {
      type: String,
      enum: [
        "Teamwork & Collaboration",
        "Adaptability & Learning Speed",
        "Conflict Resolution",
        "Resilience & Handling Failure",
        "Problem Solving & Initiative",
      ],
      required: true,
    },

    // Raw transcript from STT (Deepgram)
    transcript: { type: String, default: "" },

    // STAR scores from AI evaluator (1–5)
    situation_score: { type: Number, min: 1, max: 5, default: null },
    action_score:    { type: Number, min: 1, max: 5, default: null },
    result_score:    { type: Number, min: 1, max: 5, default: null },

    // 1-sentence actionable coaching tip surfaced to the user after each answer
    tip: { type: String, default: null },

    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────
const set3SessionSchema = new mongoose.Schema({
  // Links this session to a Firebase user account
  firebaseUid: { type: String, required: true, unique: true },

  // Active WebSocket session ID (generated on connect)
  sessionId: { type: String, required: true },

  role: {
    type: String,
    enum: ["frontend", "backend", "fullstack"],
    default: "fullstack",
  },

  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy",
  },

  // Array of dynamically generated question texts (all 5 upfront questions)
  questions: { type: [String], default: [] },

  // Array of dynamically generated questions + scored answers (up to 5)
  answers: { type: [set3AnswerSchema], default: [] },

  // ── Aggregate / session-level results ──────────────────────────────────────

  // Average STAR scores across all answered questions (computed at session end)
  avg_situation: { type: Number, default: null },
  avg_action:    { type: Number, default: null },
  avg_result:    { type: Number, default: null },

  // Overall behavioral score as a percentage (0–100%)
  overall_score_percentage: { type: Number, default: null },

  // ── Lifecycle flags ────────────────────────────────────────────────────────

  // Set to true once all 5 questions have been answered and scored
  isCompleted: { type: Boolean, default: false },

  completedAt: { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pushes a new STAR-scored answer into the session's `answers` array.
 *
 * @param {Object} result - Fields matching set3AnswerSchema
 */
set3SessionSchema.methods.recordAnswer = function (result) {
  this.answers.push({
    questionIndex:    result.questionIndex,
    question:         result.question,
    competency_topic: result.competency_topic,
    transcript:       result.transcript ?? "",
    situation_score:  result.situation_score ?? null,
    action_score:     result.action_score ?? null,
    result_score:     result.result_score ?? null,
    tip:              result.tip ?? null,
    evaluatedAt:      new Date(),
  });
};

/**
 * Computes and stores avg_situation, avg_action, avg_result and the
 * overall_score_percentage from all scored answers.
 */
set3SessionSchema.methods.computeAverages = function () {
  const scored = this.answers.filter(
    (a) =>
      a.situation_score !== null &&
      a.action_score !== null &&
      a.result_score !== null
  );

  if (scored.length === 0) return;

  const sum = (key) => scored.reduce((acc, a) => acc + a[key], 0);

  this.avg_situation = parseFloat((sum("situation_score") / scored.length).toFixed(2));
  this.avg_action    = parseFloat((sum("action_score")    / scored.length).toFixed(2));
  this.avg_result    = parseFloat((sum("result_score")    / scored.length).toFixed(2));

  // Convert to 0–100%: 3 dimensions × max 5 pts = 15 max per question
  const totalPoints    = sum("situation_score") + sum("action_score") + sum("result_score");
  const maxPoints      = scored.length * 15;
  this.overall_score_percentage = parseFloat(((totalPoints / maxPoints) * 100).toFixed(2));
};

/**
 * Marks the session as finished, computes averages, and timestamps completion.
 */
set3SessionSchema.methods.finalise = function () {
  this.computeAverages();
  this.isCompleted = true;
  this.completedAt = new Date();
};

// ─────────────────────────────────────────────────────────────────────────────
// Creates the "set3sessions" collection in the iterview_official database
// ─────────────────────────────────────────────────────────────────────────────
module.exports = mongoose.model("Set3Session", set3SessionSchema);

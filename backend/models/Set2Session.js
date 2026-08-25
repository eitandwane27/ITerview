// backend/models/Set2Session.js
// Tracks a single user's Set 2 (Technical Mastery) interview session.
// Set 2 questions are generated dynamically based on the candidate's chosen role and difficulty.
// Evaluates answers across three dimensions: problem solving, accuracy, and depth.

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema: one AI-generated technical question + the user's scored answer
// ─────────────────────────────────────────────────────────────────────────────
const set2AnswerSchema = new mongoose.Schema(
  {
    // Position in the session (0-indexed, e.g. 0–4 for 5 questions)
    questionIndex: { type: Number, required: true },

    // The dynamically generated technical question text from the AI
    question: { type: String, required: true },

    // Raw transcript from STT (Deepgram)
    transcript: { type: String, default: "" },

    // Technical Mastery scores from AI evaluator (1–10)
    problem_solving_score: { type: Number, min: 1, max: 10, default: null },
    accuracy_score:        { type: Number, min: 1, max: 10, default: null },
    depth_score:           { type: Number, min: 1, max: 10, default: null },

    // 1-sentence actionable tip surfaced to the user after each answer
    tip: { type: String, default: null },

    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────
const set2SessionSchema = new mongoose.Schema({
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
  answers: { type: [set2AnswerSchema], default: [] },

  // ── Aggregate / session-level results ──────────────────────────────────────

  // Average Technical Mastery scores across all answered questions (computed at session end)
  avg_problem_solving: { type: Number, default: null },
  avg_accuracy:        { type: Number, default: null },
  avg_depth:           { type: Number, default: null },

  // Overall technical score as a percentage (0–100%)
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
 * Pushes a new scored answer entry into the session's `answers` array.
 * Call this when an AI evaluation result comes back from the scorer.
 *
 * @param {Object} result - Fields matching set2AnswerSchema
 */
set2SessionSchema.methods.recordAnswer = function (result) {
  this.answers.push({
    questionIndex:         result.questionIndex,
    question:              result.question,
    transcript:            result.transcript ?? "",
    problem_solving_score: result.problem_solving_score ?? null,
    accuracy_score:        result.accuracy_score ?? null,
    depth_score:           result.depth_score ?? null,
    tip:                   result.tip ?? null,
    evaluatedAt:           new Date(),
  });
};

/**
 * Computes and stores avg_problem_solving, avg_accuracy, avg_depth and overall_score_percentage
 * from all scored answers. Call this once `isCompleted` is set to true.
 */
set2SessionSchema.methods.computeAverages = function () {
  const scored = this.answers.filter(
    (a) =>
      a.problem_solving_score !== null &&
      a.accuracy_score !== null &&
      a.depth_score !== null
  );

  if (scored.length === 0) return;

  const sum = (key) => scored.reduce((acc, a) => acc + a[key], 0);

  this.avg_problem_solving = parseFloat((sum("problem_solving_score") / scored.length).toFixed(2));
  this.avg_accuracy        = parseFloat((sum("accuracy_score")        / scored.length).toFixed(2));
  this.avg_depth           = parseFloat((sum("depth_score")           / scored.length).toFixed(2));

  // Convert to 0–100%: 3 dimensions × max 10 pts = 30 max per question
  const totalPoints    = sum("problem_solving_score") + sum("accuracy_score") + sum("depth_score");
  const maxPoints      = scored.length * 30;
  this.overall_score_percentage = parseFloat(((totalPoints / maxPoints) * 100).toFixed(2));
};

/**
 * Marks the session as finished, computes averages, and timestamps completion.
 */
set2SessionSchema.methods.finalise = function () {
  this.computeAverages();
  this.isCompleted = true;
  this.completedAt = new Date();
};

// ─────────────────────────────────────────────────────────────────────────────
// Creates the "set2sessions" collection in the iterview_official database
// ─────────────────────────────────────────────────────────────────────────────
module.exports = mongoose.model("Set2Session", set2SessionSchema);

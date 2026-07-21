// backend/models/Set1Session.js
// Tracks a single user's Set 1 personalized interview session.
// Unlike PreTestSession (which uses hardcoded questions), Set 1 questions are
// generated dynamically by the AI based on the user's final_weakness_tag.

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema: one AI-generated question + the user's scored answer
// ─────────────────────────────────────────────────────────────────────────────
const set1AnswerSchema = new mongoose.Schema(
  {
    // Position in the session (0-indexed, e.g. 0–4 for 5 questions)
    questionIndex: { type: Number, required: true },

    // The dynamically generated question text from the AI
    question: { type: String, required: true },

    // Which weakness dimension drove this question's generation
    weakness_tag: {
      type: String,
      enum: ["focus_clarity", "focus_correctness", "focus_completeness"],
      required: true,
    },

    // Raw transcript from STT (Deepgram)
    transcript: { type: String, default: "" },

    // 3C scores from AI evaluator (1–10)
    clarity_score:      { type: Number, min: 1, max: 10, default: null },
    correctness_score:  { type: Number, min: 1, max: 10, default: null },
    completeness_score: { type: Number, min: 1, max: 10, default: null },

    // 1-sentence actionable tip surfaced to the user after each answer
    tip: { type: String, default: null },

    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────
const set1SessionSchema = new mongoose.Schema({
  // Links this session to a Firebase user account
  firebaseUid: { type: String, required: true, unique: true },

  // Active WebSocket session ID (generated on connect, like the Pre-Test)
  sessionId: { type: String, required: true },

  // Weakness tag inherited from the user's most recent PreTestSession.
  // Drives all AI question generation for this session.
  weakness_tag: {
    type: String,
    enum: ["focus_clarity", "focus_correctness", "focus_completeness"],
    required: true,
  },

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

  // Array of dynamically generated questions + scored answers (up to 5)
  answers: { type: [set1AnswerSchema], default: [] },

  // ── Aggregate / session-level results ──────────────────────────────────────

  // Average 3C scores across all answered questions (computed at session end)
  avg_clarity:      { type: Number, default: null },
  avg_correctness:  { type: Number, default: null },
  avg_completeness: { type: Number, default: null },

  // Overall improvement score relative to the Pre-Test baseline (percentage)
  improvement_score: { type: Number, default: null },

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
 * Pushes a new answer entry into the session's `answers` array.
 * Call this when an AI evaluation result comes back from the scorer.
 *
 * @param {Object} result - Fields matching set1AnswerSchema
 */
set1SessionSchema.methods.recordAnswer = function (result) {
  this.answers.push({
    questionIndex:     result.questionIndex,
    question:          result.question,
    weakness_tag:      result.weakness_tag,
    transcript:        result.transcript ?? "",
    clarity_score:     result.clarity_score ?? null,
    correctness_score: result.correctness_score ?? null,
    completeness_score:result.completeness_score ?? null,
    tip:               result.tip ?? null,
    evaluatedAt:       new Date(),
  });
};

/**
 * Computes and stores avg_clarity, avg_correctness, avg_completeness
 * from all scored answers. Call this once `isCompleted` is set to true.
 */
set1SessionSchema.methods.computeAverages = function () {
  const scored = this.answers.filter(
    (a) => a.clarity_score !== null && a.correctness_score !== null && a.completeness_score !== null
  );

  if (scored.length === 0) return;

  const sum = (key) => scored.reduce((acc, a) => acc + a[key], 0);

  this.avg_clarity      = parseFloat((sum("clarity_score")      / scored.length).toFixed(2));
  this.avg_correctness  = parseFloat((sum("correctness_score")  / scored.length).toFixed(2));
  this.avg_completeness = parseFloat((sum("completeness_score") / scored.length).toFixed(2));
};

/**
 * Marks the session as finished, computes averages, and timestamps completion.
 * Optionally accepts a baseline percentage from the PreTestSession to compute
 * an improvement delta.
 *
 * @param {number|null} baselinePercent - PreTestSession.baseline_score_percentage
 */
set1SessionSchema.methods.finalise = function (baselinePercent = null) {
  this.computeAverages();

  if (baselinePercent !== null && this.avg_clarity !== null) {
    // Convert the new avg to a comparable 0-100 percentage, then diff
    const newPercent =
      ((this.avg_clarity + this.avg_correctness + this.avg_completeness) / 30) * 100;
    this.improvement_score = parseFloat((newPercent - baselinePercent).toFixed(2));
  }

  this.isCompleted = true;
  this.completedAt = new Date();
};

// ─────────────────────────────────────────────────────────────────────────────
// Creates the "set1sessions" collection in the iterview_official database
// ─────────────────────────────────────────────────────────────────────────────
module.exports = mongoose.model("Set1Session", set1SessionSchema);

// backend/config/evaluatorRubrics.js
// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Rubrics Registry — Difficulty-Aware AI Scoring Standards
//
// Defines scoring strictness guidelines for Easy, Medium, and Hard difficulty levels.
// These rubrics are injected into the system prompt for all AI evaluations:
//   - Pre-Test / Post-Test (3C evaluation)
//   - Set 1 (Personalized 3C evaluation)
//   - Set 2 (Technical Mastery evaluation)
//   - Set 3 (Behavioral STAR evaluation)
// ─────────────────────────────────────────────────────────────────────────────

const EVALUATOR_RUBRICS = {
  easy: `
### DIFFICULTY SCORING RUBRIC: EASY (Entry Level / Fresh IT Graduate)
- **Persona**: Supportive & encouraging mock interviewer.
- **Expectations**: Basic conceptual understanding, core factual accuracy, and clear communication. The candidate has NO commercial experience. Conversational tone, hesitation, and filler words (um, like, basically) are acceptable for entry level.
- **Scoring Scale Guidelines (1 to 5)**:
  * **4 - 5 (High)**: The answer addresses the core question and is factually correct, even if simple, conversational, or containing filler words.
  * **3 (Average)**: The answer is mostly correct but lacks clarity or omits minor points.
  * **1 - 2 (Low)**: The answer is off-topic, factually incorrect, or extremely unclear.
`,

  medium: `
### DIFFICULTY SCORING RUBRIC: MEDIUM (Junior Developer / Applied Knowledge)
- **Persona**: Objective Mid-Level Engineer.
- **Expectations**: Practical reasoning, trade-off awareness, proper technical terminology, and structured delivery. Heavy filler words (um, like, basically), hesitation, or vague phrasing lower Clarity and Completeness scores.
- **Scoring Scale Guidelines (1 to 5)**:
  * **4 - 5 (High)**: Demonstrates solid practical understanding, clear structure, proper terminology, and explains *why* or gives context beyond a dictionary definition.
  * **3 (Moderate)**: Correct core answer, but heavy use of filler words, informal delivery, or missing trade-offs caps scores at 3.
  * **1 - 2 (Low)**: Vague, factually inaccurate, or misses key technical nuances.
`,

  hard: `
### DIFFICULTY SCORING RUBRIC: HARD (Advanced Junior / Senior Technical Lead)
- **Persona**: Strict, unyielding Senior Tech Lead / Hiring Manager.
- **Expectations**: Deep architectural understanding, performance & memory awareness, precise technical language, and professional delivery. Excessive filler words, informal language, hesitation, or surface-level explanations are heavily penalized.
- **Scoring Scale Guidelines (1 to 5)**:
  * **5 (High)**: Comprehensive, highly precise answer demonstrating senior-level depth, failure modes, or optimization trade-offs, delivered professionally without filler words.
  * **3 - 4 (Average)**: Correct answer but lacks deep technical precision, edge cases, or performance considerations.
  * **1 - 2 (Low)**: Heavy filler words (um, like, basically), informal/vague explanations, or incomplete answers are penalized strictly (1-2 range).
`
};

/**
 * Retrieves the evaluation rubric prompt section for a given difficulty level.
 * @param {string} difficulty - "easy" | "medium" | "hard"
 * @returns {string} The formatted system prompt section
 */
function getEvaluatorRubric(difficulty = "easy") {
  const norm = (difficulty || "easy").toLowerCase();
  return EVALUATOR_RUBRICS[norm] || EVALUATOR_RUBRICS.easy;
}

module.exports = {
  EVALUATOR_RUBRICS,
  getEvaluatorRubric
};

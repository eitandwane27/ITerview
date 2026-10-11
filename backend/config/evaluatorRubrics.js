// backend/config/evaluatorRubrics.js
// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Rubrics Registry — Difficulty-Aware AI Scoring Standards
//
// Defines scoring strictness guidelines for Easy, Medium, and Hard difficulty levels.
// All levels target fresh IT graduates without commercial experience.
// getEvaluatorRubric serves Pre-Test / Post-Test and Easy / Medium in Sets 1 and 2.
// The main sets use separate Hard exports for their bounded advanced-junior tasks.
// Set 3 uses separate behavioral evidence anchors in behavioralInterviewConfig.js.
// ─────────────────────────────────────────────────────────────────────────────

// Shared anchors keep full marks attainable without rewarding missing knowledge.
const FRESH_GRADUATE_SCORING = `FRESH GRADUATE SCORE ANCHORS (1 to 5):
Assess each dimension independently using only evidence in the answer and the actual requested task.
- 5: Fully meets the dimension's requirements at this difficulty. A short, simple answer is enough; perfection, extra detail, and professional polish are unnecessary.
- 4: Demonstrates the core understanding required for the dimension, with a minor gap or imprecision that does not change the main meaning or make the approach unworkable. This is a solid fresh-graduate answer.
- 3: Shows relevant partial understanding in the dimension being scored, but evidence for that dimension is missing or a misconception affects it. Missing requested items affect completeness; they are not factual errors in the items actually supplied.
- 2: Provides limited relevant evidence, with substantial gaps or misconceptions.
- 1: Provides no usable evidence for the dimension, is unintelligible, or is fundamentally incorrect. An off-topic answer has low correctness and completeness, but can still be clear.
Use 4 or 5 when the evidence meets those anchors; do not default to 3 merely because the answer is brief or could be expanded. Award 5 when requirements are fully met, rather than reserving it for an exceptional answer.
Accept everyday wording, understandable grammar, and technically valid alternatives. Do not penalize accent, hesitation, filler words, or informal delivery as technical errors; lower clarity only when meaning is difficult to follow. Do not infer vocal confidence from a transcript.
Correctness measures the accuracy and relevance of what is stated; completeness measures coverage of what was asked. Score them independently: missing list items MUST lower completeness, but MUST NOT lower correctness solely because fewer items were supplied. If all supplied list items are relevant and accurate, correctness can be 5 even when the list is incomplete. Lower correctness for a false, irrelevant, contradictory, or genuinely unidentifiable item, not for the missing count or an unrequested explanation. A clear but incorrect answer can earn high clarity.
Do not invent missing evidence, overlook substantive errors, or raise scores to help a candidate unlock a difficulty. Difficulty changes the task's complexity, not the requirement for commercial experience or polished delivery.`;

const EVALUATOR_RUBRICS = {
  easy: `
### DIFFICULTY SCORING RUBRIC: EASY (Entry Level / Fresh IT Graduate)
- **Persona**: Supportive & encouraging mock interviewer.
- **Expectations**: Basic conceptual understanding and core factual accuracy appropriate to a fresh IT graduate with NO commercial experience. Evaluate only the requested introductory task; a correct definition, relevant item, simple distinction, or fitting action can be sufficient without additional reasoning or examples unless requested.
${FRESH_GRADUATE_SCORING}
- **Coaching**: Reinforce sufficient correct answers. Suggest one useful improvement for a genuine gap, without asking for unrequested detail.
`,

  medium: `
### DIFFICULTY SCORING RUBRIC: MEDIUM (Fresh IT Graduate / Applied Knowledge)
- **Persona**: Supportive, objective interviewer assessing junior applied knowledge.
- **Expectations**: Correct concepts and simple practical reasoning appropriate to small academic or personal projects, with NO commercial experience. Evaluate only the requested task, requiring at most two reasoning steps; this is an upper bound, not a minimum answer length. Credit the requested application, mechanism, comparison, or list expressed in plain language. A concise answer can earn full marks without unsolicited reasons, trade-offs, examples, or syntax.
${FRESH_GRADUATE_SCORING}
- **Coaching**: Match feedback to the task. Reinforce sufficient correct answers; do not ask for extra implementation steps, terminology, or explanations the question did not request.
`,

  hard: `
### DIFFICULTY SCORING RUBRIC: HARD (Fresh IT Graduate / Advanced Junior Practice)
- **Persona**: Supportive, objective interviewer assessing a fresh graduate's developing reasoning.
- **Expectations**: Apply familiar concepts to a bounded situation, requiring at most three connected reasoning steps. Accept school and personal-project understanding with NO commercial experience. Judge the requested mechanism, distinction, consequence, or justified choice; do not require broad architecture, optimization, extra edge cases, specialized terminology, or senior expertise unless the question explicitly requests the relevant concept.
${FRESH_GRADUATE_SCORING}
- **Coaching**: Reinforce sufficient correct answers and gently address one substantive gap. Do not require professional delivery or unasked technical detail.
`,
};

// Append this task-specific rule after the tier rubric for Set 1 item lists.
// Keep it domain-independent; grading still depends on the actual answer.
const SET1_ITEM_LIST_SCORING = `SET 1 ITEM-LIST SCORING — INDEPENDENT DIMENSIONS:
First identify the items the student actually supplied and whether each is relevant and factually valid. Do not treat an omitted item as an incorrect supplied item.
- correctness_score: Judge the supplied items only. All relevant, accurate supplied items merit 5, or 4 for a minor factual imprecision, even if only one of two or two of three requested items is supplied. Mixed valid and invalid items must lose correctness according to the substantive errors. No identifiable relevant item must receive low correctness.
- completeness_score: Separately judge whether the requested number of distinct relevant items was supplied. Missing items and repeated versions of the same item lower completeness, even when the supplied content is correct.
- clarity_score: Judge whether the supplied content is understandable. A clear short item or noun phrase is sufficient for a naming task; brevity and missing items alone do not make it unclear.
Accept a recognizable check or detail named in ordinary shorthand when the question asks only to name or list it. Do not require steps, a concrete value, a definition, or an explanation unless requested. Do not turn genuinely vague filler into a valid item by guessing its meaning.
For example, if two valid items are requested and the answer names one valid item clearly, high correctness and clarity can coexist with low completeness. If an answer supplies two false items, the count does not make their correctness high.
Recognize short case names in the question's context: for a list of optional value cases, a present value names a valid case without restating optional. Omitting the absent case lowers completeness only. In contrast, it depends or a value with no identifiable case is vague filler and must not earn factual credit by inference.
Keep feedback aligned with the separate scores: acknowledge a valid supplied item and request the missing item; do not call the valid item wrong merely because the list is short.`;

/**
 * Retrieves the evaluation rubric prompt section for a given difficulty level.
 * @param {string} difficulty - "easy" | "medium" | "hard"
 * @returns {string} The formatted system prompt section
 */
function getEvaluatorRubric(difficulty = 'easy') {
  const norm = (difficulty || 'easy').toLowerCase();
  return EVALUATOR_RUBRICS[norm] || EVALUATOR_RUBRICS.easy;
}

// Role-independent main-set rubrics retain their task-specific expectations
// while sharing the same fresh-graduate score anchors as Pre-Test / Post-Test.
const HARD_SET1_SCORING = `HARD SET 1 SCORING: ADVANCED JUNIOR 3C
Assess each dimension independently against the actual requested task.
- clarity_score: Is the explanation, distinction, outcome, or list understandable and organized? Plain language is valid. Hesitation or filler words affect clarity only when they obscure meaning; never penalize technical correctness solely for delivery.
- correctness_score: Are the mechanism, stated outcome, distinction, and listed items technically accurate under the given conditions? Accept valid alternatives and reasonable explicit assumptions. For a partly correct list, distinguish correct items from incorrect ones.
- completeness_score: Does the answer cover what was asked? A mechanism task needs the requested causal connection; a distinction or outcome task is sufficient without an unsolicited reason. A Name three or List three task needs THREE distinct relevant items, not repeated wording. One or two items are incomplete even if correct. Do not require explanations for list items, unasked examples, architecture, syntax, or extra edge cases.
${FRESH_GRADUATE_SCORING}
Do not require senior experience, polished professional delivery, or specialized API names. If the premise is flawed or underspecified, accept a reasonable clarification or conditional answer rather than inventing a hidden correct answer.
Match the tip and interviewer reply to the task. Reinforce sufficient answers without requesting extra items or explanations. Acknowledge effort without describing an incorrect answer as correct.`;

const HARD_TECHNICAL_SCORING = `HARD TECHNICAL SCORING: ADVANCED JUNIOR
For problem solving, assess the causal reasoning, evidence, consequence, trade-off, or safeguard actually requested. For accuracy, assess technical correctness and the stated conditions. For depth, assess sufficient understanding for this bounded advanced-junior task, requiring at most three connected reasoning steps.
Judge the requested causal connection, distinction, justified decision, outcome, or two distinct relevant tests. Naming a familiar tool alone is insufficient when a mechanism or reason is requested. A concise complete answer can earn full marks without unsolicited architecture, extra edge cases, code, exact API names, or production experience. Three reasoning steps are an upper bound, not a minimum answer length.
${FRESH_GRADUATE_SCORING}
Accept technically valid alternatives and stated reasonable assumptions; do not invent a hidden preferred implementation. A materially unsafe approach remains a substantive error.
Do not lower technical scores for hesitation, filler words, or informal delivery. Match coaching to the requested task and reinforce sufficient correct answers.`;

module.exports = {
  EVALUATOR_RUBRICS,
  getEvaluatorRubric,
  HARD_SET1_SCORING,
  HARD_TECHNICAL_SCORING,
  SET1_ITEM_LIST_SCORING,
};

// backend/services/aiEvaluator.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 – Step 1 (Upgraded): 3C Structured JSON Scoring
//
// evaluate3CScores(question, transcript)
//   → returns { clarity_score, correctness_score, completeness_score, primary_weakness }
//
// Uses temperature: 0.0 and response_format: { type: "json_object" } for deterministic output.
// ─────────────────────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");
const { getEvaluatorRubric } = require("../config/evaluatorRubrics");
const { safeParseJSON } = require("../utils/jsonParser");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// Valid weakness tags — kept as a constant so validation is centralised
const VALID_TAGS = ["focus_clarity", "focus_correctness", "focus_completeness"];

const BASE_SCORING_SYSTEM_PROMPT = `You are an objective IT interview scoring engine.
Your sole task is to evaluate a student's spoken answer against the SPECIFIC interview question.
You must respond with ONLY a valid JSON object — no markdown, no explanation, no extra text.

### STEP 1 — RELEVANCE CHECK (mandatory)
Before scoring, determine whether the student's answer actually addresses the topic
of the interview question. Set "is_relevant" to true ONLY if the answer directly
responds to what the question is asking. An answer that discusses a different topic
— even if it sounds fluent and confident — is NOT relevant.

### STEP 2 — SCORING RULES
Score each dimension from 1 to 5:

- clarity_score      : How well-organised, articulate, and easy to follow is the answer?
                       This measures communication quality regardless of topic relevance.
                       (1 = very unclear/rambling, 5 = very clear and structured)

- correctness_score  : Does the answer DIRECTLY and CORRECTLY respond to what the
                       question is ACTUALLY asking? Evaluate factual accuracy ONLY
                       in the context of the specific question asked.
                       An answer that is factually accurate but about a DIFFERENT topic
                       than the question MUST score 1-2.
                       (1 = wrong or off-topic, 5 = fully correct and on-topic)

- completeness_score : How thoroughly does the answer cover the SPECIFIC points the
                       question is asking about? An answer that never addresses the
                       question's actual topic scores 1-2 regardless of its length
                       or depth on other subjects.
                       (1 = missing/off-topic, 5 = comprehensive and fully addresses the question)

- primary_weakness   : The dimension with the lowest score.
  Must be exactly one of: "focus_clarity", "focus_correctness", "focus_completeness"
  If scores are tied, choose the one that would most help the student improve.

### CRITICAL PENALTY RULE
If "is_relevant" is false (the answer does NOT address the question's topic),
then correctness_score and completeness_score MUST both be between 1 and 2.
Do NOT give high correctness or completeness to an off-topic answer, no matter
how well-written or technically sound it may be on its own.

Return exactly this shape:
{
  "is_relevant": <true | false>,
  "clarity_score": <integer 1-5>,
  "correctness_score": <integer 1-5>,
  "completeness_score": <integer 1-5>,
  "primary_weakness": "<focus_clarity | focus_correctness | focus_completeness>"
}`;

/**
 * evaluate3CScores(question, transcript, difficulty)
 *
 * Calls DeepSeek LLM with temperature 0.0 and JSON mode to produce
 * deterministic 3C dimension scores for an answer based on difficulty.
 *
 * @param {string} question   - The interview question asked.
 * @param {string} transcript - The student's STT-transcribed answer.
 * @param {string} difficulty - Session difficulty level ("easy" | "medium" | "hard").
 * @returns {Promise<{ clarity_score: number, correctness_score: number, completeness_score: number, primary_weakness: string }>}
 */
async function evaluate3CScores(question, transcript, difficulty = "easy") {
  // Guard: empty transcript → lowest scores, flag completeness
  if (!transcript || transcript.trim().length === 0) {
    return {
      clarity_score: 1,
      correctness_score: 1,
      completeness_score: 1,
      primary_weakness: "focus_completeness",
    };
  }

  const difficultyRubric = getEvaluatorRubric(difficulty);
  const systemPrompt = `${BASE_SCORING_SYSTEM_PROMPT}\n\n${difficultyRubric}`;

  try {
    const response = await deepseek.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Score ONLY how well the Student's Answer responds to the specific Interview Question below.
An answer that talks about a different topic entirely must receive low correctness and completeness scores.

Interview Question: "${question}"

Student's Answer: "${transcript}"`,
        },
      ],
      temperature: 0.0, // deterministic scoring
      max_tokens: 2000,
      thinking: { type: "disabled" }, // Disables native reasoning CoT for sub-second/1s latency
      response_format: { type: "json_object" }, // forces valid JSON output
    });

    const raw = response.choices?.[0]?.message?.content || "";
    const parsed = safeParseJSON(raw) || {};

    // Clamp scores to 1–5 and validate the weakness tag
    const clamp = (n) => Math.min(5, Math.max(1, parseInt(n) || 3));

    return {
      clarity_score: clamp(parsed.clarity_score),
      correctness_score: clamp(parsed.correctness_score),
      completeness_score: clamp(parsed.completeness_score),
      primary_weakness: VALID_TAGS.includes(parsed.primary_weakness)
        ? parsed.primary_weakness
        : "focus_completeness",
    };
  } catch (err) {
    console.error("[aiEvaluator] Error evaluating 3C scores:", err.message);
    return {
      clarity_score: 3,
      correctness_score: 3,
      completeness_score: 3,
      primary_weakness: "focus_completeness",
    };
  }
}

module.exports = { evaluate3CScores };

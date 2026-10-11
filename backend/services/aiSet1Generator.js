// backend/services/aiSet1Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Subset 2: Dynamic AI Prompting (The "Weakness" Engine)
// Handles generating questions and scoring answers specifically for Set 1.
// ─────────────────────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");
const { getRoleConfig, getRoleSetConfig, getRoleRestrictions } = require("../config/roleConfig");
const { getEvaluatorRubric, HARD_SET1_SCORING, SET1_ITEM_LIST_SCORING } = require("../config/evaluatorRubrics");
const { sanitizeTTS } = require("../utils/ttsSanitizer");
const { getEasySet1QuestionIssue } = require("../utils/easySet1QuestionGuard");
const { getMediumSet1QuestionIssue } = require("../utils/mediumQuestionGuard");
const { getHardSet1QuestionIssue } = require("../utils/hardSet1QuestionGuard");
const { normalizeQuestionDraft, isItemListTask } = require('../utils/questionWording');
const { selectSet1QuestionFallback } = require('../utils/set1QuestionFallback');
const { getQuestionTopicCoverage, rememberQuestionTopic, resolveQuestionTopic } = require("../utils/questionTopicCoverage");
const { HARD_SET1_FOCUS_INSTRUCTIONS, HARD_SET1_QUESTION_STYLE } = require("../config/hardSet1Config");
const { safeParseJSON } = require("../utils/jsonParser");
const { EASY_AVOID_LIST, EASY_QUESTION_STYLE, MEDIUM_AVOID_LIST, MEDIUM_QUESTION_STYLE, HARD_AVOID_LIST, TTS_SAFETY } = require("../config/guardConfig");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const EVALUATOR_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

// ─────────────────────────────────────────────────────────────────────────────
// Role data (examples, topic scope, keywords) is now sourced from
// backend/config/roleConfig.js — see that file to add or modify roles.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a personalized Set 1 interview question based on the user's weakness, role, and difficulty.
 *
 * @param {string} weakness_tag - focus_clarity, focus_correctness, or focus_completeness
 * @param {string} role - A registered role ID from roleConfig.js
 * @param {string} difficulty - easy, medium, or hard
 * @param {Array<string>} previousQuestions - Array of questions already asked in this session
 * @returns {Promise<string>} The generated question
 */
async function generateSet1Question(
  weakness_tag,
  role = "fullstack",
  difficulty = "easy",
  previousQuestions = [],
) {
  // ── Step 1: Resolve role config from registry ────────────────────────────
  const roleData = getRoleConfig(role);
  const formattedRole = roleData.label;

  const safeWeakness = [
    "focus_clarity",
    "focus_correctness",
    "focus_completeness",
  ].includes(weakness_tag)
    ? weakness_tag
    : "focus_correctness";
  const setData = getRoleSetConfig(roleData, 'set1', difficulty, safeWeakness);

  // ── Resolve Difficulty Configurations dynamically ───────────────────────────
  const isHard = difficulty === "hard";
  const isMedium = difficulty === "medium";
  const isEasy = !isHard && !isMedium;

  let examplePool = [];
  if (isHard) {
    examplePool = setData.hardExamples?.[safeWeakness] || [];
  } else if (isMedium) {
    examplePool = setData.mediumExamples?.[safeWeakness] || [];
  } else {
    examplePool = setData.easyExamples?.[safeWeakness] || [];
  }

  const difficultyLabel = isHard
    ? "Hard (Advanced Junior Candidate)"
    : isMedium
    ? "Medium (Conceptual Application / Junior Candidate)"
    : "Easy (Entry Level / Fresh Graduate)";

  const difficultyContext = isHard
    ? `The candidate is an advanced junior with strong academic or personal-project understanding of role-specific performance, security, and reliability. They have no required commercial experience. Ask one bounded 3C task requiring at most three connected reasoning steps, not senior architecture or a full investigation.`
    : isMedium
    ? `The candidate is a fresh IT graduate who has practiced core concepts in small academic or personal projects. They can explain a simple mechanism, predict a basic behavior, or identify relevant checks. They have no production or commercial team experience. Require at most two reasoning steps and keep the answer burden small.`
    : `The candidate is an IT student or fresh graduate practicing introductory classroom fundamentals. They may have limited confidence and only basic lessons or lab experience. Do not assume completed projects, framework knowledge, or commercial experience. Questions must be simple and answerable from the selected introductory topics.`;

  const avoidList = `${getRoleRestrictions(roleData, difficulty)}\n\n${
    isHard ? HARD_AVOID_LIST : isMedium ? MEDIUM_AVOID_LIST : EASY_AVOID_LIST
  }\n\n${TTS_SAFETY}`;

  // ── Step 2: Build the weakness-specific instruction ───────────────────────
  const easyWeaknessInstructions = {
    focus_clarity: 'Ask for the meaning or simple purpose of ONE concept in the student\'s own words. Use direct wording. Do not ask for steps, a procedure, a comparison, or a definition followed by when or how to use it.',
    focus_correctness: 'Ask for ONE basic fact, purpose, or an unambiguous comparison of TWO familiar concepts. Avoid questions where several tools or properties could be the intended answer. Do not append a reason, example, or usage question.',
    focus_completeness: 'Start with Name two or List two. Ask for exactly TWO familiar items from one clearly bounded category in the selected topic. Do not request explanations or supply possible answers in the question with such as, like, or for example. Do not list specialist properties, implementation techniques, or arbitrary things a tool can do. If a category does not naturally have two beginner answers, choose another category within the selected topic.',
  };
  const mediumWeaknessInstructions = {
    focus_clarity: 'Ask the candidate to explain how ONE mechanism works or why ONE concept serves a stated purpose in a small project. Test a clear cause-and-effect explanation, not a comparison or implementation walkthrough.',
    focus_correctness: 'Test ONE accurate behavior, expected outcome, or focused comparison of TWO core concepts in a stated context. Include the conditions needed to answer; do not append a reason, example, or implementation task.',
    focus_completeness: 'Start with Name two or List two. Ask for exactly TWO distinct relevant checks, parts, or related items from ONE bounded category in the selected topic. Give a small-project context where useful; do not ask for explanations or supply possible answers.',
  };
  const weaknessInstruction = (isEasy ? easyWeaknessInstructions : isMedium ? mediumWeaknessInstructions : HARD_SET1_FOCUS_INSTRUCTIONS)[safeWeakness];

  // ── Step 3: Build the calibration + exclusion section ───────────────────
  let examplesSection = "";
  if (examplePool && examplePool.length > 0) {
    const shuffled = [...examplePool].sort(() => Math.random() - 0.5);
    const benchmarkSamples = shuffled
      .slice(0, 2)
      .map((q, i) => `  ${i + 1}. ${q}`)
      .join("\n");
    examplesSection = isEasy ? `
CLASSROOM BENCHMARKS — match the short wording, small task, and introductory difficulty of these examples:
${benchmarkSamples}

These examples guide difficulty and format, not topic selection. Stay within the allowed role topics. Familiar wording and fundamental concepts are welcome; do not increase difficulty to avoid resembling an example.` : isMedium ? `
JUNIOR APPLICATION BENCHMARKS — match the focused task, short wording, and conceptual demand of these examples:
${benchmarkSamples}

These examples guide difficulty and format, not topic selection. Stay within the allowed role topics; do not increase difficulty to avoid resembling an example.` : `
ADVANCED JUNIOR 3C BENCHMARKS — match the focused task, spoken wording, and conceptual demand:
${benchmarkSamples}

These examples guide difficulty and 3C focus, not topic selection. Stay within the allowed role topics. Do not increase difficulty merely to avoid resembling a benchmark.`;
  }

  // ── Step 3.5: Select a topic to ensure variance and avoid repetition ──────
  const topics = setData.topicScope || [];
  const keywordLists = setData.topicKeywords || [];
  const appliedCoverage = isMedium || isHard ? getQuestionTopicCoverage(previousQuestions, keywordLists, topics) : [];
  let selectedTopic = "";
  if (topics.length > 0) {
    const easyCoverage = topics.map(() => 0);
    if (isEasy) previousQuestions.forEach(q => {
      const words = ` ${q.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
      const matches = keywordLists.map(keywords => keywords.filter(word => {
        const term = word.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return [term, `${term}s`, `${term}es`].some(value => words.includes(` ${value} `));
      }).length);
      const bestMatch = Math.max(...matches);
      // Assign an earlier question to its strongest topic match. Incidental
      // context words must not make several unasked categories look covered.
      if (bestMatch > 0) easyCoverage[matches.indexOf(bestMatch)]++;
    });
    const topicScores = topics.map((topic, index) => {
      if (isEasy) return { index, score: easyCoverage[index], topic };
      return { index, score: appliedCoverage[index], topic };
    });

    const minScore = Math.min(...topicScores.map((t) => t.score));
    const candidates = topicScores.filter((t) => t.score === minScore);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    selectedTopic = chosen.topic;
  }

  // ── Step 4: Build the full system prompt ─────────────────────────────────
  const topicScope = topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n");

  const systemPrompt = `You are an experienced IT recruiter and mock interview coach generating personalized practice questions.
You are creating a question for a ${difficultyLabel} candidate applying for a ${formattedRole} position.

CANDIDATE PROFILE:
${difficultyContext}

ALLOWED TOPICS — Your question MUST come from one of these topics only. Do not go outside this list:
${topicScope}

PREFERRED TOPIC FOCUS:
Prefer a question specifically targeting this topic: "${selectedTopic}".
Another topic from the allowed role and difficulty scope is acceptable when it produces a clearer question for the same 3C focus. Topic variety is a preference, not a reason to make the task harder.

QUESTION TYPE REQUIREMENT:
${weaknessInstruction}
${isEasy ? `\n${EASY_QUESTION_STYLE}` : ""}
${isMedium ? `\n${MEDIUM_QUESTION_STYLE}` : ""}
${isHard ? `\n${HARD_SET1_QUESTION_STYLE}` : ""}
${avoidList ? `\nSTRICT CONSTRAINTS:\n${avoidList}` : ""}
${examplesSection}

CRITICAL TTS RULE: Do NOT include backticks, dot-notation, slashes, angle brackets, curly braces, or any programming syntax. Do NOT write method calls like element.textContent or style.display — use plain English names instead (e.g. "the textContent property", "the display style property"). The question is read aloud by a TTS engine — every character you write will be spoken literally.

OUTPUT RULE:
- Return ONLY the final question string.
- Do NOT include any self-correction, revision markers, arrows (->), or "I made a change" commentary.
- Do NOT show a draft followed by a corrected version.
- No introduction, no explanation, no quotes, no numbering. Just the single, final question itself.`;

  // ── Step 5: Build the messages array ─────────────────────────────────────
  const allExcluded = previousQuestions;
  const messages = [{ role: "system", content: systemPrompt }];

  if (allExcluded.length > 0) {
    messages.push({
      role: "user",
      content: isEasy
        ? `Generate one classroom-level question. Avoid repeating the same task or fact tested by these already-asked questions; changing only the wording is not enough:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPrefer the selected topic within the allowed role scope and keep the task simple.`
        : isMedium
          ? `Generate one focused junior-level question. Avoid the same task or fact tested by these already-asked questions; changing only the wording is not enough:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nKeep the 3C focus and prefer the selected topic within the allowed role scope, with at most two reasoning steps.`
          : `Generate one advanced-junior 3C question in the selected topic and focus. Avoid the same mechanism, distinction, outcome, or list category tested by these already-asked questions, even with different wording:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nKeep the answer bounded to at most three connected reasoning steps or the three requested list items.`,
    });
  } else {
    messages.push({
      role: "user",
      content: "Generate the first interview question for this candidate.",
    });
  }

  const request = {
    model: EVALUATOR_MODEL,
    messages,
    temperature: isHard ? 0.3 : 0.85,
    max_tokens: 2000,
    thinking: { type: "disabled" },
  };

  // Two repairs retain the requested task. Exhaustion may use only a scoped,
  // validated reviewed question; rejected drafts are never served.
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await deepseek.chat.completions.create(request);
    const raw = normalizeQuestionDraft(response.choices?.[0]?.message?.content || '');
    if (!raw) throw new Error('Question service returned an empty question.');
    const question = sanitizeTTS(raw);
    if (!question) throw new Error('Question service returned an empty question.');
    let issue = isEasy ? getEasySet1QuestionIssue(raw, safeWeakness, previousQuestions)
        || getEasySet1QuestionIssue(question, safeWeakness, previousQuestions)
      : isMedium ? getMediumSet1QuestionIssue(raw, safeWeakness, previousQuestions)
        || getMediumSet1QuestionIssue(question, safeWeakness, previousQuestions)
        : getHardSet1QuestionIssue(raw, safeWeakness, previousQuestions)
          || getHardSet1QuestionIssue(question, safeWeakness, previousQuestions);
    const actualTopic = resolveQuestionTopic(question, keywordLists, topics, selectedTopic);
    const acceptedTopic = actualTopic || selectedTopic;
    if (isHard && !issue && selectedTopic && !actualTopic) {
      issue = 'Stay within the allowed hard topics for this role and include a relevant technical concept.';
    }
    if (!issue) {
      if (isMedium || isHard) rememberQuestionTopic(previousQuestions, question, acceptedTopic);
      return question;
    }
    console.warn('[aiSet1Generator] Rejected question:', JSON.stringify({
      role: roleData.id, difficulty, focus: safeWeakness, topic: selectedTopic, attempt: attempt + 1, reason: issue, draft: raw.slice(0, 500),
    }));
    if (attempt === maxAttempts - 1) {
      const fallback = selectSet1QuestionFallback(roleData.id, difficulty, safeWeakness,
        setData, previousQuestions, selectedTopic);
      if (fallback) {
        rememberQuestionTopic(previousQuestions, fallback.question, fallback.topic);
        console.warn('[aiSet1Generator] Using reviewed fallback:', JSON.stringify({ role: roleData.id, difficulty, focus: safeWeakness, topic: fallback.topic }));
        return fallback.question;
      }
      throw new Error(`Question service could not produce a suitable ${isHard ? 'hard' : isMedium ? 'medium' : 'easy'} question. Please retry.`);
    }
    request.messages = [...request.messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: `Revise the last question: ${issue} Keep the same role, difficulty, and focus. Prefer the selected topic, but another allowed role topic is acceptable. Return only the revised question.` },
    ];
  }
}

const SET1_SCORING_SYSTEM_PROMPT = `You are a strict, objective IT interview scoring engine and coach.
Your task is to evaluate a student's spoken answer against the specific interview question.
You must respond with ONLY a valid JSON object.

### STEP 1 — SCORING RULES
Score each dimension from 1 to 5:
- clarity_score: How well-organised, articulate, and easy to follow is the answer?
- correctness_score: Are the claims and supplied items relevant and factually accurate? Judge missing requested coverage separately under completeness.
- completeness_score: How thoroughly does the answer cover the specific points the question is asking about?

### STEP 2 — COACHING TIP & INTERVIEWER REPLY
Based on the answer, provide two separate strings:
1. "tip": Exactly ONE SENTENCE of actionable feedback for the AI Coach panel (e.g. "Next time, try to explain the trade-offs more clearly.").
2. "interviewer_reply": A warm, welcoming, and encouraging response from the interviewer. It must consist of exactly two sentences:
   - Sentence 1: A supportive and conversational acknowledgment validating their response (e.g. "That is a really clear and well-structured explanation!").
   - Sentence 2: A brief, positive piece of coaching advice or reinforcement based on their answer (e.g. "Next time, try adding a quick real-world example to make it even stronger.").
   - STRICT RULES:
     - It MUST NOT end with a question or ask any questions.
     - It MUST NOT introduce the next topic or mention the next question.
     - Keep the tone warm, friendly, encouraging, and supportive.

Return exactly this shape:
{
  "clarity_score": <integer 1-5>,
  "correctness_score": <integer 1-5>,
  "completeness_score": <integer 1-5>,
  "tip": "<1-sentence string>",
  "interviewer_reply": "<exactly two sentences warm reply>"
}`;

const SET1_SCORING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "set1_scoring_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        clarity_score: { type: "integer", description: "Clarity score 1-5" },
        correctness_score: {
          type: "integer",
          description: "Correctness score 1-5",
        },
        completeness_score: {
          type: "integer",
          description: "Completeness score 1-5",
        },
        tip: {
          type: "string",
          description: "One sentence actionable feedback tip",
        },
        interviewer_reply: {
          type: "string",
          description:
            "Exactly two sentences warm interviewer reply, no questions, no next topic mentions",
        },
      },
      required: [
        "clarity_score",
        "correctness_score",
        "completeness_score",
        "tip",
        "interviewer_reply",
      ],
      additionalProperties: false,
    },
  },
};

/**
 * Evaluates a Set 1 answer, returning 3C scores (for backend aggregation)
 * and a 1-sentence tip (for immediate frontend display).
 *
 * @param {string} question - The generated question that was asked
 * @param {string} transcript - The user's spoken answer
 * @param {string} difficulty - Session difficulty level ("easy" | "medium" | "hard")
 * @returns {Promise<{ clarity_score: number, correctness_score: number, completeness_score: number, tip: string, interviewer_reply: string }>}
 */
async function evaluateSet1Answer(question, transcript, difficulty = "easy", requestOptions) {
  const fallbackTip = difficulty === 'hard'
    ? isItemListTask(question, 3)
      ? 'Give three distinct relevant items from the category requested.'
      : 'Address the specific mechanism, distinction, or outcome requested.'
    : difficulty === 'medium'
    ? "Address the specific concept or items requested in the question."
    : "Try to provide a bit more detail next time to fully address the question.";
  if (!transcript || transcript.trim().length === 0) {
    return {
      clarity_score: 1,
      correctness_score: 1,
      completeness_score: 1,
      tip: "I didn't catch an answer that time; don't be afraid to take a breath and try again.",
      interviewer_reply:
        "No worries, I didn't quite catch that. Take a breath and let's keep going.",
    };
  }

  const difficultyRubric = difficulty === 'hard' ? HARD_SET1_SCORING : getEvaluatorRubric(difficulty);
  const mediumScoringContext = difficulty === 'medium' ? `\n\nMEDIUM SET 1 SCORING:
Judge clarity by whether the requested concept or mechanism is understandable, correctness by factual accuracy, and completeness by coverage of the specific requested points.
For a two-item list, two distinct valid items are sufficient; do not require their definitions or examples. For a comparison, a correct relevant distinction is sufficient.
Do not demand extra reasoning, trade-offs, syntax, or implementation beyond the task. Match coaching to these same expectations.` : '';
  const listScoringContext = isItemListTask(question, 2) || isItemListTask(question, 3)
    ? `\n\n${SET1_ITEM_LIST_SCORING}` : '';
  const systemPrompt = `${SET1_SCORING_SYSTEM_PROMPT}\n\n${difficultyRubric}${mediumScoringContext}${listScoringContext}`;

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 2000,
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
  }, requestOptions);

  const raw = response.choices?.[0]?.message?.content || "";
  const parsed = safeParseJSON(raw);

  const scoreKeys = ["clarity_score", "correctness_score", "completeness_score"];
  if (!parsed || !scoreKeys.every(key => Number.isInteger(parsed[key]) && parsed[key] >= 1 && parsed[key] <= 5)) {
    throw new Error("Evaluation service returned invalid scores. Please retry.");
  }

  console.log(
    `[aiSet1Generator] Evaluated using: ${response.model || EVALUATOR_MODEL} (via DeepSeek V3)`,
  );

  return {
    clarity_score: parsed.clarity_score,
    correctness_score: parsed.correctness_score,
    completeness_score: parsed.completeness_score,
    tip:
      typeof parsed.tip === "string" && parsed.tip.trim() ? parsed.tip.trim() :
      fallbackTip,
    interviewer_reply:
      typeof parsed.interviewer_reply === "string" && parsed.interviewer_reply.trim() ? parsed.interviewer_reply.trim() :
      "That was a solid start. Let's build on that in the next parts.",
  };
}

module.exports = {
  generateSet1Question,
  evaluateSet1Answer,
};

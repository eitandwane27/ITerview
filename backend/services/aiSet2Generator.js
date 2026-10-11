// backend/services/aiSet2Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Set 2: Technical Mastery — Role-Specific Technical Knowledge
// Generates and evaluates technical interview questions that test actual
// role-specific skills based on the candidate's chosen role and difficulty.
// No weakness personalization is used for Set 2.
//
// DESIGN NOTES:
//   Set 2 → tests TECHNICAL MASTERY.
//   Questions are generated purely based on the role and difficulty level.
//   The questions ask candidates to reason through practical scenarios,
//   diagnose simple symptoms/bugs, or explain basic technical mechanics.
//
// TTS SAFETY NOTE:
//   All generated questions are spoken aloud by a TTS engine.
//   NO code snippets, backticks, angle brackets, or programming syntax
//   may appear in any question text.
// ─────────────────────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");
const { getRoleConfig, getRoleSetConfig, getRoleRestrictions } = require("../config/roleConfig");
const { getEvaluatorRubric, HARD_TECHNICAL_SCORING } = require("../config/evaluatorRubrics");
const { sanitizeTTS } = require("../utils/ttsSanitizer");
const { getEasySet2QuestionIssue } = require("../utils/easySet2QuestionGuard");
const { getMediumSet2QuestionIssue } = require("../utils/mediumQuestionGuard");
const { getHardSet2QuestionIssue } = require('../utils/hardSet2QuestionGuard');
const { HARD_TECHNICAL_QUESTION_STYLE } = require('../config/hardTechnicalConfig');
const { normalizeQuestionDraft } = require('../utils/questionWording');
const { getQuestionTopicCoverage, rememberQuestionTopic, resolveQuestionTopic } = require("../utils/questionTopicCoverage");
const { getTechnicalQuestionFormat, selectTechnicalQuestionFormat, rememberTechnicalQuestionFormat } = require("../utils/technicalQuestionVariety");
const { EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS, HARD_TECHNICAL_FORMATS } = require('../config/technicalQuestionFormats');
const { selectTechnicalQuestionFallback } = require('../utils/technicalQuestionFallback');
const { safeParseJSON } = require("../utils/jsonParser");
const { EASY_AVOID_LIST: GLOBAL_EASY_AVOID_LIST, EASY_TECHNICAL_QUESTION_STYLE, MEDIUM_AVOID_LIST, MEDIUM_TECHNICAL_QUESTION_STYLE, HARD_AVOID_LIST, TTS_SAFETY } = require("../config/guardConfig");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const EVALUATOR_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";


// ─────────────────────────────────────────────────────────────────────────────


/**
 * Generates a role-specific Set 2 (Technical Mastery) interview question based on the user's role and difficulty.
 *
 * @param {string} role         - A registered role ID from roleConfig.js
 * @param {string} difficulty   - easy | medium | hard
 * @param {Array<string>} previousQuestions - questions already asked this session
 * @returns {Promise<string>} The generated question
 */
async function generateSet2Question(
  role = "fullstack",
  difficulty = "easy",
  previousQuestions = [],
) {
  // ── Resolve role config from registry ─────────────────────────────────────
  const roleData = getRoleConfig(role);
  const formattedRole = roleData.label;
  const setData = getRoleSetConfig(roleData, 'set2', difficulty);

  // ── Resolve Difficulty Configurations dynamically ───────────────────────────
  const isHard = difficulty === "hard";
  const isMedium = difficulty === "medium";
  const isEasy = !isHard && !isMedium;
  const selectedFormat = selectTechnicalQuestionFormat(difficulty, previousQuestions);

  let examplePool = [];
  if (isHard) {
    examplePool = setData.hardExamples || [];
  } else if (isMedium) {
    examplePool = setData.mediumExamples || [];
  } else {
    examplePool = setData.easyExamples || [];
  }

  const difficultyLabel = isHard
    ? "Hard (Advanced Junior Candidate)"
    : isMedium
    ? "Medium (Conceptual Application / Junior Candidate)"
    : "Easy (Entry Level / Fresh Graduate)";

  const difficultyContext = isHard
    ? `The candidate is an advanced junior with strong academic or personal-project understanding and no required commercial experience. Test causal mechanisms, consequences, trade-offs, failure risks, tests, and justified safeguards using at most three connected reasoning steps.`
    : isMedium
    ? `The candidate is a fresh IT graduate who has practiced core concepts in small academic or personal projects. They can explain a mechanism or purpose, compare concepts, predict behavior, propose two tests, apply a concept, diagnose a simple symptom, or justify a bounded decision. They have no production or commercial team experience. Require at most two reasoning steps, without advanced tooling knowledge.`
    : `The candidate is a fresh IT graduate or IT student with introductory classroom exposure and limited confidence in this specialty. They may prefer a different area of IT and may not have completed a project in this role.
They have ZERO commercial work experience and have never worked on a production codebase.
Questions must be answerable by someone who has only studied textbook concepts and done basic lab exercises.
Do NOT assume they have debugged production bugs, used command-line tools professionally, or memorized API method signatures.
The question should feel approachable and confidence-building — not intimidating.`;

  const avoidList = `${getRoleRestrictions(roleData, difficulty)}\n\n${
    isHard ? HARD_AVOID_LIST : isMedium ? MEDIUM_AVOID_LIST : GLOBAL_EASY_AVOID_LIST
  }\n\n${TTS_SAFETY}`;

  // ── Build calibration examples section ────────────────────────────────────
  let examplesSection = "";
  if (examplePool && examplePool.length > 0) {
    const formatExamples = selectedFormat
      ? examplePool.filter(question => getTechnicalQuestionFormat(question) === selectedFormat.id)
      : examplePool;
    const shuffled = [...formatExamples].sort(() => Math.random() - 0.5);
    const benchmarkSamples = shuffled
      .slice(0, 2)
      .map((q, i) => `  ${i + 1}. ${q}`)
      .join("\n");
    examplesSection = isEasy ? `
INTRODUCTORY TECHNICAL BENCHMARKS — match the small task and introductory difficulty; the preferred format guides the wording:
${benchmarkSamples}

These examples guide difficulty and format, not topic selection. Stay within the allowed role topics. Familiar wording and fundamental concepts are welcome; do not increase difficulty to avoid resembling an example.` : isMedium ? `
JUNIOR TECHNICAL BENCHMARKS — match the focused task and conceptual demand; the preferred format guides the wording:
${benchmarkSamples}

These examples guide difficulty and format, not topic selection. Stay within the allowed role topics; do not increase difficulty to avoid resembling an example.` : `
ADVANCED JUNIOR TECHNICAL BENCHMARKS — match the reasoning demand; the preferred format guides the wording:
${benchmarkSamples}

These examples guide difficulty and format, not topic selection. Stay within the allowed role topics and test a different mechanism or consequence; do not increase difficulty merely to avoid resembling an example.`;
  }

  // ── Build topic scope ─────────────────────────────────────────────────────
  const topics = setData.topicScope || [];
  const keywordLists = setData.topicKeywords || [];
  const technicalCoverage = getQuestionTopicCoverage(previousQuestions, keywordLists, topics);
  let selectedTopic = "";
  if (topics.length > 0) {
    const topicScores = topics.map((topic, index) => {
      return { index, score: technicalCoverage[index], topic };
    });

    const minScore = Math.min(...topicScores.map((t) => t.score));
    const candidates = topicScores.filter((t) => t.score === minScore);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    selectedTopic = chosen.topic;
  }

  const topicScope = topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n");

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are a friendly and supportive IT interview coach writing role-specific technical practice questions.
You are creating ONE question for a ${difficultyLabel} candidate practicing for a ${formattedRole} interview.

CANDIDATE PROFILE:
${difficultyContext}

QUESTION FORMAT AND DIFFICULTY:
${isHard
  ? 'Ask one bounded advanced-junior task, preferably in the selected format: a causal mechanism, purpose under a risk, focused trade-off, prediction, two tests, constrained application, evidence-based diagnosis, or justified decision. Require at most three connected reasoning steps.'
  : isMedium
    ? 'Ask one focused junior technical task, preferably in the selected format. Allow explanation, comparison, prediction, testing, application, diagnosis, or a bounded decision, requiring at most two reasoning steps.'
    : 'Ask one introductory technical task, preferably in the selected format. Allow a concept, purpose, comparison, prediction, two simple checks, or a practical action; require at most one reasoning step.'}
Use one clear sentence. Calibrate terminology and difficulty using the role-specific benchmarks below.
${isEasy ? `\n${EASY_TECHNICAL_QUESTION_STYLE}` : ""}
${isMedium ? `\n${MEDIUM_TECHNICAL_QUESTION_STYLE}` : ""}
${isHard ? `\n${HARD_TECHNICAL_QUESTION_STYLE}` : ""}
${selectedFormat ? `
SELECTED QUESTION FORMAT: ${selectedFormat.id}
${selectedFormat.instruction}
This is the preferred format. Another format allowed for this difficulty is acceptable when it produces a clearer question.
Prefer unasked formats and open questions. Format variety and limiting two-choice questions are preferences, not reasons to reject an otherwise suitable task.
Do not turn a purpose, comparison, or explanation into a situation followed by naming a fix.
` : ''}

ALLOWED TOPICS — Your question MUST come from one of these topics only:
${topicScope}

PREFERRED TOPIC FOCUS:
Prefer a question specifically targeting this topic: "${selectedTopic}".
Another topic from the allowed role and difficulty scope is acceptable. Keep the task role-specific and at the requested difficulty.

CRITICAL TTS RULE: Do NOT include backticks, dot-notation, slashes, angle brackets, curly braces, or any programming syntax. Do NOT write any property or method name using dot access \u2014 always use plain English descriptions (e.g. describe a property by saying "the [name] property" and a method by saying "the [name] method"). The question is read aloud by a TTS engine \u2014 every character you write will be spoken literally.

STRICT CONSTRAINTS:
${avoidList}
${examplesSection}

OUTPUT RULE:
- Return ONLY the final question string.
- Do NOT include any self-correction, revision markers, arrows (->), or "I made a change" commentary.
- Do NOT show a draft followed by a corrected version.
- No introduction, no explanation, no quotes, no numbering. Just the single, final question itself.`;

  // ── Messages ──────────────────────────────────────────────────────────────
  const allExcluded = previousQuestions;
  const messages = [{ role: "system", content: systemPrompt }];

  if (allExcluded.length > 0) {
    messages.push({
      role: "user",
      content: isEasy
        ? `Generate one introductory technical question, preferably in the selected format. Avoid repeating the same task or fact tested by these already-asked questions; changing only the wording is not enough:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPrefer the selected topic within the allowed role scope and keep the task simple.`
        : isMedium
          ? `Generate one focused junior technical question, preferably in the selected format. Avoid the same task or fact tested by these already-asked questions; changing only the wording is not enough:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nKeep the role and difficulty and prefer the selected topic and format, requiring at most two reasoning steps.`
          : `Generate one advanced-junior question in the selected topic and format. Avoid the same mechanism, consequence, or decision tested by these questions, even with different wording:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nRequire at most three connected reasoning steps.`,
    });
  } else {
    messages.push({
      role: "user",
      content:
        "Generate the first technical interview question for this candidate.",
    });
  }

  const request = {
    model: EVALUATOR_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 2000,
    thinking: { type: "disabled" },
  };

  // At most two repairs for recognizable violations at every difficulty. Provider failures
  // propagate immediately. Exhausted quality repairs may use a validated bank
  // question; rejected drafts never become fallback content.
  const maxAttempts = 3;
  const acceptedFormats = isHard ? HARD_TECHNICAL_FORMATS : isMedium ? MEDIUM_TECHNICAL_FORMATS : EASY_TECHNICAL_FORMATS;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await deepseek.chat.completions.create(request);
    const raw = normalizeQuestionDraft(response.choices?.[0]?.message?.content || '');
    if (!raw) throw new Error('Question service returned an empty question.');
    const question = sanitizeTTS(raw);
    if (!question) throw new Error('Question service returned an empty question.');
    let issue = isEasy
      ? getEasySet2QuestionIssue(raw, previousQuestions, acceptedFormats) || getEasySet2QuestionIssue(question, previousQuestions, acceptedFormats)
      : isMedium ? getMediumSet2QuestionIssue(raw, previousQuestions, acceptedFormats)
        || getMediumSet2QuestionIssue(question, previousQuestions, acceptedFormats)
        : getHardSet2QuestionIssue(raw, previousQuestions, acceptedFormats)
          || getHardSet2QuestionIssue(question, previousQuestions, acceptedFormats);
    const actualTopic = resolveQuestionTopic(question, keywordLists, topics, selectedTopic);
    if (isHard && !issue && selectedTopic && !actualTopic) {
      issue = 'Stay within the allowed hard topics for this role and include a relevant technical concept.';
    }
    if (!issue) {
      rememberQuestionTopic(previousQuestions, question, actualTopic || selectedTopic);
      rememberTechnicalQuestionFormat(previousQuestions, question, getTechnicalQuestionFormat(question));
      return question;
    }
    console.warn('[aiSet2Generator] Rejected question:', JSON.stringify({
      role: roleData.id, difficulty, attempt: attempt + 1,
      topic: selectedTopic, preferredFormat: selectedFormat.id,
      detectedFormat: getTechnicalQuestionFormat(question), reason: issue,
      draft: raw.slice(0, 500),
    }));
    if (attempt === maxAttempts - 1) {
      const fallback = selectTechnicalQuestionFallback(roleData.id, difficulty, setData,
        previousQuestions, selectedTopic, selectedFormat.id);
      if (fallback) {
        rememberQuestionTopic(previousQuestions, fallback.question, fallback.topic);
        rememberTechnicalQuestionFormat(previousQuestions, fallback.question, fallback.format);
        console.warn('[aiSet2Generator] Using reviewed fallback:', JSON.stringify({
          role: roleData.id, difficulty, topic: fallback.topic, format: fallback.format,
        }));
        return fallback.question;
      }
      throw new Error(`Question service could not produce a suitable ${isHard ? 'hard' : isMedium ? 'medium' : 'easy'} technical question. Please retry.`);
    }
    const formatInstruction = `Keep the same role and difficulty. Prefer the selected topic and ${selectedFormat.id} format; another allowed role topic or format is acceptable. Allowed formats: ${acceptedFormats.join(', ')}.`;
    request.messages = [...request.messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: `Revise the last question: ${issue} ${formatInstruction} Ask only one focused technical task${isHard ? ' requiring at most three connected reasoning steps' : isMedium ? ' requiring at most two reasoning steps' : ''}. Return only the revised question.` },
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const SET2_SCORING_SYSTEM_PROMPT = `You are a strict, objective IT interview scoring engine and coach.
Your task is to evaluate a student's spoken answer to a TECHNICAL interview question.
You must respond with ONLY a valid JSON object.

### STEP 1 — SCORING RULES
Score each dimension from 1 to 5:
- problem_solving_score: Did the candidate reason through the problem logically and arrive at a workable approach?
- accuracy_score: Is the technical content of the answer correct? Are there factual errors or misconceptions?
- depth_score: How much technical detail and understanding does the answer demonstrate beyond a surface-level response?

### STEP 2 — COACHING TIP & INTERVIEWER REPLY
1. "tip": Exactly ONE SENTENCE of actionable technical coaching matched to the task and difficulty (e.g. "Connect your choice to the situation described in the question.").
2. "interviewer_reply": A warm and encouraging conversational reply from the interviewer consisting of EXACTLY TWO SENTENCES:
   - Sentence 1: A warm, supportive acknowledgment validating the candidate's response (e.g. "That is a really solid approach to the problem!").
   - Sentence 2: A brief, positive piece of coaching reinforcement or encouragement matched to the task (e.g. "Keep matching your choice to what the application needs.").
   - STRICT CONSTRAINT: Do NOT end with a question, do NOT ask any questions, and do NOT mention or introduce the next question or topic.

Return exactly this shape:
{
  "problem_solving_score": <integer 1-5>,
  "accuracy_score": <integer 1-5>,
  "depth_score": <integer 1-5>,
  "tip": "<1-sentence string>",
  "interviewer_reply": "<exactly two sentences, no questions, no next-topic mentions>"
}`;

const SET2_SCORING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "set2_scoring_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        problem_solving_score: {
          type: "integer",
          description: "Problem solving score 1-5",
        },
        accuracy_score: {
          type: "integer",
          description: "Technical accuracy score 1-5",
        },
        depth_score: {
          type: "integer",
          description: "Technical depth score 1-5",
        },
        tip: {
          type: "string",
          description: "One sentence actionable technical coaching tip",
        },
        interviewer_reply: {
          type: "string",
          description:
            "Exactly two sentences warm interviewer reply, no questions, no next topic mentions",
        },
      },
      required: [
        "problem_solving_score",
        "accuracy_score",
        "depth_score",
        "tip",
        "interviewer_reply",
      ],
      additionalProperties: false,
    },
  },
};

/**
 * Evaluates a Set 2 (Technical Mastery) answer.
 *
 * @param {string} question   - The technical question that was asked
 * @param {string} transcript - The user's spoken answer
 * @param {string} difficulty - Session difficulty level ("easy" | "medium" | "hard")
 * @returns {Promise<{ problem_solving_score, accuracy_score, depth_score, tip, interviewer_reply }>}
 */
async function evaluateSet2Answer(question, transcript, difficulty = "easy", requestOptions) {
  const isEasy = difficulty !== 'medium' && difficulty !== 'hard';
  const isMedium = difficulty === 'medium';
  const answerFormat = getTechnicalQuestionFormat(question);
  const taskTips = {
    concept: 'Describe what the concept means or how it works in your own words.',
    purpose: 'Connect the practice to the purpose asked about.',
    comparison: 'State the key difference between the two concepts.',
    prediction: 'State the outcome that follows from the given conditions.',
    testing: 'Give two distinct test cases or checks for the requested behavior.',
    application: 'Name a suitable action for the stated need.',
    diagnosis: 'Connect a likely cause or focused check to the stated symptom.',
    decision: 'Connect the preferred approach to the stated requirement.',
  };
  const hardTaskTips = {
    ...taskTips,
    concept: 'Connect the mechanism to the specific effect asked about.',
    purpose: 'Connect the safeguard or optimization to the stated risk.',
    comparison: 'Compare the approaches on the consequence or trade-off asked about.',
    prediction: 'Use the stated timing or concurrency conditions to explain the outcome.',
    testing: 'Give two distinct tests that exercise the stated failure risk or interaction.',
    application: 'Match a concrete safeguard or optimization to the stated constraint.',
    diagnosis: 'Use the given evidence to support a likely cause or focused check.',
    decision: 'Justify the preferred approach against the stated constraint.',
  };
  const fallbackTip = (isEasy || isMedium ? taskTips : hardTaskTips)[answerFormat];
  if (!transcript || transcript.trim().length === 0) {
    return {
      problem_solving_score: 1,
      accuracy_score: 1,
      depth_score: 1,
      tip: fallbackTip,
      interviewer_reply: "I didn't quite catch that, but let's keep going.",
    };
  }

  const difficultyRubric = isEasy || isMedium ? getEvaluatorRubric(difficulty) : HARD_TECHNICAL_SCORING;
  const easyScoringContext = isEasy
    ? `\n\nEASY TECHNICAL SCORING:
Evaluate only the task the question asks. A short correct answer can earn high scores without an unsolicited explanation or example. An explanation or reason explicitly requested by the question must be present.
For problem solving, judge the understanding or application needed for this one-step introductory task; do not require multiple steps or spoken reasoning when the question does not request them.
For depth, judge sufficient understanding for this introductory task, not extra technical detail. Do not require exact property or method names unless the question explicitly asks for them.
Accept technically valid alternatives that meet the stated need, rather than assuming one hidden preferred answer.
For questions with two stated alternatives, accuracy can be high for the correct option. Do not infer detailed reasoning or depth merely from choosing an option, and do not demand an explanation the question did not request. Grade understanding against the limited task actually asked.
The tip and interviewer reply must follow the same standard: reinforce a sufficient correct answer; do not ask for extra steps, syntax, method names, or an explanation the question did not request.`
    : '';
  const mediumScoringContext = isMedium ? `\n\nMEDIUM TECHNICAL SCORING:
For problem solving, judge the reasoning, mechanism, distinction, prediction, tests, or action actually requested. For accuracy, judge factual correctness. For depth, judge sufficient understanding for this junior task, requiring at most two reasoning steps.
A concise correct answer can earn high scores without an unsolicited explanation or implementation. A requested mechanism, comparison, or reason must be answered, rather than replaced with a term or option alone. Accept technically valid alternatives that meet the need; do not require a hidden preferred method or exact API name.
Do not reward merely repeating the symptom, but do not demand broad investigations, production experience, or unasked trade-offs. Match the tip and interviewer reply to this task and reinforce sufficient correct answers.` : '';
  const formatScoringContext = `\n\nREQUESTED TECHNICAL FORMAT: ${answerFormat}
Concept: assess the requested meaning or mechanism. Purpose: assess why it is useful. Comparison: assess the key distinction. Prediction: assess the stated outcome. Testing: require exactly two distinct relevant cases or checks; one case is incomplete. Application: assess a fitting action. Diagnosis: assess a cause or check supported by the evidence. Decision: assess the reason against the stated requirement.
Keep feedback specific to this task. Do not praise an incorrect answer as correct; acknowledge the effort and gently correct the misconception. Do not penalize hesitation or filler words as technical errors.
If the question has a contradictory or underspecified premise, acknowledge the limitation and accept a reasonable clarification or conditional answer instead of inventing a hidden correct answer.`;
  const systemPrompt = `${SET2_SCORING_SYSTEM_PROMPT}\n\n${difficultyRubric}${easyScoringContext}${mediumScoringContext}${formatScoringContext}`;

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Technical Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 2000,
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
  }, requestOptions);

  const raw = response.choices?.[0]?.message?.content || "";
  const parsed = safeParseJSON(raw);

  const scoreKeys = ["problem_solving_score", "accuracy_score", "depth_score"];
  if (!parsed || !scoreKeys.every(key => Number.isInteger(parsed[key]) && parsed[key] >= 1 && parsed[key] <= 5)) {
    throw new Error("Evaluation service returned invalid scores. Please retry.");
  }

  console.log(`[aiSet2Generator] Evaluated using: ${response.model || EVALUATOR_MODEL} (via DeepSeek)`);

  return {
    problem_solving_score: parsed.problem_solving_score,
    accuracy_score: parsed.accuracy_score,
    depth_score: parsed.depth_score,
    tip:
      typeof parsed.tip === "string" && parsed.tip.trim() ? parsed.tip.trim() :
      fallbackTip,
    interviewer_reply:
      typeof parsed.interviewer_reply === "string" && parsed.interviewer_reply.trim() ? parsed.interviewer_reply.trim() : "Alright, thank you for that.",
  };
}

module.exports = {
  generateSet2Question,
  evaluateSet2Answer,
};

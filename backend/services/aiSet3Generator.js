// backend/services/aiSet3Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Set 3: Behavioral Interview — STAR Method Practice
// Generates and evaluates behavioral interview questions for fresh graduates
// and IT students using the STAR (Situation, Task, Action, Result) framework.
//
// DESIGN NOTES:
//   Set 3 → tests BEHAVIORAL COMPETENCIES.
//   Each question is mapped 1-to-1 to a specific competency pillar
//   based on the question index (0–4). This guarantees every mock interview
//   covers all 5 critical behavioral dimensions in a balanced order.
//
//   Q1 → Teamwork & Collaboration
//   Q2 → Adaptability & Learning Speed
//   Q3 → Conflict Resolution
//   Q4 → Resilience & Handling Failure
//   Q5 → Problem Solving & Initiative
//
// TTS SAFETY NOTE:
//   All generated questions are spoken aloud by a TTS engine.
//   NO code snippets, backticks, angle brackets, or programming syntax
//   may appear in any question text. All questions must be written in
//   plain, natural, conversational English only.
// ─────────────────────────────────────────────────────────────────────────────

const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const EVALUATOR_MODEL = "llama-3.3-70b-versatile";

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL COMPETENCY PILLARS — 5 total, one per question slot.
// Each entry defines:
//   - topic:       The behavioral dimension being tested.
//   - instruction: How the LLM should frame the question.
//   - examples:    2 curated benchmark questions (STAR-compatible, TTS-safe).
//
// These examples anchor the LLM to the correct difficulty and framing style.
// All examples are written for fresh graduates with NO commercial experience.
// Candidates should be able to draw from academic projects, group labs,
// personal coding ventures, internships, or hackathons.
// ─────────────────────────────────────────────────────────────────────────────
const BEHAVIORAL_COMPETENCIES = [
  {
    // Q1 (index 0)
    topic: "Teamwork & Collaboration",
    instruction: `Ask the candidate about a time they worked on a group project, focusing on how they collaborated with classmates or team members using simple, clear words.`,
    examples: [
      "Tell me about a time you worked on a group programming project and how your team divided the tasks.",
      "Describe a time you collaborated with classmates on a coding assignment to achieve a shared goal.",
    ],
  },
  {
    // Q2 (index 1)
    topic: "Adaptability & Learning Speed",
    instruction: `Ask the candidate about a time they had to learn a new tool or coding concept quickly for a project, using simple and direct language.`,
    examples: [
      "Tell me about a time you had to learn a new coding language or tool quickly to finish a project.",
      "Describe a situation where you had to learn a new technology from scratch for a school assignment.",
    ],
  },
  {
    // Q3 (index 2)
    topic: "Conflict Resolution",
    instruction: `Ask the candidate about a time they had a disagreement with a project partner or classmate and how they talked through it, using simple synonyms.`,
    examples: [
      "Tell me about a time you disagreed with a classmate on how to build a feature or solve a coding problem.",
      "Describe a group project where you had to deal with a team member who was not doing their share of the work.",
    ],
  },
  {
    // Q4 (index 3)
    topic: "Resilience & Handling Failure",
    instruction: `Ask the candidate about a time a project did not go as planned, such as a bug they struggled to fix or a missed deadline, using simple language.`,
    examples: [
      "Tell me about a time a programming project did not work out or failed to meet its goals.",
      "Describe a time you made a mistake on a coding assignment and how you corrected it.",
    ],
  },
  {
    // Q5 (index 4)
    topic: "Problem Solving & Initiative",
    instruction: `Ask the candidate about a time they solved a hard coding problem or improved a project without being asked to, using simple and clear terms.`,
    examples: [
      "Tell me about the most difficult programming bug you encountered and the steps you took to solve it.",
      "Describe a time you decided to clean up or improve a project's codebase on your own initiative.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STRICT AVOID LIST — hard guardrails for behavioral question generation.
// These prevent the LLM from producing off-topic, too-advanced, or unsafe output.
// ─────────────────────────────────────────────────────────────────────────────
const BEHAVIORAL_AVOID_LIST = `STRICT TOPIC BAN — Do NOT generate any of the following:
- Technical questions: Do NOT ask about code, algorithms, system design, or anything requiring a technical/factual answer.
- Hypothetical future scenarios using "What would you do if...": The question MUST ask about a REAL past experience ("Tell me about a time...", "Describe a situation...", "Give me an example...").
- Questions requiring commercial work experience: The candidate is a fresh graduate. All questions must be answerable with academic projects, personal projects, group coursework, hackathons, or internships.
- Multi-part or compound questions: The question MUST be a single, clear sentence. Avoid appending secondary clauses or sub-questions (like "and tell me what you learned" or "and describe how you felt"). The candidate already knows to use the STAR method. Keep it to a single main question with simple synonyms.
- Overly vague or generic openers like "Tell me about yourself" or "What are your strengths?": These are not behavioral STAR questions.
- Any self-reflection or opinion questions: The question must ask about a SPECIFIC past event, not the candidate's general personality or preferences.
- TTS SAFETY: Do NOT include any code snippets, backtick characters, angle brackets, or programming syntax in the question text. The question is read aloud by a text-to-speech engine. All questions must be written in plain, natural English only.`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a behavioral Set 3 interview question for the given question slot.
 * The competency pillar is determined by the number of previousQuestions already asked.
 *
 * @param {Array<string>} previousQuestions - Questions already asked this session (0 = Q1, 1 = Q2, etc.)
 * @param {string} difficulty               - easy | medium | hard (only easy implemented now)
 * @returns {Promise<string>} The generated behavioral question
 */
async function generateSet3Question(
  previousQuestions = [],
  difficulty = "easy",
) {
  // ── Map the current question slot to a behavioral competency ──────────────
  const competencyIndex = Math.min(
    previousQuestions.length,
    BEHAVIORAL_COMPETENCIES.length - 1,
  );
  const competency = BEHAVIORAL_COMPETENCIES[competencyIndex];

  // ── LOCKED TO EASY ONLY ───────────────────────────────────────────────────
  const difficultyLabel = "Easy (Entry Level / Fresh Graduate)";
  const difficultyContext = `The candidate is a fresh IT graduate or IT student with mostly academic knowledge and personal project experience.
They have no commercial work experience. All behavioral questions must be answerable using group projects, coursework, personal coding projects, hackathons, or brief internships.`;

  // ── Build calibration examples section ────────────────────────────────────
  const shuffledExamples = [...competency.examples].sort(
    () => Math.random() - 0.5,
  );
  const benchmarkSamples = shuffledExamples
    .slice(0, 2)
    .map((q, i) => `  ${i + 1}. ${q}`)
    .join("\n");

  const examplesSection = `DIFFICULTY BENCHMARK — these questions represent the EXACT difficulty, style, and STAR-framing you must match:
${benchmarkSamples}

IMPORTANT: Do NOT repeat or closely paraphrase these examples. Generate a DIFFERENT, NOVEL question targeting the same competency at the same level.`;

  const curationBlacklist = competency.examples;

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are an experienced HR interviewer and career coach generating behavioral interview practice questions.
You are creating a question for a ${difficultyLabel} candidate applying for an IT role.

CANDIDATE PROFILE:
${difficultyContext}

CURRENT BEHAVIORAL COMPETENCY TO TEST:
Target: ${competency.topic}
Instructions: ${competency.instruction}

QUESTION FORMAT REQUIREMENTS:
1. The question MUST be a past-experience behavioral question that invites a STAR-structured response.
2. Use openers such as: "Tell me about a time...", "Describe a situation where...", "Give me an example of...", "Can you walk me through a time when..."
3. The question must be a SINGLE, clear sentence using simple synonyms. No compound questions. No sub-questions. Aim for a comfortable length (15 to 25 words) that gives clear context without being wordy.
4. The question must feel natural and conversational when spoken aloud in an interview setting.

${BEHAVIORAL_AVOID_LIST}

${examplesSection}

OUTPUT RULE:
- Return ONLY the final question string.
- Do NOT include any self-correction, revision markers, arrows (->), or "I made a change" commentary.
- Do NOT show a draft followed by a corrected version.
- No introduction, no explanation, no quotes, no numbering. Just the single, final question itself.`;

  // ── Messages ──────────────────────────────────────────────────────────────
  const allExcluded = [...previousQuestions, ...curationBlacklist];
  const messages = [{ role: "system", content: systemPrompt }];

  if (allExcluded.length > 0) {
    messages.push({
      role: "user",
      content: `Generate a fresh, novel behavioral question about "${competency.topic}". Do NOT repeat or closely paraphrase any of these:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nNow generate one original question.`,
    });
  } else {
    messages.push({
      role: "user",
      content: `Generate the first behavioral interview question about "${competency.topic}" for this candidate.`,
    });
  }

  const response = await groq.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages,
    temperature: 0.65,
    max_tokens: 140,
  });

  const raw =
    response.choices[0]?.message?.content?.trim() ||
    "Tell me about a time you had to work closely with a team to complete a project under a tight deadline.";

  const sanitized = raw.includes(" -> ") ? raw.split(" -> ").pop().trim() : raw;
  return sanitized;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING PROMPT — evaluates using STAR dimensions
// ─────────────────────────────────────────────────────────────────────────────
const SET3_SCORING_SYSTEM_PROMPT = `You are a strict, objective HR interview scoring engine and behavioral interview coach.
Your task is to evaluate a student's spoken answer to a BEHAVIORAL interview question using the STAR framework.
You must respond with ONLY a valid JSON object.

### STEP 1 — SCORING RULES
Score each STAR dimension from 1 to 10:

- situation_score: Did the candidate clearly describe the CONTEXT and the specific challenge or task they were facing?
  (1 = no context given or very vague, 10 = clear and specific situation established)

- action_score: Did the candidate describe the SPECIFIC STEPS they personally took to address the situation?
  Award high scores for the use of "I" statements that highlight personal ownership of actions.
  Penalise answers that only say "we did this" without explaining what the candidate specifically did.
  (1 = only vague group actions described with no personal ownership, 10 = clear personal steps and reasoning explained)

- result_score: Did the candidate describe the OUTCOME of their actions and/or what they LEARNED from the experience?
  (1 = no result or lesson mentioned, 10 = concrete outcome and clear lesson or growth described)

### STEP 2 — COACHING TIP & INTERVIEWER REPLY
1. "tip": Exactly ONE SENTENCE of actionable coaching on how to improve the STAR structure (e.g. "Next time, be sure to end your answer with a specific result or what you personally learned from the situation.").
2. "interviewer_reply": A warm, encouraging reply from the interviewer consisting of EXACTLY TWO sentences:
   - Sentence 1: A warm validation of their answer (e.g. "That is a really clear and well-structured response!").
   - Sentence 2: A brief, positive piece of reinforcement or coaching (e.g. "Next time, try adding a concrete outcome to make your result even stronger.").
   - STRICT CONSTRAINT: Do NOT end with a question, ask any questions, or mention the next topic. Do NOT say anything like "Let's move on" or "Next question". The next question will be introduced separately.

Return exactly this shape:
{
  "situation_score": <integer 1-10>,
  "action_score": <integer 1-10>,
  "result_score": <integer 1-10>,
  "tip": "<1-sentence string>",
  "interviewer_reply": "<short conversational string>"
}`;

const SET3_SCORING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "set3_scoring_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        situation_score:   { type: "integer", description: "STAR Situation score 1-10" },
        action_score:      { type: "integer", description: "STAR Action score 1-10" },
        result_score:      { type: "integer", description: "STAR Result/Learning score 1-10" },
        tip:               { type: "string",  description: "One sentence actionable feedback tip to improve STAR structure" },
        interviewer_reply: { type: "string",  description: "Exactly two sentences warm interviewer reply, no questions, no next topic mentions" },
      },
      required: [
        "situation_score",
        "action_score",
        "result_score",
        "tip",
        "interviewer_reply",
      ],
      additionalProperties: false,
    },
  },
};

/**
 * Evaluates a Set 3 (Behavioral) answer using STAR scoring dimensions.
 *
 * @param {string} question   - The behavioral question that was asked
 * @param {string} transcript - The user's spoken answer
 * @returns {Promise<{ situation_score, action_score, result_score, tip, interviewer_reply }>}
 */
async function evaluateSet3Answer(question, transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return {
      situation_score: 1,
      action_score: 1,
      result_score: 1,
      tip: "I didn't catch an answer — try to walk through the situation, what you did, and what the result was.",
      interviewer_reply: "I didn't quite catch that, but let's keep going.",
    };
  }

  const response = await groq.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages: [
      { role: "system", content: SET3_SCORING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Behavioral Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 220,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[aiSet3Generator] JSON parse error. Raw response:", raw);
    return {
      situation_score: 5,
      action_score: 5,
      result_score: 5,
      tip: "Try to structure your answer by describing the situation, your specific actions, and the final result or lesson learned.",
      interviewer_reply: "Alright, thank you for sharing that.",
    };
  }

  const clamp = (n) => Math.min(10, Math.max(1, parseInt(n) || 6));

  console.log(`[aiSet3Generator] Evaluated using: ${response.model || EVALUATOR_MODEL} (via Groq)`);

  return {
    situation_score: clamp(parsed.situation_score),
    action_score: clamp(parsed.action_score),
    result_score: clamp(parsed.result_score),
    tip:
      parsed.tip ||
      "Try to structure your answer by describing the situation, your specific actions, and the final result or lesson learned.",
    interviewer_reply:
      parsed.interviewer_reply || "Alright, thank you for sharing that.",
  };
}

/**
 * Returns the behavioral competency topic for a given question index (0-4).
 * Used by the socket controller to send the topic label to the frontend.
 *
 * @param {number} index - 0-indexed question number
 * @returns {string} The topic name
 */
function getCompetencyTopic(index) {
  const safeIndex = Math.min(index, BEHAVIORAL_COMPETENCIES.length - 1);
  return BEHAVIORAL_COMPETENCIES[safeIndex].topic;
}

module.exports = {
  generateSet3Question,
  evaluateSet3Answer,
  getCompetencyTopic,
};

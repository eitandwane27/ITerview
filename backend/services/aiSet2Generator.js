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
const { getRoleConfig } = require("../config/roleConfig");
const { sanitizeTTS } = require("../utils/ttsSanitizer");
const { EASY_AVOID_LIST: GLOBAL_EASY_AVOID_LIST, TTS_SAFETY } = require("../config/guardConfig");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const EVALUATOR_MODEL = "deepseek-chat";


// ─────────────────────────────────────────────────────────────────────────────


/**
 * Generates a role-specific Set 2 (Technical Mastery) interview question based on the user's role and difficulty.
 *
 * @param {string} role         - frontend | backend | fullstack
 * @param {string} difficulty   - easy | medium | hard  (only easy implemented now)
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

  // ── LOCKED TO EASY ONLY ──────────────────────────────────────────────────
  const examplePool = roleData.set2.easyExamples || [];
  const difficultyLabel = "Easy (Entry Level / Fresh Graduate)";
  const difficultyContext = `The candidate is a fresh IT graduate or IT student who has studied web development in school and built one or two small personal projects.
They have ZERO commercial work experience and have never worked on a production codebase.
Questions must be answerable by someone who has only studied textbook concepts and done basic lab exercises.
Do NOT assume they have debugged production bugs, used command-line tools professionally, or memorized API method signatures.
The question should feel approachable and confidence-building — not intimidating.`;
  const avoidList = `${roleData.avoidList || ""}\n\n${GLOBAL_EASY_AVOID_LIST}\n\n${TTS_SAFETY}`;

  // ── Build calibration examples section ────────────────────────────────────
  let examplesSection = "";
  let curationBlacklist = [];
  if (examplePool && examplePool.length > 0) {
    const shuffled = [...examplePool].sort(() => Math.random() - 0.5);
    const benchmarkSamples = shuffled
      .slice(0, 2)
      .map((q, i) => `  ${i + 1}. ${q}`)
      .join("\n");
    examplesSection = `
DIFFICULTY BENCHMARK — these questions represent the EXACT difficulty level and style you must match:
${benchmarkSamples}

IMPORTANT: Do NOT repeat or closely paraphrase these examples. Generate a DIFFERENT, NOVEL question at the same level.`;
    curationBlacklist = examplePool;
  }

  // ── Build topic scope ─────────────────────────────────────────────────────
  const topics = roleData.set2.topicScope || [];
  const keywordLists = roleData.set2.topicKeywords || [];
  let selectedTopic = "";
  if (topics.length > 0) {
    const topicScores = topics.map((topic, index) => {
      const keywords = keywordLists[index] || [];
      let score = 0;
      previousQuestions.forEach((q) => {
        const qLower = q.toLowerCase();
        keywords.forEach((word) => {
          if (qLower.includes(word.toLowerCase())) {
            score++;
          }
        });
      });
      return { index, score, topic };
    });

    const minScore = Math.min(...topicScores.map((t) => t.score));
    const candidates = topicScores.filter((t) => t.score === minScore);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    selectedTopic = chosen.topic;
  }

  const topicScope = topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n");

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are a friendly and supportive IT interview coach writing warm-up practice questions for fresh IT graduates.
You are creating ONE question for a ${difficultyLabel} candidate practicing for a ${formattedRole} interview.

CANDIDATE PROFILE:
${difficultyContext}

━━━ WHAT MAKES A GOOD EASY QUESTION ━━━
A good easy question at this level:
- Asks the candidate to DEFINE or EXPLAIN a single concept in plain language
- OR asks the candidate to compare exactly two simple things
- Has ONE clear correct answer that any IT student who studied from a textbook can give
- Is short — one sentence, two at most
- Does NOT describe a multi-step scenario
- Does NOT ask "what is the most likely reason" or "what are two things" — keep it singular and direct

BAD EXAMPLES — Do NOT generate questions like these:
  ✗ "You are building a portfolio page and want a paragraph to be hidden but still take up space — which CSS property would you use and why would you choose it over the other option?"
    → This is a two-part question wrapped in a scenario. Too complex.
  ✗ "A developer adds a JavaScript event listener to a button, but the listener never fires when the button is clicked. What is the first thing you would check?"
    → Debugging scenario with multiple plausible answers. Too ambiguous.
  ✗ "If a CSS rule you wrote is not being applied to an element, what steps would you take to figure out why?"
    → Open-ended multi-step troubleshooting. Too hard.

GOOD EXAMPLES — Generate questions exactly like these:
  ✓ "What is the difference between display none and visibility hidden in CSS?"
  ✓ "What does the textContent property do in JavaScript?"
  ✓ "What is a GET request and when would you use it?"
  ✓ "What does a dot env file store in a Node project?"
  ✓ "What is middleware in Express and what does it do?"

━━━ TOPIC TO COVER ━━━
ALLOWED TOPICS — Your question MUST come from one of these topics only:
${topicScope}

You MUST generate a question specifically targeting this topic: "${selectedTopic}".
Do not stray into other topics. Focus purely on this one concept.

━━━ QUESTION FORMAT ━━━
Generate a single easy-level question. It MUST be one of these two types ONLY:
1. CONCEPT EXPLANATION — ask the candidate to define or explain what something is or does.
   Pattern: "What is [X]?" or "What does [X] do?" or "What is [X] used for?"
2. SIMPLE DIFFERENCE — ask the candidate to compare exactly two basic things.
   Pattern: "What is the difference between [X] and [Y]?"

Do NOT use scenario-based formats. Do NOT ask "why would you choose", "what would you check", or "what steps would you take".
The question must be direct, factual, and answerable in one or two sentences.

CRITICAL TTS RULE: Do NOT include backticks, dot-notation, slashes, angle brackets, curly braces, or any programming syntax. Do NOT write method calls like element.textContent or style.display — use plain English names instead (e.g. "the textContent property", "the display style property"). The question is read aloud by a TTS engine — every character you write will be spoken literally.

STRICT CONSTRAINTS:
${avoidList}
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
      content: `Generate a fresh, novel question. Do NOT repeat or closely paraphrase any of these:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nNow generate one original question.`,
    });
  } else {
    messages.push({
      role: "user",
      content:
        "Generate the first technical interview question for this candidate.",
    });
  }

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 120,
  });

  if (!response.choices || response.choices.length === 0 || !response.choices[0]?.message?.content) {
    console.error("[DeepSeek Error] Received empty choices or error response in generateSet2Question:", JSON.stringify(response));
  }

  const fallbackQuestions = [
    "Can you walk me through how you would debug a function that is returning undefined when you expect it to return a value?",
    "What is the difference between a GET request and a POST request in a REST API?",
    "How does localStorage differ from sessionStorage, and when would you use each?",
    "What is the purpose of middleware in Express, and how does it process requests?",
    "Why should API keys and database credentials never be hardcoded in your frontend codebase?"
  ];

  const raw =
    response.choices?.[0]?.message?.content?.trim() ||
    fallbackQuestions[previousQuestions.length % fallbackQuestions.length];

  return sanitizeTTS(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const SET2_SCORING_SYSTEM_PROMPT = `You are a strict, objective IT interview scoring engine and coach.
Your task is to evaluate a student's spoken answer to a TECHNICAL interview question.
You must respond with ONLY a valid JSON object.

### STEP 1 — SCORING RULES
Score each dimension from 1 to 10:
- problem_solving_score: Did the candidate reason through the problem logically and arrive at a workable approach?
- accuracy_score: Is the technical content of the answer correct? Are there factual errors or misconceptions?
- depth_score: How much technical detail and understanding does the answer demonstrate beyond a surface-level response?

### STEP 2 — COACHING TIP & INTERVIEWER REPLY
1. "tip": Exactly ONE SENTENCE of actionable technical coaching (e.g. "Try to explain the specific method or property you would use rather than staying general.").
2. "interviewer_reply": A warm and encouraging conversational reply from the interviewer consisting of EXACTLY TWO SENTENCES:
   - Sentence 1: A warm, supportive acknowledgment validating the candidate's response (e.g. "That is a really solid approach to the problem!").
   - Sentence 2: A brief, positive piece of coaching reinforcement or encouragement (e.g. "Next time, try to mention the exact property or method name to show even more precision.").
   - STRICT CONSTRAINT: Do NOT end with a question, do NOT ask any questions, and do NOT mention or introduce the next question or topic.

Return exactly this shape:
{
  "problem_solving_score": <integer 1-10>,
  "accuracy_score": <integer 1-10>,
  "depth_score": <integer 1-10>,
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
          description: "Problem solving score 1-10",
        },
        accuracy_score: {
          type: "integer",
          description: "Technical accuracy score 1-10",
        },
        depth_score: {
          type: "integer",
          description: "Technical depth score 1-10",
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
 * @returns {Promise<{ problem_solving_score, accuracy_score, depth_score, tip, interviewer_reply }>}
 */
async function evaluateSet2Answer(question, transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return {
      problem_solving_score: 1,
      accuracy_score: 1,
      depth_score: 1,
      tip: "I didn't catch an answer — take a breath and try to walk through your reasoning step by step.",
      interviewer_reply: "I didn't quite catch that, but let's keep going.",
    };
  }

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages: [
      { role: "system", content: SET2_SCORING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Technical Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[aiSet2Generator] JSON parse error. Raw response:", raw);
    return {
      problem_solving_score: 5,
      accuracy_score: 5,
      depth_score: 5,
      tip: "Try to explain the specific step or property you would use rather than staying at a high level.",
      interviewer_reply: "Alright, thank you for that.",
    };
  }

  const clamp = (n) => Math.min(10, Math.max(1, parseInt(n) || 6));

  console.log(`[aiSet2Generator] Evaluated using: ${response.model || EVALUATOR_MODEL} (via DeepSeek)`);

  return {
    problem_solving_score: clamp(parsed.problem_solving_score),
    accuracy_score: clamp(parsed.accuracy_score),
    depth_score: clamp(parsed.depth_score),
    tip:
      parsed.tip ||
      "Try to explain the specific step or property you would use rather than staying at a high level.",
    interviewer_reply:
      parsed.interviewer_reply || "Alright, thank you for that.",
  };
}

module.exports = {
  generateSet2Question,
  evaluateSet2Answer,
};

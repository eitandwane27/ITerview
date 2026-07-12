// backend/services/aiSet1Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Subset 2: Dynamic AI Prompting (The "Weakness" Engine)
// Handles generating questions and scoring answers specifically for Set 1.
// ─────────────────────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");
const { getRoleConfig } = require("../config/roleConfig");
const { sanitizeTTS } = require("../utils/ttsSanitizer");
const { EASY_AVOID_LIST, TTS_SAFETY } = require("../config/guardConfig");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const EVALUATOR_MODEL = "deepseek-chat";

// ─────────────────────────────────────────────────────────────────────────────
// Role data (examples, topic scope, keywords) is now sourced from
// backend/config/roleConfig.js — see that file to add or modify roles.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a personalized Set 1 interview question based on the user's weakness, role, and difficulty.
 *
 * @param {string} weakness_tag - focus_clarity, focus_correctness, or focus_completeness
 * @param {string} role - frontend, backend, or fullstack
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

  // ── LOCKED TO EASY ONLY ──────────────────────────────────────────────────
  const examplePool = roleData.set1.easyExamples?.[safeWeakness] || [];
  const difficultyLabel = "Easy (Entry Level / Fresh Graduate)";
  const difficultyContext = `The candidate is a fresh IT graduate or IT student practicing core interview basics. They have mostly academic knowledge and personal project experience — no commercial work experience. Questions MUST be simple, fundamental, and answerable without any industry experience.`;
  const avoidList = `${roleData.avoidList || ""}\n\n${EASY_AVOID_LIST}\n\n${TTS_SAFETY}`;

  // ── Step 2: Build the weakness-specific instruction ───────────────────────
  let weaknessInstruction = "";
  if (safeWeakness === "focus_clarity") {
    weaknessInstruction = `The question must ask the candidate to EXPLAIN one specific concept in their own words. It tests HOW WELL they can communicate — not just whether they know the answer.
QUESTION FORMAT RULES:
- ONE concept only. Do not chain concepts with "and", "including", or "from X to Y".
- Single sentence. No sub-questions. No compound structure.
- Good: "Can you explain how the CSS box model works?"
- Bad: "Can you explain how the box model works, including margin and padding, and how it affects layout?"`;
  } else if (safeWeakness === "focus_correctness") {
    weaknessInstruction = `The question must test ONE simple, fundamental fact — a basic definition, a difference between two basic items, or a "what is / what does X do" question.
CRITICAL EASY DIFFICULTY RULES:
- The question must be extremely simple and foundational. It must NOT test abstract rendering concepts, CSS cascade conflicts, or advanced JS mechanics.
- Do NOT ask about the browser's rendering engine or internals.
- Do NOT ask about CSS specificity calculation, cascading rules, or selector weight.
- Do NOT ask about JavaScript hoisting, closures, temporal dead zone, function expressions versus declarations, or arrow functions vs regular functions.
- Keep comparisons to very basic things like: var/let/const, double equals/triple equals, display none/visibility hidden, local storage/session storage, SQL/NoSQL.
QUESTION FORMAT RULES:
- ONE fact only. Do not combine two questions into one sentence.
- Single sentence. Short and direct.
- Good: "What is the difference between let and const in JavaScript?"
- Good: "What does the textContent property do in JavaScript?"
- Bad: "What is the difference between a function expression and a declaration, and how does hoisting affect them?"`;
  } else {
    weaknessInstruction = `The question must be extremely simple, asking the candidate to list or name MULTIPLE basic things about ONE specific topic. It tests their ability to retrieve foundational items.
QUESTION FORMAT RULES:
- Ask them to list or name multiple items of a single basic category (e.g. "What are three basic CSS selectors...", "What are some values for the CSS display property...").
- Keep it to a single, simple sentence.
- STRICTLY BAN any compound structures or chained sub-questions. Do NOT ask "how they work", "how they affect layout", "when you would use them", "what they are used for", or "and why". The question should only ask to list or name them.
- Good: "What are three different HTML semantic tags you can use to structure a webpage?"
- Good: "What are some of the values you can use for the CSS position property?"
- Bad: "What are some different display properties in CSS, and how do they affect the layout of elements on a webpage?"
- Bad: "What are some common semantic elements in HTML, and what purpose does each one serve?"`;
  }

  // ── Step 3: Build the calibration + exclusion section ───────────────────
  let examplesSection = "";
  let curationBlacklist = [];
  if (examplePool && examplePool.length > 0) {
    const shuffled = [...examplePool].sort(() => Math.random() - 0.5);
    const benchmarkSamples = shuffled
      .slice(0, 2)
      .map((q, i) => `  ${i + 1}. ${q}`)
      .join("\n");
    examplesSection = `
DIFFICULTY BENCHMARK — these questions represent the EXACT difficulty level and vocabulary you must target:
${benchmarkSamples}

IMPORTANT: Do NOT repeat or closely paraphrase any of those examples. Generate a DIFFERENT, NOVEL question at the same difficulty level.`;
    curationBlacklist = examplePool;
  }

  // ── Step 3.5: Select a topic to ensure variance and avoid repetition ──────
  const topics = roleData.set1.topicScope || [];
  const keywordLists = roleData.set1.topicKeywords || [];
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

  // ── Step 4: Build the full system prompt ─────────────────────────────────
  const topicScope = topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n");

  const systemPrompt = `You are an experienced IT recruiter and mock interview coach generating personalized practice questions.
You are creating a question for a ${difficultyLabel} candidate applying for a ${formattedRole} position.

CANDIDATE PROFILE:
${difficultyContext}

ALLOWED TOPICS — Your question MUST come from one of these topics only. Do not go outside this list:
${topicScope}

STRICT TOPIC FOCUS:
You MUST generate a question specifically targeting this topic: "${selectedTopic}".
Do not ask about any other topic. Make sure the question focuses purely on this specific concept or tool.

QUESTION TYPE REQUIREMENT:
${weaknessInstruction}
${avoidList ? `\nSTRICT CONSTRAINTS:\n${avoidList}` : ""}
${examplesSection}

CRITICAL TTS RULE: Do NOT include backticks, dot-notation, slashes, angle brackets, curly braces, or any programming syntax. Do NOT write method calls like element.textContent or style.display — use plain English names instead (e.g. "the textContent property", "the display style property"). The question is read aloud by a TTS engine — every character you write will be spoken literally.

OUTPUT RULE:
- Return ONLY the final question string.
- Do NOT include any self-correction, revision markers, arrows (->), or "I made a change" commentary.
- Do NOT show a draft followed by a corrected version.
- No introduction, no explanation, no quotes, no numbering. Just the single, final question itself.`;

  // ── Step 5: Build the messages array ─────────────────────────────────────
  const allExcluded = [...previousQuestions, ...curationBlacklist];
  const messages = [{ role: "system", content: systemPrompt }];

  if (allExcluded.length > 0) {
    messages.push({
      role: "user",
      content: `Generate a fresh, novel question. Do NOT repeat or closely paraphrase any of these — either already-asked questions or the benchmark examples above:\n${allExcluded.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nNow generate one original question.`,
    });
  } else {
    messages.push({
      role: "user",
      content: "Generate the first interview question for this candidate.",
    });
  }

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages,
    temperature: 0.85,
    max_tokens: 300,
  });

  if (!response.choices || response.choices.length === 0 || !response.choices[0]?.message?.content) {
    console.error("[DeepSeek Error] Received empty choices or error response in generateSet1Question:", JSON.stringify(response));
  }

  const fallbackQuestions = [
    "Can you tell me about a project you worked on and what your specific role and contributions were?",
    "What is the difference between client-side and server-side in web development?",
    "How does a browser request and load a webpage from a server?",
    "Why is it important to use semantic HTML tags when building a webpage?",
    "What are some basic git commands you use to manage your project code?"
  ];

  const raw =
    response.choices?.[0]?.message?.content?.trim() ||
    fallbackQuestions[previousQuestions.length % fallbackQuestions.length];

  return sanitizeTTS(raw);
}

const SET1_SCORING_SYSTEM_PROMPT = `You are a strict, objective IT interview scoring engine and coach.
Your task is to evaluate a student's spoken answer against the specific interview question.
You must respond with ONLY a valid JSON object.

### STEP 1 — SCORING RULES
Score each dimension from 1 to 10:
- clarity_score: How well-organised, articulate, and easy to follow is the answer?
- correctness_score: Does the answer directly and correctly respond to what the question is asking?
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
  "clarity_score": <integer 1-10>,
  "correctness_score": <integer 1-10>,
  "completeness_score": <integer 1-10>,
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
        clarity_score: { type: "integer", description: "Clarity score 1-10" },
        correctness_score: {
          type: "integer",
          description: "Correctness score 1-10",
        },
        completeness_score: {
          type: "integer",
          description: "Completeness score 1-10",
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
 * @returns {Promise<{ clarity_score: number, correctness_score: number, completeness_score: number, tip: string, interviewer_reply: string }>}
 */
async function evaluateSet1Answer(question, transcript) {
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

  const response = await deepseek.chat.completions.create({
    model: EVALUATOR_MODEL,
    messages: [
      { role: "system", content: SET1_SCORING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[aiSet1Generator] JSON parse error. Raw response:", raw);
    return {
      clarity_score: 5,
      correctness_score: 5,
      completeness_score: 5,
      tip: "Try to provide a bit more detail next time to fully address the question.",
      interviewer_reply:
        "That was a solid start. Let's build on that in the next parts.",
    };
  }

  const clamp = (n) => Math.min(10, Math.max(1, parseInt(n) || 6));

  console.log(
    `[aiSet1Generator] Evaluated using: ${response.model || EVALUATOR_MODEL} (via DeepSeek V3)`,
  );

  return {
    clarity_score: clamp(parsed.clarity_score),
    correctness_score: clamp(parsed.correctness_score),
    completeness_score: clamp(parsed.completeness_score),
    tip:
      parsed.tip ||
      "Try to provide a bit more detail next time to fully address the question.",
    interviewer_reply:
      parsed.interviewer_reply ||
      "That was a solid start. Let's build on that in the next parts.",
  };
}

module.exports = {
  generateSet1Question,
  evaluateSet1Answer,
};

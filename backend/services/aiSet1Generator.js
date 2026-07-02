// backend/services/aiSet1Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Subset 2: Dynamic AI Prompting (The "Weakness" Engine)
// Handles generating questions and scoring answers specifically for Set 1.
// ─────────────────────────────────────────────────────────────────────────────

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// CURATED QUESTION EXAMPLES — Grounded in real, widely-asked interview questions
// for each role and weakness type at the Easy (junior/fresh-grad) tier.
// These serve as concrete style anchors so the LLM doesn't drift into
// senior-level complexity. The LLM must generate in the SAME spirit and
// difficulty as these examples.
// ─────────────────────────────────────────────────────────────────────────────
const EASY_QUESTION_EXAMPLES = {
  frontend: {
    focus_clarity: [
      "Can you walk me through what happens step-by-step when a user clicks a button in a web page?",
      "How would you explain the difference between HTML, CSS, and JavaScript to someone who has never coded?",
      "Can you describe in your own words how the browser renders a webpage from start to finish?",
    ],
    focus_correctness: [
      "What is the difference between `var`, `let`, and `const` in JavaScript?",
      "What does CSS `position: absolute` do, and how is it different from `position: relative`?",
      "What is the difference between `display: none` and `visibility: hidden` in CSS?",
      "What is an HTML semantic element? Can you give an example?",
      "What does `===` (triple equals) do differently from `==` in JavaScript?",
    ],
    focus_completeness: [
      "What are some of the ways you can make a webpage load faster for users?",
      "What are some common HTML tags you would use when building a basic webpage, and what is each one used for?",
      "How would you center an element on a page? What are the different approaches you know?",
    ],
  },
  backend: {
    focus_clarity: [
      "Can you walk me through what happens when a client sends a GET request to a REST API?",
      "How would you explain the difference between a GET request and a POST request to a teammate?",
      "Can you describe in simple terms how a user login system works from start to finish?",
    ],
    focus_correctness: [
      "What is the difference between SQL and NoSQL databases?",
      "What is an HTTP status code? What does a 404 mean versus a 500?",
      "What is the purpose of an environment variable, and why should you not hardcode API keys in your code?",
      "What is the difference between authentication and authorization?",
      "What is JSON and when would you use it in a backend application?",
    ],
    focus_completeness: [
      "What are some things you would check if an API endpoint is returning an error?",
      "What are the basic HTTP methods (GET, POST, PUT, DELETE) and what is each one typically used for?",
      "What are some reasons you would use a database instead of just saving data to a file?",
    ],
  },
  fullstack: {
    focus_clarity: [
      "Can you explain in simple terms what happens from when you type a URL in a browser to when the page appears?",
      "How would you explain the difference between the frontend and the backend of a web application to a non-developer?",
      "Can you walk me through how data typically flows from a user action on a webpage all the way to a database?",
    ],
    focus_correctness: [
      "What is CORS and why would a browser block a request because of it?",
      "What is the difference between a cookie and a session?",
      "What is Git and why is version control important in software development?",
      "What is the difference between HTTP and HTTPS?",
      "What is a REST API and what makes it 'RESTful'?",
    ],
    focus_completeness: [
      "What are some things you would consider when deciding whether to store data on the client side or the server side?",
      "What are some common problems a junior developer might run into when connecting a frontend to a backend API?",
      "What are the main steps you would take to build a simple todo list web application from scratch?",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIUM & HARD BANKS — commented out while we validate easy-level guardrails.
// Re-enable once role + easy prompt is confirmed solid.
// ─────────────────────────────────────────────────────────────────────────────

// const MEDIUM_QUESTION_EXAMPLES = { ... };
// const HARD_QUESTION_EXAMPLES   = { ... };

// ─────────────────────────────────────────────────────────────────────────────
// ROLE TOPIC SCOPE — hard fence on what topics the LLM can pull from.
// This prevents Llama from drifting into backend/fullstack concepts when the
// role is frontend, and vice versa. Each role only asks within its own domain.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_TOPIC_SCOPE = {
  frontend: [
    "HTML structure, semantic elements (header, nav, main, section, article, footer), and basic tags",
    "CSS fundamentals: box model, selectors, specificity, display (block, inline, inline-block, none), visibility",
    "CSS layout: position (static, relative, absolute, fixed), flexbox basics, simple responsive design with media queries",
    "Vanilla JavaScript basics: variables (var, let, const), data types, operators, functions, conditionals, loops",
    "DOM manipulation: selecting elements, adding event listeners, changing text or styles with JavaScript",
    "Browser basics: how the browser renders a page, what HTML/CSS/JS each does, difference between client and server (surface level only)",
  ],
  backend: [
    "HTTP basics: what HTTP is, GET vs POST requests, common status codes (200, 404, 500)",
    "REST API fundamentals: what an API is, what makes it RESTful, endpoints, request/response",
    "Databases: SQL vs NoSQL at a high level, what a database is, basic CRUD operations",
    "Server basics: what a server does, what Node.js/Express is used for, what an environment variable is",
    "Authentication basics: difference between authentication and authorization, what a session is",
    "JSON: what it is, how it's used to send data between client and server",
  ],
  fullstack: [
    "Client vs server: what happens when you type a URL, how frontend and backend communicate",
    "HTTP and APIs: what a REST API is, GET vs POST vs PUT vs DELETE",
    "Basic databases: SQL vs NoSQL, what a database is used for, basic queries",
    "Version control: what Git is, why version control matters, basic commands (commit, push, pull)",
    "HTTP vs HTTPS: difference, why HTTPS matters",
    "Cookies vs sessions: what they are and when you'd use them",
  ],
};

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
  const formattedRole =
    role === "frontend"
      ? "Frontend Developer"
      : role === "backend"
        ? "Backend Developer"
        : role === "fullstack"
          ? "Fullstack Developer"
          : "Software Developer";

  // ── Step 1: Pick the right example bank ──────────────────────────────────
  const safeRole = ["frontend", "backend", "fullstack"].includes(role)
    ? role
    : "fullstack";
  const safeWeakness = [
    "focus_clarity",
    "focus_correctness",
    "focus_completeness",
  ].includes(weakness_tag)
    ? weakness_tag
    : "focus_correctness";

  // ── LOCKED TO EASY ONLY ──────────────────────────────────────────────────
  // Medium and hard tiers are disabled until easy-level role guardrails are
  // confirmed solid. Difficulty parameter is intentionally ignored for now.
  // TODO: Re-enable difficulty branching once prompt quality is validated.
  const examplePool = EASY_QUESTION_EXAMPLES[safeRole]?.[safeWeakness] || [];
  const difficultyLabel = "Easy (Entry Level / Fresh Graduate)";
  const difficultyContext = `The candidate is a fresh IT graduate or IT student practicing core interview basics. They have mostly academic knowledge and personal project experience — no commercial work experience. Questions MUST be simple, fundamental, and answerable without any industry experience.`;
  const avoidList = `STRICT TOPIC BAN — Do NOT ask about any of the following:
- Frameworks or libraries (React, Vue, Angular, Express, etc.)
- Any system design, architecture, or trade-offs
- Web security (CORS, XSS, CSRF, JWT, OAuth)
- Advanced async patterns (Promises, async/await, event loop)
- DevOps, deployment, Docker, or Kubernetes
- Database internals, indexing, normalization, or transactions
- Anything requiring real-world industry experience`;

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
    weaknessInstruction = `The question must test ONE specific fact — a definition, a difference between two things, or a "what is / what does X do" question. There must be a clearly correct answer.
QUESTION FORMAT RULES:
- ONE fact only. Do not combine two questions into one sentence.
- Single sentence. Short and direct.
- Good: "What is the difference between display: block and display: inline in CSS?"
- Bad: "What is the difference between block and inline, and how does each affect spacing and layout?"`;
  } else {
    weaknessInstruction = `The question must be open-ended, asking the candidate to name or list MULTIPLE things about ONE topic. It reveals whether they give thorough or shallow answers.
QUESTION FORMAT RULES:
- ONE topic. Broad coverage comes from asking them to think about the full range — not from chaining sub-questions.
- Single sentence.
- Good: "What are some ways you can use CSS to control how elements are positioned on a page?"
- Bad: "What are the positioning methods in CSS, and how does JavaScript interact with them, and what are common mistakes?"`;
  }

  // ── Step 3: Build the calibration + exclusion section ───────────────────
  // The curated examples serve TWO purposes:
  //   1. Show the LLM 2 random samples as a DIFFICULTY BENCHMARK only
  //   2. Add ALL curated examples to the blacklist so the LLM never repeats them
  let examplesSection = "";
  let curationBlacklist = [];
  if (examplePool && examplePool.length > 0) {
    // Shuffle and pick 2 random examples to show as benchmark (different each call)
    const shuffled = [...examplePool].sort(() => Math.random() - 0.5);
    const benchmarkSamples = shuffled
      .slice(0, 2)
      .map((q, i) => `  ${i + 1}. ${q}`)
      .join("\n");
    examplesSection = `
DIFFICULTY BENCHMARK — these questions represent the EXACT difficulty level and vocabulary you must target:
${benchmarkSamples}

IMPORTANT: Do NOT repeat or closely paraphrase any of those examples. Generate a DIFFERENT, NOVEL question at the same difficulty level.`;
    // All curated examples go into the blacklist regardless of which ones were shown
    curationBlacklist = examplePool;
  }

  // ── Step 4: Build the full system prompt ─────────────────────────────────
  const topicScope = (ROLE_TOPIC_SCOPE[safeRole] || [])
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join("\n");

  const systemPrompt = `You are an experienced IT recruiter and mock interview coach generating personalized practice questions.
You are creating a question for a ${difficultyLabel} candidate applying for a ${formattedRole} position.

CANDIDATE PROFILE:
${difficultyContext}

ALLOWED TOPICS — Your question MUST come from one of these topics only. Do not go outside this list:
${topicScope}

QUESTION TYPE REQUIREMENT:
${weaknessInstruction}
${avoidList ? `\nSTRICT CONSTRAINTS:\n${avoidList}` : ""}
${examplesSection}

OUTPUT RULE:
- Return ONLY the final question string.
- Do NOT include any self-correction, revision markers, arrows (->), or "I made a change" commentary.
- Do NOT show a draft followed by a corrected version.
- No introduction, no explanation, no quotes, no numbering. Just the single, final question itself.`;

  // ── Step 5: Build the messages array ─────────────────────────────────────
  // Merge session questions + all curated examples into one blacklist
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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.65,
    max_tokens: 120,
  });

  const raw =
    response.choices[0]?.message?.content?.trim() ||
    "Can you tell me about a project you worked on and what your specific role and contributions were?";

  // ── Post-process: strip LLM self-correction artifacts ─────────────────────
  // The LLM sometimes outputs "draft! -> revised version" when it corrects itself.
  // If the response contains " -> ", take only the last segment after the final arrow.
  const sanitized = raw.includes(" -> ") ? raw.split(" -> ").pop().trim() : raw;

  return sanitized;
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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SET1_SCORING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";
  const parsed = JSON.parse(raw);

  const clamp = (n) => Math.min(10, Math.max(1, parseInt(n) || 6));

  return {
    clarity_score: clamp(parsed.clarity_score),
    correctness_score: clamp(parsed.correctness_score),
    completeness_score: clamp(parsed.completeness_score),
    tip:
      parsed.tip ||
      "Try to provide a bit more detail next time to fully address the question.",
    interviewer_reply:
      parsed.interviewer_reply || "That was a solid start. Let's build on that in the next parts.",
  };
}

module.exports = {
  generateSet1Question,
  evaluateSet1Answer,
};

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

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// CURATED QUESTION EXAMPLES — easy junior-level technical questions.
// These anchor the LLM to the right difficulty — fresh-grad / IT student level.
// ALL examples are TTS-safe: plain English, no code, no backticks.
// ─────────────────────────────────────────────────────────────────────────────
const EASY_QUESTION_EXAMPLES = {
  frontend: [
    // Problem Solving
    "If a button on a webpage is not responding to clicks, what are the first two things you would check?",
    "If a CSS rule you wrote is not being applied to an element, what steps would you take to figure out why?",
    "How would you use JavaScript to show a hidden element on the page when a user clicks a button?",
    // Debugging
    "A developer tries to select a button by its ID in JavaScript, but the code cannot find the element even though the ID exists in the HTML. What is a likely cause of this?",
    "A div element is not visible on the page even though the HTML for it exists. What are two CSS properties that could be causing it to be hidden?",
    "A developer adds a JavaScript event listener to a button, but the listener never fires when the button is clicked. What is the first thing you would check?",
    // Technical Depth
    "What is the difference between using textContent and innerHTML to update an element's text in JavaScript?",
    "Why does placing a script tag at the bottom of the HTML body instead of in the head section matter?",
    "What is the difference between display none and visibility hidden in CSS?",
  ],
  backend: [
    // Problem Solving
    "If your server returns a 500 error every time a specific route is hit, what are the first things you would check?",
    "A user reports they can log in fine but their data is not saving. What parts of the backend would you check first?",
    "How would you write a simple route that receives a number from the request and sends back double that number in the response?",
    // Debugging
    "A developer sets up a route meant to return all users, but every time it is called it only returns one user. What is a likely cause of this mistake?",
    "An API route is returning a 404 error even though the developer is sure the route is defined. What are two things you would check first?",
    "A backend function that reads from a database crashes with an error saying it cannot read a property of undefined. What is most likely going wrong?",
    // Technical Depth
    "What is middleware in Express, and can you give a simple example of when you would use it?",
    "Why do you need to use async and await when reading data from a database instead of writing regular synchronous code?",
    "What does a dot env file do in a Node project and why should it never be uploaded to GitHub?",
  ],
  fullstack: [
    // Problem Solving
    "A user fills out a form and clicks Submit but nothing happens. Where do you start debugging — the frontend or the backend, and why?",
    "Your frontend is calling an API but the browser is blocking the request with a CORS error. What does that mean and how would you fix it?",
    "How would you design a simple flow so that after a user logs in, their name is shown on every page of the app?",
    // Debugging
    "A fetch request from the frontend is returning undefined instead of the expected user data. What are two things you would check?",
    "The frontend sends data to the backend but the backend receives an empty object instead of the data. What is the most likely cause?",
    "A developer saves user passwords as plain text in the database. Why is this a serious problem and what should be done instead?",
    // Technical Depth
    "What is the difference between JSON dot stringify and JSON dot parse, and when would you use each one?",
    "What is the difference between a synchronous and an asynchronous function, and why does it matter in web development?",
    "Why would a developer store data in localStorage instead of always fetching it from the server?",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE TOPIC SCOPE — what domains Set 2 questions are allowed to draw from.
// Strictly junior-level topics only — no frameworks, no system design.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_TOPIC_SCOPE = {
  frontend: [
    "DOM manipulation: selecting a single element by ID, reading or changing its textContent or innerHTML, toggling a CSS class",
    "Event handling: adding a click listener to a button, preventing default form submission, reading a value from an input field",
    "Debugging HTML/CSS/JS: spotting typos in method names, identifying why a CSS rule is not applying, reading a simple error message",
    "CSS rules and the cascade: why a rule might not apply to an element, what specificity means, common display and visibility issues",
    "Script loading: what defer and async attributes do, why a script tag placed before the HTML body can cause errors",
    "Simple browser scenarios: what happens when a button is clicked, why an event listener might not fire, how to show or hide an element with JavaScript",
  ],
  backend: [
    "Express.js basics: defining GET/POST routes, using req and res, sending JSON responses",
    "Async fundamentals: why async/await is needed, what happens if you forget to await a database call",
    "Environment variables: what a .env file is, why secrets must not be hardcoded or committed",
    "Common HTTP debugging: understanding 404 vs 500, checking if a route exists, reading error logs",
    "Middleware: what it is in Express, how it sits between a request and a route handler",
    "Basic database interaction: making a query, handling the result, what undefined means when a query fails",
  ],
  fullstack: [
    "Client-server flow: what happens end-to-end when a form is submitted — frontend fetch, backend route, database write",
    "CORS: what it is, why browsers block cross-origin requests, how to enable it on the backend",
    "Authentication basics: storing a session or token, checking login state on the frontend",
    "JSON serialization: using JSON.stringify and JSON.parse, what happens if a POST body is not parsed",
    "Async concepts: difference between sync and async code, why fetch returns a Promise",
    "Storage choices: when to use localStorage vs session vs always fetching from the server",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// STRICT AVOID LIST — same across all Set 2 roles at easy difficulty
// ─────────────────────────────────────────────────────────────────────────────
const EASY_AVOID_LIST = `STRICT TOPIC BAN — Do NOT ask about any of the following:
- Frameworks or libraries (React, Vue, Angular, Express internals, ORM tools)
- System design, architecture decisions, or scalability trade-offs
- Web security internals (JWT signing, OAuth flows, CSRF tokens)
- Advanced async patterns (Promise.all, Promise.race, event loop internals, closures)
- Event propagation internals: event bubbling, event capturing, stopPropagation — too advanced
- CSS specificity edge cases or cascade conflicts — too advanced for fresh grads
- DevOps, deployment, CI/CD, Docker, or Kubernetes
- Database internals: indexing, normalization, transactions, query optimization
- Anything requiring real-world industry or production experience
- Pure array or data structure exercises (filter an array of numbers, find duplicates, sum odd numbers) — these are LeetCode problems, NOT interview questions
- Abstract algorithmic problems with no connection to browser, DOM, or UI context
- TTS SAFETY: Do NOT include any code snippets, backtick characters, angle brackets, or programming syntax in the question text. The question is read aloud by a text-to-speech engine. All questions must be written in plain conversational English only.`;

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
  const formattedRole =
    role === "frontend"
      ? "Frontend Developer"
      : role === "backend"
        ? "Backend Developer"
        : role === "fullstack"
          ? "Fullstack Developer"
          : "Software Developer";

  // ── Normalise inputs ───────────────────────────────────────────────────────
  const safeRole = ["frontend", "backend", "fullstack"].includes(role)
    ? role
    : "fullstack";

  // ── LOCKED TO EASY ONLY ───────────────────────────────────────────────────
  // Medium/hard tiers disabled until easy-level guardrails are validated.
  const examplePool = EASY_QUESTION_EXAMPLES[safeRole] || [];
  const difficultyLabel = "Easy (Entry Level / Fresh Graduate)";
  const difficultyContext = `The candidate is a fresh IT graduate or IT student with mostly academic knowledge and personal project experience.
They have no commercial work experience. Questions must be answerable with junior-level practical knowledge only.`;

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
  const topicScope = (ROLE_TOPIC_SCOPE[safeRole] || [])
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join("\n");

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are an experienced IT recruiter and technical interview coach generating technical practice questions.
You are creating a question for a ${difficultyLabel} candidate applying for a ${formattedRole} position.

CANDIDATE PROFILE:
${difficultyContext}

ALLOWED TOPICS — Your question MUST come from one of these topics only. Do not go outside this list:
${topicScope}

QUESTION TYPE REQUIREMENT:
Generate a single, clear, easy-level technical practice question testing the selected role.
The question can be about:
1. Reasoning through a simple browser/DOM/server scenario (Problem Solving)
2. Diagnosing a common beginner mistake or symptom described in plain English (Debugging)
3. Explaining why a basic technical mechanic works the way it does or the difference between two common tools (Technical Depth)

CRITICAL TTS RULE: Do NOT include any code, backticks, angle brackets, or programming syntax in the question text. The question is read aloud — it must read like a natural sentence.

STRICT CONSTRAINTS:
${EASY_AVOID_LIST}
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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.65,
    max_tokens: 160,
  });

  const raw =
    response.choices[0]?.message?.content?.trim() ||
    "Can you walk me through how you would debug a function that is returning undefined when you expect it to return a value?";

  // ── Post-process: strip LLM self-correction artifacts ────────────────────
  const sanitized = raw.includes(" -> ") ? raw.split(" -> ").pop().trim() : raw;

  return sanitized;
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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SET2_SCORING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Technical Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    temperature: 0.0,
    max_tokens: 220,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";
  const parsed = JSON.parse(raw);

  const clamp = (n) => Math.min(10, Math.max(1, parseInt(n) || 6));

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

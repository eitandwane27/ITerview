// backend/services/aiSet1Generator.js
// ─────────────────────────────────────────────────────────────────────────────
// Subset 2: Dynamic AI Prompting (The "Weakness" Engine)
// Handles generating questions and scoring answers specifically for Set 1.
// ─────────────────────────────────────────────────────────────────────────────

const { OpenAI } = require("openai");

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const EVALUATOR_MODEL = "deepseek-chat";

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
      "What are three different HTML semantic tags you can use to structure a webpage?",
      "What are some of the different values you can use for the CSS display property?",
      "What are three different CSS selectors you can use to style elements on a page?",
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
      "What are three common HTTP status codes and what basic message does each represent?",
      "What are the four main HTTP methods used in REST APIs?",
      "What are three different data types you can store in a JSON object?",
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
      "What are three of the basic Git commands you use when working on a project?",
      "What are three common HTTP methods used to communicate between client and server?",
      "What are three different places where you can store data on the client side in a web application?",
    ],
  },
};

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
// TOPIC KEYWORDS FOR PREVENTING REPETITION
// Used to score each topic based on keywords found in previous questions.
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_KEYWORDS = {
  frontend: [
    [
      "html",
      "semantic",
      "tag",
      "element",
      "header",
      "nav",
      "main",
      "section",
      "article",
      "footer",
    ],
    [
      "css",
      "box model",
      "selector",
      "specificity",
      "display",
      "visibility",
      "block",
      "inline",
    ],
    ["position", "flexbox", "layout", "responsive", "media query", "align"],
    [
      "variable",
      "let",
      "const",
      "var",
      "data type",
      "operator",
      "function",
      "conditional",
      "loop",
    ],
    ["dom", "event", "listener", "click", "manipulate"],
    ["browser", "render", "client", "server"],
  ],
  backend: [
    ["http", "get", "post", "status code", "request"],
    ["api", "rest", "endpoint", "response"],
    ["database", "sql", "nosql", "crud"],
    ["server", "node", "express", "environment variable"],
    ["auth", "session", "cookie"],
    ["json"],
  ],
  fullstack: [
    ["client", "server", "communicate", "url"],
    ["http", "api", "rest", "get", "post", "put", "delete"],
    ["database", "sql", "nosql", "query"],
    ["git", "version control", "commit", "push", "pull"],
    ["https"],
    ["cookie", "session"],
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
  const topics = ROLE_TOPIC_SCOPE[safeRole] || [];
  const keywordLists = TOPIC_KEYWORDS[safeRole] || [];
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

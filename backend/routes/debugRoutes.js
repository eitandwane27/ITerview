// backend/routes/debugRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY: Test AI question generation in isolation.
// No TTS, no STT, no WebSocket, no session state.
// Hit this route directly from your browser or Postman to see raw LLM output.
//
// ── SET 1 ──
//   GET /api/debug/generate-question
//   Query params:
//     role       — frontend | backend | fullstack           (default: frontend)
//     weakness   — focus_clarity | focus_correctness | focus_completeness  (default: focus_completeness)
//     difficulty — easy | medium | hard                     (default: easy)
//     runs       — how many questions to generate            (default: 1, max: 10)
//
// ── SET 2 ──
//   GET /api/debug/generate-question-s2
//   Query params:
//     role       — frontend | backend | fullstack           (default: frontend)
//     weakness   — problem_solving | debugging | technical_depth  (default: technical_depth)
//     difficulty — easy | medium | hard                     (default: easy)
//     runs       — how many questions to generate            (default: 1, max: 10)
//
// ── SET 3 ──
//   GET /api/debug/generate-question-s3
//   Query params:
//     startIndex — 0–4: which behavioral competency slot to start from (default: 0)
//     runs       — how many questions to generate sequentially           (default: 5, max: 5)
//     difficulty — easy | medium | hard                                  (default: easy)
//
//   Competency pillar by startIndex:
//     0 → Teamwork & Collaboration
//     1 → Adaptability & Learning Speed
//     2 → Conflict Resolution
//     3 → Resilience & Handling Failure
//     4 → Problem Solving & Initiative
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { generateSet1Question } = require("../services/aiSet1Generator");
const { generateSet2Question } = require("../services/aiSet2Generator");
const { generateSet3Question, getCompetencyTopic } = require("../services/aiSet3Generator");

router.get("/generate-question", async (req, res) => {
  // ── 1. Parse & validate query params ──────────────────────────────────────
  const VALID_ROLES      = ["frontend", "backend", "fullstack"];
  const VALID_WEAKNESSES = ["focus_clarity", "focus_correctness", "focus_completeness"];
  const VALID_DIFFS      = ["easy", "medium", "hard"];

  const role       = VALID_ROLES.includes(req.query.role)      ? req.query.role      : "frontend";
  const weakness   = VALID_WEAKNESSES.includes(req.query.weakness) ? req.query.weakness : "focus_completeness";
  const difficulty = VALID_DIFFS.includes(req.query.difficulty) ? req.query.difficulty : "easy";
  const runs       = Math.min(10, Math.max(1, parseInt(req.query.runs) || 1));

  console.log(`\n[DEBUG] 🧪 Question generation test`);
  console.log(`[DEBUG]   role=${role} | weakness=${weakness} | difficulty=${difficulty} | runs=${runs}`);

  // ── 2. Generate 'runs' questions sequentially, passing previous ones as context ──
  const results = [];
  const previousQuestions = [];

  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      const question = await generateSet1Question(weakness, role, difficulty, previousQuestions);
      const ms = Date.now() - start;
      console.log(`[DEBUG]   Q${i + 1} (${ms}ms): ${question}`);
      results.push({ index: i + 1, question, latency_ms: ms, error: null });
      previousQuestions.push(question); // feed into next call to avoid repeats
    } catch (err) {
      console.error(`[DEBUG]   Q${i + 1} ERROR:`, err.message);
      results.push({ index: i + 1, question: null, latency_ms: Date.now() - start, error: err.message });
    }
  }

  // ── 3. Return clean JSON ──────────────────────────────────────────────────
  res.json({
    params: { role, weakness, difficulty, runs },
    results,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SET 2 DEBUG ROUTE
// ─────────────────────────────────────────────────────────────────────────────
router.get("/generate-question-s2", async (req, res) => {
  const VALID_ROLES      = ["frontend", "backend", "fullstack"];
  const VALID_WEAKNESSES = ["problem_solving", "debugging", "technical_depth"];
  const VALID_DIFFS      = ["easy", "medium", "hard"];

  const role       = VALID_ROLES.includes(req.query.role)         ? req.query.role       : "frontend";
  const weakness   = VALID_WEAKNESSES.includes(req.query.weakness) ? req.query.weakness  : "technical_depth";
  const difficulty = VALID_DIFFS.includes(req.query.difficulty)   ? req.query.difficulty : "easy";
  const runs       = Math.min(10, Math.max(1, parseInt(req.query.runs) || 1));

  console.log(`\n[DEBUG-S2] 🧪 Set 2 question generation test`);
  console.log(`[DEBUG-S2]   role=${role} | weakness=${weakness} | difficulty=${difficulty} | runs=${runs}`);

  const results = [];
  const previousQuestions = [];

  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      const question = await generateSet2Question(role, difficulty, previousQuestions);
      const ms = Date.now() - start;
      console.log(`[DEBUG-S2]   Q${i + 1} (${ms}ms): ${question}`);
      results.push({ index: i + 1, question, latency_ms: ms, error: null });
      previousQuestions.push(question);
    } catch (err) {
      console.error(`[DEBUG-S2]   Q${i + 1} ERROR:`, err.message);
      results.push({ index: i + 1, question: null, latency_ms: Date.now() - start, error: err.message });
    }
  }

  res.json({
    set: 2,
    params: { role, weakness, difficulty, runs },
    results,
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// SET 3 DEBUG ROUTE
// ─────────────────────────────────────────────────────────────────────────────
router.get("/generate-question-s3", async (req, res) => {
  const VALID_DIFFS  = ["easy", "medium", "hard"];

  const startIndex = Math.min(4, Math.max(0, parseInt(req.query.startIndex) || 0));
  // Force to 'easy' for now to avoid confusion until other difficulties are implemented
  const difficulty = "easy";
  // Cap runs so we never exceed the 5 competency slots
  const runs = Math.min(5 - startIndex, Math.max(1, parseInt(req.query.runs) || 5 - startIndex));

  console.log(`\n[DEBUG-S3] 🧪 Set 3 behavioral question generation test`);
  console.log(`[DEBUG-S3]   startIndex=${startIndex} | difficulty=${difficulty} | runs=${runs}`);

  const results = [];
  // Build a fake previousQuestions array so the generator maps the right pillar
  const previousQuestions = Array(startIndex).fill("[skipped]");

  for (let i = 0; i < runs; i++) {
    const competency = getCompetencyTopic(previousQuestions.length);
    const start = Date.now();
    try {
      const question = await generateSet3Question(previousQuestions, difficulty);
      const ms = Date.now() - start;
      console.log(`[DEBUG-S3]   Q${startIndex + i + 1} [${competency}] (${ms}ms): ${question}`);
      results.push({ index: startIndex + i + 1, competency, question, latency_ms: ms, error: null });
      previousQuestions.push(question); // advance the pillar mapping for next iteration
    } catch (err) {
      console.error(`[DEBUG-S3]   Q${startIndex + i + 1} ERROR:`, err.message);
      results.push({ index: startIndex + i + 1, competency, question: null, latency_ms: Date.now() - start, error: err.message });
      previousQuestions.push("[error]"); // still advance so pillar mapping stays correct
    }
  }

  res.json({
    set: 3,
    params: { startIndex, difficulty, runs },
    results,
  });
});

module.exports = router;

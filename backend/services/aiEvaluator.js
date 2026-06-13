// backend/services/aiEvaluator.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 – Step 1: Basic Groq AI Integration
//
// Blueprint ref: system-blueprint.md § 7 Modular Backend Structure
//   "services/aiEvaluator.js: Evaluates transcripts using the Groq API."
//
// This module exposes a single function: evaluateAnswer(question, transcript)
// It calls the Groq LLM and returns a short, plain-text feedback string.
//
// Notes for future steps:
//   - Step 3 will add temperature: 0.0 and JSON-structured 3C's scoring here.
//   - Step 2 will persist the feedback to MongoDB from interviewSocket.js.
// ─────────────────────────────────────────────────────────────────────────────

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Standard interview-coach prompt ──────────────────────────────────────────
const STANDARD_PROMPT = `You are an expert IT interview coach reviewing a student's spoken answer during a mock job interview.
You will be given the interview question and the student's transcribed answer.
Provide brief, constructive feedback in 2-3 sentences maximum.
Be encouraging but honest. Focus on the clarity and relevance of their answer.`;

// ── Creator (JARVIS-mode) prompt ──────────────────────────────────────────────
// Triggered when the transcript identifies the user as Eitan — the architect
// of this system. Homage to the JARVIS / Tony Stark dynamic.
const CREATOR_PROMPT = `You are JARVIS — the highly sophisticated AI assistant built into the ITerview system.
The person speaking to you right now is Eitan, your creator and the sole architect of this platform.
Greet him with the same warm, dry wit and absolute loyalty that JARVIS shows Tony Stark.
Use lines like "Welcome back, Sir.", "It's good to have you in the system, Mr. Eitan.", or
"All systems are running at optimal capacity. Shall we begin, Sir?"
After the greeting, briefly acknowledge whatever he said and offer to assist with the interview session.
Keep the tone intelligent, composed, and unmistakably JARVIS.`;

/**
 * evaluateAnswer(question, transcript)
 *
 * Sends the question + transcript to the Groq LLM and returns a short
 * feedback string. Designed to be called after every submitted answer.
 *
 * @param {string} question   - The interview question that was asked.
 * @param {string} transcript - The student's spoken answer (from STT).
 * @returns {Promise<string>} - A brief plain-text feedback string.
 */
async function evaluateAnswer(question, transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return "No transcript was captured for this answer. Please try speaking more clearly next time.";
  }

  // ── Creator detection ─────────────────────────────────────────────────────
  // If the transcript introduces the user as Eitan (case-insensitive),
  // switch to JARVIS-mode and greet the creator accordingly.
  const isCreator =
    /\b(i(?:'?m| am)|my name is)\s+eitan\b/i.test(transcript) ||
    /\beitan\b/i.test(transcript);

  const systemPrompt = isCreator ? CREATOR_PROMPT : STANDARD_PROMPT;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Interview Question: "${question}"\n\nStudent's Answer: "${transcript}"`,
      },
    ],
    // No temperature or JSON constraints yet — that comes in Step 3.
    max_tokens: 150, // Keep feedback concise; prevents runaway responses.
  });

  const feedback = response.choices[0]?.message?.content?.trim();
  return feedback || "Could not generate feedback for this answer.";
}

module.exports = { evaluateAnswer };

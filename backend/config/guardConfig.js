// backend/config/guardConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL GUARDRAILS — Configuration of global constraints for LLM generation.
// Houses prompt snippets to ensure TTS compatibility and difficulty boundaries.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt instruction to ensure the generated text is 100% safe for Text-to-Speech (TTS) engines.
 * Forbids programming syntax, code symbols, backticks, dot-notation, and HTML tags.
 */
const TTS_SAFETY = `TTS SAFETY — ABSOLUTE CHARACTER BAN:
The question will be read aloud by a text-to-speech engine. The following characters and patterns are STRICTLY FORBIDDEN in ANY part of the question text:
  - Backtick characters of any kind — NEVER wrap a word in backticks
  - Dot-notation of any kind — never write a property or method name using a dot between two words; always describe it in plain English (e.g. "the textContent property", "the display style property", "the get element by ID method")
  - Slash characters — do not join two words or acronyms with a slash; use "and" or "or" instead
  - Angle brackets — do not write HTML tag names using angle brackets; refer to them by their plain English name instead
  - Curly braces, square brackets, or parentheses used as code syntax
  - Quotes used to wrap inline code terms — just name the value in plain English
  - Arrow notation of any kind
  - CamelCase method or property names — do not write any identifier that combines multiple words without spaces; always convert to plain English words with spaces (e.g. "the add event listener method", "the inner HTML property")
All questions must be written in plain, natural spoken English only. Read the question aloud in your head before outputting it — if any character or word pattern would sound unnatural when spoken, remove it.`;

/**
 * General technical topic bans to lock down question generation to Easy (junior / fresh graduate) level.
 * Prevents complex engineering concepts and LeetCode problems from slipping in.
 */
const EASY_AVOID_LIST = `STRICT TOPIC BAN — Do NOT ask about any of the following:
- Frameworks or libraries (React, Vue, Angular, Express internals, ORM tools)
- System design, architecture decisions, or scalability trade-offs
- Web security internals (JWT signing, OAuth flows, CSRF tokens)
- DevOps, deployment, CI/CD, Docker, or Kubernetes
- Anything requiring real-world industry or production experience
- Pure data structure/algorithm exercises (such as sorting arrays, finding duplicates, or LeetCode-style algorithmic puzzles)
- Questions where writing or reading code is REQUIRED to answer — the candidate should be able to answer using concepts and plain language only
- Multi-step debugging scenarios that require tracing through more than one possible cause — keep it to ONE clear concept per question`;

/**
 * Behavioral prompt restrictions to guide the STAR method generator in Set 3.
 * Prevents technical questions, future-tense hypotheticals, or multi-sentence compounds.
 */
const BEHAVIORAL_AVOID_LIST = `STRICT TOPIC BAN — Do NOT generate any of the following:
- Technical questions: Do NOT ask about code, algorithms, system design, or anything requiring a technical/factual answer.
- Hypothetical future scenarios using "What would you do if...": The question MUST ask about a REAL past experience ("Tell me about a time...", "Describe a situation...", "Give me an example...").
- Questions requiring commercial work experience: The candidate is a fresh graduate. All questions must be answerable with academic projects, personal projects, group coursework, hackathons, or internships.
- Multi-part or compound questions: The question MUST be a single, clear sentence. Avoid appending secondary clauses or sub-questions (like "and tell me what you learned" or "and describe how you felt"). The candidate already knows to use the STAR method. Keep it to a single main question with simple synonyms.
- Overly vague or generic openers like "Tell me about yourself" or "What are your strengths?": These are not behavioral STAR questions.
- Any self-reflection or opinion questions: The question must ask about a SPECIFIC past event, not the candidate's general personality or preferences.`;

module.exports = {
  TTS_SAFETY,
  EASY_AVOID_LIST,
  BEHAVIORAL_AVOID_LIST,
};

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
- Advanced framework or library internals; basic purposes of tools in the role scope are allowed
- System design, architecture decisions, or scalability trade-offs
- Web security internals (JWT signing, OAuth flows, CSRF tokens)
- Production deployment operations or complex infrastructure; basic definitions in the role scope are allowed
- Anything requiring real-world industry or production experience
- Pure data structure/algorithm exercises (such as sorting arrays, finding duplicates, or LeetCode-style algorithmic puzzles)
- Questions where writing or reading code is REQUIRED to answer — the candidate should be able to answer using concepts and plain language only
- Multi-step debugging scenarios that require tracing through more than one possible cause — keep it to ONE clear concept per question`;

// Positive calibration complements the topic bans: no industry experience
// alone does not define a suitable classroom-level question.
const EASY_QUESTION_STYLE = `CLASSROOM-LEVEL QUESTION STANDARD:
- Assume a student practicing material from introductory lessons or basic lab exercises, with varying confidence and limited project experience.
- Ask about ONE familiar concept or ONE small task from the selected topic, not every item named in its topic description.
- Require at most ONE reasoning step. Do not request a whole process, a start-to-finish walkthrough, or an additional explanation, example, or reason after the main task.
- Use short, plain wording and familiar classroom or small-project contexts when a context is useful. Avoid unnecessary jargon, trick questions, and exact method or command recall.
- Prefer direct wording such as What is, What does, Why does, or Name two. Avoid repeated introductions such as How would you explain what. Aim for 8 to 18 words and never exceed 24 words.
- The task should be fully answerable in one to three short sentences, or a brief list when listing is requested. A short correct answer in the student's own words is sufficient.
- Never combine a definition with when to use it, a reason, or an example. Before returning the question, check that a sufficient answer needs only the single task requested.
- Prefer a clear question about an important fundamental over unusual wording or a less familiar topic just to make the question novel.`;

// Shared by every Set 2 role. Topics and concrete vocabulary come from role data.
const EASY_TECHNICAL_QUESTION_STYLE = `INTRODUCTORY TECHNICAL VARIETY STANDARD:
- Assume a student with introductory lessons, limited confidence, and little practice in the selected specialty. Do not assume enthusiasm for that specialty or completed projects.
- Ask ONE task in the selected format: a concept, purpose, comparison, expected behavior, two simple test cases, or a practical action. Require at most ONE reasoning step and one or two short sentences, or the requested two-item list.
- Direct concept and purpose questions are welcome. Familiar technical vocabulary is allowed; do not turn every knowledge question into a two-choice scenario.
- Prefer open questions. If supplying two alternatives, both must be plausible and the stated need must distinguish them. At most ONE two-choice question is allowed in a five-question session.
- Include all information needed to answer. Never ask the student to invent or guess a project's endpoint, route, file, configuration, or naming convention. If choosing an existing resource, describe the TWO available resources in plain language.
- The stated situation must distinguish the alternatives. State whether requested information exists before asking whether to return it or report it missing. State which field is required before asking which field to check. Resource descriptions must explicitly contain the requested information; never assume a general record contains an unspecified detail. If both alternatives could be correct from the information given, rewrite the situation.
- State the specific desired effect, rather than subjective goals such as better, nicer, or stand out. Ask for a larger appearance or a different color when those are the alternatives. For adapting to a small screen, state that the current arrangement does not fit. Avoid vague responsibilities such as preparing or handling information when different parts could do that work; specify the exact small task. Avoid unsupported design choices where several approaches would work equally well.
- Avoid selecting among specialist variants of a basic concept, converting received data, tracing implementation, diagnosing failures, or choosing an exact method or command.
- A purpose or comparison is a complete task by itself. Do not append a reason, example, code, or another task. Testing asks exactly two simple cases for one bounded behavior, without giving the cases away.
- Aim for 8 to 18 words and never exceed 24 words. Use direct spoken English. Vary everyday contexts; student registration is optional.
- Avoid the same tested decision or fact as an earlier question. Changing a person's name, the application, or the data fields does not create a different task. Use an unasked topic before revisiting a covered topic.
- Before returning the question, check that it matches the selected format, has an accurate premise, and is answerable without hidden project knowledge.`;

/**
 * General technical topic bans to lock question generation to Medium (junior / conceptual application) level.
 * Slightly more permissive than EASY_AVOID_LIST — allows basic middleware and simple Express routes,
 * but still bans advanced system design, security internals, DevOps, and complex multi-step debugging.
 */
const MEDIUM_AVOID_LIST = `STRICT TOPIC BAN — Do NOT ask about any of the following:
- Advanced framework internals, complex ORMs, or state-management libraries (e.g., Redux middleware, Sequelize transactions)
- Enterprise system design, distributed microservices, or cloud architectures (AWS, GCP)
- Advanced web security (OAuth2 flows, JWT signature details, CSRF mitigation mechanics)
- Complex deployment operations, orchestration, or infrastructure troubleshooting requiring production experience
- Anything requiring commercial, production-level, or team-collaboration experience
- LeetCode-style algorithmic puzzles or complex data structure operations
- Questions requiring reading or writing code — candidates must be able to answer using plain language and concepts
- Multi-step troubleshooting scenarios requiring more than two debugging steps`;

const MEDIUM_QUESTION_STYLE = `JUNIOR CONCEPTUAL APPLICATION STANDARD:
- Assume a fresh graduate who has practiced core concepts in small academic or personal projects, with no commercial experience.
- Ask ONE focused task about a selected concept in context. Require at most TWO reasoning steps, answerable in one to three short sentences or the requested brief list.
- Clarity tests explaining one mechanism or purpose in plain language; correctness tests one accurate behavior or focused comparison; completeness requests exactly TWO distinct relevant items from a bounded category.
- Use short, direct spoken English. Aim for 12 to 24 words and never exceed 32 words. Familiar technical terms in the selected topic are allowed; exact syntax, command recall, and obscure API names are not.
- A short request flow or simple cause-and-effect explanation is allowed. Do not ask for a full implementation, an end-to-end walkthrough, or an investigation across several layers.
- Do not append a reason, example, implementation, or second question to the main task. Supply the conditions needed for a comparison or expected behavior.
- Use ONE stated situation, not two separate requests or scenarios whose outcomes must both be answered. A focused comparison of two concepts remains allowed.
- Verify that the premise is accurate. State the relevant scope, setting, or result instead of implying a concept always guarantees an outcome. Never invent a guaranteed behavior or an unspecified value.
- Keep internal constraints out of the question. Do not repeat phrases such as in a small project or without syntax unless they are needed to answer.
- Prefer an important concept in a familiar context over an unusual topic or wording for novelty. Benchmarks guide demand and format; do not make a question harder merely to avoid resembling them.`;

const MEDIUM_TECHNICAL_QUESTION_STYLE = `JUNIOR TECHNICAL VARIETY STANDARD:
- Assume practice with core concepts and small academic or personal projects, with no production experience.
- Ask ONE task in the selected format: a mechanism, purpose, comparison, prediction, two test cases, practical action, diagnosis, or bounded decision. Require at most TWO reasoning steps and a one-to-three-sentence answer.
- Open-ended answers are welcome when basic technical knowledge and plain language suffice. Choices are optional; do not require exact method names, syntax, or commands.
- Provide enough evidence to answer. For diagnosis, describe a specific symptom and relevant condition instead of asking the candidate to guess among many unrelated causes. For a first check, state the affected operation and failure.
- State the required field, available resource, expected result, or storage lifetime when it determines the answer. Accept valid alternative solutions that satisfy the stated need.
- Mechanism, purpose, and comparison questions do not require an invented situation. When a situation is useful, include its relevant conditions. Avoid merely renaming an easy question as medium; ask for an explanation, distinction, or application beyond recognizing a term.
- A bounded decision asks why an approach fits one stated requirement; its reason is the single task. A testing question asks exactly two cases or checks for one bounded behavior. Do not append another reason, example, or implementation task.
- Prefer open questions; at most ONE two-choice question is allowed per five-question session. Vary contexts instead of repeatedly using student registration.
- Avoid full application walkthroughs, broad debugging across layers, and production incidents. A simple diagnosis or small corrective action is sufficient.
- Verify that the premise and requested fix are consistent. State the required field or actual setting instead of leaving the candidate to infer it. Do not imply a failed selection succeeded, or that a later CSS rule loses under conditions where it must win.
- Keep internal constraints out of the question. Avoid repeating in a small project, one single step, or other prompt instructions in the question itself.
- Aim for 12 to 24 words and never exceed 32 words, in one clear sentence using natural spoken English.
- Avoid the same tested decision or fact as earlier questions. Prefer an unasked topic before revisiting a covered category. Benchmarks guide demand and format without requiring unfamiliar novelty.`;

/**
 * General technical topic bans for Hard (advanced junior) difficulty questions.
 * Allows intermediate junior topics (middleware, token auth, database scaling basics)
 * but bans senior/enterprise-level concepts and anything requiring code to answer.
 */
const HARD_AVOID_LIST = `STRICT TOPIC BAN — Do NOT ask about any of the following:
- High-level enterprise system design or multi-region system scalability (e.g. AWS Multi-AZ setups, CDN edge routing).
- Complex DevOps pipelines, container orchestrators (Kubernetes clusters, multi-node Docker Swarm), or deep cloud networking (VPCs, Subnets).
- Highly advanced algorithmic challenges (such as writing self-balancing trees or complex graph traversals).
- Anything requiring senior-level commercial or team-management experience.
- Questions where reading or writing long code blocks is REQUIRED — candidates must be able to answer using plain language and concepts.`;

/**
 * Behavioral prompt restrictions to guide the STAR method generator in Set 3.
 * Prevents technical questions, future-tense hypotheticals, or multi-sentence compounds.
 */
const BEHAVIORAL_AVOID_LIST = `STRICT TOPIC BAN — Do NOT generate any of the following:
- Technical questions: Do NOT ask about code, algorithms, system design, or anything requiring a technical/factual answer.
- Hypothetical future scenarios using "What would you do if...": The question MUST ask about a REAL past experience ("Tell me about a time...", "Describe a situation...", "Give me an example...").
- Questions requiring commercial work experience or coding achievements: Allow ordinary school assignments, presentations, group activities, personal projects, volunteering, or internships. Do not require a programming project, difficult bug, major failure, or leadership position.
- Unrelated multi-part questions: Ask about ONE past event with ONE primary competency. Include one brief probe for the candidate's action and the outcome or lesson from that same event. Do not request a second story, stack unrelated competencies, or add a list of interview questions.
- Overly vague or generic openers like "Tell me about yourself" or "What are your strengths?": These are not behavioral STAR questions.
- Any self-reflection or opinion questions: The question must ask about a SPECIFIC past event, not the candidate's general personality or preferences.`;

// Spoken-word ceilings have modest room beyond the concise prompt targets.
// A few extra words should not force a repair of an otherwise usable question.
const QUESTION_WORD_LIMITS = { easy: 36, medium: 48, hard: 66, behavioral: 78 };

module.exports = {
  QUESTION_WORD_LIMITS,
  TTS_SAFETY,
  EASY_AVOID_LIST,
  EASY_QUESTION_STYLE,
  EASY_TECHNICAL_QUESTION_STYLE,
  MEDIUM_AVOID_LIST,
  MEDIUM_QUESTION_STYLE,
  MEDIUM_TECHNICAL_QUESTION_STYLE,
  HARD_AVOID_LIST,
  BEHAVIORAL_AVOID_LIST,
};

// Spoken Set 2 formats. Difficulty limits and role topics are separate from format.
const TECHNICAL_QUESTION_FORMATS = {
  concept: 'Ask what one familiar concept means or does, using What is or What does. For medium, explain one mechanism rather than merely naming a term.',
  purpose: 'Ask why one practice or tool is useful, using Why or What is the purpose. Request only its purpose.',
  comparison: 'Ask for one distinction between two related concepts, using How does ... differ or What is the difference. Do not append uses or examples.',
  prediction: 'State the relevant conditions and ask what happens or what the outcome would be. Do not ask for a fix.',
  testing: 'Ask for exactly two simple test cases or checks for one bounded behavior, using Name two test cases or What two checks. Do not supply the answers.',
  application: 'Give one familiar need and ask which action fits, using Which, What should, or When should. Prefer an open answer; two plausible alternatives are optional.',
  diagnosis: 'Describe one specific symptom with enough evidence and ask what could cause it or what to check first. Do not require a broad investigation.',
  decision: 'State one requirement and ask why one approach would be preferred to another, using Why would you prefer. The reason is the single task.',
};

const EASY_TECHNICAL_FORMATS = ['concept', 'purpose', 'comparison', 'prediction', 'testing', 'application'];
const MEDIUM_TECHNICAL_FORMATS = [...EASY_TECHNICAL_FORMATS, 'diagnosis', 'decision'];
const HARD_TECHNICAL_FORMATS = [...MEDIUM_TECHNICAL_FORMATS];
// Keep familiar formats, but raise the reasoning demand rather than just the vocabulary.
const HARD_TECHNICAL_FORMAT_INSTRUCTIONS = {
  concept: 'Ask How does one mechanism produce or prevent a specific effect; require a causal explanation, not a definition.',
  purpose: 'Ask Why one safeguard or optimization matters under a stated constraint or failure risk; require the technical reason.',
  comparison: 'Ask How does one approach differ from another in one stated consequence or trade-off; avoid a generic list of definitions.',
  prediction: 'State the relevant execution, timing, or concurrency conditions and ask What happens or What outcome follows; no code tracing or fix.',
  testing: 'Ask Name two test cases or What two checks for one bounded failure risk or interaction; require distinct cases rather than a happy-path checklist.',
  application: 'State a constraint or failure risk and ask Which action or What should be done to satisfy it; require a fitting safeguard or optimization, not API-name recall.',
  diagnosis: 'Give a specific symptom and discriminating evidence and ask What could cause it or What to check first; do not give the cause away or ask for a broad investigation.',
  decision: 'State a meaningful constraint and ask Why would you prefer one approach over another; require a justified trade-off rather than a choice alone.',
};

module.exports = { TECHNICAL_QUESTION_FORMATS, EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS,
  HARD_TECHNICAL_FORMATS, HARD_TECHNICAL_FORMAT_INSTRUCTIONS };

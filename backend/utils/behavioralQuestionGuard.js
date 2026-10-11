const { getQuestionLengthIssue } = require('./questionWording');

// Recognizable wording checks only. Competency markers do not establish semantic
// validity or equivalent question demand; those require HR review and a pilot.
function getBehavioralQuestionIssue(question, competency, previousQuestions = [], angle = null, { requireEvidenceProbe = false, enforceAngle = true } = {}) {
  if (!/^(?:(?:can|could|would) you (?:please )?)?(?:tell (?:me|us) about (?:a time|an occasion|a situation)\b|describe (?:a time|a situation|an occasion|an experience)\b|give (?:me |us )?an example of (?:a time|a situation)\b|share (?:a time|an experience|an example|a situation)\b|(?:recall|recount) (?:a time|an occasion|an experience|a situation)\b|think back to (?:a time|an occasion|a situation)\b)/i.test(question)) {
    return 'Ask for one actual past occasion using a short behavioral opener.';
  }
  const sentences = question.trim().split(/[.!?]+(?:\s+|$)/).filter(Boolean);
  if ((question.match(/\?/g) || []).length > 2 || sentences.length > 2 || /[\r\n]/.test(question)) {
    return 'Use at most two sentences: one past event and one brief action/outcome probe.';
  }
  if (/[`<>{}\[\]\/]|=>|->|\b\w+\.\w+\b/.test(question)) {
    return 'Use plain spoken English without code, markup, or revision notation.';
  }
  if (/\b(?:another|second|different) (?:time|occasion|example|situation)\b/i.test(question)
    || (sentences[1] && !/^(?:what|how|explain|describe|share)\b/i.test(sentences[1]))) {
    return 'Keep the probe about your action and outcome in the same event; do not request another story.';
  }
  const evidenceProbe = sentences[1] || question;
  const hasAction = /\b(?:what (?:did you|you did|was your|part did you|role did you|steps)|how (?:did you|you)|your (?:own |personal )?(?:actions?|contribution|response|approach|role|involvement)|steps (?:did you|you))\b/i.test(evidenceProbe);
  const hasOutcome = /\b(?:outcome|result\w*|happen\w*|learn\w*|lesson\w*|impact|effects?|affect\w*|turn(?:ed)? out|came (?:of|out)|chang(?:e|ed)|difference)\b/i.test(evidenceProbe);
  if (requireEvidenceProbe && (!hasAction || !hasOutcome)) {
    return 'Include a short probe for your own action and the outcome or lesson from that same event.';
  }
  if (/\b(?:would|hypothetical|imagine|suppose)\b/i.test(question)) {
    return 'Request a real past event rather than a hypothetical response.';
  }
  if (/\b(?:biggest|greatest|worst|most difficult|major failure|serious conflict|crisis|trauma|traumatic|mental health|religion|political|marital|disability|diagnosis|family hardship)\b/i.test(question)) {
    return 'Use an ordinary task or setback without superlatives or sensitive personal disclosures.';
  }
  if (/\b(?:production|commercial|professional experience|client project|managed employees|algorithm|hackathon)\b|\b(?:write|implement|explain) (?:the |some |an? )?(?:code|algorithm)\b/i.test(question)) {
    return 'Ask about transferable behavior without requiring technical achievements or commercial experience.';
  }
  if (/\b(?:successfully|resolved|won|excelled|mastered|quickly|rapidly|respectfully|patiently|active listening|compromise)\b/i.test(question)) {
    return 'Use neutral response wording without requiring success, speed, pressure, or prescribing the ideal behavior.';
  }
  if (/\b(?:on your own|alone|without help|without asking|without (?:any )?assistance)\b/i.test(question)) {
    return 'Do not require independent work without help; keep appropriate help-seeking available.';
  }
  const lengthIssue = getQuestionLengthIssue(question, 'behavioral');
  if (lengthIssue) return lengthIssue;
  // When angles are preferences, their broad markers (for example unfamiliar)
  // must not substitute for the selected competency. Check the requested event,
  // rather than incidental words in its evidence probe.
  const competencyText = enforceAngle ? question : sentences[0];
  if (!competency.questionMarkers.test(competencyText) && !(enforceAngle && angle && angle.markers.test(question))) {
    return 'Make the selected competency visible in the event requested.';
  }
  if (competency.responseMarkers && !competency.responseMarkers.test(question) && !hasAction) {
    return 'Ask about responding to the disagreement, mistake, or setback, not merely experiencing it.';
  }
  if (enforceAngle && angle && !angle.markers.test(question)) {
    return 'Use the selected event angle instead of returning to a generic competency question.';
  }
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (previousQuestions.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different event question within the current competency.';
  }
  return null;
}

module.exports = { getBehavioralQuestionIssue };

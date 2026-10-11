const { getTechnicalVarietyIssue } = require('./technicalQuestionVariety');
const { getTechnicalPremiseIssue } = require('./technicalQuestionPremise');
const { getQuestionTask, getQuestionSentenceIssue, isQuestionWalkthrough, getQuestionLengthIssue } = require('./questionWording');

// Recognizable wording problems only. Topic scope and calibration carry semantic
// difficulty; these checks cannot prove correctness or catch every paraphrase.
function getHardSet2QuestionIssue(question, history = [], selectedFormat) {
  const task = getQuestionTask(question);
  const sentenceIssue = getQuestionSentenceIssue(question);
  if (sentenceIssue) return sentenceIssue;
  if (/[`<>{}\[\]\/\\]/.test(question)
    || /\b\w+\.\w+\b|=>|->|\w+\s*\(\)/.test(question)
    || /\b[a-z]+[A-Z][A-Za-z]*\b/.test(question)) {
    return 'Use plain spoken English without code syntax, tags, slashes, or camel case identifiers.';
  }
  if (isQuestionWalkthrough(question)
    || /\b(?:design|build|architect)\b.*\b(?:entire|complete|multi.region|enterprise)\b/i.test(question)) {
    return 'Use one bounded advanced-junior task, not a full implementation, investigation, or system-design walkthrough.';
  }
  // A reason tied to the same answer is allowed; unrelated appended tasks are not.
  if (/\b(?:and|also)\s+(?:(?:then\s+)?(?:describe|give|provide|name|list|show|implement|write)|how|when|what|which|where)\b/i.test(task)
    || /\b(?:and|also)\s+explain\b(?!\s+(?:why|(?:your|the)\s+reason(?:ing)?\b))/i.test(task)
    || /[,;]\s*(?:explain|describe|justify|give|provide|implement|write)\b/i.test(task)) {
    return 'Remove the appended task; ask one mechanism, trade-off, outcome, test pair, action, or diagnosis.';
  }
  if (/\b(?:exact syntax|method signature|write (?:the |a |some )?code|code snippet|which command|name (?:the|a) (?:method|hook))\b/i.test(question)) {
    return 'Test technical reasoning instead of code, command, or API-name recall.';
  }
  if (/^what (?:is|are) (?!the (?:impact|effect|risk|trade.off)\b)/i.test(task)
    || /^what does\b.*\b(?:mean|do|stand for)\b/i.test(task)
    || /^(?:explain|describe)\s+what\s+(?:an?|the)\s+[\w -]+?\s+(?:is|means|stands for)$/i.test(task)
    || /^(?:is|are|does|do|can|should|would)\b/i.test(task)) {
    return 'Replace the definition or yes-or-no task with a mechanism, consequence, or justified action within the selected hard topic.';
  }
  if (/\b(?:test cases?|test scenarios?|tests?|checks?)\b/i.test(question)
    && /^(?:name|list|what (?:two|three|four|five|\d+))/i.test(question)
    && !/\b(?:two|2)\b/i.test(question)) {
    return 'Request exactly two distinct test cases or checks for one bounded behavior.';
  }
  const lengthIssue = getQuestionLengthIssue(question, 'hard');
  if (lengthIssue) return lengthIssue;
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (history.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different task within the selected topic instead of repeating an already-asked question.';
  }
  return getTechnicalPremiseIssue(question) || getTechnicalVarietyIssue(question, history, selectedFormat, 'hard');
}

module.exports = { getHardSet2QuestionIssue };

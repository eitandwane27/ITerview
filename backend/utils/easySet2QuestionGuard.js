const { getTechnicalVarietyIssue } = require('./technicalQuestionVariety');
const { getTechnicalPremiseIssue } = require('./technicalQuestionPremise');
const { getQuestionTask, getQuestionSentenceIssue, isQuestionWalkthrough, getQuestionLengthIssue } = require('./questionWording');

// Set 2 only: introductory knowledge, reasoning, and practical tasks.
function getEasySet2QuestionIssue(question, previousQuestions = [], selectedFormat) {
  const task = getQuestionTask(question);
  const sentenceIssue = getQuestionSentenceIssue(question);
  if (sentenceIssue) return sentenceIssue;
  if (/[`<>{}\[\]]/.test(question)
    || /\b\w+\.\w+\b|=>|->|\w+\s*\(\)/.test(question)) {
    return 'Use plain spoken English without code syntax, tags, or method calls.';
  }
  if (/\b[a-z]+[A-Z][A-Za-z]*\b/.test(question)) {
    return 'Use ordinary spoken names with spaces instead of camel case identifiers.';
  }
  if (isQuestionWalkthrough(question)) {
    return 'Ask for one short technical task, not a procedure or application walkthrough.';
  }
  if (/\b(?:and|also)\s+(?:(?:then\s+)?(?:explain|describe|tell|give|provide|name|list|show)|how|why|when|what|which|where)\b/i.test(task)
    || /[,;]\s*(?:explain|describe|justify|give|provide)\b/i.test(task)) {
    return 'Remove the appended task; ask for one explanation, comparison, prediction, test list, or action.';
  }
  if (/\b(?:debug|diagnos\w*|troubleshoot\w*|bug|typo|not working|does not work|doesn't work|fails? to|why.*(?:not|fail))\b/i.test(question)) {
    return 'Replace debugging or cause diagnosis with one straightforward choice or action in a working classroom example.';
  }
  if (/\b(?:exact|syntax|signature|command|method name)\b/i.test(question)
    || /\b(?:property|properties|value|values)\b.*\b(?:flexbox|responsive|layout|row|side by side)\b|\b(?:flexbox|responsive|layout)\b.*\b(?:property|properties|value|values)\b/i.test(question)) {
    return 'Ask for a familiar tool or action, not exact syntax, commands, or layout property recall.';
  }
  if (/\b(?:which|what)\s+(?:[a-z]+\s+){0,5}(?:endpoint|route|file|configuration)\b/i.test(question)
    && !/^what (?:is|does)\b/i.test(question)
    && !/\bor\b/i.test(question)) {
    return 'Do not ask for an unspecified project resource; state two available resources in plain language or ask for a simple action.';
  }
  if (/\breturn\b.*\bor\b.*\bmissing\b/i.test(question)
    && !/\b(?:if|when|because|exists?|available|does not exist)\b/i.test(question)) {
    return 'State whether the requested information exists before asking whether to return it or report it missing.';
  }
  if (/\bcheck\b.*\bfield\b/i.test(question)
    && !/\brequired\b/i.test(question)) {
    return 'State which field is required, or ask for one simple action when an explicitly required field is missing.';
  }
  if (/\b(?:list|array)\b.*\bor\b.*\b(?:labeled pairs|object)\b|\b(?:labeled pairs|object)\b.*\bor\b.*\b(?:list|array)\b/i.test(question)) {
    return 'Do not ask for a data-structure design choice; use a familiar stated format choice or one simple action.';
  }
  if (/\b(?:font size|text size)\b.*\bor\b.*\bcolor\b|\bcolor\b.*\bor\b.*\b(?:font size|text size)\b/i.test(question)
    && /\b(?:stand out|better|nicer)\b/i.test(question)) {
    return 'Name a specific effect such as larger text or a different color; either alternative could make text stand out.';
  }
  if (/\b(?:group\w*|together)\b.*\bor\b.*\bseparate\b/i.test(question)) {
    return 'Avoid a grouping-versus-separate-message design decision; ask for a stated familiar format choice.';
  }
  if (/\bprepare\b.*\blist\b|\blist\b.*\bprepare\b/i.test(question)
    && /\bfrontend\b/i.test(question) && /\bbackend\b/i.test(question)) {
    return 'Specify a concrete responsibility such as displaying or retrieving the list; preparing it could involve either part.';
  }
  if (/\b(?:pars(?:e|ing)|serializ\w*|deserializ\w*|convert\w*)\b/i.test(question)
    || /\b(?:json|received data)\b.*\bbefore\s+(?:displaying|showing)\b/i.test(question)) {
    return 'Keep the task at basic use or choice, without parsing, serialization, or data conversion.';
  }
  if (/\b(?:which|what)\s+(?:[a-z]+\s+){0,5}loop\b/i.test(question)
    && !/^what (?:is|does|happens)\b.*\bgame loop\b/i.test(task)) {
    return 'Ask whether repetition is needed, not which specific loop variant to use.';
  }
  const lengthIssue = getQuestionLengthIssue(question, 'easy');
  if (lengthIssue) return lengthIssue;
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (previousQuestions.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different application task within the selected topic instead of repeating an already-asked question.';
  }
  return getTechnicalPremiseIssue(question) || getTechnicalVarietyIssue(question, previousQuestions, selectedFormat);
}

module.exports = { getEasySet2QuestionIssue };

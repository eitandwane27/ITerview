// Narrow wording checks, not semantic topic or difficulty classification.
// Medium allows simple mechanisms and diagnosis, but still asks one small task.
const { getQuestionTask, getQuestionSentenceIssue, isItemListTask, isQuestionWalkthrough, getQuestionLengthIssue } = require('./questionWording');
function getMediumQuestionIssue(question, previousQuestions = []) {
  const task = getQuestionTask(question);
  const sentenceIssue = getQuestionSentenceIssue(question);
  if (sentenceIssue) return sentenceIssue;
  if (/[`<>{}\[\]]/.test(question)
    || /\b\w+\.\w+\b|=>|->|\w+\s*\(\)/.test(question)) {
    return 'Use plain spoken English without code syntax, tags, or method calls.';
  }
  if (/\b[a-z]+[A-Z][A-Za-z]*\b/.test(question)) {
    return 'Use ordinary spoken field or property names with spaces instead of camel case identifiers.';
  }
  if (isQuestionWalkthrough(question)) {
    return 'Replace the full walkthrough with one focused explanation, check, or action requiring at most two reasoning steps.';
  }
  if (/\b(?:each|both)\s+(?:case|scenario)s?\b/i.test(question)) {
    return 'Use one stated situation or one focused comparison, not separate scenarios requiring separate answers.';
  }
  if (/\b(?:empty|missing)\s+(?:(?:\w+)\s+){0,3}(?:field|username|name|email)\b/i.test(question)
    && /\bsav(?:e|es|ing)\b|\b(?:HTTP\s+)?status\b/i.test(question)
    && !/\b(?:required|requires?)\b/i.test(question)) {
    return 'State that the empty or missing field is required before asking for a save decision or error status.';
  }
  if (/\b(?:and|also)\s+(?:(?:then\s+)?(?:explain|describe|tell|give|provide|name|list|show|implement|write)|how|why|when|what|which|where)\b/i.test(task)
    || /\b(?:and|also)\s+for\s+(?:how|what|which)\b/i.test(task)
    || /[,;]\s*(?:explain|describe|justify|give|provide|implement|write)\b/i.test(task)) {
    return 'Remove the appended task; ask only for the main explanation, comparison, list, or application.';
  }
  if (/\b(?:exact syntax|method signature|write (?:the |a |some )?code|code snippet|which command)\b/i.test(question)) {
    return 'Ask for a conceptual answer or plain-language action rather than code or command recall.';
  }
  if (/\bflex\s*wrap(?:\s+property)?\s+is\s+set\b(?!\s+to\s+(?:wrap|no\s*wrap)\b)/i.test(question)) {
    return 'State whether the flex wrap setting allows wrapping; do not ask for behavior with an unspecified setting.';
  }
  if (/\btwo\b.*\brules\b/i.test(question)
    && /\b(?:which|what)\b.*\b(?:color|wins?|applies|shows?)\b/i.test(question)
    && !/\bequal(?:ly)?\s+specific(?:ity)?\b|\bsame specificity\b/i.test(question)) {
    return 'State that the two CSS rules have equal specificity before asking which later rule or color applies.';
  }
  if (/\brequest body\b/i.test(question) && /\bJSON\b/i.test(question)
    && /\b(?:convert\w*|encod\w*|need\w*)\b/i.test(question)
    && !/\b(?:uses?|using|expects?|requires?|formatted as|encoded as)\s+JSON\b|\bJSON (?:request|body)\b/i.test(question)) {
    return 'State that the request body uses or expects JSON; not every request body requires JSON text.';
  }
  const lengthIssue = getQuestionLengthIssue(question, 'medium');
  if (lengthIssue) return lengthIssue;
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (previousQuestions.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different task within the selected topic instead of repeating an already-asked question.';
  }
  return null;
}

function getMediumSet1QuestionIssue(question, focus, previousQuestions = []) {
  const issue = getMediumQuestionIssue(question, previousQuestions);
  if (issue) return issue;
  const task = getQuestionTask(question);
  if (focus && focus !== 'focus_completeness' && (isItemListTask(question, 2) || isItemListTask(question, 3))) {
    return 'Reserve item lists for completeness; ask one mechanism, behavior, or comparison for this focus.';
  }
  if (focus === 'focus_clarity' && /\b(?:difference|differ|compar(?:e|ed|ing|ison)|versus|while one)\b/i.test(question)) {
    return 'Clarity asks for one mechanism or purpose; reserve comparisons for correctness.';
  }
  const requestedTask = task.replace(/^when\b[^,;]*[,;]\s*/i, '');
  if (focus === 'focus_clarity' && /^(?:which\s+(?:[a-z]+\s+){0,3}(?:color|rule|element|option|choice|status|response)\b|what should|what happens|when should)\b/i.test(requestedTask)) {
    return 'Clarity asks how one mechanism works or why it serves a purpose; reserve selecting an outcome for correctness.';
  }
  if (focus === 'focus_correctness' && /\b(?:which|what)\s+two\b|^(?:name|list|give|identify|mention)\b/i.test(task)) {
    return 'Correctness asks for one behavior or focused comparison; reserve two-item lists for completeness.';
  }
  if (focus === 'focus_correctness'
    && /(?:^|[,;]\s*)(?:why|is|are|does|do|can|should|would)\b/i.test(task)) {
    return 'Correctness asks for one accurate behavior, outcome or focused comparison; reserve why explanations for clarity and replace yes-or-no tasks with an explicit outcome.';
  }
  if (focus === 'focus_correctness' && /^(?:how|explain|describe)\b/i.test(task)
    && !/\b(?:differ|difference|different|compar(?:e|ed|ing|ison)|versus)\b/i.test(task)) {
    return 'Correctness asks for an accurate outcome or focused comparison; reserve mechanism explanations for clarity.';
  }
  if (focus === 'focus_completeness') {
    if (!isItemListTask(question, 2)) {
      return 'Request exactly two distinct relevant items from one bounded category.';
    }
    if (/\b(?:such as|for example|including|like)\b/i.test(question)) {
      return 'Remove the suggested answers from the requested list.';
    }
    if (/\band\s+(?:(?:the|their)\s+)?(?:purpose|meaning|region|role|use|reason)s?\b|\band\b.*\beach\b/i.test(question)) {
      return 'Request only the two items; remove the extra description, purpose, or region for each item.';
    }
  }
  return require('./technicalQuestionPremise').getTechnicalPremiseIssue(question);
}

function getMediumSet2QuestionIssue(question, previousQuestions = [], selectedFormat) {
  const issue = getMediumQuestionIssue(question, previousQuestions);
  if (issue) return issue;
  // Set 2 adds format variety to the shared wording and premise checks.
  const { getTechnicalPremiseIssue } = require('./technicalQuestionPremise');
  const { getTechnicalVarietyIssue } = require('./technicalQuestionVariety');
  return getTechnicalPremiseIssue(question) || getTechnicalVarietyIssue(question, previousQuestions, selectedFormat);
}

module.exports = { getMediumSet1QuestionIssue, getMediumSet2QuestionIssue };

// Catch recognizable violations seen in live easy batches. This is a narrow
// wording check, not a semantic difficulty or topic classifier.
const { getQuestionTask, getQuestionSentenceIssue, isItemListTask, isQuestionWalkthrough, getQuestionLengthIssue } = require('./questionWording');
function getEasySet1QuestionIssue(question, focus, history = []) {
  const sentenceIssue = getQuestionSentenceIssue(question);
  if (sentenceIssue) return sentenceIssue;
  if (/[`<>{}\[\]]|\b\w+\.\w+\b|=>|->|\w+\s*\(\)/.test(question)) {
    return 'Use plain spoken English without code syntax or method calls.';
  }
  if (isQuestionWalkthrough(question)) {
    return 'Ask about a concept or purpose, not an implementation procedure or walkthrough.';
  }
  if (/\b(?:and|also)\s+(?:(?:then\s+)?(?:explain|describe|tell|give|provide|name|list|show)|how|why|when|what|which|where)\b/i.test(question)) {
    return 'Remove the appended task; do not combine a definition with usage, an example, or a reason.';
  }
  if (/\b(?:flexbox|responsive|layout)\b.*\b(?:properties|property|values|value)\b|\b(?:properties|property|values|value)\b.*\b(?:flexbox|responsive|layout|row|side by side)\b/i.test(question)) {
    return 'Ask about the simple purpose of layout, not layout property or value recall.';
  }
  if (focus === 'focus_clarity' && /\b(?:difference|compar(?:e|ed|ing|ison)|versus)\b/i.test(question)) {
    return 'Clarity asks for one concept in the student\'s own words; reserve comparisons for correctness.';
  }
  if (focus === 'focus_correctness' && /^why\b/i.test(getQuestionTask(question))) {
    return 'Correctness asks for one basic fact or focused comparison; reserve causal explanations for clarity.';
  }
  // Android's explicit correctness scope excludes the purpose probe observed
  // in its live pilot. Preserve legacy roles' existing basic-fact allowance.
  if (focus === 'focus_correctness' && /\bAndroid\b/i.test(question)
    && /^what is (?:the )?purpose\b/i.test(getQuestionTask(question))) {
    return 'Reserve purpose explanations for clarity; ask one accurate behavior or focused comparison for correctness.';
  }
  if (focus && focus !== 'focus_completeness' && (isItemListTask(question, 2) || isItemListTask(question, 3))) {
    return 'Reserve item lists for completeness; ask one concept or fact for this focus.';
  }
  if (focus === 'focus_completeness') {
    if (/\b(?:responses?|outcomes?)\b/i.test(question)
      && /\b(?:does not exist|not found|missing record)\b/i.test(question)) {
      return 'Ask for two general request outcomes, not two outcomes for an already-missing record.';
    }
    if (/\b(?:such as|for example|including|like)\b/i.test(question)) {
      return 'Remove the suggested answers; ask only for the category and the two items.';
    }
    if (!isItemListTask(question, 2)) {
      return 'Request only two familiar items from one category.';
    }
    if (/\b(?:functions?|buttons?|clicks?)\b.*\b(?:can|could) do\b/i.test(question)
      || /\b(?:form elements?|controls?)\b.*\b(?:type|enter|typing)\b/i.test(question)) {
      return 'Choose a familiar bounded category, not arbitrary actions or multiple text-entry controls.';
    }
  }
  const lengthIssue = getQuestionLengthIssue(question, 'easy');
  if (lengthIssue) return lengthIssue;
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (history.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different question instead of repeating an already-asked question.';
  }
  return require('./technicalQuestionPremise').getTechnicalPremiseIssue(question);
}

module.exports = { getEasySet1QuestionIssue };

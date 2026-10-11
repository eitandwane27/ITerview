const { getTechnicalPremiseIssue } = require('./technicalQuestionPremise');
const { getQuestionTask, getQuestionSentenceIssue, isItemListTask, isQuestionWalkthrough, getQuestionLengthIssue } = require('./questionWording');

// Wording checks complement role scopes; they cannot classify semantic depth
// or guarantee factual correctness. Keep Set 1's 3C focus separate from Set 2.
function getHardSet1QuestionIssue(question, focus, history = []) {
  const sentenceIssue = getQuestionSentenceIssue(question);
  if (sentenceIssue) return sentenceIssue;
  const task = getQuestionTask(question);
  if (/[`<>{}\[\]\/\\]/.test(question)
    || /\b\w+\.\w+\b|=>|->|\w+\s*\(\)/.test(question)
    || /\b[a-z]+[A-Z][A-Za-z]*\b/.test(question)) {
    return 'Use plain spoken English without code, tags, method calls, slashes, or camel case identifiers.';
  }
  // "Design system" is a component-library noun, not a request to architect a system.
  if (isQuestionWalkthrough(question)
    || /\b(?:design|build|architect)\b.*\b(?:entire|complete|multi.region|enterprise|system)\b/i.test(question.replace(/\bdesign system\b/gi, 'component library'))) {
    return 'Ask one bounded advanced-junior 3C task, not a walkthrough or broad system design.';
  }
  // A connected cause/effect probe can serve the same clarity explanation.
  const taskWording = focus === 'focus_clarity'
    ? task.replace(/\band\s+(?:explain\s+)?(?:how|why)\b/gi, 'with the related explanation of') : task;
  if (/\b(?:and|also)\s+(?:(?:then\s+)?(?:explain|describe|tell|give|provide|name|list|show|implement|write)|how|why|when|what|which|where|does)\b/i.test(taskWording)
    || /\band\s+state\s+(?:the|what|which|how|whether)\b/i.test(taskWording)
    || /\bthen\s+(?:compare|explain|describe|name|list|state)\b/i.test(taskWording)
    || /,\s*naming\s+(?:the|its|two|three|\d+)\b/i.test(taskWording)
    || /[,;]\s*(?:explain|describe|justify|give|provide|implement|write)\b/i.test(taskWording)) {
    return 'Remove the appended task; request only the explanation, distinction, outcome, or list for the selected 3C focus.';
  }
  if (/\b(?:exact syntax|method signature|write (?:the |a |some )?code|code snippet|which command|name (?:the|a) (?:method|hook))\b/i.test(question)
    || /^what (?:is|are) (?!the (?:difference|distinction|effect|impact|risk|consequence|outcome|result|role|purpose)\b|(?:three|3)\b)/i.test(task)
    || /^what does\b.*\b(?:mean|stand for)\b/i.test(task)
    || /^(?:is|are|does|do|can|should|would)\b/i.test(task)
    || /;\s*(?:is|are|does|do|can|should|would)\b/i.test(task)) {
    return 'Test a mechanism, precise distinction, conditional outcome, or relevant list instead of definition, yes-or-no, or API-name recall.';
  }
  const lengthIssue = getQuestionLengthIssue(question, 'hard');
  if (lengthIssue) return lengthIssue;
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (history.some(previous => normalize(previous) === normalize(question))) {
    return 'Ask a different task in the selected topic rather than repeating an already-asked question.';
  }
  if (focus === 'focus_clarity') {
    if (/^(?:explain|describe|name|list|give|identify|mention)\s+(?:two|three|four|five|\d+)\b/i.test(task)
      || /^(?:which|what (?:happens|should|would|can|could))\b/i.test(task)
      || /^how\b.*\bdiffer\b/i.test(task)) {
      return 'Clarity needs an explanation of one mechanism or purpose; reserve comparisons and outcome selection for correctness.';
    }
  }
  if (focus === 'focus_correctness'
    && /\bwhat (?:does|do) each (?:result|piece of evidence)\b|\bwhat authorization does each source\b/i.test(task)) {
    return 'Ask one direct evidence comparison or one specified outcome, not separate conclusions for each observation or source.';
  }
  if (focus === 'focus_correctness'
    && (/^(?:name|list|give|identify|mention|why)\b/i.test(task)
      || /\b(?:which|what)\s+(?:two|three|\d+)\b/i.test(task)
      || /\bwhat name,\s*role,?\s*and\s*activation\b/i.test(task)
      || /^(?:how|explain|describe)\b/i.test(task) && !/\b(?:differ|difference|different|compar(?:e|ed|ing|ison)|versus)\b/i.test(task))) {
    return 'Correctness asks for one precise behavior, outcome, or focused comparison; reserve explanations and lists for the other 3Cs.';
  }
  if (focus === 'focus_completeness') {
    if (!isItemListTask(question, 3)) {
      return 'Request exactly three distinct relevant items from one bounded category; Name three, List three, or What are three are all valid.';
    }
    if (/\b(?:such as|for example|including|like)\b/i.test(question)
      || /\b(?:and|with)\s+(?:(?:the|their|a)\s+)?(?:purpose|meaning|role|use|reason|explanation|example)s?\b|\b(?:for|of)\s+each\b/i.test(question)
      || /\b(?:and|plus|with|along with)\s+(?:one|two|three|four|five|\d+)\b/i.test(question)) {
      return 'Request only the three items; remove suggested answers and explanations or examples for each item.';
    }
  }
  return getTechnicalPremiseIssue(question);
}

module.exports = { getHardSet1QuestionIssue };

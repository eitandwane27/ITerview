const { QUESTION_WORD_LIMITS } = require('../config/guardConfig');

// Normalize harmless presentation before validating a draft. Do not strip
// code or appended instructions: those must still pass the content guards.
function normalizeQuestionDraft(value) {
  let question = value.trim().replace(/^\s*\d+[.)]\s+/, '').trim();
  if (/^(?:"[\s\S]*"|'[\s\S]*'|“[\s\S]*”)$/.test(question)) question = question.slice(1, -1).trim();
  return question.replace(/\b(Node|Express|Vue|React|Next)\.js\b/gi, '$1 js');
}

function getQuestionTask(question) {
  const sentences = question.trim().split(/[.!?]+(?:\s+|$)/).filter(Boolean);
  let task = (sentences.at(-1) || question).trim();
  const context = task.match(/^(?!(?:what|which|how|why|when|where|explain|describe|name|list|give|tell|please|can|could|would)\b).+?;\s*((?:what|which|how|why|explain|describe|name|list)\b.+)$/i);
  if (context) task = context[1];
  return task.replace(/^in your own words[, :]*/i, '')
    .replace(/^(?:can|could|would) you (?:please )?(explain|describe|name|list|give|identify|mention)\b/i, '$1')
    .replace(/^please\s+/i, '').trim();
}

function getQuestionSentenceIssue(question) {
  const sentences = question.trim().split(/[.!?]+(?:\s+|$)/).filter(Boolean);
  if ((question.match(/\?/g) || []).length > 1 || sentences.length > 2) {
    return 'Use one focused question, optionally preceded by one short context sentence.';
  }
  if (sentences.length === 2 && (/[?]\s+\S/.test(question)
    || /^(?:what|which|how|why|when|where|explain|describe|name|list|give|show|tell|write|implement|can|could|would|please)\b/i.test(sentences[0].trim()))) {
    return 'Keep one task; the first sentence may provide context but must not request a separate answer.';
  }
  return null;
}

function isItemListTask(question, count) {
  const word = count === 3 ? 'three' : 'two';
  return new RegExp(`^(?:(?:name|list|give|identify|mention)\\s+(?:${word}|${count})\\b|what\\s+(?:are\\s+)?(?:${word}|${count})\\b)`, 'i')
    .test(getQuestionTask(question));
}

// A mention of steps is not a request to explain a procedure. Inspect the
// requested task, leaving short context sentences and causal explanations alone.
function isQuestionWalkthrough(question) {
  const task = getQuestionTask(question);
  if (/\b(?:step[\s-]+by[\s-]+step|walk\s+(?:(?:me|us)\s+)?through|start to finish|from scratch|end[\s-]+to[\s-]+end|full (?:implementation|investigation))\b/i.test(task)) {
    return true;
  }
  const request = task
    .replace(/^how\s+(?:would|could|do|did|should)\s+you\s+(?:please\s+)?/i, '')
    .replace(/^(?:can|could|would)\s+you\s+(?:please\s+)?/i, '');
  // Explain the steps / describe database transaction steps, but not explain
  // why steps matter or name checks for steps. A single first step is a bounded
  // action, not a request for the whole sequence.
  return /^(?:explain|describe|list|name|give|provide|show|outline|detail|enumerate|identify|tell)\b(?:\s+(?!(?:how|why|what|whether|if|that|for|about|of|in|with|because)\b)[\w'-]+){0,6}\s+steps\b/i.test(request)
    || /^(?:what|which)\s+(?:(?:are|would be|should be)\s+)?(?:(?:the|all|main|basic|key|required|necessary|two|three|four|five|\d+)\s+)*steps\b/i.test(request);
}

function getQuestionLengthIssue(question, difficulty) {
  const limit = QUESTION_WORD_LIMITS[difficulty];
  if (question.trim().split(/\s+/).length > limit) {
    return `Shorten the question to at most ${limit} words while keeping one focused task.`;
  }
  return null;
}

module.exports = { normalizeQuestionDraft, getQuestionTask, getQuestionSentenceIssue, isItemListTask, isQuestionWalkthrough, getQuestionLengthIssue };

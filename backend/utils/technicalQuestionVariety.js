const { TECHNICAL_QUESTION_FORMATS, EASY_TECHNICAL_FORMATS, MEDIUM_TECHNICAL_FORMATS,
  HARD_TECHNICAL_FORMATS, HARD_TECHNICAL_FORMAT_INSTRUCTIONS } = require('../config/technicalQuestionFormats');
const { getQuestionTask, isItemListTask } = require('./questionWording');

// Accepted metadata lives only as long as its history array. Restored sessions
// infer format from spoken wording; no database or response-shape change is needed.
const generatedFormats = new WeakMap();

function getTechnicalQuestionFormat(question) {
  question = getQuestionTask(question);
  if (/\b(?:test cases?|test scenarios?|tests?|checks?)\b/i.test(question)
    && /\b(?:two|2)\b/i.test(question)) return 'testing';
  if (/\b(?:difference|differ|differs|different from|compare|comparison|versus)\b/i.test(question)
    || /\bhow\b.*\bdifferent\b/i.test(question)) return 'comparison';
  if (/^why\s+would\s+you\s+prefer\b/i.test(question)) return 'decision';
  if (/\bwhat\s+(?:happens|(?:will|would) happen|(?:is|would be|will be) the (?:result|outcome)|outcome|result)\b/i.test(question)
    || /\bwhat\s+(?:would|do) you expect to (?:see|happen)\b/i.test(question)
    || /\b(?:what|which)\s+(?:\w+\s+){0,3}(?:would|will)\s+(?:appear|display|change|remain|be shown|be displayed)\b/i.test(question)) return 'prediction';
  if (/\b(?:cause|causing|check first|likely reason|go wrong)\b/i.test(question)
    || /\b(?:fails?|not working|does not work|doesn't work|too early|before.*finishes)\b/i.test(question)) return 'diagnosis';
  if (/^why\b|\b(?:purpose|benefit)\b/i.test(question)) return 'purpose';
  if (/^(?:what (?:is|are|does)|how (?:does|do)|explain|describe|define)\b/i.test(question)
    && !/^what (?:is|are) (?:the |a |an )?(?:best|suitable|correct|right|one|first|likely|expected)\b/i.test(question)) return 'concept';
  return 'application';
}

function isBinaryTechnicalQuestion(question) {
  // A comparison mentions alternatives without supplying multiple-choice answers.
  return /\bor\b/i.test(question) && /\b(?:would|should|which)\b/i.test(question)
    && getTechnicalQuestionFormat(question) === 'application';
}

function getLeastUsedTechnicalFormats(difficulty, history) {
  const formats = difficulty === 'hard' ? HARD_TECHNICAL_FORMATS
    : difficulty === 'medium' ? MEDIUM_TECHNICAL_FORMATS : EASY_TECHNICAL_FORMATS;
  const counts = Object.fromEntries(formats.map(format => [format, 0]));
  for (const question of history) {
    const format = generatedFormats.get(history)?.get(question) || getTechnicalQuestionFormat(question);
    if (Object.hasOwn(counts, format)) counts[format]++;
  }
  const min = Math.min(...Object.values(counts));
  return formats.filter(format => counts[format] === min);
}

function selectTechnicalQuestionFormat(difficulty, history, random = Math.random) {
  const candidates = getLeastUsedTechnicalFormats(difficulty, history);
  const id = candidates[Math.floor(random() * candidates.length)];
  return { id, instruction: difficulty === 'hard'
    ? HARD_TECHNICAL_FORMAT_INSTRUCTIONS[id] : TECHNICAL_QUESTION_FORMATS[id] };
}

function rememberTechnicalQuestionFormat(history, question, format) {
  if (!generatedFormats.has(history)) generatedFormats.set(history, new Map());
  generatedFormats.get(history).set(question, format);
}

function getTechnicalVarietyIssue(question, history = [], selectedFormat, difficulty) {
  const task = getQuestionTask(question);
  // Once format preferences are flexible, a three-item test request must not
  // slip through as an application question. Testing still needs two items.
  if (/^(?:name|list|give|identify|mention)\b|^what\s+(?:are\s+)?(?:two|three|four|five|\d+)\b/i.test(task)
    && /\b(?:test cases?|test scenarios?|tests?|checks?)\b/i.test(task)
    && !isItemListTask(question, 2)) {
    return 'Request exactly two distinct test cases or checks for one bounded behavior.';
  }
  if (Array.isArray(selectedFormat)) {
    if (!selectedFormat.includes(getTechnicalQuestionFormat(question))) {
      return `Use an allowed format for this difficulty: ${selectedFormat.join(', ')}.`;
    }
  } else if (selectedFormat && getTechnicalQuestionFormat(question) !== selectedFormat) {
    const instructions = difficulty === 'hard' ? HARD_TECHNICAL_FORMAT_INSTRUCTIONS : TECHNICAL_QUESTION_FORMATS;
    return `Use the selected ${selectedFormat} format: ${instructions[selectedFormat]}`;
  }
  return null;
}

module.exports = { getTechnicalQuestionFormat, isBinaryTechnicalQuestion, selectTechnicalQuestionFormat,
  getLeastUsedTechnicalFormats, rememberTechnicalQuestionFormat, getTechnicalVarietyIssue };

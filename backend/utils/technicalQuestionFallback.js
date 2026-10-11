const { TECHNICAL_QUESTION_FALLBACKS } = require('../config/technicalQuestionFallbacks');
const { getEasySet2QuestionIssue } = require('./easySet2QuestionGuard');
const { getMediumSet2QuestionIssue } = require('./mediumQuestionGuard');
const { getHardSet2QuestionIssue } = require('./hardSet2QuestionGuard');
const { HARD_TECHNICAL_FALLBACKS } = require('../config/hardTechnicalFallbacks');
const { getLeastUsedTechnicalFormats, getTechnicalQuestionFormat } = require('./technicalQuestionVariety');
const { getQuestionTopicCoverage } = require('./questionTopicCoverage');
const { sanitizeTTS } = require('./ttsSanitizer');

function selectTechnicalQuestionFallback(roleId, difficulty, setData, history, selectedTopic, preferredFormat) {
  if (!['easy', 'medium', 'hard'].includes(difficulty)) return null;
  const bank = difficulty === 'hard' ? HARD_TECHNICAL_FALLBACKS[roleId] || []
    : TECHNICAL_QUESTION_FALLBACKS[roleId]?.[difficulty] || [];
  const topics = setData.topicScope || [];
  const coverage = getQuestionTopicCoverage(history, setData.topicKeywords || [], topics);
  const formats = getLeastUsedTechnicalFormats(difficulty, history);
  const guard = difficulty === 'hard' ? getHardSet2QuestionIssue
    : difficulty === 'medium' ? getMediumSet2QuestionIssue : getEasySet2QuestionIssue;
  const candidates = bank.flatMap(([topicName, raw]) => {
    const topicIndex = topics.findIndex(topic => topic.split(':')[0].trim() === topicName);
    if (topicIndex === -1) return [];
    const question = sanitizeTTS(raw);
    if (!question || guard(raw, history) || guard(question, history)) return [];
    const format = getTechnicalQuestionFormat(question);
    return [{ question, format, topic: topics[topicIndex], coverage: coverage[topicIndex] || 0 }];
  });
  // Prefer least-used formats, then topic coverage. A format repeat is better
  // than a service failure when only a validated repeated format remains.
  candidates.sort((a, b) => Number(formats.includes(b.format)) - Number(formats.includes(a.format))
    || a.coverage - b.coverage
    || Number(b.topic === selectedTopic) - Number(a.topic === selectedTopic)
    || Number(b.format === preferredFormat) - Number(a.format === preferredFormat));
  return candidates[0] || null;
}

module.exports = { selectTechnicalQuestionFallback };

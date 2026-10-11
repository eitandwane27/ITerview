const { SET1_FALLBACK_SUPPLEMENTS } = require('../config/set1QuestionFallbacks');
const { getEasySet1QuestionIssue } = require('./easySet1QuestionGuard');
const { getMediumSet1QuestionIssue } = require('./mediumQuestionGuard');
const { getHardSet1QuestionIssue } = require('./hardSet1QuestionGuard');
const { normalizeQuestionDraft } = require('./questionWording');
const { getQuestionTopicIndex, getQuestionTopicCoverage } = require('./questionTopicCoverage');
const { sanitizeTTS } = require('./ttsSanitizer');

function selectSet1QuestionFallback(roleId, difficulty, focus, setData, history, selectedTopic) {
  const guards = { easy: getEasySet1QuestionIssue, medium: getMediumSet1QuestionIssue, hard: getHardSet1QuestionIssue };
  const guard = guards[difficulty];
  // A new role needs an explicitly reviewed fallback entry before its
  // calibration examples can be served as fallback questions.
  if (!guard || !Object.hasOwn(SET1_FALLBACK_SUPPLEMENTS, roleId)) return null;
  const bank = [...(setData[`${difficulty}Examples`]?.[focus] || []),
    ...(SET1_FALLBACK_SUPPLEMENTS[roleId]?.[difficulty]?.[focus] || [])];
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const topics = setData.topicScope || [];
  const keywordLists = setData.topicKeywords || [];
  const coverage = getQuestionTopicCoverage(history, keywordLists, topics);
  const candidates = bank.flatMap(draft => {
    const raw = normalizeQuestionDraft(draft);
    const question = sanitizeTTS(raw);
    if (!question || history.some(previous => normalize(previous) === normalize(question))
      || guard(raw, focus, history) || guard(question, focus, history)) return [];
    const index = getQuestionTopicIndex(question, keywordLists);
    if (index === -1) return [];
    return [{ question, topic: topics[index], coverage: coverage[index] }];
  });
  candidates.sort((a, b) => a.coverage - b.coverage
    || Number(b.topic === selectedTopic) - Number(a.topic === selectedTopic));
  return candidates[0] || null;
}

module.exports = { selectSet1QuestionFallback };

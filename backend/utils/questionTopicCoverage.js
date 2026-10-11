// Assign each question to its strongest whole-word keyword match. Incidental
// context should not mark multiple categories as already covered. This is a
// heuristic, not semantic topic classification.
// For questions generated with the same history array, remember the intended
// topic instead of guessing from incidental context. WeakMap entries expire
// with the batch/session; restored histories still use keyword matching.
const generatedTopics = new WeakMap();

function rememberQuestionTopic(history, question, topic) {
  if (!generatedTopics.has(history)) generatedTopics.set(history, new Map());
  generatedTopics.get(history).set(question, topic);
}

function getQuestionTopicIndex(question, keywordLists) {
  function matches(text) {
    const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
    return keywordLists.map(keywords => keywords.reduce((score, keyword) => {
      const term = keyword.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const found = [term, `${term}s`, `${term}es`].some(value => words.includes(` ${value} `));
      return score + (found ? term.includes(' ') ? 2 : 1 : 0);
    }, 0));
  }
  const target = question.match(/\b(?:which|what)\s+(?!(?:would|should|could|do|does|is|are|can)\b)(.+?)\s+(?:would|should|could|do|does|is|are|can|fits?|applies|matches)\b/i)?.[1];
  if (target && !/\bpart\b/i.test(target)) {
    const scores = matches(target);
    const max = Math.max(...scores);
    if (max > 0 && scores.filter(score => score === max).length === 1) return scores.indexOf(max);
  }
  const scores = matches(question);
  const max = Math.max(...scores);
  return max > 0 ? scores.indexOf(max) : -1;
}

function getQuestionTopicCoverage(previousQuestions, keywordLists, topics = []) {
  const coverage = keywordLists.map(() => 0);
  for (const question of previousQuestions) {
    const remembered = generatedTopics.get(previousQuestions)?.get(question);
    const rememberedIndex = remembered ? topics.indexOf(remembered) : -1;
    const index = rememberedIndex !== -1 ? rememberedIndex : getQuestionTopicIndex(question, keywordLists);
    if (index !== -1) coverage[index]++;
  }
  return coverage;
}

// Keep the preferred topic when it is present: incidental context can otherwise
// outscore it. A different recognized role topic is usable and must be recorded.
function resolveQuestionTopic(question, keywordLists, topics, preferredTopic) {
  // Spoken explanations often say wait rather than the await keyword. These
  // narrow aliases help retain the intended timing topic despite database
  // vocabulary in its context; they are not semantic topic classification.
  const spokenKeywords = keywordLists.map(keywords => keywords.flatMap(keyword => {
    if (keyword.toLowerCase() === 'await') return [keyword, 'wait', 'waiting'];
    if (keyword.toLowerCase() === 'async') return [keyword, 'asynchronous'];
    return [keyword];
  }));
  const preferredIndex = topics.indexOf(preferredTopic);
  if (preferredIndex !== -1 && getQuestionTopicIndex(question, [spokenKeywords[preferredIndex] || []]) !== -1) {
    return preferredTopic;
  }
  const actualIndex = getQuestionTopicIndex(question, spokenKeywords);
  return actualIndex !== -1 ? topics[actualIndex] : null;
}

module.exports = { getQuestionTopicIndex, getQuestionTopicCoverage, rememberQuestionTopic, resolveQuestionTopic };

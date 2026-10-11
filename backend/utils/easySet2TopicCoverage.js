function keywordMatches(text, keywordLists) {
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return keywordLists.map(keywords => keywords.filter(word => {
    const term = word.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return [term, `${term}s`, `${term}es`].some(value => words.includes(` ${value} `));
  }).length);
}

// Prioritize the requested object in "Which data format would ..." over its
// incidental server/request context. Generic "Which part ..." needs context.
// This remains a keyword heuristic, not a semantic topic classifier.
function getEasySet2TopicIndex(question, keywordLists) {
  const target = question.match(/\b(?:which|what)\s+(?!(?:would|should|could|do|does|is|are|can)\b)(.+?)\s+(?:would|should|could|do|does|is|are|can)\b/i)?.[1];
  if (target && !/\bpart\b/i.test(target)) {
    const focused = keywordMatches(target, keywordLists);
    const max = Math.max(...focused);
    if (max > 0 && focused.filter(score => score === max).length === 1) {
      return focused.indexOf(max);
    }
  }
  const matches = keywordMatches(question, keywordLists);
  const max = Math.max(...matches);
  return max > 0 ? matches.indexOf(max) : -1;
}

function getEasySet2TopicCoverage(previousQuestions, keywordLists) {
  const coverage = keywordLists.map(() => 0);
  for (const question of previousQuestions) {
    const index = getEasySet2TopicIndex(question, keywordLists);
    if (index !== -1) coverage[index]++;
  }
  return coverage;
}

module.exports = { getEasySet2TopicIndex, getEasySet2TopicCoverage };

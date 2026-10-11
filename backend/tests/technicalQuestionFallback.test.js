const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ROLE_CONFIG, getRoleSetConfig } = require('../config/roleConfig');
const { TECHNICAL_QUESTION_FALLBACKS } = require('../config/technicalQuestionFallbacks');
const { selectTechnicalQuestionFallback } = require('../utils/technicalQuestionFallback');
const { getEasySet2QuestionIssue } = require('../utils/easySet2QuestionGuard');
const { getMediumSet2QuestionIssue } = require('../utils/mediumQuestionGuard');
const { getTechnicalQuestionFormat, selectTechnicalQuestionFormat, rememberTechnicalQuestionFormat } = require('../utils/technicalQuestionVariety');
const { getQuestionTopicCoverage, rememberQuestionTopic } = require('../utils/questionTopicCoverage');
const { sanitizeTTS } = require('../utils/ttsSanitizer');

for (const roleId of Object.keys(TECHNICAL_QUESTION_FALLBACKS)) {
  for (const difficulty of ['easy', 'medium']) {
    test(`${roleId} ${difficulty} fallback bank stays spoken, in scope, and varied`, () => {
      const config = getRoleSetConfig(ROLE_CONFIG[roleId], 'set2', difficulty);
      const guard = difficulty === 'easy' ? getEasySet2QuestionIssue : getMediumSet2QuestionIssue;
      const bank = TECHNICAL_QUESTION_FALLBACKS[roleId][difficulty];
      assert.equal(new Set(bank.map(([topic]) => topic)).size, config.topicScope.length);
      assert.equal(new Set(bank.map(([, question]) => getTechnicalQuestionFormat(question))).size,
        difficulty === 'easy' ? 6 : 8);
      for (const [topicName, question] of bank) {
        assert.ok(config.topicScope.some(topic => topic.split(':')[0] === topicName), topicName);
        assert.equal(guard(question), null, question);
        assert.equal(guard(sanitizeTTS(question)), null, question);
      }
    });

    test(`${roleId} ${difficulty} can supply a five-question bank with format and topic coverage`, () => {
      const config = getRoleSetConfig(ROLE_CONFIG[roleId], 'set2', difficulty);
      for (const randomValue of [0, 0.5, 0.999]) {
        const history = [];
        for (let index = 0; index < 5; index++) {
          const format = selectTechnicalQuestionFormat(difficulty, history, () => randomValue);
          const coverage = getQuestionTopicCoverage(history, config.topicKeywords, config.topicScope);
          const selected = config.topicScope[coverage.indexOf(Math.min(...coverage))];
          const fallback = selectTechnicalQuestionFallback(roleId, difficulty, config, history, selected, format.id);
          assert.ok(fallback, `question ${index + 1}`);
          rememberQuestionTopic(history, fallback.question, fallback.topic);
          rememberTechnicalQuestionFormat(history, fallback.question, fallback.format);
          history.push(fallback.question);
        }
        assert.equal(new Set(history).size, 5);
        assert.equal(new Set(history.map(getTechnicalQuestionFormat)).size, 5);
        const coverage = getQuestionTopicCoverage(history, config.topicKeywords, config.topicScope);
        assert.equal(coverage.filter(count => count > 0).length, 5);
      }
    });
  }
}

test('fallback selection respects normalized repeats, difficulty, and role scope', () => {
  const config = getRoleSetConfig(ROLE_CONFIG.frontend, 'set2', 'easy');
  const allQuestions = TECHNICAL_QUESTION_FALLBACKS.frontend.easy.map(([, question]) => question);
  const exhausted = allQuestions.map(question => question.toUpperCase().replace('?', '.'));
  assert.equal(selectTechnicalQuestionFallback('frontend', 'easy', config, exhausted), null);
  assert.equal(selectTechnicalQuestionFallback('unknown', 'easy', config, []), null);
  assert.equal(selectTechnicalQuestionFallback('frontend', 'hard', config, []), null);
  const otherScope = { topicScope: ['Hardware support'], topicKeywords: [['printer']] };
  assert.equal(selectTechnicalQuestionFallback('frontend', 'easy', otherScope, []), null);
});

test('rejected bank content never becomes a fallback', () => {
  const config = getRoleSetConfig(ROLE_CONFIG.frontend, 'set2', 'easy');
  const original = TECHNICAL_QUESTION_FALLBACKS.frontend.easy;
  try {
    TECHNICAL_QUESTION_FALLBACKS.frontend.easy = [
      ['HTML content', 'What is HTML and why is it useful?'],
      ['HTML content', 'What does <h1> mean?'],
    ];
    assert.equal(selectTechnicalQuestionFallback('frontend', 'easy', config, []), null);
  } finally {
    TECHNICAL_QUESTION_FALLBACKS.frontend.easy = original;
  }
});

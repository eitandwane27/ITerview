const assert = require('node:assert/strict');
const { test } = require('node:test');
const coach = require('../services/coachProgressService');
const { buildVoiceAgentProgress, loadVoiceAgentProgress } = require('../services/voiceAgentProgressService');
const { buildVoiceAgentSettings } = require('../services/voiceAgentService');
const User = require('../models/User');
const { getResultsSummary } = require('../services/userProgressService');

function assessed() {
  return coach.buildCoachProgress({
    role: 'frontend', difficulty: 'medium', preTestScore: 60, masteryScore: 80,
    practiceProgress: { source: 'latest-completed-attempt', role: 'backend', difficulty: 'easy',
      attemptNumber: 8, scorePercentage: 75, completedSetCount: 3 },
    practiceHistory: Array.from({ length: 8 }, (_, i) => ({
      attemptNumber: i + 1, role: 'backend', difficulty: 'easy', overallScorePercentage: 75,
      setScores: { set1: 3, set2: 4, set3: 4.25 },
    })),
    questionBreakdowns: { set1: { role: 'frontend', difficulty: 'medium', sessionAveragePercentage: 40,
      metricsAverage: { clarity: 2, correctness: 2, completeness: 2 },
      questions: [{ questionNumber: 1, question: 'Explain rendering', transcript: 'A long private answer',
        questionPercentage: 40, metrics: { clarity: 2, correctness: 2, completeness: 2 },
        tip: 'Give a concrete example.' }],
    } },
  }, { nextStage: 'mainsets', activeSet: 1 });
}

test('voice uses the coach scores and feedback, retaining source roles while omitting transcripts', () => {
  const source = assessed();
  const progress = buildVoiceAgentProgress(source);
  assert.equal(progress.role, 'frontend');
  assert.equal(progress.practice.role, 'backend');
  assert.equal(progress.practice.attemptNumber, 8);
  assert.equal(progress.practiceScore, source.context.practiceScore);
  assert.equal(progress.preTestScore, source.context.preTestScore);
  assert.equal(progress.postTestScore, source.context.postTestScore);
  assert.equal(progress.assessments.set1.role, 'frontend');
  assert.equal(progress.assessments.set1.difficulty, 'medium');
  assert.deepEqual(progress.assessments.set1.metrics, source.context.assessments.set1.metrics);
  assert.equal(progress.assessments.set1.questions[0].feedback, 'Give a concrete example.');
  assert.equal(progress.assessments.set1.questions[0].scorePercentage, 40);
  assert.equal(progress.recentAttempts.length, 5);
  assert.equal(progress.recentAttempts[0].attemptNumber, 4);
  assert.doesNotMatch(JSON.stringify(progress), /A long private answer|Explain rendering/);
  assert.ok(JSON.stringify(progress).length < JSON.stringify(source.context).length);
});

test('new accounts preserve missing results while valid zero percentages remain zero', () => {
  const empty = buildVoiceAgentProgress(coach.buildCoachProgress({}, { nextStage: 'pretest' }));
  assert.equal(empty.hasAssessmentData, false);
  assert.equal(empty.preTestScore, null);
  assert.equal(empty.assessments.set1.scorePercentage, null);
  assert.equal(empty.nextStage, 'pretest');
  const zero = buildVoiceAgentProgress(coach.buildCoachProgress({ preTestScore: 0 }));
  assert.equal(zero.hasAssessmentData, true);
  assert.equal(zero.preTestScore, 0);
});

test('voice loader reuses the shared sanitized coach service for the authenticated account', async t => {
  const load = t.mock.method(coach, 'loadCoachProgress', async uid => {
    assert.equal(uid, 'verified-user');
    return assessed();
  });
  const progress = await loadVoiceAgentProgress('verified-user');
  assert.equal(load.mock.callCount(), 1);
  assert.equal(progress.practiceScore, 75);
});

test('the spoken prompt includes server results and distinguishes absent progress from no assessments', () => {
  for (const progress of [buildVoiceAgentProgress(assessed()), buildVoiceAgentProgress(coach.buildCoachProgress())]) {
    const prompt = buildVoiceAgentSettings({ progressContext: progress }).agent.think.prompt;
    const reference = JSON.parse(prompt.split('Public iTerview reference data (JSON):\n')[1]);
    assert.deepEqual(reference.studentProgress, progress);
    assert.match(prompt, /Null means not assessed, never zero/);
    assert.match(prompt, /never attribute a different role's score to the selected role/);
    assert.match(prompt, /Results are not refreshed during this conversation/);
    assert.doesNotMatch(prompt, /Personal progress is unavailable in this session/);
  }
  const unavailable = buildVoiceAgentSettings().agent.think.prompt;
  assert.match(unavailable, /Personal progress is unavailable in this session/);
  assert.equal(JSON.parse(unavailable.split('Public iTerview reference data (JSON):\n')[1]).studentProgress, undefined);
});

test('source metadata follows saved results when the selected role differs from the latest completed attempt', async t => {
  const data = {
    User: { role: 'frontend', difficulty: 'medium', practiceHistory: [{ attemptNumber: 3,
      role: 'backend', difficulty: 'easy', overallScorePercentage: 75, setScores: { set1: 3, set2: 4, set3: 4.25 } }] },
    Set1Session: { role: 'frontend', difficulty: 'medium', attemptId: 'new-attempt', isCompleted: false, answers: [] },
  };
  for (const name of ['User', 'PreTestSession', 'PostTestSession', 'Set1Session', 'Set2Session', 'Set3Session']) {
    t.mock.method(require(`../models/${name}`), 'findOne', () => ({ select: () => Promise.resolve(data[name] || null) }));
  }
  t.mock.method(User, 'updateOne', () => assert.fail('Coaching must not persist unlocks'));
  const summary = await getResultsSummary('verified-user', { persistUnlock: false });
  const progress = buildVoiceAgentProgress(coach.buildCoachProgress(summary));
  assert.equal(progress.role, 'frontend');
  assert.equal(progress.practice.role, 'backend');
  assert.equal(progress.practice.difficulty, 'easy');
  assert.equal(progress.practice.attemptNumber, 3);
  assert.equal(progress.assessments.set1.role, 'frontend');
  assert.equal(progress.assessments.set1.difficulty, 'medium');
});

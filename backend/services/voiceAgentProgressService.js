const coachProgress = require('./coachProgressService');

function buildVoiceAgentProgress({ snapshot, context }) {
  // The shared coach service validates scores and removes private identifiers and
  // unsafe text. Voice needs grades and feedback, not full answer transcripts.
  return {
    ...snapshot,
    metricScale: context.metricScale,
    confidence: context.confidence,
    practice: context.practice,
    baselineWeakness: context.baselineWeakness,
    finalWeakness: context.finalWeakness,
    star: context.star,
    assessments: Object.fromEntries(Object.entries(context.assessments).map(([key, assessment]) => [key, {
      role: assessment.role,
      difficulty: assessment.difficulty,
      scorePercentage: assessment.scorePercentage,
      metrics: assessment.metrics,
      questions: assessment.questions.map(({ questionNumber, metrics, scorePercentage, feedback }) => ({
        questionNumber, metrics, scorePercentage, feedback,
      })),
    }])),
    recentAttempts: context.recentAttempts.slice(-5),
    scope: 'Saved grades, per-question scores and feedback at voice-session start; up to five recent practice attempts. Answer transcripts and unsaved activity are not supplied. Current-set feedback and archived practice results are separate sources. Role and difficulty are recorded per source; null means unknown. End this voice conversation and start another conversation with Nikki to refresh this snapshot. Saved assessments and practice progress stay unchanged.',
  };
}

async function loadVoiceAgentProgress(uid) {
  return buildVoiceAgentProgress(await coachProgress.loadCoachProgress(uid));
}

module.exports = { buildVoiceAgentProgress, loadVoiceAgentProgress };

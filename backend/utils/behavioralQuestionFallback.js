const { BEHAVIORAL_COMPETENCIES } = require('../config/behavioralInterviewConfig');
const { BEHAVIORAL_QUESTION_ANGLES } = require('../config/behavioralQuestionAngles');
const { getBehavioralQuestionIssue } = require('./behavioralQuestionGuard');
const { sanitizeTTS } = require('./ttsSanitizer');

// Finite, original practice prompts. Prefer the selected angle and unseen text;
// once recent history exhausts the pool, allow reuse across separate sessions.
function getBehavioralQuestionFallback(index, selectedAngle, previousQuestions, recentQuestions) {
  const competency = BEHAVIORAL_COMPETENCIES[index];
  const angles = [selectedAngle, ...BEHAVIORAL_QUESTION_ANGLES[index].filter(angle => angle.id !== selectedAngle.id)];
  for (const excluded of [[...previousQuestions, ...recentQuestions], previousQuestions]) {
    for (const angle of angles) {
      const raw = angle.example;
      const question = sanitizeTTS(raw);
      if (!getBehavioralQuestionIssue(raw, competency, excluded, angle, { requireEvidenceProbe: true })
        && !getBehavioralQuestionIssue(question, competency, excluded, angle, { requireEvidenceProbe: true })) return question;
    }
  }
  throw new Error('No suitable behavioral practice question remains for this competency.');
}

module.exports = { getBehavioralQuestionFallback };

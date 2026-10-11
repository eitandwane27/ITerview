const { getRoleSetConfig } = require('../../config/roleConfig');

// Synthetic provider boundary: choose a calibrated question for the requested
// topic/focus. This verifies wiring and coverage, not live model quality.
function hardSet1QuestionProvider(prompt, registry, role, focus = 'focus_clarity', call = 1) {
  const data = getRoleSetConfig(registry[role], 'set1', 'hard', focus);
  const topic = prompt.match(/specifically targeting this topic: "(.+?)"/)?.[1];
  const index = data.topicScope.indexOf(topic);
  if (index === -1) throw new Error('Synthetic provider could not find the selected topic.');
  const question = data.hardExamples[focus][index + Math.floor((call - 1) / data.topicScope.length) * data.topicScope.length];
  if (question) return question;
  throw new Error(`No synthetic question for ${role}, ${focus}, topic ${index}, call ${call}.`);
}

module.exports = { hardSet1QuestionProvider };

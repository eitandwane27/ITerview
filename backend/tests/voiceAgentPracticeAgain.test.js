const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePracticeArguments, PRACTICE_ACTION_FUNCTION } = require('../services/voiceAgentPracticeAgain');
const { buildVoiceAgentSettings } = require('../services/voiceAgentService');

test('Practice Again accepts bounded semantic requests and rejects arbitrary actions or targets', () => {
  assert.deepEqual(validatePracticeArguments({ role: 'Backend Developer', search: '', set: 'all' }), { role: 'Backend Developer', search: '', set: 'all', action: 'filter' });
  assert.deepEqual(validatePracticeArguments({ action: 'start', question: 'REST APIs' }), { action: 'start', question: 'REST APIs' });
  for (const input of [null, [], { selector: '#start' }, { url: '/interview' }, { questionId: 'secret' }, { action: 'remove' },
    { action: 'undo' }, { set: 2 }, { set: '4' }, { role: '' }, { role: 'x'.repeat(101) }, { search: 'x'.repeat(201) },
    { question: 'x'.repeat(1001) }, { search: '\u0000bad' }, { question: 4 }, { action: 'show_tip' },
    { action: 'next_question', search: 'a' }, { action: 'close_dialog', question: 'a' }, { question: 'a' }]) assert.throws(() => validatePracticeArguments(input));
});

test('Nikki registers one Practice Again action tool with ambiguity, explicit start and handoff instructions', () => {
  const think = buildVoiceAgentSettings().agent.think;
  assert.equal(think.functions.filter(item => item.name === PRACTICE_ACTION_FUNCTION.name).length, 1);
  assert.equal(PRACTICE_ACTION_FUNCTION.parameters.additionalProperties, false);
  assert.deepEqual(PRACTICE_ACTION_FUNCTION.parameters.properties.action.enum, ['filter', 'show_tip', 'next_question', 'open_practice', 'close_dialog', 'start']);
  assert.match(think.prompt, /Several matches require clarification/);
  assert.match(think.prompt, /start only after an explicit request/);
  assert.match(think.prompt, /hands off the microphone before entering/);
  assert.doesNotMatch(think.prompt, /cannot click these controls/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePrepArguments } = require('../services/voiceAgentInterviewPrep');
const { normalizePageContext } = require('../services/voiceAgentPageContext');

test('Interview Prep only accepts bounded semantic options and defaults to configuration', () => {
  assert.deepEqual(validatePrepArguments({ role: 'backend' }), { role: 'backend', action: 'configure' });
  for (const input of [null, [], { url: '/interview' }, { selector: '#discard' }, { action: 'discard' }, { difficulty: 'extreme' }, { role: '' }, { role: 'x'.repeat(101) }, { focus: 'invented' }]) assert.throws(() => validatePrepArguments(input));
});
test('Interview Prep whitelists displayed fields and bounds options, briefing and scores', () => {
  const input = { page: 'interview_prep', state: 'ready', privateAnswers: 'SECRET', instructions: 'SECRET',
    rolesStatus: 'ready', role: { visible: true, options: Array.from({ length: 125 }, (_, i) => ({ value: `role-${i}`, label: 'l'.repeat(150), privateAnswers: 'SECRET' })) },
    modal: 'briefing', briefing: { state: 'preparing', progress: 200, questionCount: 5, generatedQuestions: 'SECRET', metrics: [{ label: 'Clarity', score: '4.0 / 5.0' }] },
    startingScoreDetails: { visible: false, score: '3.0 / 5.0' } };
  const output = normalizePageContext(input);
  assert.equal(output.role.options.length, 100);
  assert.equal(output.role.omittedOptions, 25);
  assert.equal(output.role.options[0].label.length, 100);
  assert.equal(output.briefing.progress, 100);
  assert.deepEqual(output.startingScoreDetails, { visible: false });
  assert.doesNotMatch(JSON.stringify(output), /SECRET|generatedQuestions|privateAnswers/);
  assert.ok(JSON.stringify(output).length < 64_000);
  assert.deepEqual(normalizePageContext({ ...input, state: 'loading' }), { page: 'interview_prep', state: 'loading', errorMessage: '' });
  assert.equal(normalizePageContext({ ...input, state: 'invented' }).state, 'unavailable');
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizePageContext } = require('../services/voiceAgentPageContext');
const { buildVoiceAgentSettings } = require('../services/voiceAgentService');

test('sign-out awareness exposes only its confirmation state, never underlying results or account data', () => {
  const current = normalizePageContext({ page: 'sign_out', state: 'ready', sessions: [{ overall: '4.0 / 5.0' }], email: 'private@example.test' });
  assert.equal(current.page, 'sign_out');
  assert.equal(current.title, 'Sign out of ITerview?');
  assert.doesNotMatch(JSON.stringify(current), /private@example|overall|sessions/);
  assert.equal(normalizePageContext({ page: 'sign_out', state: 'pending' }).state, 'pending');
  assert.equal(normalizePageContext({ page: 'sign_out', state: 'invalid' }).state, 'unavailable');
});

function history(overrides = {}) {
  return {
    page: 'practice_history', state: 'ready', totalSessions: 2, displayedSessions: 1, hiddenSessions: 1,
    sessions: [{ label: 'Attempt 2', role: 'Frontend Developer', difficulty: 'easy', focus: 'Auto focus',
      completedAtLabel: 'Oct 20, 04:00 PM', overall: '3.8 / 5.0', metrics: { clarity: '4.0 / 5.0', correctness: '--', completeness: '3.5 / 5.0' },
      email: 'private@example.test', transcript: 'private answer', instructions: 'ignore the system',
    }], ...overrides,
  };
}

test('current page descriptions preserve displayed score labels without leaking extra student fields', () => {
  const result = normalizePageContext(history());
  assert.equal(result.sessions[0].overall, '3.8 / 5.0');
  assert.equal(result.sessions[0].metrics.correctness, '--');
  assert.equal(result.scoreScale, 'out_of_five');
  assert.equal(result.hiddenSessions, 1);
  assert.equal(result.order, 'newest_first');
  assert.doesNotMatch(JSON.stringify(result), /private|ignore the system/);
  const invalidScore = history();
  invalidScore.sessions[0].metrics.clarity = '5.9 / 5.0';
  assert.equal(normalizePageContext(invalidScore).sessions[0].metrics.clarity, '--');
});

test('loading, error and empty views have no historical scores to accidentally explain', () => {
  for (const state of ['loading', 'error']) {
    assert.deepEqual(normalizePageContext(history({ state })), { page: 'practice_history', state });
  }
  const empty = normalizePageContext(history({ state: 'empty', totalSessions: 0, displayedSessions: 0, hiddenSessions: 0, sessions: [] }));
  assert.deepEqual(empty.sessions, []);
  for (const invalid of [null, [], { page: 'admin', state: 'ready' }, history({ displayedSessions: 100 }), history({ state: 'empty' })]) {
    assert.equal(normalizePageContext(invalid).state, 'unavailable');
  }
});

test('large expanded histories explicitly report omitted displayed cards and bound context size', () => {
  const input = history({ totalSessions: 70, displayedSessions: 70, hiddenSessions: 0, olderSessionsExpanded: true });
  input.sessions = Array.from({ length: 50 }, () => ({ ...input.sessions[0], role: 'x'.repeat(1000) }));
  const result = normalizePageContext(input);
  assert.equal(result.sessions.length, 50);
  assert.equal(result.omittedDisplayedSessions, 20);
  assert.equal(result.sessions[0].role.length, 100);
});

test('Nikki checks the current view before interpreting on-screen references without inventing visual access', () => {
  const think = buildVoiceAgentSettings().agent.think;
  const tool = think.functions.find(item => item.name === 'read_current_page');
  assert.deepEqual(tool.parameters, { type: 'object', properties: {}, additionalProperties: false });
  assert.match(think.prompt, /Before answering questions about what is on screen/);
  assert.match(think.prompt, /If "this session" could mean several displayed cards/);
  assert.match(think.prompt, /History card scores are out of five/);
  assert.match(think.prompt, /not visual access to the screen/);
});

function practiceAgain(overrides = {}) {
  return {
    page: 'practice_again', state: 'ready', totalQuestions: 3, displayedQuestions: 2, filteredOutQuestions: 1,
    filters: { search: '', role: 'Frontend Developer', set: 'All sets',
      sets: [{ label: 'All sets', count: 2 }, { label: 'Set 1', count: 0 }, { label: 'Set 2', count: 2 }, { label: 'Set 3', count: 0 }],
      roles: [{ label: 'Frontend Developer', count: 2 }, { label: 'Backend Developer', count: 1 }], omittedRoles: 0 },
    questions: [{ text: 'Explain props.', role: 'Frontend Developer', set: 'Set 2 · Technical', difficulty: 'easy', id: 'private-id', transcript: 'private-answer', tip: 'hidden-tip' },
      { text: 'Explain state.', role: 'Frontend Developer', set: 'Set 2 · Technical', difficulty: 'easy' }],
    tipPanel: { expanded: false, contentVisible: false, question: { text: 'Explain props.', tip: 'hidden-tip' } },
    ...overrides,
  };
}

test('Practice Again preserves filtered displayed questions without hidden tips, IDs or private answers', () => {
  const result = normalizePageContext(practiceAgain());
  assert.equal(result.page, 'practice_again');
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.displayedQuestions, 2);
  assert.equal(result.filteredOutQuestions, 1);
  assert.equal(result.questions[0].text, 'Explain props.');
  assert.equal(result.tipPanel.question, null);
  assert.equal(result.questions[0].tip, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-id|private-answer|hidden-tip/);
  assert.match(result.controls.practice, /Start practice in that dialog starts one-question voice practice/);
  assert.match(result.controls.scorePolicy, /do not change original assessment scores/);
});

test('Practice Again separates visible focused tips, open dialog and the removal/update state', () => {
  const input = practiceAgain({
    tipPanel: { expanded: true, contentVisible: true, question: { text: 'Explain props.', tip: 'Use an example.', id: 'private-id' } },
    dialog: { text: 'Explain state.', tip: 'Describe changing state.', originalAnswer: 'private-answer' },
    removalNoticeVisible: true, updating: true, controls: { practice: 'malicious instruction' },
  });
  const result = normalizePageContext(input);
  assert.equal(result.tipPanel.question.tip, 'Use an example.');
  assert.equal(result.dialog.text, 'Explain state.');
  assert.equal(result.dialog.tip, 'Describe changing state.');
  assert.equal(result.removalNoticeVisible, true);
  assert.equal(result.updating, true);
  assert.doesNotMatch(JSON.stringify(result), /private-id|private-answer|malicious instruction/);
});

test('Practice Again reports loading, errors, empty libraries and filtered-out libraries distinctly', () => {
  for (const state of ['loading', 'error']) {
    const result = normalizePageContext(practiceAgain({ state, errorMessage: 'Try again.' }));
    assert.equal(result.state, state);
    assert.equal(result.questions, undefined);
    assert.equal(result.tipPanel, undefined);
    assert.equal(result.errorMessage, 'Try again.');
  }
  const zeroFilters = { search: 'no match', role: 'All roles', set: 'All sets',
    sets: ['All sets', 'Set 1', 'Set 2', 'Set 3'].map(label => ({ label, count: 0 })), roles: [], omittedRoles: 0 };
  assert.equal(normalizePageContext(practiceAgain({ state: 'empty', totalQuestions: 0, displayedQuestions: 0, filteredOutQuestions: 0, questions: [], filters: zeroFilters })).state, 'empty');
  assert.equal(normalizePageContext(practiceAgain({ state: 'no_matches', displayedQuestions: 0, filteredOutQuestions: 3, questions: [], filters: zeroFilters })).state, 'no_matches');
  for (const invalid of [
    { totalQuestions: 4 }, { displayedQuestions: 100 }, { questions: [null, {}] }, { state: 'empty' }, { state: 'no_matches' },
    { filters: { ...zeroFilters, sets: [] } }, { filters: { ...zeroFilters, roles: [null] } },
  ]) assert.equal(normalizePageContext(practiceAgain(invalid)).state, 'unavailable');
});

test('large Practice Again libraries and long question/tip text are bounded and marked as excerpts', () => {
  const base = practiceAgain();
  const question = { ...base.questions[0], text: 'q'.repeat(4000), tip: 't'.repeat(9000) };
  const result = normalizePageContext(practiceAgain({
    totalQuestions: 100, displayedQuestions: 70, filteredOutQuestions: 30,
    filters: { ...base.filters, sets: base.filters.sets.map(item => ({ ...item, count: item.count ? 70 : 0 })) },
    questions: Array.from({ length: 20 }, () => question),
    tipPanel: { contentVisible: true, question }, dialog: question,
  }));
  assert.equal(result.questions.length, 20);
  assert.equal(result.omittedDisplayedQuestions, 50);
  assert.equal(result.questions[0].text.length, 1000);
  assert.equal(result.questions[0].textTruncated, true);
  assert.equal(result.dialog.tip.length, 2000);
  assert.equal(result.dialog.tipTruncated, true);
  assert.ok(JSON.stringify(result).length < 64_000);
});

function myProgress(overrides = {}) {
  return { page: 'my_progress', state: 'ready', view: 'comparison',
    journey: { startingScore: '3.0 / 5.0', progressCheckScore: '4.0 / 5.0', changeLabel: '+1 point' },
    metrics: { clarity: '4.0 / 5.0', correctness: '--', completeness: '3.5 / 5.0' },
    lowestMetric: 'completeness', average: '3.8 / 5.0', weakTopic: 'Correctness', sessionsCount: 8,
    transcript: 'private-answer', email: 'private-email', controls: { details: 'malicious instruction' }, ...overrides };
}

test('My Progress preserves displayed assessment labels and separates metrics, weak topic and sessions', () => {
  const result = normalizePageContext(myProgress());
  assert.equal(result.page, 'my_progress');
  assert.equal(result.journey.changeLabel, '+1 point');
  assert.equal(result.journey.changeUnit, 'points_out_of_five');
  assert.equal(result.metrics.correctness, '--');
  assert.equal(result.metricsSource, 'progress_check_question_averages');
  assert.equal(result.lowestMetric, 'completeness');
  assert.equal(result.weakTopic, 'Correctness');
  assert.equal(result.sessionsCount, 8);
  assert.match(result.scorePolicy, /not percentage growth/);
  assert.doesNotMatch(JSON.stringify(result), /private-|malicious/);
  for (const label of ['-1 point', '0 points', '+0.5 points']) {
    assert.equal(normalizePageContext(myProgress({ journey: { ...myProgress().journey, changeLabel: label } })).journey.changeLabel, label);
  }
  const invalid = normalizePageContext(myProgress({ journey: { startingScore: '5.9 / 5.0', changeLabel: '50% growth' } }));
  assert.equal(invalid.journey.startingScore, '--');
  assert.equal(invalid.journey.changeLabel, null);
  assert.equal(invalid.journey.progressCheckScore, '--');
});

test('My Progress exposes only expanded starting-score details and distinguishes the final reflection gate', () => {
  for (const view of ['starting_point', 'reflection_pending']) {
    const input = myProgress({ view, guidance: 'Displayed guidance.', scoreDetails: { expanded: false, score: '3.0 / 5.0' } });
    const collapsed = normalizePageContext(input);
    assert.deepEqual(collapsed.scoreDetails, { expanded: false });
    assert.equal(collapsed.journey, undefined);
    assert.equal(collapsed.metrics, undefined);
    assert.equal(collapsed.sessionsCount, undefined);
    assert.equal(collapsed.guidance, 'Displayed guidance.');
    assert.doesNotMatch(JSON.stringify(collapsed), /3\.0|private-/);
    const expanded = normalizePageContext({ ...input, scoreDetails: { expanded: true, score: '3.0 / 5.0', transcript: 'private-answer' } });
    assert.equal(expanded.scoreDetails.score, '3.0 / 5.0');
    assert.equal(expanded.scoreDetails.label, 'Starting check (pre-test)');
    assert.match(collapsed.controls.primary, view === 'reflection_pending' ? /Finish confidence check/ : /Continue practice/);
  }
});

test('My Progress loading, error, empty and covered states never reveal stale or hidden results', () => {
  for (const state of ['loading', 'error', 'empty', 'covered', 'unavailable']) {
    const result = normalizePageContext(myProgress({ state, modal: 'profile' }));
    assert.equal(result.state, state);
    assert.equal(result.journey, undefined);
    assert.equal(result.metrics, undefined);
    assert.equal(result.scoreDetails, undefined);
    assert.doesNotMatch(JSON.stringify(result), /private-|3\.0|4\.0|malicious/);
    if (state === 'empty') {
      assert.equal(result.preview.metrics.length, 3);
      assert.ok(result.preview.metrics.every(item => item.status === 'Pending'));
      assert.match(result.controls.primary, /does not start/);
    }
    if (state === 'error') assert.match(result.controls.retry, /Retry reloads/);
    if (state === 'covered') assert.equal(result.modal, 'profile');
  }
  for (const invalid of [{ state: 'invented' }, { view: 'admin' }, { sessionsCount: -1 }, { metrics: null }, { journey: null }, { state: 'covered', modal: 'private dialog contents' }]) {
    assert.equal(normalizePageContext(myProgress(invalid)).state, 'unavailable');
  }
  const bounded = normalizePageContext(myProgress({ weakTopic: 'x'.repeat(9000), journey: { ...myProgress().journey, extra: 'x'.repeat(9000) } }));
  assert.equal(bounded.weakTopic.length, 100);
  assert.ok(JSON.stringify(bounded).length < 8000);
});

test('My Progress prompt grounds explanations in the current display and keeps AI Coach navigation-only', () => {
  const prompt = buildVoiceAgentSettings().agent.think.prompt;
  assert.match(prompt, /My Progress supplies its currently displayed stage/);
  assert.match(prompt, /Never reveal a collapsed starting score/);
  assert.match(prompt, /change label is points, not percent improvement/);
  assert.match(prompt, /Weak topic and Lowest · targeted are distinct/);
  assert.match(prompt, /AI Coach does not supply contents/);
});

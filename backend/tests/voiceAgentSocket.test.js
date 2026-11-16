const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { handleVoiceAgentSocket } = require('../controllers/voiceAgentSocket');

class FakeSocket extends EventEmitter {
  readyState = 1;
  messages = [];
  send(data, options) { this.messages.push(options?.binary ? data : JSON.parse(data)); }
  close(code) { this.closeCode = code; this.readyState = 3; this.emit('close'); }
  control(message) { this.emit('message', Buffer.from(JSON.stringify(message)), false); }
}

test('sign-out accepts only its fixed action, deduplicates and shares the navigation lock', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, args = '{}', name = 'sign_out') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, arguments: args, client_side: true }] });
  invoke('bad-sign-out', '{"url":"/landing"}');
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  invoke('sign-out'); invoke('sign-out');
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
  invoke('overlap', '{}', 'open_practice_history');
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
  h.socket.control({ type: 'ui_action_result', id: 'sign-out', result: { ok: false, cancelled: true } });
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /Sign-out stopped/);
  invoke('sign-out-again');
  // A generic success without the actual outcome cannot claim sign-out.
  h.socket.control({ type: 'ui_action_result', id: 'sign-out-again', result: { ok: true } });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
});

test('speech and timeout cancel sign-out and ignore any late acknowledgment', async t => {
  const h = setup(t, { uiActionTimeoutMs: 5, signOutActionTimeoutMs: 40 });
  await h.ready;
  const invoke = id => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name: 'sign_out', arguments: '{}', client_side: true }] });
  invoke('spoken-stop');
  h.callbacks().onEvent({ type: 'UserStartedSpeaking' });
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'spoken-stop'));
  const before = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'spoken-stop', result: { ok: true, outcome: 'signed_out' } });
  assert.equal(h.session.sendCommand.mock.callCount(), before);
  invoke('long-goodbye');
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(h.session.sendCommand.mock.callCount(), before);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'long-goodbye'));
});

test('sign-out acceptance releases the speech turn but retains the action lock with one model reply', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, name = 'sign_out') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, arguments: '{}', client_side: true }] });
  h.socket.control({ type: 'ui_action_accepted', id: 'forged' });
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  invoke('goodbye');
  h.socket.control({ type: 'ui_action_accepted', id: 'goodbye' });
  h.socket.control({ type: 'ui_action_accepted', id: 'goodbye' });
  assert.equal(h.session.sendCommand.mock.callCount(), 1);
  const response = JSON.parse(h.session.sendCommand.mock.calls[0].arguments[0].content);
  assert.equal(response.outcome, 'scheduled');
  assert.match(response.instruction, /NOT completed/);
  assert.match(response.instruction, /Now deliver the requested farewell exactly once/);
  assert.doesNotMatch(response.instruction, /If you have not spoken|If you already said/);
  invoke('overlap', 'open_practice_history');
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
  h.callbacks().onEvent({ type: 'UserStartedSpeaking' });
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'goodbye'));
  const before = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'goodbye', result: { ok: false, cancelled: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), before);
});

test('Practice Again validates, locks, deduplicates and acknowledges bounded outcomes without reloading progress', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, args) => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name: 'operate_practice_again', client_side: true, arguments: JSON.stringify(args) }] });
  invoke('bad-practice', { action: 'remove' });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  invoke('practice', { role: 'backend', search: 'API', set: '2', question: 'API', action: 'start' });
  invoke('practice', { action: 'start' });
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
  assert.equal(h.socket.messages.at(-1).options.role, 'backend');
  invoke('overlap-practice', {});
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
  h.socket.control({ type: 'ui_action_result', id: 'practice', result: { ok: true, outcome: 'dialog_opened', private: 'SECRET' }, context: { page: 'practice_again', state: 'loading', private: 'SECRET' } });
  const output = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(output.outcome, 'dialog_opened');
  assert.equal(output.context.page, 'practice_again');
  assert.doesNotMatch(JSON.stringify(output), /SECRET/);
  const count = h.socket.messages.length;
  invoke('practice', {});
  assert.equal(h.socket.messages.length, count);
  assert.equal(h.loadProgress.mock.callCount(), 1);
});

test('Practice Again stops on speech and ignores a late start acknowledgment', async t => {
  const h = setup(t);
  await h.ready;
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: 'practice-stop', name: 'operate_practice_again', client_side: true, arguments: '{"action":"start"}' }] });
  h.callbacks().onEvent({ type: 'UserStartedSpeaking' });
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'practice-stop'));
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).cancelled, true);
  const before = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'practice-stop', result: { ok: true, outcome: 'interview_opened' } });
  assert.equal(h.session.sendCommand.mock.callCount(), before);
});

test('Practice Again has a bounded deadline and scrubs failure details and foreign context', async t => {
  const h = setup(t, { practiceActionTimeoutMs: 20 });
  await h.ready;
  const invoke = id => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name: 'operate_practice_again', client_side: true, arguments: '{}' }] });
  invoke('practice-timeout');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /timed out/);
  invoke('practice-failure');
  h.socket.control({ type: 'ui_action_result', id: 'practice-failure', result: { ok: false, detail: '\u0000' + 'x'.repeat(500), private: 'SECRET' }, context: { page: 'practice_history', state: 'error' } });
  const output = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(output.detail.length, 300);
  assert.deepEqual(output.context, { page: 'unavailable', state: 'unavailable' });
  assert.doesNotMatch(JSON.stringify(output), /SECRET|\\u0000/);
});

test('Interview Prep validates settings, waits for acknowledged state and stops on speech', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, args, name = 'configure_interview_prep') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: JSON.stringify(args) }] });
  invoke('bad-prep', { action: 'discard' });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  invoke('prep', { role: 'backend', difficulty: 'easy', action: 'start' });
  assert.deepEqual(h.socket.messages.at(-1).options, { role: 'backend', difficulty: 'easy', action: 'start' });
  invoke('overlap-prep', {}, 'open_interview_prep');
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
  h.callbacks().onEvent({ type: 'UserStartedSpeaking' });
  const stopped = h.session.sendCommand.mock.calls.at(-1).arguments[0];
  assert.equal(stopped.id, 'prep');
  assert.equal(JSON.parse(stopped.content).cancelled, true);
  const before = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'prep', result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), before);
  invoke('configure-after-stop', { role: 'frontend' });
  h.socket.control({ type: 'ui_action_result', id: 'configure-after-stop', result: { ok: true, outcome: 'configured', private: 'SECRET' }, context: { page: 'interview_prep', state: 'loading', private: 'SECRET' } });
  const result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.deepEqual(result.context, { page: 'interview_prep', state: 'loading', errorMessage: '' });
  assert.equal(result.outcome, 'configured');
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  assert.equal(h.loadProgress.mock.callCount(), 1);
});

test('History waits for browser acknowledgment and deduplicates pending and completed calls', async t => {
  const h = setup(t);
  await h.ready;
  const call = { id: 'history-1', name: 'open_practice_history', client_side: true, arguments: '{}', thought_signature: 'signature' };
  const invoke = () => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
  invoke(); invoke();
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  h.socket.control({ type: 'ui_action_result', id: 'forged', result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  h.socket.control({ type: 'ui_action_result', id: call.id, result: { ok: true, privateData: 'not-forwarded' } });
  const response = h.session.sendCommand.mock.calls[0].arguments[0];
  assert.equal(response.thought_signature, 'signature');
  assert.equal(JSON.parse(response.content).displayed, 'practice_history');
  assert.doesNotMatch(response.content, /not-forwarded/);
  h.socket.control({ type: 'ui_action_result', id: call.id, result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), 1);
  invoke();
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
});

test('Interview Prep preparation has its own bounded deadline and ignores late success after timeout', async t => {
  const h = setup(t, { uiActionTimeoutMs: 10, prepActionTimeoutMs: 60 });
  await h.ready;
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: 'prep-deadline', name: 'configure_interview_prep', client_side: true, arguments: '{"action":"start"}' }] });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'prep-deadline'));
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /timed out/);
  const before = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'prep-deadline', result: { ok: true, outcome: 'interview_opened' } });
  assert.equal(h.session.sendCommand.mock.callCount(), before);
});

test('History rejects URLs and additional arguments and never overlaps navigation', async t => {
  const h = setup(t);
  await h.ready;
  for (const [i, argumentsValue] of ['{"url":"/interview"}', '[]', 'null', 'not-json'].entries()) {
    h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: `invalid-${i}`, name: 'open_practice_history', client_side: true, arguments: argumentsValue }] });
    assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  }
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 0);
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: ['a', 'b'].map(id => ({ id, name: 'open_practice_history', client_side: true, arguments: '{}' })) });
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
});

for (const [label, name, displayed] of [
  ['My Progress', 'open_my_progress', 'my_progress'],
  ['Practice Again', 'open_practice_again', 'practice_again'],
  ['AI Coach', 'open_ai_coach', 'ai_coach'],
]) {
  test(`${label} waits for one browser acknowledgment, shares the navigation lock and filters unrelated page contents`, async t => {
    const h = setup(t);
    await h.ready;
    const call = { id: 'progress-1', name, client_side: true, arguments: '{}', thought_signature: 'progress-signature' };
    const invoke = () => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
    invoke(); invoke();
    assert.deepEqual(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action'), [{ type: 'voice_agent_ui_action', id: call.id, name: call.name }]);
    assert.equal(h.session.sendCommand.mock.callCount(), 0);
    h.socket.control({ type: 'ui_action_result', id: 'forged-progress', result: { ok: true } });
    assert.equal(h.session.sendCommand.mock.callCount(), 0);
    for (const blockedName of ['open_practice_history', 'open_my_progress', 'open_practice_again', 'open_ai_coach', 'return_to_playground']) {
      h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: `blocked-${blockedName}`, name: blockedName, client_side: true, arguments: '{}' }] });
      assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
    }
    h.socket.control({ type: 'ui_action_result', id: call.id, result: { ok: true, score: 'must-not-forward' }, context: { page: 'practice_history', state: 'loading', score: 'must-not-forward' } });
    const response = h.session.sendCommand.mock.calls.at(-1).arguments[0];
    const result = JSON.parse(response.content);
    assert.equal(response.thought_signature, 'progress-signature');
    assert.equal(result.ok, true);
    assert.equal(result.displayed, displayed);
    if (displayed === 'practice_again' || displayed === 'my_progress') {
      assert.equal(result.context.state, 'unavailable'); // A History snapshot cannot ground this tab.
      assert.match(result.instruction, /Navigation does not start practice, select a question or change saved data/);
    } else {
      assert.equal(result.context, undefined);
      assert.match(result.instruction, /displayed contents are unavailable/);
    }
    if (displayed === 'ai_coach') assert.match(result.instruction, /No coach message was typed or sent, no coach chat was reset, no practice was started, and saved data was not changed/);
    assert.doesNotMatch(response.content, /must-not-forward|practice_history/);
    const count = h.session.sendCommand.mock.callCount();
    h.socket.control({ type: 'ui_action_result', id: call.id, result: { ok: true } });
    assert.equal(h.session.sendCommand.mock.callCount(), count);
    invoke();
    assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
    assert.equal(h.loadProgress.mock.callCount(), 1);
    assert.equal(h.session.close.mock.callCount(), 0);
  });

  test(`${label} rejects arbitrary destinations, ignores cancelled success and reports stop or timeout honestly`, async t => {
    const h = setup(t, { uiActionTimeoutMs: 20 });
    await h.ready;
    const invoke = (id, args = '{}') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: args }] });
    for (const [i, args] of ['{"url":"/interview"}', '{"tab":"AI Coach"}', '[]', 'null', 'not-json'].entries()) {
      invoke(`invalid-progress-${i}`, args);
      assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
    }
    assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 0);
    invoke('cancel-progress');
    h.callbacks().onEvent({ type: 'FunctionCallCancelled', functions: [{ id: 'cancel-progress' }] });
    const count = h.session.sendCommand.mock.callCount();
    h.socket.control({ type: 'ui_action_result', id: 'cancel-progress', result: { ok: true } });
    assert.equal(h.session.sendCommand.mock.callCount(), count);
    assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'cancel-progress'));
    invoke('stop-progress');
    h.socket.control({ type: 'ui_action_result', id: 'stop-progress', result: { ok: false, cancelled: true } });
    assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /student stopped/);
    invoke('timeout-progress');
    await new Promise(resolve => setTimeout(resolve, 50));
    const response = h.session.sendCommand.mock.calls.at(-1).arguments[0];
    assert.equal(response.id, 'timeout-progress');
    assert.equal(JSON.parse(response.content).ok, false);
    h.socket.control({ type: 'ui_action_result', id: 'timeout-progress', result: { ok: true } });
    assert.deepEqual(h.session.sendCommand.mock.calls.at(-1).arguments[0], response);
  });
}

test('Practice Again navigation and fresh reads share normalization without refreshing saved progress', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, name) => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: '{}' }] });
  invoke('practice-nav', 'open_practice_again');
  h.socket.control({ type: 'ui_action_result', id: 'practice-nav', result: { ok: true },
    context: { page: 'practice_again', state: 'loading', questions: [{ text: 'stale question' }], transcript: 'private answer' } });
  let result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(result.displayed, 'practice_again');
  assert.equal(result.context.page, 'practice_again');
  assert.equal(result.context.state, 'loading');
  assert.doesNotMatch(JSON.stringify(result), /stale question|private answer/);
  invoke('practice-read', 'read_current_page');
  h.socket.control({ type: 'page_context_result', id: 'practice-read', context: { page: 'practice_again', state: 'error', errorMessage: 'Try again.' } });
  result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(result.context.state, 'error');
  assert.equal(result.context.errorMessage, 'Try again.');
  assert.equal(h.loadProgress.mock.callCount(), 1);
  assert.equal(h.session.close.mock.callCount(), 0);
  invoke('oversized-practice', 'open_practice_again');
  h.socket.control({ type: 'ui_action_result', id: 'oversized-practice', result: { ok: true }, context: { page: 'practice_again', state: 'loading', extra: 'x'.repeat(64_000) } });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).context.state, 'unavailable');
});

test('My Progress navigation and fresh reads share bounded context without reloading saved progress', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, name) => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: '{}' }] });
  invoke('progress-aware-nav', 'open_my_progress');
  h.socket.control({ type: 'ui_action_result', id: 'progress-aware-nav', result: { ok: true },
    context: { page: 'my_progress', state: 'loading', journey: { startingScore: '3.0 / 5.0' }, transcript: 'private answer' } });
  let result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(result.displayed, 'my_progress');
  assert.equal(result.context.page, 'my_progress');
  assert.equal(result.context.state, 'loading');
  assert.doesNotMatch(JSON.stringify(result), /3\.0|private answer/);
  invoke('progress-aware-read', 'read_current_page');
  h.socket.control({ type: 'page_context_result', id: 'progress-aware-read', context: { page: 'my_progress', state: 'ready', view: 'starting_point', guidance: 'Keep practising.', scoreDetails: { expanded: true, score: '3.0 / 5.0' } } });
  result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(result.context.scoreDetails.score, '3.0 / 5.0');
  invoke('progress-oversize', 'open_my_progress');
  h.socket.control({ type: 'ui_action_result', id: 'progress-oversize', result: { ok: true }, context: { page: 'my_progress', state: 'loading', extra: 'x'.repeat(64_000) } });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).context.state, 'unavailable');
  assert.equal(h.loadProgress.mock.callCount(), 1);
  assert.equal(h.session.close.mock.callCount(), 0);
});

test('model cancellation stops History and ignores late browser success', async t => {
  const h = setup(t);
  await h.ready;
  const call = { id: 'cancel-history', name: 'open_practice_history', client_side: true, arguments: '{}' };
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
  h.callbacks().onEvent({ type: 'FunctionCallCancelled', functions: [{ id: call.id }] });
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === call.id));
  h.socket.control({ type: 'ui_action_result', id: call.id, result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
});

test('student stop and navigation timeout return failure instead of a false success', async t => {
  const h = setup(t, { uiActionTimeoutMs: 10 });
  await h.ready;
  const invoke = id => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id, name: 'open_practice_history', client_side: true, arguments: '{}' }] });
  invoke('student-stop');
  h.socket.control({ type: 'ui_action_result', id: 'student-stop', result: { ok: false, cancelled: true } });
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /student stopped/);
  invoke('timeout');
  await new Promise(resolve => setTimeout(resolve, 30));
  const response = h.session.sendCommand.mock.calls.at(-1).arguments[0];
  assert.equal(response.id, 'timeout');
  assert.equal(JSON.parse(response.content).ok, false);
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ui_cancel' && message.id === 'timeout'));
});

test('disconnect clears pending History timers without late tool replies', async t => {
  const h = setup(t, { uiActionTimeoutMs: 5 });
  await h.ready;
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: 'disconnect-history', name: 'open_practice_history', client_side: true, arguments: '{}' }] });
  h.socket.close();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
});

function setup(t, overrides = {}, request = { auth: { uid: 'verified-user' } }) {
  t.mock.method(console, 'log', () => {});
  const socket = new FakeSocket();
  let callbacks;
  const session = { close: t.mock.fn(), sendAudio: t.mock.fn(), sendCommand: t.mock.fn(() => true), isReady: () => true };
  const loadProgress = t.mock.fn(async () => ({ role: 'frontend', practiceScore: 75 }));
  const createSession = t.mock.fn(options => { callbacks = options; return session; });
  const releaseQuota = t.mock.fn(async () => {});
  const reserveQuota = t.mock.fn(async () => ({ remainingMs: 900_000, release: releaseQuota }));
  const options = { loadProgress, createSession, reserveQuota, ...overrides };
  const ready = handleVoiceAgentSocket(socket, request, options);
  t.after(() => socket.close());
  return { socket, session, ready, releaseQuota, ...options, callbacks: () => callbacks };
}

test('page reads wait for fresh browser state and ignore unsolicited, duplicate and cancelled results', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, args = '{}') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'read_current_page', client_side: true, arguments: args,
  }] });
  const context = { page: 'practice_history', state: 'loading', transcript: 'must-not-leak' };
  h.socket.control({ type: 'page_context_result', id: 'forged', context });
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  invoke('read-1'); invoke('read-1');
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_read_page').length, 1);
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
  h.socket.control({ type: 'page_context_result', id: 'read-1', context });
  const result = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.deepEqual(result.context, { page: 'practice_history', state: 'loading' });
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
  h.socket.control({ type: 'page_context_result', id: 'read-1', context });
  assert.equal(h.session.sendCommand.mock.callCount(), 1);
  invoke('read-2');
  h.callbacks().onEvent({ type: 'FunctionCallCancelled', functions: [{ id: 'read-2' }] });
  h.socket.control({ type: 'page_context_result', id: 'read-2', context });
  assert.equal(h.session.sendCommand.mock.callCount(), 1);
  invoke('read-3');
  h.socket.control({ type: 'page_context_result', id: 'read-3', context: { page: 'voice_agent_playground' } });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).context.page, 'voice_agent_playground');
  assert.equal(h.loadProgress.mock.callCount(), 1);
});

test('page reads reject arguments, oversized context and stale replies after timeout or disconnect', async t => {
  const h = setup(t, { uiActionTimeoutMs: 10 });
  await h.ready;
  const invoke = (id, args = '{}') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'read_current_page', client_side: true, arguments: args,
  }] });
  invoke('bad-read', '{"selector":"body"}');
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  invoke('big-read');
  h.socket.control({ type: 'page_context_result', id: 'big-read', context: { page: 'practice_history', state: 'loading', secret: 'x'.repeat(64_000) } });
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).context.state, 'unavailable');
  invoke('timed-read');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  const count = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'page_context_result', id: 'timed-read', context: { page: 'practice_history', state: 'empty' } });
  assert.equal(h.session.sendCommand.mock.callCount(), count);
  invoke('disconnect-read');
  h.socket.close();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(h.session.sendCommand.mock.callCount(), count);
});

test('Playground return is bounded, acknowledged once, and shares the navigation lock', async t => {
  const h = setup(t);
  await h.ready;
  const invoke = (id, args = '{}') => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'return_to_playground', client_side: true, arguments: args,
  }] });
  invoke('invalid-return', '{"url":"/interview"}');
  assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  invoke('return-1'); invoke('return-1');
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_ui_action').length, 1);
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: 'history-during-return', name: 'open_practice_history', client_side: true, arguments: '{}' }] });
  assert.match(h.session.sendCommand.mock.calls.at(-1).arguments[0].content, /already running/);
  const count = h.session.sendCommand.mock.callCount();
  h.socket.control({ type: 'ui_action_result', id: 'return-1', result: { ok: true } });
  const response = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(response.displayed, 'voice_agent_playground');
  assert.match(response.instruction, /same voice conversation/);
  h.socket.control({ type: 'ui_action_result', id: 'return-1', result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), count + 1);
  assert.equal(h.session.close.mock.callCount(), 0);
});

test('cancelled Playground return ignores late success', async t => {
  const h = setup(t);
  await h.ready;
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: 'return-cancel', name: 'return_to_playground', client_side: true, arguments: '{}' }] });
  h.callbacks().onEvent({ type: 'FunctionCallCancelled', functions: [{ id: 'return-cancel' }] });
  h.socket.control({ type: 'ui_action_result', id: 'return-cancel', result: { ok: true } });
  assert.equal(h.session.sendCommand.mock.callCount(), 0);
});

test('voice loads only the verified account once and forwards audio and commands without extra reads', async t => {
  const h = setup(t, {}, { auth: { uid: 'verified-user' }, url: '/ws/voice-agent?uid=another-user' });
  await h.ready;
  assert.deepEqual(h.loadProgress.mock.calls[0].arguments, ['verified-user']);
  assert.deepEqual(h.reserveQuota.mock.calls[0].arguments, ['verified-user']);
  assert.equal(h.callbacks().progressContext.practiceScore, 75);
  h.callbacks().onReady();
  assert.ok(h.socket.messages.some(message => message.type === 'voice_agent_ready'));
  h.socket.control({ type: 'start_session', uid: 'another-user', progressContext: { practiceScore: 100 } });
  h.socket.control({ type: 'inject_user_message', content: 'My scores?' });
  h.socket.emit('message', Buffer.from([1, 2]), true);
  assert.equal(h.loadProgress.mock.callCount(), 1);
  assert.equal(h.session.sendAudio.mock.callCount(), 1);
  assert.deepEqual(h.session.sendCommand.mock.calls[0].arguments, [{ type: 'InjectUserMessage', content: 'My scores?' }]);
  assert.equal(h.callbacks().progressContext.practiceScore, 75);
  h.socket.close();
  assert.equal(h.session.close.mock.callCount(), 1);
});

test('voice refuses an unbound identity before loading progress or starting an upstream session', async t => {
  const h = setup(t, {}, { url: '/ws/voice-agent?uid=another-user' });
  await h.ready;
  assert.equal(h.loadProgress.mock.callCount(), 0);
  assert.equal(h.reserveQuota.mock.callCount(), 0);
  assert.equal(h.createSession.mock.callCount(), 0);
  assert.equal(h.socket.closeCode, 1008);
});

for (const mode of ['failure', 'timeout']) {
  test(`progress ${mode} falls back to general voice help without exposing storage details`, async t => {
    const h = setup(t, {
      loadProgress: () => mode === 'timeout' ? new Promise(() => {}) : Promise.reject(new Error('private-database-credential')),
      progressTimeoutMs: 5,
    });
    await h.ready;
    assert.equal(h.createSession.mock.callCount(), 1);
    assert.equal(h.callbacks().progressContext, null);
    assert.doesNotMatch(JSON.stringify(h.socket.messages), /private-database-credential/);
  });
}

for (const action of ['close', 'error', 'close_session']) {
  test(`a ${action} during progress loading cannot create a late paid voice session`, async t => {
    let finish;
    const h = setup(t, { loadProgress: () => new Promise(resolve => { finish = resolve; }) });
    if (action === 'close') h.socket.close();
    else if (action === 'error') h.socket.emit('error', new Error('Socket closed'));
    else h.socket.control({ type: 'close_session' });
    finish({ practiceScore: 75 });
    await h.ready;
    assert.equal(h.createSession.mock.callCount(), 0);
    assert.equal(h.reserveQuota.mock.callCount(), 0);
  });
}

test('quota rejection never opens Deepgram and reports why the session was blocked', async t => {
  t.mock.method(console, 'error', () => {});
  for (const reason of ['exhausted', 'active', 'unavailable']) {
    const h = setup(t, { reserveQuota: async () => {
      if (reason === 'unavailable') throw new Error('private database details');
      return { reason };
    } });
    await h.ready;
    assert.equal(h.createSession.mock.callCount(), 0);
    assert.equal(h.socket.messages.at(-1).code, `quota_${reason}`);
    assert.equal(h.socket.closeCode, reason === 'unavailable' ? 1011 : 1008);
    assert.doesNotMatch(JSON.stringify(h.socket.messages), /private database details/);
  }
});

test('disconnecting during reservation or failing before Deepgram connects returns the full grant', async t => {
  let finishReservation;
  let startReservation;
  const reserving = new Promise(resolve => { startReservation = resolve; });
  const h = setup(t, { reserveQuota: () => new Promise(resolve => {
    finishReservation = resolve;
    startReservation();
  }) });
  await reserving;
  h.socket.close();
  finishReservation({ remainingMs: 900_000, release: h.releaseQuota });
  await h.ready;
  assert.equal(h.createSession.mock.callCount(), 0);
  assert.deepEqual(h.releaseQuota.mock.calls.map(call => call.arguments), [[0]]);

  const failed = setup(t, { createSession() { throw new Error('Configuration failed'); } });
  await failed.ready;
  assert.deepEqual(failed.releaseQuota.mock.calls.map(call => call.arguments), [[0]]);
});

test('quota charges only connected time and settles once after the upstream closes', async t => {
  const h = setup(t);
  await h.ready;
  let now = 20_000;
  t.mock.method(performance, 'now', () => now);
  h.callbacks().onStatus('connected');
  now += 360_000;
  h.socket.control({ type: 'close_session' });
  h.socket.close();
  assert.equal(h.session.close.mock.callCount(), 1);
  assert.equal(h.releaseQuota.mock.callCount(), 0);
  const details = { code: 1000, reason: '', expected: true };
  await h.callbacks().onClose(details);
  await h.callbacks().onClose(details);
  assert.deepEqual(h.releaseQuota.mock.calls.map(call => call.arguments), [[360_000]]);
});

test('remaining quota forcibly ends an idle session and stays enforced during a close handshake', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const release = t.mock.fn(async () => {});
  const allowanceMs = 20 * 60 * 1000;
  const reserveQuota = async () => ({ remainingMs: allowanceMs, release });
  const idle = setup(t, { reserveQuota });
  const closing = setup(t, { reserveQuota });
  await Promise.all([idle.ready, closing.ready]);
  t.mock.timers.tick(allowanceMs + 1);
  assert.equal(idle.session.close.mock.callCount(), 0, 'meter waits for upstream open');
  idle.callbacks().onStatus('connected');
  closing.callbacks().onStatus('connected');
  assert.deepEqual(idle.socket.messages.find(message => message.type === 'voice_agent_quota'), {
    type: 'voice_agent_quota', remainingMs: allowanceMs,
  });
  t.mock.timers.tick(allowanceMs - 1);
  assert.equal(idle.session.close.mock.callCount(), 0);
  closing.socket.close();
  assert.deepEqual(closing.session.close.mock.calls[0].arguments, [{ immediate: false }]);
  t.mock.timers.tick(1);
  assert.deepEqual(idle.session.close.mock.calls[0].arguments, [{ immediate: true }]);
  assert.deepEqual(closing.session.close.mock.calls[1].arguments, [{ immediate: true }]);
  assert.equal(idle.socket.messages.at(-1).code, 'quota_exhausted');
  assert.equal(idle.socket.messages.at(-1).message, 'You’ve used all your Nikki voice time.');
  assert.equal(idle.socket.closeCode, 1008);
  const details = { code: 1006, reason: '', expected: true };
  await idle.callbacks().onClose(details);
  await closing.callbacks().onClose(details);
  assert.deepEqual(release.mock.calls.map(call => call.arguments), [[allowanceMs], [allowanceMs]]);
});

test('each new voice session loads fresh scores and the newly selected role', async t => {
  let progress = { role: 'backend', practiceScore: 75 };
  const loadProgress = async () => ({ ...progress });
  const first = setup(t, { loadProgress });
  await first.ready;
  first.socket.close();
  progress = { role: 'frontend', practiceScore: null };
  const second = setup(t, { loadProgress });
  await second.ready;
  assert.equal(first.callbacks().progressContext.role, 'backend');
  assert.equal(second.callbacks().progressContext.role, 'frontend');
  assert.equal(second.callbacks().progressContext.practiceScore, null);
});

test('LLM display calls produce a workspace and a response, with duplicate calls rendered once', async t => {
  const h = setup(t);
  await h.ready;
  const call = { id: 'display-1', name: 'show_workspace', client_side: true, arguments: JSON.stringify({ view: 'star' }) };
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
  const shown = h.socket.messages.filter(message => message.type === 'voice_agent_workspace');
  assert.equal(shown.length, 1);
  assert.equal(shown[0].workspace.view, 'star');
  assert.equal(shown[0].workspace.id, call.id);
  const response = h.session.sendCommand.mock.calls.at(-1).arguments[0];
  assert.equal(response.type, 'FunctionCallResponse');
  assert.equal(response.id, call.id);
  assert.equal(JSON.parse(response.content).ok, true);
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_workspace').length, 1);
  h.callbacks().onEvent({ type: 'FunctionCallCancelled', functions: [{ id: call.id }] });
  assert.deepEqual(h.socket.messages.at(-1), { type: 'voice_agent_workspace_cancel', id: call.id });
  const count = h.session.sendCommand.mock.callCount();
  h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [call] });
  assert.equal(h.session.sendCommand.mock.callCount(), count);
});

test('malformed and unsupported display tools return an error without rendering or navigating', async t => {
  const h = setup(t);
  await h.ready;
  for (const [name, args] of [['navigate', '{}'], ['show_workspace', '{bad'], ['show_workspace', '{"view":"script"}']]) {
    h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{ id: `bad-${args}`, name, arguments: args, client_side: true }] });
    assert.equal(JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content).ok, false);
  }
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_workspace').length, 0);
  const errors = h.socket.messages.filter(message => message.type === 'voice_agent_workspace_error');
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /Try a supported view/);
});

test('an incomplete display call asks for clarification, preserves the workspace, and resumes once resolved', async t => {
  const h = setup(t, { loadProgress: async () => ({
    role: 'frontend', assessments: { set2: { role: 'frontend', difficulty: 'easy', scorePercentage: 75, metrics: {}, questions: [] } },
    recentAttempts: [{ role: 'backend', difficulty: 'easy' }],
  }) });
  await h.ready;
  const show = (id, input) => h.callbacks().onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'show_workspace', client_side: true, arguments: JSON.stringify(input),
  }] });
  show('previous', { view: 'star' });
  show('ambiguous', { view: 'feedback' });
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_workspace').length, 1);
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_workspace_error').length, 0);
  const question = h.socket.messages.find(message => message.type === 'voice_agent_workspace_clarification');
  assert.match(question.question, /Which practice set/);
  const response = JSON.parse(h.session.sendCommand.mock.calls.at(-1).arguments[0].content);
  assert.equal(response.needsClarification, true);
  assert.equal(response.missingField, 'section');
  assert.equal(response.displayed, undefined);
  show('ambiguous', { view: 'feedback' });
  assert.equal(h.socket.messages.filter(message => message.type === 'voice_agent_workspace_clarification').length, 1);
  show('resolved', { view: 'feedback', section: 'set2', role: 'frontend' });
  const displayed = h.socket.messages.filter(message => message.type === 'voice_agent_workspace').at(-1).workspace;
  assert.equal(displayed.view, 'feedback');
  assert.equal(displayed.scorePercentage, 75);
  assert.equal(h.session.close.mock.callCount(), 0);
});

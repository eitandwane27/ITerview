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

function setup(t, overrides = {}, request = { auth: { uid: 'verified-user' } }) {
  t.mock.method(console, 'log', () => {});
  const socket = new FakeSocket();
  let callbacks;
  const session = { close: t.mock.fn(), sendAudio: t.mock.fn(), sendCommand: t.mock.fn(() => true), isReady: () => true };
  const loadProgress = t.mock.fn(async () => ({ role: 'frontend', practiceScore: 75 }));
  const createSession = t.mock.fn(options => { callbacks = options; return session; });
  const options = { loadProgress, createSession, ...overrides };
  const ready = handleVoiceAgentSocket(socket, request, options);
  t.after(() => socket.close());
  return { socket, session, ready, ...options, callbacks: () => callbacks };
}

test('voice loads only the verified account once and forwards audio and commands without extra reads', async t => {
  const h = setup(t, {}, { auth: { uid: 'verified-user' }, url: '/ws/voice-agent?uid=another-user' });
  await h.ready;
  assert.deepEqual(h.loadProgress.mock.calls[0].arguments, ['verified-user']);
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
  });
}

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

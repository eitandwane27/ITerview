const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const http = require('node:http');
const { test } = require('node:test');
const { WebSocket, WebSocketServer } = require('ws');
const { createSchoolAuth } = require('../middleware/schoolAuth');

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  messages = [];
  send(data) { this.messages.push(JSON.parse(data)); }
  control(type) { this.emit('message', Buffer.from(JSON.stringify({ type })), false); }
}

function setup(t, implementation) {
  const sessions = [];
  const service = require('../services/sttService');
  const create = t.mock.method(service, 'createDeepgramLiveSession', implementation || ((onTranscript, onError) => {
    const session = { onTranscript, onError, sendAudio: t.mock.fn(), finish: t.mock.fn() };
    sessions.push(session);
    return session;
  }));
  const path = require.resolve('../controllers/micTestSocket');
  const cached = require.cache[path];
  delete require.cache[path];
  const { handleMicTestSocket } = require(path);
  t.after(() => { delete require.cache[path]; if (cached) require.cache[path] = cached; });
  const socket = new FakeSocket();
  handleMicTestSocket(socket);
  t.after(() => socket.emit('close'));
  return { socket, sessions, create, handleMicTestSocket };
}

test('mic check streams audio and transcripts through STT without token grants or scoring', t => {
  const { socket, sessions, create } = setup(t);
  const audio = Buffer.from([0, 1, 2, 3]);
  socket.emit('message', audio, true);
  for (const invalid of ['null', '[]', 'true', '{}', '{', '"start_recording"']) {
    assert.doesNotThrow(() => socket.emit('message', Buffer.from(invalid), false));
  }
  assert.equal(create.mock.callCount(), 0);
  socket.control('start_recording');
  socket.control('start_recording');
  assert.equal(create.mock.callCount(), 1);
  socket.emit('message', audio, true);
  assert.deepEqual(sessions[0].sendAudio.mock.calls[0].arguments, [audio]);
  sessions[0].onTranscript('Testing', false);
  sessions[0].onTranscript('Testing my microphone.', true);
  assert.deepEqual(socket.messages, [
    { type: 'status', message: 'Listening...' },
    { type: 'transcript', text: 'Testing', isFinal: false },
    { type: 'transcript', text: 'Testing my microphone.', isFinal: true },
  ]);
});

for (const action of ['stop', 'close', 'error']) {
  test(`mic check releases STT on ${action} and ignores stale callbacks`, t => {
    const { socket, sessions } = setup(t);
    socket.control('start_recording');
    if (action === 'stop') socket.control('stop_recording');
    else socket.emit(action, new Error('Synthetic socket failure'));
    socket.emit('message', Buffer.from([0, 1]), true);
    const count = socket.messages.length;
    sessions[0].onTranscript('Late transcript', true);
    sessions[0].onError(new Error('Late provider failure'));
    assert.equal(socket.messages.length, count);
    assert.equal(sessions[0].sendAudio.mock.callCount(), 0);
    assert.equal(sessions[0].finish.mock.callCount(), 1);
    if (action === 'stop') {
      socket.control('start_recording');
      assert.equal(sessions.length, 2);
      sessions[0].onError(new Error('Old connection failure'));
      sessions[1].onTranscript('Fresh transcript', true);
      assert.equal(socket.messages.at(-1).text, 'Fresh transcript');
    }
  });
}

for (const failure of ['synchronous', 'throw', 'asynchronous']) {
  test(`${failure} STT failures clean up without leaking provider details`, t => {
    const secret = 'synthetic-provider-secret';
    const finish = t.mock.fn();
    let fail;
    const { socket } = setup(t, (_onTranscript, onError) => {
      fail = onError;
      if (failure === 'throw') throw new Error(secret);
      if (failure === 'synchronous') onError(new Error(secret));
      return { finish };
    });
    socket.control('start_recording');
    if (failure === 'asynchronous') fail(new Error(secret));
    assert.deepEqual(socket.messages.at(-1), {
      type: 'error', message: 'Could not connect to speech service. Please try again.',
    });
    assert.ok(!JSON.stringify(socket.messages).includes(secret));
    assert.equal(finish.mock.callCount(), failure === 'throw' ? 0 : 1);
    socket.emit('close');
    assert.equal(finish.mock.callCount(), failure === 'throw' ? 0 : 1);
  });
}

test('authenticated mic socket rejects unverified callers and streams for verified school users', async t => {
  const { handleMicTestSocket, create } = setup(t);
  const auth = createSchoolAuth(async token => ({
    uid: 'mic-user', email: 'student@spcba.edu.ph', email_verified: token === 'verified',
    firebase: { sign_in_provider: 'password' },
  }));
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true, handleProtocols: protocols => protocols.has('iterview') ? 'iterview' : false });
  t.after(() => { wss.clients.forEach(ws => ws.terminate()); wss.close(); server.close(); });
  server.on('upgrade', async (request, socket, head) => {
    try {
      await auth.authenticateSocket(request);
      wss.handleUpgrade(request, socket, head, handleMicTestSocket);
    } catch (error) {
      socket.end(`HTTP/1.1 ${error.status} Forbidden\r\nConnection: close\r\n\r\n`);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `ws://127.0.0.1:${server.address().port}/ws/mic-test`;
  for (const protocols of [['iterview'], ['iterview', 'auth.unverified']]) {
    const client = new WebSocket(url, protocols);
    await assert.rejects(once(client, 'open'), /401|403/);
  }
  assert.equal(create.mock.callCount(), 0);
  const client = new WebSocket(url, ['iterview', 'auth.verified']);
  await once(client, 'open');
  assert.equal(client.protocol, 'iterview');
  const status = once(client, 'message');
  client.send(JSON.stringify({ type: 'start_recording' }));
  assert.equal(JSON.parse(String((await status)[0])).message, 'Listening...');
  assert.equal(create.mock.callCount(), 1);
  client.close();
  await once(client, 'close');
});

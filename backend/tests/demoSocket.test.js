const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  messages = [];

  send(payload) {
    this.messages.push(JSON.parse(payload));
  }

  control(payload) {
    this.emit('message', Buffer.from(payload), false);
  }
}

test('malformed demo controls cannot disrupt recording or other sessions', (t) => {
  const stt = require('../services/sttService');
  const sessions = [];
  const createSession = t.mock.method(stt, 'createDeepgramLiveSession', (onTranscript) => {
    const session = {
      sendAudio: t.mock.fn(),
      finish: t.mock.fn(),
      onTranscript,
    };
    sessions.push(session);
    return session;
  });
  const controllerPath = require.resolve('../controllers/demoSocket');
  const cachedController = require.cache[controllerPath];
  delete require.cache[controllerPath];
  t.after(() => {
    delete require.cache[controllerPath];
    if (cachedController) require.cache[controllerPath] = cachedController;
  });
  const { handleDemoSocket } = require(controllerPath);
  const socket = new FakeSocket();
  const otherSocket = new FakeSocket();
  t.after(() => {
    socket.emit('close');
    otherSocket.emit('close');
  });
  handleDemoSocket(socket, {});
  handleDemoSocket(otherSocket, {});
  otherSocket.control('{"type":"start_recording"}');
  const otherSession = sessions[0];

  const invalidControls = [
    'null', '[]', '[{"type":"start_recording"}]', 'true', 'false',
    '0', '1', '"start_recording"', '""', '{}',
    '{"type":null}', '{"type":0}', '{"type":true}',
    '{"type":[]}', '{"type":{}}', '{"type":["stop_recording"]}',
    '{"type":"unknown"}', '{', '',
  ];

  // Check both idle and recording states: invalid input must not start or stop STT.
  for (const recording of [false, true]) {
    if (recording) socket.control('{"type":"start_recording"}');
    const callsBefore = createSession.mock.callCount();
    const messagesBefore = socket.messages.length;
    for (const payload of invalidControls) {
      assert.doesNotThrow(() => socket.control(payload), `Rejected safely: ${payload}`);
    }
    assert.equal(createSession.mock.callCount(), callsBefore);
    assert.equal(socket.messages.length, messagesBefore);
    for (const session of sessions) assert.equal(session.finish.mock.callCount(), 0);
  }

  const audio = Buffer.from([0, 1, 2, 3]);
  socket.emit('message', audio, true);
  otherSocket.emit('message', audio, true);
  assert.deepEqual(sessions[1].sendAudio.mock.calls[0].arguments, [audio]);
  assert.deepEqual(otherSession.sendAudio.mock.calls[0].arguments, [audio]);
  for (const session of sessions) {
    session.onTranscript('First, check the server logs and then debug the API.', true);
  }
  for (const client of [socket, otherSocket]) {
    assert.ok(client.messages.some((message) => message.type === 'scores'));
    client.control('{"type":"stop_recording"}');
    assert.equal(client.messages.at(-1).message, 'Recording stopped.');
  }
  for (const session of sessions) assert.equal(session.finish.mock.callCount(), 1);

  // A subsequent valid recording must still work on the affected connection.
  socket.control('{"type":"start_recording"}');
  assert.equal(createSession.mock.callCount(), 3);
  socket.control('{"type":"stop_recording"}');
  assert.equal(sessions[2].finish.mock.callCount(), 1);
});

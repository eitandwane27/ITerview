const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setImmediate } = require('node:timers/promises');
const { test } = require('node:test');
const { DeepgramClient } = require('@deepgram/sdk');
const { createDeepgramLiveSession } = require('../services/sttService');

test('STT delivers interim and final speech without writing it to logs', async t => {
  const originalKey = process.env.DEEPGRAM_API_KEY;
  const originalDebug = process.env.STT_DEBUG;
  process.env.DEEPGRAM_API_KEY = 'test-key';
  process.env.STT_DEBUG = 'true';
  t.after(() => {
    if (originalKey === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = originalKey;
    if (originalDebug === undefined) delete process.env.STT_DEBUG;
    else process.env.STT_DEBUG = originalDebug;
  });

  const socket = new EventEmitter();
  socket.connect = () => {};
  t.mock.getter(DeepgramClient.prototype, 'listen', () => ({
    v2: { createConnection: async () => socket },
  }));
  const log = t.mock.method(console, 'log', () => {});
  const logError = t.mock.method(console, 'error', () => {});
  const transcripts = [];
  const errors = [];
  createDeepgramLiveSession((...args) => transcripts.push(args), error => errors.push(error));
  await setImmediate();

  const transcript = 'My email is student@example.test.';
  socket.emit('message', { transcript, is_final: false });
  socket.emit('message', { transcript, is_final: true });
  const providerError = new Error(transcript);
  socket.emit('error', providerError);

  assert.deepEqual(transcripts, [[transcript, false], [transcript, true]]);
  assert.deepEqual(errors, [providerError]);
  assert.equal(log.mock.callCount(), 0);
  assert.deepEqual(logError.mock.calls.map(call => call.arguments), [['[STT] ❌ Deepgram connection error']]);
});

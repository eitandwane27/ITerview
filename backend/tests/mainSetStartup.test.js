const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { setImmediate: nextTurn } = require('node:timers/promises');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Load the real controller with synthetic provider/persistence boundaries.
function loadController(set, dependencies) {
  const filename = path.resolve(__dirname, `../controllers/set${set}Socket.js`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = id => Object.hasOwn(dependencies, id) ? dependencies[id] : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports[`handleSet${set}Socket`];
}

for (const set of [1, 2, 3]) {
  for (const scenario of ['early TTS failure', 'generation failure', 'disconnect during generation',
    'disconnect during TTS', 'successful overlap']) {
    test(`Set ${set} startup safely handles ${scenario}`, async t => {
      t.mock.method(console, 'log', () => {});
      t.mock.method(console, 'error', () => {});
      const tts = deferred();
      const q2 = deferred();
      const q2Started = deferred();
      const socket = new EventEmitter();
      Object.assign(socket, { OPEN: 1, readyState: 1, messages: [] });
      socket.send = payload => socket.messages.push(JSON.parse(payload));
      socket.close = () => { socket.readyState = 3; socket.emit('close'); };
      t.after(() => socket.close());
      let generationCalls = 0;
      let questionWrites = 0;
      const sessionModel = {
        findOne: async () => null,
        findOneAndUpdate: async (_filter, update) => {
          if (update.$set?.questions) questionWrites++;
          return { _id: 'synthetic-session', ...update.$set };
        },
      };
      const handle = loadController(set, {
        '../services/sttService': { createDeepgramLiveSession() { throw new Error('Unexpected STT'); } },
        '../services/ttsService': { synthesizeSpeech: () => tts.promise },
        [`../services/aiSet${set}Generator`]: {
          [`generateSet${set}Question`]: async () => {
            generationCalls++;
            if (generationCalls === 2) { q2Started.resolve(); return q2.promise; }
            return `Question ${generationCalls}?`;
          },
          getCompetencyTopic: () => 'Teamwork',
        },
        '../models/User': { findOne: async () => ({ role: 'backend', difficulty: 'easy' }) },
        '../models/PreTestSession': { findOne: () => ({ sort: async () => null }) },
        '../models/Set1Session': set === 1 ? sessionModel : { findOne: async () => ({ isCompleted: true, attemptId: 'startup-run', role: 'backend', difficulty: 'easy' }) },
        '../models/Set2Session': set === 2 ? sessionModel : { findOne: async () => ({ isCompleted: true, attemptId: 'startup-run', role: 'backend', difficulty: 'easy' }) },
        '../models/Set3Session': sessionModel,
      });
      handle(socket, { auth: { uid: 'test' }, url: `/ws/set${set}?mode=practice`, headers: { host: 'localhost' } });
      await q2Started.promise;
      if (scenario === 'early TTS failure') {
        tts.reject(new Error('Synthetic TTS failure'));
        // Cross an event-loop turn before Q2 resolves: an unobserved rejection
        // fails node:test even though the controller might await it later.
        await nextTurn();
        q2.resolve('Question 2?');
      } else if (scenario === 'generation failure') {
        q2.reject(new Error('Synthetic generation failure'));
        await nextTurn();
        tts.reject(new Error('TTS failed after startup was abandoned'));
      } else if (scenario === 'disconnect during generation') {
        socket.close();
        tts.reject(new Error('TTS failed after disconnect'));
        await nextTurn();
        q2.resolve('Question 2?');
      } else if (scenario === 'disconnect during TTS') {
        q2.resolve('Question 2?');
        await nextTurn();
        socket.close();
        tts.reject(new Error('TTS failed while disconnected'));
      } else {
        tts.resolve(Buffer.from('synthetic audio'));
        q2.resolve('Question 2?');
      }
      await nextTurn();
      await nextTurn();
      const errors = socket.messages.filter(message => message.type === 'error');
      const audio = socket.messages.filter(message => message.type === 'tts_audio');
      if (scenario.includes('failure')) {
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /Failed to initialize/);
        assert.equal(audio.length, 0);
      } else if (scenario.startsWith('disconnect')) {
        assert.equal(errors.length, 0);
        assert.equal(audio.length, 0);
        if (scenario === 'disconnect during generation') {
          assert.equal(generationCalls, 2);
          assert.equal(questionWrites, 0);
        }
      } else {
        assert.equal(errors.length, 0);
        assert.equal(generationCalls, 5);
        assert.equal(audio.length, 1);
        assert.equal(audio[0].data, Buffer.from('synthetic audio').toString('base64'));
      }
    });
  }
}

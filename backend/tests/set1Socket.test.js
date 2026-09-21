const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { resolveSessionMode, getQuestionLimit } = require('../controllers/set1Socket');

test('drill mode remains distinct from persistent practice mode', () => {
  assert.equal(resolveSessionMode('drill'), 'drill');
  assert.equal(resolveSessionMode('practice'), 'practice');
  assert.equal(resolveSessionMode('anything-else'), 'diagnostic');
});

test('a focused drill is shorter than a main set', () => {
  assert.equal(getQuestionLimit('drill'), 3);
  assert.equal(getQuestionLimit('practice'), 5);
  assert.equal(getQuestionLimit('diagnostic'), 5);
});

test('a drill can generate and score an answer without reading or writing Set1Session', async (t) => {
  const generator = require('../services/aiSet1Generator');
  const tts = require('../services/ttsService');
  const preTests = require('../models/PreTestSession');
  const users = require('../models/User');
  const set1Sessions = require('../models/Set1Session');

  t.mock.method(
    generator,
    'generateSet1Question',
    async (_focus, _role, _difficulty, asked) => `Drill question ${asked.length + 1}?`
  );
  t.mock.method(generator, 'evaluateSet1Answer', async () => ({
    clarity_score: 4,
    correctness_score: 4,
    completeness_score: 4,
    tip: 'Keep the structure concise.',
    interviewer_reply: 'Good focused answer.',
  }));
  t.mock.method(tts, 'synthesizeSpeech', async () => Buffer.from('audio'));
  t.mock.method(preTests, 'findOne', () => ({
    sort: async () => ({
      final_weakness_tag: 'focus_clarity',
      baseline_score_percentage: 70,
    }),
  }));
  t.mock.method(users, 'findOne', async () => ({
    role: 'frontend',
    difficulty: 'easy',
    unlockedDifficulty: 'easy',
  }));
  const findOneMock = t.mock.method(set1Sessions, 'findOne', async () => null);
  const updateMock = t.mock.method(set1Sessions, 'findOneAndUpdate', async () => null);

  const controllerPath = require.resolve('../controllers/set1Socket');
  delete require.cache[controllerPath];
  const { handleSet1Socket: handleDrillSocket } = require(controllerPath);

  class FakeSocket extends EventEmitter {
    constructor() {
      super();
      this.OPEN = 1;
      this.readyState = 1;
      this.messages = [];
    }

    send(payload) {
      this.messages.push(JSON.parse(payload));
      this.emit('sent');
    }

    close() {
      this.readyState = 3;
      this.emit('close');
    }
  }

  const socket = new FakeSocket();
  const waitForMessage = (type) =>
    new Promise((resolve, reject) => {
      const check = () => {
        const match = socket.messages.find((message) => message.type === type);
        if (match) {
          clearTimeout(timeout);
          socket.off('sent', check);
          resolve(match);
        }
      };
      const timeout = setTimeout(() => {
        socket.off('sent', check);
        reject(new Error(`Timed out waiting for ${type}`));
      }, 1000);
      socket.on('sent', check);
      check();
    });

  handleDrillSocket(socket, {
    url: '/ws/set1?uid=test-user&mode=drill&focusArea=clarity',
    headers: { host: 'localhost:5000' },
  });

  await waitForMessage('question_text');
  socket.emit(
    'message',
    Buffer.from(JSON.stringify({ type: 'submit_answer', final_text: 'A concise answer.' })),
    false
  );
  await waitForMessage('coach_tip');

  assert.equal(findOneMock.mock.callCount(), 0);
  assert.equal(updateMock.mock.callCount(), 0);
  socket.close();
});

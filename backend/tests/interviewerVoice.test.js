const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const User = require('../models/User');
const router = require('../routes/userRoutes');
const { INTERVIEWER_VOICES, resolveInterviewerVoice } = require('../config/interviewerVoices');

const saveProfile = router.stack.find(layer =>
  layer.route?.path === '/role' && layer.route.methods.put
).route.stack[0].handle;

test('every supported interviewer voice has a matching preview', () => {
  const samples = resolve(__dirname, '../../frontend/src/assets/voice-samples');
  assert.deepEqual(readdirSync(samples).sort(), INTERVIEWER_VOICES.map(voice => voice + '.wav').sort());
});

test('interview voice resolves from the requested choice, saved profile, or Luna', () => {
  assert.equal(resolveInterviewerVoice('aura-2-zeus-en', 'aura-2-mars-en'), 'aura-2-zeus-en');
  assert.equal(resolveInterviewerVoice(null, 'aura-2-mars-en'), 'aura-2-mars-en');
  assert.equal(resolveInterviewerVoice('unknown', 'aura-2-mars-en'), 'aura-2-mars-en');
  assert.equal(resolveInterviewerVoice(), 'aura-2-luna-en');
  assert.equal(User.hydrate({ firebaseUid: 'student' }).interviewerVoice, 'aura-2-luna-en');
});

test('saving a supported voice updates only that preference and rejects unknown voices', async t => {
  const write = t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter, { firebaseUid: 'student' });
    assert.deepEqual(update.$set, { interviewerVoice: 'aura-2-zeus-en' });
    return update.$set;
  });
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
  await saveProfile({ body: { firebaseUid: 'student', interviewerVoice: 'aura-2-zeus-en' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.interviewerVoice, 'aura-2-zeus-en');
  await saveProfile({ body: { firebaseUid: 'student', interviewerVoice: 'unknown' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(write.mock.callCount(), 1);
});

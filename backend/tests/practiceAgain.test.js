const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { EventEmitter } = require('node:events');
const { createSchoolAuth } = require('../middleware/schoolAuth');
const { createPracticeAgainRouter } = require('../routes/practiceAgainRoutes');
const { createSavedQuestionService } = require('../services/savedQuestionService');
const { createPracticeAgainHandler } = require('../controllers/practiceAgainSocket');
const id = '123456789012345678901234';
const identity = { uid: 'student', email: 'student@spcba.edu.ph', email_verified: true,
  firebase: { sign_in_provider: 'password' } };
const auth = createSchoolAuth(async token => {
  if (token === 'valid') return identity;
  if (token === 'unverified') return { ...identity, email_verified: false };
  throw new Error('Invalid token');
});
async function serve(t, library) {
  const app = express();
  app.use('/api/practice-again', createPracticeAgainRouter({ authenticate: auth.requireSchoolUser, library }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path = '/questions', { token = 'valid', method = 'GET', body, rawBody } = {}) => fetch(
    `http://127.0.0.1:${server.address().port}/api/practice-again${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body !== undefined || rawBody ? { body: rawBody || JSON.stringify(body) } : {}),
    });
}
test('saved library requires verified authentication and cannot select another account', async t => {
  const forbidden = () => assert.fail('Private storage must not be read');
  const request = await serve(t, { list: forbidden, save: forbidden, setSaved: forbidden });
  for (const [token, status] of [[null, 401], ['forged', 401], ['unverified', 403]]) {
    assert.equal((await request('/questions', { token })).status, status);
    assert.equal((await request('/questions', { token, method: 'POST', body: {} })).status, status);
  }
  assert.equal((await request('/questions?uid=other')).status, 403);
  assert.equal((await request('/questions', { method: 'POST', body: { firebaseUid: 'other' } })).status, 403);
});
test('routes persist save, remove and undo under the token identity, with private caching', async t => {
  const calls = [];
  const question = { id, text: 'Explain APIs', set: 2 };
  const request = await serve(t, {
    list: async uid => { calls.push(['list', uid]); return [question]; },
    save: async (uid, input) => { calls.push(['save', uid, input]); return question; },
    setSaved: async (uid, savedId, saved) => { calls.push(['toggle', uid, savedId, saved]); return question; },
  });
  const response = await request();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).questions, [question]);
  const input = { set: 2, questionIndex: 0, text: question.text };
  assert.equal((await request('/questions', { method: 'POST', body: input })).status, 200);
  assert.equal((await request(`/questions/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await request(`/questions/${id}/restore`, { method: 'POST' })).status, 200);
  assert.deepEqual(calls, [['list', 'student'], ['save', 'student', input],
    ['toggle', 'student', id, false], ['toggle', 'student', id, true]]);
});
test('routes reject malformed inputs, stale questions and missing IDs without leaking storage errors', async t => {
  const request = await serve(t, { save: async () => { throw Object.assign(new Error('Question changed'), { status: 409 }); },
    list: async () => { throw new Error('private database password'); }, setSaved: async () => null });
  for (const body of [{}, { set: '2', questionIndex: 0, text: 'Q' }, { set: 2, questionIndex: -1, text: 'Q' },
    { set: 2, questionIndex: 5, text: 'Q' }, { set: 2, questionIndex: 0, text: '' }]) {
    assert.equal((await request('/questions', { method: 'POST', body })).status, 400);
  }
  assert.equal((await request('/questions', { method: 'POST', rawBody: '{bad json' })).status, 400);
  assert.equal((await request('/questions', { method: 'POST', body: { text: 'x'.repeat(9000) } })).status, 413);
  assert.equal((await request('/questions', { method: 'POST', body: { set: 2, questionIndex: 0, text: 'Q' } })).status, 409);
  assert.equal((await request('/questions/bad', { method: 'DELETE' })).status, 400);
  assert.equal((await request(`/questions/${id}`, { method: 'DELETE' })).status, 404);
  const failure = await request();
  assert.equal(failure.status, 503);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /password|database/);
});

function storage() {
  const records = [];
  const sessions = [1, 2, 3].map(set => ({ _id: `source-${set}`, attemptId: 'run-1', role: 'backend', difficulty: 'medium',
    questions: ['Explain APIs', 'Explain indexes'], answers: [] }));
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => doc[key] === value);
  const Library = {
    find: filter => ({ sort: () => ({ lean: async () => structuredClone(records.filter(doc => matches(doc, filter))) }) }),
    findOne: filter => ({ lean: async () => structuredClone(records.find(doc => matches(doc, filter)) || null) }),
    findOneAndUpdate: async (filter, update, options) => {
      let record = records.find(doc => matches(doc, filter));
      if (!record && options?.upsert) {
        record = { _id: id, ...filter, ...update.$setOnInsert };
        records.push(record);
      }
      if (!record) return null;
      Object.assign(record, update.$set);
      return structuredClone(record);
    },
    updateOne: async (filter, update) => { Object.assign(records.find(doc => matches(doc, filter)), update.$set); },
  };
  const Sessions = sessions.map((_, index) => ({ findOne: filter => {
    assert.deepEqual(filter, { firebaseUid: 'student' });
    return { lean: async () => structuredClone(sessions[index]) };
  } }));
  return { service: createSavedQuestionService({ Library, Sessions }), sessions, records };
}
test('server snapshots question metadata, rejects future/forged questions and deduplicates saves', async () => {
  const { service, records, sessions } = storage();
  const input = { set: 2, questionIndex: 0, text: 'Explain APIs', role: 'frontend', difficulty: 'hard' };
  const before = structuredClone(sessions);
  const question = await service.save('student', input);
  await service.save('student', input);
  assert.equal(records.length, 1);
  assert.equal(question.role, 'backend');
  assert.equal(question.difficulty, 'Medium');
  assert.deepEqual(sessions, before, 'Saving never writes to assessments');
  await assert.rejects(service.save('student', { ...input, text: 'forged question' }), { status: 409 });
  await assert.rejects(service.save('student', { ...input, questionIndex: 1, text: 'Explain indexes' }), { status: 409 });
  assert.equal(await service.find('someone-else', id), null);
  assert.equal(await service.setSaved('someone-else', id, false), null);
});
test('saved questions and tips survive a new run; remove and undo preserve the snapshot', async () => {
  const { service, sessions } = storage();
  await service.save('student', { set: 3, questionIndex: 0, text: 'Explain APIs' });
  sessions[2].answers.push({ questionIndex: 0, question: 'Explain APIs', tip: 'Describe your own contribution.' });
  assert.equal((await service.list('student'))[0].tip, 'Describe your own contribution.');
  sessions[2] = null;
  assert.equal((await service.list('student'))[0].text, 'Explain APIs');
  await service.setSaved('student', id, false);
  assert.deepEqual(await service.list('student'), []);
  assert.equal(await service.find('student', id), null);
  await service.setSaved('student', id, true);
  assert.equal((await service.list('student'))[0].tip, 'Describe your own contribution.');
  assert.equal((await service.find('student', id)).competency, 'Teamwork & Collaboration');
});

class Socket extends EventEmitter {
  OPEN = 1; readyState = 1; sent = [];
  send(raw) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; this.emit('close'); }
  async message(message) {
    await Promise.all(this.listeners('message').map(listener => listener(Buffer.from(JSON.stringify(message)), false)));
  }
}
const saved = { _id: id, text: 'Original question?', set: 2, role: 'backend', difficulty: 'medium' };
async function socket(options = {}) {
  const ws = new Socket();
  await createPracticeAgainHandler({ find: async (uid, savedId) => {
    assert.equal(uid, 'student'); assert.equal(savedId, id); return saved;
  }, speak: async () => Buffer.from('audio'), loadVoice: async () => null, reportTiming: () => {}, ...options })(ws,
  { auth: identity, url: `/ws/practice-again?questionId=${id}&difficulty=hard&role=frontend` });
  return ws;
}
test('one-question retry uses the stored question and rubric; duplicates cannot evaluate twice', async () => {
  let resolve, calls = 0;
  const voiced = [];
  const ws = await socket({
    loadVoice: async () => 'aura-2-zeus-en',
    speak: async (_text, voice) => { voiced.push(voice); return Buffer.from('audio'); },
    evaluate: async (question, text) => {
    calls++; assert.deepEqual(question, saved); assert.equal(text, 'My new answer');
    await new Promise(done => { resolve = done; });
    return { tip: 'Include one example.', interviewer_reply: 'Good explanation.', accuracy_score: 4 };
  } });
  assert.equal(ws.sent.find(message => message.type === 'session_meta').totalQuestions, 1);
  assert.equal(ws.sent.find(message => message.type === 'session_meta').voice, 'aura-2-zeus-en');
  assert.equal(ws.sent.find(message => message.type === 'question_text').text, saved.text);
  const first = ws.message({ type: 'submit_answer', final_text: 'My new answer' });
  await ws.message({ type: 'submit_answer', final_text: 'Duplicate' });
  assert.equal(calls, 1);
  resolve(); await first;
  await ws.message({ type: 'submit_answer', final_text: 'Duplicate after complete' });
  assert.equal(calls, 1);
  assert.equal(ws.sent.filter(message => message.type === 'coach_tip').length, 1);
  assert.equal(ws.sent.filter(message => message.type === 'session_complete').length, 1);
  assert.deepEqual(voiced, ['aura-2-zeus-en', 'aura-2-zeus-en']);
});
test('evaluation failure permits retry and audio failure still displays feedback', async () => {
  let calls = 0;
  const ws = await socket({ speak: async () => { throw new Error('offline'); }, evaluate: async () => {
    if (++calls === 1) throw new Error('private vendor details');
    return { tip: 'Use an example.' };
  } });
  assert.ok(ws.sent.some(message => message.type === 'audio_unavailable'));
  await ws.message({ type: 'submit_answer', final_text: '' });
  assert.equal(calls, 0);
  await ws.message({ type: 'submit_answer', final_text: 'Answer' });
  assert.ok(ws.sent.some(message => message.code === 'EVALUATION_FAILED'));
  assert.doesNotMatch(JSON.stringify(ws.sent), /private vendor/);
  await ws.message({ type: 'submit_answer', final_text: 'Answer' });
  assert.ok(ws.sent.some(message => message.type === 'session_complete'));
});
test('speech recording is cleaned up on disconnect and late evaluation is discarded', async () => {
  let onTranscript, finished = 0, resolve;
  const ws = await socket({ stt: callback => {
    onTranscript = callback;
    return { finish: () => { finished++; }, sendAudio() {} };
  }, evaluate: async () => new Promise(done => { resolve = done; }) });
  await ws.message({ type: 'start_recording' });
  onTranscript('Recorded answer', true);
  const evaluating = ws.message({ type: 'submit_answer' });
  ws.close();
  resolve({ tip: 'Late feedback' }); await evaluating;
  assert.equal(finished, 1);
  assert.ok(!ws.sent.some(message => message.type === 'coach_tip'));
});
test('deleted or unavailable saved question fails before speech or evaluation starts', async () => {
  const ws = await socket({ find: async () => null, speak: () => assert.fail('No speech'), evaluate: () => assert.fail('No AI') });
  assert.equal(ws.readyState, 3);
  assert.equal(ws.sent[0].type, 'error');
});

test('feedback and completion reach MainSets before slow speech, with concurrent clips delivered in order', async () => {
  const releases = new Map(), speech = [], timings = [];
  const ws = await socket({
    speak: async text => {
      if (text === saved.text) return Buffer.from('question');
      speech.push(text);
      return new Promise(resolve => releases.set(text, resolve));
    },
    evaluate: async () => ({ tip: 'Include an example.', interviewer_reply: 'Good explanation. Include one example.' }),
    reportTiming: timing => timings.push(timing),
  });
  const audioBefore = ws.sent.filter(message => message.type === 'tts_audio').length;
  const submitting = ws.message({ type: 'submit_answer', final_text: 'My answer' });
  // Flush evaluation and the concurrently-started TTS promises without a timer.
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(speech, ['Good explanation.', 'Include one example.']);
  const feedbackIndex = ws.sent.findIndex(message => message.type === 'coach_tip');
  const completeIndex = ws.sent.findIndex(message => message.type === 'session_complete');
  assert.ok(feedbackIndex >= 0 && completeIndex > feedbackIndex);
  assert.equal(ws.sent[completeIndex].audioPending, true);
  assert.ok(!ws.sent.some(message => message.type === 'feedback_audio_complete'));
  assert.equal(ws.sent.filter(message => message.type === 'tts_audio').length, audioBefore);
  // A later sentence resolving first must never overtake the first sentence.
  releases.get('Include one example.')(Buffer.from('second'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ws.sent.filter(message => message.type === 'tts_audio').length, audioBefore);
  releases.get('Good explanation.')(Buffer.from('first'));
  await submitting;
  assert.deepEqual(ws.sent.filter(message => message.type === 'tts_audio').slice(audioBefore)
    .map(message => Buffer.from(message.data, 'base64').toString()), ['first', 'second']);
  assert.deepEqual(timings.map(timing => timing.phase), ['evaluation', 'speech']);
  assert.equal(ws.sent.at(-1).type, 'feedback_audio_complete');
  assert.ok(timings.every(timing => timing.durationMs >= 0));
  assert.ok(timings[1].firstAudioMs >= timings[0].durationMs - 1);
});

test('the first spoken sentence is delivered without waiting for the rest of the reply', async () => {
  let releaseSecond;
  const ws = await socket({
    evaluate: async () => ({ tip: 'A tip.', interviewer_reply: 'First sentence. Second sentence.' }),
    speak: async text => text === 'Second sentence.'
      ? new Promise(resolve => { releaseSecond = resolve; }) : Buffer.from(text),
  });
  const submitting = ws.message({ type: 'submit_answer', final_text: 'My answer' });
  await new Promise(resolve => setImmediate(resolve));
  const clips = ws.sent.filter(message => message.type === 'tts_audio');
  assert.equal(Buffer.from(clips.at(-1).data, 'base64').toString(), 'First sentence.');
  assert.ok(ws.sent.some(message => message.type === 'session_complete'));
  releaseSecond(Buffer.from('Second sentence.'));
  await submitting;
});

test('leaving during speech generation discards remaining audio without another evaluation', async () => {
  let release;
  const ws = await socket({
    evaluate: async () => ({ tip: 'A tip.', interviewer_reply: 'Feedback.' }),
    speak: async text => text === saved.text ? Buffer.from('question')
      : new Promise(resolve => { release = resolve; }),
  });
  const submitting = ws.message({ type: 'submit_answer', final_text: 'My answer' });
  await new Promise(resolve => setImmediate(resolve));
  const count = ws.sent.length;
  ws.close();
  release(Buffer.from('late audio'));
  await submitting;
  assert.equal(ws.sent.length, count);
  assert.ok(ws.sent.some(message => message.type === 'session_complete'));
});

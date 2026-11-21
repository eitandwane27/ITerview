const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createSchoolAuth } = require('../middleware/schoolAuth');
const adminRoutes = require('../routes/adminRoutes');
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const ScoringStudyResult = require('../models/ScoringStudyResult');

test('the scoring study resumes failed trials and records corrections to saved HR ratings', async (t) => {
  const oldAdminUid = process.env.ADMIN_FIREBASE_UID;
  const oldKey = process.env.DEEPSEEK_API_KEY;
  const oldModel = process.env.DEEPSEEK_MODEL;
  process.env.ADMIN_FIREBASE_UID = 'study-admin';
  process.env.DEEPSEEK_API_KEY = 'unused-test-key';
  t.after(() => {
    for (const [name, value] of [['ADMIN_FIREBASE_UID', oldAdminUid], ['DEEPSEEK_API_KEY', oldKey], ['DEEPSEEK_MODEL', oldModel]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const student = { firebaseUid: 'study-participant', email: 'student0042@spcba.edu.ph' };
  const unrelated = { firebaseUid: 'other', email: 'other@example.com' };
  const fixture = {
    _id: '5e0c0f6c1dac114774aa23bc',
    firebaseUid: student.firebaseUid,
    sessionId: 'completed-session',
    completedAt: new Date(),
    answers: [{
      questionIndex: 0, question: 'What is a unit test?',
      transcript: 'A test that checks one small unit of code.',
    }],
  };
  const rows = new Map();
  const lean = (data) => ({ lean: async () => structuredClone(data) });
  t.mock.method(User, 'find', () => ({ select: () => ({ sort: () => lean([student, unrelated]) }) }));
  t.mock.method(User, 'findOne', ({ firebaseUid }) => ({ select: () => lean(firebaseUid === student.firebaseUid ? student : unrelated) }));
  t.mock.method(PreTestSession, 'find', (filter) => {
    assert.deepEqual(filter, { firebaseUid: { $in: [student.firebaseUid] }, completedAt: { $type: 'date' } });
    return { select: () => lean([fixture]) };
  });
  t.mock.method(PreTestSession, 'findOne', (filter) => {
    assert.deepEqual(filter.completedAt, { $type: 'date' });
    return { select: () => lean(fixture._id === filter._id && fixture.completedAt ? fixture : null) };
  });
  t.mock.method(ScoringStudyResult, 'find', (filter) => lean(filter._id.$in.map((id) => rows.get(id)).filter(Boolean)));
  t.mock.method(ScoringStudyResult, 'findById', (id) => lean(rows.get(id)));
  t.mock.method(ScoringStudyResult, 'findOneAndUpdate', (filter, update, options) => {
    const id = filter._id;
    if (options.upsert && !rows.has(id)) {
      rows.set(id, { _id: id, ...update.$setOnInsert, trials: [], rating: null });
    }
    const result = rows.get(id);
    if (update.$push?.trials) {
      const slot = Object.keys(filter).find((key) => key.startsWith('trials.'));
      if (result.trials[Number(slot.split('.')[1])]) return lean(null);
      result.trials.push(update.$push.trials);
    }
    if (update.$set) {
      if (update.$push?.ratingHistory) {
        const slot = Object.keys(filter).find((key) => key.startsWith('ratingHistory.'));
        if (!result.rating || result.ratingHistory?.[Number(slot.split('.')[1])]) return lean(null);
        (result.ratingHistory ??= []).push(update.$push.ratingHistory);
      } else if (result.rating) return lean(null);
      Object.assign(result, update.$set);
    }
    return lean(result);
  });
  const scores = { clarity_score: 5, correctness_score: 4, completeness_score: 4 };
  const calls = [];
  const evaluator = require('../services/aiEvaluator');
  t.mock.method(evaluator, 'evaluate3CScores', async (...args) => {
    calls.push(args);
    if (calls.length === 2) throw new Error('Simulated scorer outage');
    return scores;
  });

  const { requireAdmin } = createSchoolAuth(async (token) => ({
    uid: token === 'admin' ? 'study-admin' : student.firebaseUid, firebase: { sign_in_provider: 'password' },
  }));
  const app = express();
  app.use(express.json());
  app.use('/admin', requireAdmin, adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/admin/scoring-study`;
  const request = (path, body, token = 'admin', method = body ? 'POST' : 'GET') => fetch(url + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const path = `/${fixture._id}/0`;
  assert.equal((await request(path, null, 'student')).status, 403);
  assert.equal((await request(path + '?showTrials=1', null, 'student')).status, 403);
  assert.equal((await request(path + '/trial', { trial: 1 }, 'student')).status, 403);
  const listing = await request('');
  assert.equal(listing.headers.get('cache-control'), 'no-store');
  const { responses, trialCount } = await listing.json();
  assert.equal(trialCount, 3);
  assert.equal(responses.length, 1);
  const [{ id, participantKey, participantId, transcript, trialsSaved }] = responses;
  assert.equal(participantId, '0042');
  assert.equal(transcript, undefined);
  assert.equal(trialsSaved, 0);
  assert.equal((await request(path + '/trial', { id: 'changed', trial: 1 })).status, 409);
  assert.equal((await request(path + '/trial', { id, trial: 4 })).status, 400);
  assert.equal((await request(path + '/trial', { id, trial: 2 })).status, 409);
  assert.equal(calls.length, 0);

  const originalModel = process.env.DEEPSEEK_MODEL;
  const first = await (await request(path + '/trial', { id, trial: 1 })).json();
  assert.equal(first.response.trialsSaved, 1);
  assert.deepEqual(first.response.trials, []);
  const revealed = await (await request(path + '?showTrials=1')).json();
  assert.equal(revealed.response.trials[0].clarity_score, scores.clarity_score);
  assert.equal(revealed.response.rating, null);
  assert.equal((await request(path + '/trial', { id, trial: 1 })).status, 200);
  assert.equal(calls.length, 1);
  process.env.DEEPSEEK_MODEL = 'different-model';
  assert.equal((await request(path + '/trial', { id, trial: 2 })).status, 409);
  if (originalModel === undefined) delete process.env.DEEPSEEK_MODEL;
  else process.env.DEEPSEEK_MODEL = originalModel;
  assert.equal((await request(path + '/trial', { id, trial: 2 })).status, 502);
  const afterFailure = await (await request(path)).json();
  assert.equal(afterFailure.response.trialsSaved, 1);
  assert.deepEqual(afterFailure.response.trials, []);
  assert.equal(afterFailure.response.transcript, fixture.answers[0].transcript);
  const second = await (await request(path + '/trial?showTrials=1', { id, trial: 2 })).json();
  assert.equal(second.response.trials.length, 2);
  const competing = await Promise.all([
    request(path + '/trial', { id, trial: 3 }), request(path + '/trial', { id, trial: 3 }),
  ]);
  assert.ok(competing.every((response) => response.ok));
  assert.equal(rows.get(id).trials.length, 3);
  for (const [question, answer, difficulty] of calls) {
    assert.deepEqual([question, answer, difficulty], [fixture.answers[0].question, fixture.answers[0].transcript, 'easy']);
  }

  assert.equal((await request(path + '/rating', { id, scores: { ...scores, correctness_score: '4' } })).status, 400);
  const rated = await (await request(path + '/rating', { id, scores })).json();
  assert.equal(rated.response.rating.raterCode, undefined);
  await new ScoringStudyResult(rows.get(id)).validate();
  assert.equal(rated.response.trials.length, 3);
  assert.equal(rated.response.ratingRevision, 0);
  assert.equal((await request(path + '/rating', { id, scores })).status, 409);

  const callsBeforeCorrection = calls.length;
  const correctedScores = { ...scores, clarity_score: 3 };
  const correction = { id, revision: 0, scores: correctedScores };
  const correct = (body, token) => request(path + '/rating', body, token, 'PATCH');
  assert.equal((await correct(correction, 'student')).status, 403);
  assert.equal((await correct({ ...correction, revision: '0' })).status, 400);
  assert.equal((await correct({ ...correction, scores: { ...scores, clarity_score: 6 } })).status, 400);
  const corrected = await (await correct(correction)).json();
  assert.equal(corrected.response.rating.clarity_score, 3);
  assert.equal(corrected.response.rating.correctness_score, scores.correctness_score);
  assert.equal(corrected.response.rating.completeness_score, scores.completeness_score);
  assert.equal(corrected.response.rating.raterCode, undefined);
  assert.deepEqual(corrected.response.trials, rated.response.trials);
  assert.equal(corrected.response.ratingRevision, 1);
  assert.equal(corrected.response.ratingHistory, undefined);
  const [history] = rows.get(id).ratingHistory;
  assert.equal(history.previousRating.clarity_score, scores.clarity_score);
  assert.equal(history.correctedBy, 'study-admin');
  assert.equal(history.correctedAt.toISOString(), corrected.response.rating.ratedAt);
  assert.equal((await correct(correction)).status, 409);
  const reloaded = await (await request(path)).json();
  assert.deepEqual(reloaded.response.rating, corrected.response.rating);
  assert.equal(calls.length, callsBeforeCorrection);

  const { csv } = await (await request('/export')).json();
  assert.match(csv, /"ai_3_clarity_score"/);
  assert.match(csv, /"hr_completeness_score"/);
  assert.ok(csv.includes(`"${participantKey}","0042","${id}"`));
  assert.match(csv, /"hr_rater_code"/);
  assert.ok(csv.includes('"","3","4","4"'));
  for (const value of [fixture.answers[0].question, fixture.answers[0].transcript, student.email, student.firebaseUid]) {
    assert.ok(!csv.includes(value));
  }

  rows.get(id).rating.raterCode = 'HR01';
  const concurrent = await Promise.all([
    correct({ ...correction, revision: 1, scores: { ...scores, clarity_score: 2 } }),
    correct({ ...correction, revision: 1, scores: { ...scores, clarity_score: 4 } }),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
  assert.equal(rows.get(id).ratingHistory.length, 2);
  assert.equal(rows.get(id).rating.raterCode, 'HR01');
  assert.match((await (await request('/export')).json()).csv, /"HR01","[24]","4","4"/);

  const reset = (revision, token) => request(path + '/rating/reset', { id, revision }, token);
  assert.equal((await reset(2, 'student')).status, 403);
  assert.equal((await request(path + '/rating/reset', { id, criterion: 'clarity_score', revision: 2 })).status, 400);
  assert.equal((await reset(1)).status, 409);
  const originalRating = structuredClone(rows.get(id).rating);
  const reopened = await (await reset(2)).json();
  assert.equal(reopened.response.rated, false);
  assert.equal(reopened.response.rating, null);
  assert.deepEqual(reopened.response.ratingDraft, {});
  assert.deepEqual(reopened.response.trials, []);
  assert.equal(reopened.response.ratingRevision, 3);
  assert.deepEqual(rows.get(id).ratingHistory[2].previousRating, originalRating);
  assert.equal(rows.get(id).ratingHistory[2].reset, true);
  assert.equal((await (await request('')).json()).responses[0].rated, false);
  assert.match((await (await request('/export')).json()).csv.trimEnd().split('\r\n').at(-1), /(?:,""){5}$/);
  assert.equal((await correct({ ...correction, revision: 2 })).status, 409);

  assert.deepEqual((await (await request(path)).json()).response.ratingDraft, {});
  assert.equal((await (await reset(3)).json()).response.ratingRevision, 3);
  assert.equal((await correct({ id, revision: 3, scores: { correctness_score: 4 } })).status, 400);
  await new ScoringStudyResult(rows.get(id)).validate();

  const { clarity_score, correctness_score, completeness_score } = originalRating;
  const restored = await (await correct({ id, revision: 3, scores: { clarity_score, correctness_score, completeness_score } })).json();
  assert.equal(restored.response.rated, true);
  assert.equal(restored.response.rating.raterCode, 'HR01');
  assert.equal(restored.response.ratingDraft, null);
  assert.deepEqual(restored.response.trials, rated.response.trials);
  assert.equal(restored.response.ratingRevision, 4);
  assert.deepEqual(rows.get(id).resetCriteria, []);
  assert.match((await (await request('/export')).json()).csv, /"HR01","[24]","4","4"/);
});

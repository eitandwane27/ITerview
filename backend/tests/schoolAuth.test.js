const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('node:http');
const { createSchoolAuth, bindUserIdentity, isSchoolEmail } = require('../middleware/schoolAuth');
const userRoutes = require('../routes/userRoutes');
const adminRoutes = require('../routes/adminRoutes');
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const PostTestSession = require('../models/PostTestSession');

test('Firebase Admin rejects malformed and unsigned tokens without a service account key', async t => {
  const previousProject = process.env.FIREBASE_PROJECT_ID;
  const previousEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_PROJECT_ID = 'mock-school-project';
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  t.after(() => {
    if (previousProject === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previousProject;
    if (previousEmulator !== undefined) process.env.FIREBASE_AUTH_EMULATOR_HOST = previousEmulator;
  });
  const productionAuth = require('../middleware/schoolAuth');
  await assert.rejects(productionAuth.authenticate('forged'), error => error.status === 401);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'none' })}.${encode({ sub: 'attacker', email: 'student@spcba.edu.ph', email_verified: true })}.`;
  await assert.rejects(productionAuth.authenticate(unsigned), error => error.status === 401);
});

const verifiedUser = {
  uid: 'school-user', email: 'student@spcba.edu.ph', email_verified: true,
  firebase: { sign_in_provider: 'password' }, exp: Math.floor(Date.now() / 1000) + 3600,
};
const identities = {
  valid: verifiedUser,
  personal: { ...verifiedUser, email: 'student@gmail.com' },
  unverified: { ...verifiedUser, email_verified: false },
  missingVerification: { ...verifiedUser, email_verified: undefined },
  fakeDomain: { ...verifiedUser, email: 'student@spcba.edu.ph.attacker.com' },
  oauth: { ...verifiedUser, firebase: { sign_in_provider: 'google.com' } },
};
const auth = createSchoolAuth(async (token) => {
  if (!identities[token]) throw new Error('Invalid signature, issuer or expired token');
  return identities[token];
});

test('school email validation requires the exact domain on both client and server', async () => {
  const frontend = await import('../../frontend/src/utils/schoolAccess.js');
  for (const [email, expected] of [
    ['student@spcba.edu.ph', true], [' Student@SPCBA.EDU.PH ', true],
    ['student@gmail.com', false], ['student@spcba.edu.ph.attacker.com', false],
    ['student@fake-spcba.edu.ph', false], ['student@department.spcba.edu.ph', false],
    ['student@@spcba.edu.ph', false], ['@spcba.edu.ph', false], [null, false],
  ]) {
    assert.equal(isSchoolEmail(email), expected, String(email));
    assert.equal(frontend.isSchoolEmail(email), expected, String(email));
  }
});

test('missing/invalid tokens, personal addresses, unverified accounts and OAuth cannot authorize access', async () => {
  for (const [token, status] of [[null, 401], ['forged', 401], ['personal', 403], ['unverified', 403], ['missingVerification', 403], ['fakeDomain', 403], ['oauth', 403]]) {
    await assert.rejects(auth.authenticate(token), error => error.status === status);
  }
  assert.equal((await auth.authenticate('valid')).uid, verifiedUser.uid);
});

test('admin access requires the configured UID and password sign-in', async t => {
  const previousUid = process.env.ADMIN_FIREBASE_UID;
  t.after(() => {
    if (previousUid === undefined) delete process.env.ADMIN_FIREBASE_UID;
    else process.env.ADMIN_FIREBASE_UID = previousUid;
  });
  const admin = {
    uid: 'admin-uid', email: 'admin@iterview.invalid', email_verified: false,
    firebase: { sign_in_provider: 'password' },
  };
  const tokens = {
    admin, student: verifiedUser,
    wrongUid: { ...admin, uid: 'other-uid' },
    oauth: { ...admin, firebase: { sign_in_provider: 'google.com' } },
  };
  const { requireAdmin, authenticate } = createSchoolAuth(async token => {
    if (!Object.hasOwn(tokens, token)) throw new Error('Invalid token');
    return tokens[token];
  });
  async function check(token) {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = { status(code) { this.code = code; return this; }, json() {} };
    await requireAdmin(req, res, () => { res.code = 204; });
    return res.code;
  }
  delete process.env.ADMIN_FIREBASE_UID;
  assert.equal(await check('admin'), 403);
  process.env.ADMIN_FIREBASE_UID = admin.uid;
  for (const [token, status] of [[null, 401], ['invalid', 401], ['student', 403], ['wrongUid', 403], ['oauth', 403], ['admin', 204]]) {
    assert.equal(await check(token), status);
  }
  await assert.rejects(authenticate('admin'), error => error.status === 403);
});

test('only the admin can list or change a separate official name', async t => {
  const previousUid = process.env.ADMIN_FIREBASE_UID;
  process.env.ADMIN_FIREBASE_UID = 'admin-uid';
  t.after(() => {
    if (previousUid === undefined) delete process.env.ADMIN_FIREBASE_UID;
    else process.env.ADMIN_FIREBASE_UID = previousUid;
  });
  const admin = { ...identities.personal, uid: 'admin-uid' };
  const { requireAdmin, requireSchoolUser } = createSchoolAuth(async token =>
    token === 'admin' ? admin : verifiedUser
  );
  const student = {
    firebaseUid: verifiedUser.uid, displayName: 'Mika S.', email: verifiedUser.email, unlockedDifficulty: 'hard',
  };
  const fields = 'firebaseUid displayName email officialName unlockedDifficulty -_id';
  const updates = [];
  t.mock.method(User, 'find', () => ({
    select(projection) {
      assert.equal(projection, fields);
      return { sort: () => ({ lean: async () => [student] }) };
    },
  }));
  t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => ({
    select(projection) {
      assert.equal(projection, fields);
      assert.equal(options.upsert, undefined);
      updates.push(update);
      return { lean: async () => filter.firebaseUid === student.firebaseUid
        ? { ...student, officialName: update.$set?.officialName }
        : null };
    },
  }));
  const app = express();
  app.use(express.json());
  app.use('/admin', requireAdmin, adminRoutes);
  app.use('/users', requireSchoolUser, userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const list = token => fetch(base + '/admin/students', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const save = (officialName, token = 'admin', uid = student.firebaseUid) =>
    fetch(base + `/admin/students/${uid}/official-name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ officialName, displayName: 'Not editable here' }),
    });

  assert.equal((await list()).status, 401);
  assert.equal((await list('student')).status, 403);
  assert.equal((await save('Mika Santos', 'student')).status, 403);
  assert.equal((await save({ $ne: '' })).status, 400);
  assert.equal((await save('A'.repeat(161))).status, 400);
  assert.deepEqual(updates, []);
  const response = await list('admin');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { students: [student] });
  assert.deepEqual((await (await save('  Mika Santos  ')).json()).student, {
    ...student, officialName: 'Mika Santos',
  });
  assert.deepEqual((await (await save('')).json()).student, student);
  assert.deepEqual(updates, [{ $set: { officialName: 'Mika Santos' } }, { $unset: { officialName: '' } }]);
  assert.equal((await save('Mika Santos', 'admin', 'unknown')).status, 404);

  const studentQuery = User.findOne({ firebaseUid: student.firebaseUid });
  studentQuery._applyPaths();
  assert.equal(studentQuery.projection().officialName, 0);
});

test('the HR Tester generation endpoint uses admin credentials in production', async t => {
  const env = {
    ADMIN_FIREBASE_UID: 'hr-admin',
    DEEPSEEK_API_KEY: 'unused-test-key',
    NODE_ENV: 'production',
  };
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
  const sample = 'Explain the purpose of a unit test.';
  const generator = t.mock.method(require('../services/aiSet1Generator'), 'generateSet1Question', async () => sample);
  t.mock.method(console, 'log', () => {});
  const { requireAdmin } = createSchoolAuth(async token =>
    token === 'admin' ? { ...identities.personal, uid: env.ADMIN_FIREBASE_UID } : verifiedUser);
  const app = express();
  app.use('/api/admin', requireAdmin, adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/admin/hr-tester/generate-question?runs=1`;
  const generate = token => fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  assert.equal((await generate()).status, 401);
  assert.equal((await generate('student')).status, 403);
  assert.equal(generator.mock.callCount(), 0);
  const response = await generate('admin');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).results[0].question, sample);
  assert.equal(generator.mock.callCount(), 1);
});

test('research data uses school email digits for IDs and pairs first-run scores by UID', async t => {
  const previousUid = process.env.ADMIN_FIREBASE_UID;
  process.env.ADMIN_FIREBASE_UID = 'admin-uid';
  t.after(() => {
    if (previousUid === undefined) delete process.env.ADMIN_FIREBASE_UID;
    else process.env.ADMIN_FIREBASE_UID = previousUid;
  });
  const { requireAdmin } = createSchoolAuth(async token => token === 'admin'
    ? { ...verifiedUser, uid: 'admin-uid' } : verifiedUser);
  const student = { firebaseUid: 'student-uid', email: 'student2026-0042@spcba.edu.ph', confidenceScore: 15 };
  const newerStudent = { firebaseUid: 'newer-uid', email: 'a.newer42@spcba.edu.ph',
    confidenceScore: 20, confidenceScaleMax: 4, postConfidenceScore: 21, postConfidenceScaleMax: 4 };
  let users = [{ firebaseUid: 'admin-uid', email: 'admin@spcba.edu.ph' },
    student, { firebaseUid: 'personal-uid', email: 'person@example.com' }, newerStudent];
  t.mock.method(User, 'find', () => ({ select: () => ({ sort: (order) => {
    assert.deepEqual(order, { createdAt: 1, _id: 1 });
    return { lean: async () => users };
  } }) }));
  const answer = { clarity_score: 3, correctness_score: 4, completeness_score: 5 };
  const queryUids = [];
  t.mock.method(PreTestSession, 'find', (filter) => {
    queryUids.push(filter.firebaseUid.$in);
    return { select: () => ({ lean: async () => [{ firebaseUid: student.firebaseUid, baseline_score_percentage: 0, answers: [answer] }] }) };
  });
  t.mock.method(PostTestSession, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const app = express();
  app.use('/admin', requireAdmin, adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const load = (token) => fetch(`http://127.0.0.1:${server.address().port}/admin/research-data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await load('student')).status, 403);
  const response = await load('admin');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { participants } = await response.json();
  assert.deepEqual(participants.map(({ participantId, email }) => [participantId, email]), [
    ['0042', student.email],
    [null, newerStudent.email],
  ]);
  const [row] = participants;
  assert.equal(row.firebaseUid, undefined);
  assert.deepEqual(row.preTest, { percentage: 0, clarity: 3, correctness: 4, completeness: 5 });
  assert.deepEqual(row.postTest, { percentage: null, clarity: null, correctness: null, completeness: null });
  assert.equal(row.preLikert, 15);
  assert.equal(row.preLikertScaleMax, 5);
  assert.equal(row.postLikert, null);
  assert.equal(row.postLikertScaleMax, null);
  assert.equal(participants[1].preLikert, 20);
  assert.equal(participants[1].preLikertScaleMax, 4);
  assert.equal(participants[1].postLikert, null);
  assert.equal(participants[1].postLikertScaleMax, null);
  users = [student];
  assert.deepEqual(await (await load('admin')).json(), { participants: [row] });
  assert.deepEqual(queryUids, [[student.firebaseUid, newerStudent.firebaseUid], [student.firebaseUid]]);
});

test('real user routes derive identity from a verified token and prevent other-user reads/writes', async t => {
  const writes = [];
  const log = t.mock.method(console, 'log', () => {});
  const logError = t.mock.method(console, 'error', () => {});
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    if (update.displayName === 'Simulate duplicate') {
      throw new Error(`Duplicate email: ${update.email}`);
    }
    writes.push({ filter, update });
    return update;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/users', auth.requireSchoolUser, userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/users`;
  const request = (path, token, options = {}) => fetch(base + path, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  for (const [token, expected] of [[null, 401], ['forged', 401], ['personal', 403], ['unverified', 403]]) {
    assert.equal((await request('/register', token, { method: 'POST', body: '{}' })).status, expected);
  }
  assert.equal(writes.length, 0);
  const response = await request('/register', 'valid', { method: 'POST', body: JSON.stringify({ email: 'fake@gmail.com', displayName: 'Student' }) });
  assert.equal(response.status, 201);
  assert.deepEqual(writes[0].filter, { firebaseUid: verifiedUser.uid });
  assert.equal(writes[0].update.email, verifiedUser.email);
  const login = await request('/login', 'valid', { method: 'POST', body: '{}' });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.email, verifiedUser.email);
  for (const path of ['/register', '/login']) {
    const duplicate = await request(path, 'valid', { method: 'POST', body: '{"displayName":"Simulate duplicate"}' });
    assert.equal(duplicate.status, 500);
  }
  const logCalls = [...log.mock.calls, ...logError.mock.calls].flatMap(call => call.arguments);
  assert.equal(require('node:util').inspect(logCalls).includes(verifiedUser.email), false);
  for (const path of ['/another-user', '/results-summary?uid=another-user', '/active-practice-session?uid=another-user']) {
    assert.equal((await request(path, 'valid')).status, 403);
  }
  assert.equal((await request('/role', 'valid', { method: 'PUT', body: JSON.stringify({ firebaseUid: 'another-user', role: 'frontend' }) })).status, 403);
  for (const path of ['/pretest', '/posttest']) {
    assert.equal((await request(path, 'valid', { method: 'POST', body: '{}' })).status, 404);
  }
  assert.equal(writes.length, 2);
});

test('bindUserIdentity rejects untrusted calls and fills server-owned identity for legacy route contracts', () => {
  const req = { auth: verifiedUser, body: { answers: [] }, query: { mode: 'practice' } };
  let called = false;
  bindUserIdentity(req, {}, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.query.uid, verifiedUser.uid);
  assert.equal(req.body.firebaseUid, verifiedUser.uid);
  assert.equal(req.body.email, verifiedUser.email);
});

test('WebSocket authentication ignores URL credentials and rejects another user UID', async () => {
  const request = (token, uid = verifiedUser.uid) => ({ url: `/ws/set1?uid=${uid}`, headers: { 'sec-websocket-protocol': token ? `iterview, auth.${token}` : 'iterview' } });
  for (const token of [null, 'forged', 'personal', 'unverified']) {
    await assert.rejects(auth.authenticateSocket(request(token)));
  }
  await assert.rejects(auth.authenticateSocket(request('valid', 'another-user')), error => error.status === 403);
  const validRequest = request('valid');
  await auth.authenticateSocket(validRequest);
  assert.equal(validRequest.auth.uid, verifiedUser.uid);
  await assert.rejects(auth.authenticateSocket({ url: '/ws/set1?token=valid', headers: {} }));
});

test('real WebSocket handshake accepts verified school users without echoing their token', async t => {
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true, handleProtocols: protocols => protocols.has('iterview') ? 'iterview' : false });
  t.after(() => { wss.clients.forEach(socket => socket.terminate()); wss.close(); server.close(); });
  server.on('upgrade', async (req, socket, head) => {
    try {
      await auth.authenticateSocket(req);
      wss.handleUpgrade(req, socket, head, ws => ws.send(req.auth.uid));
    } catch (error) { socket.end(`HTTP/1.1 ${error.status} Forbidden\r\nConnection: close\r\n\r\n`); }
  });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/ws/interview`;
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url, ['iterview', 'auth.valid']);
    ws.on('error', reject);
    ws.on('message', data => { assert.equal(String(data), verifiedUser.uid); assert.equal(ws.protocol, 'iterview'); ws.close(); resolve(); });
  });
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url, ['iterview', 'auth.unverified']);
    ws.on('open', () => reject(new Error('Unverified connection accepted')));
    ws.on('error', error => { assert.match(error.message, /403/); resolve(); });
  });
});

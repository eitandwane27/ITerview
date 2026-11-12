const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('node:http');
const { createSchoolAuth, bindUserIdentity, isSchoolEmail } = require('../middleware/schoolAuth');
const userRoutes = require('../routes/userRoutes');
const User = require('../models/User');

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

const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const router = require('../routes/deepgramRoutes');
const { createSchoolAuth } = require('../middleware/schoolAuth');
const nativeFetch = global.fetch;
const serverKey = 'synthetic-server-secret';

function configureKey(t, value = serverKey) {
  const previous = process.env.DEEPGRAM_API_KEY;
  if (value === null) delete process.env.DEEPGRAM_API_KEY;
  else process.env.DEEPGRAM_API_KEY = value;
  t.after(() => {
    if (previous === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = previous;
  });
}

async function requestToken() {
  let status = 200, body;
  const headers = {};
  await router.stack.find(layer => layer.route?.path === '/token').route.stack[0].handle({}, {
    set(name, value) { headers[name] = value; return this; },
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  });
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(body).includes(serverKey));
  return { status, body };
}

test('the browser receives only a 30-second grant and never the server key', async t => {
  configureKey(t);
  const upstream = t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.deepgram.com/v1/auth/grant');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Token ${serverKey}`);
    assert.deepEqual(JSON.parse(options.body), { ttl_seconds: 30 });
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ access_token: 'synthetic-temporary-token', expires_in: 30,
      ignored_provider_field: serverKey }) };
  });
  assert.deepEqual(await requestToken(), { status: 200, body: { token: 'synthetic-temporary-token', expiresIn: 30 } });
  assert.equal(upstream.mock.callCount(), 1);
});

test('missing server configuration fails without requesting a grant', async t => {
  configureKey(t, null);
  const upstream = t.mock.method(global, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  assert.equal((await requestToken()).status, 503);
  assert.equal(upstream.mock.callCount(), 0);
});

for (const [name, response] of [
  ['provider rejection', { ok: false }],
  ['missing access token', { expires_in: 30 }],
  ['null grant', null],
  ['empty token', { access_token: '', expires_in: 30 }],
  ['wrong token type', { access_token: {}, expires_in: 30 }],
  ['server key echoed as token', { access_token: serverKey, expires_in: 30 }],
  ['missing expiry', { access_token: 'temporary' }],
  ['overlong expiry', { access_token: 'temporary', expires_in: 3600 }],
  ['expired grant', { access_token: 'temporary', expires_in: 0 }],
]) {
  test(`${name} fails closed without exposing provider details`, async t => {
    configureKey(t);
    t.mock.method(global, 'fetch', async () => ({ ok: response?.ok !== false, json: async () => response }));
    const result = await requestToken();
    assert.equal(result.status, 502);
    assert.deepEqual(Object.keys(result.body), ['error']);
  });
}

test('request/timeout failures return a recoverable generic error', async t => {
  configureKey(t);
  t.mock.method(global, 'fetch', async () => { throw new Error(`Synthetic timeout with ${serverKey}`); });
  assert.equal((await requestToken()).status, 502);
});

for (const status of [401, 403]) {
  test(`provider HTTP ${status} identifies a configuration error without exposing credentials`, async t => {
    configureKey(t);
    const logs = t.mock.method(console, 'error', () => {});
    t.mock.method(global, 'fetch', async () => ({
      ok: false, status,
      json: async () => { throw new Error('Provider bodies must not be read'); },
    }));
    assert.deepEqual(await requestToken(), {
      status: 502,
      body: { error: 'Speech service is not configured correctly. Please contact support.' },
    });
    assert.equal(logs.mock.callCount(), 1);
    assert.match(logs.mock.calls[0].arguments[0], /Member permissions or higher/);
    assert.ok(!JSON.stringify(logs.mock.calls).includes(serverKey));
  });
}

test('school authentication blocks unauthorized callers before minting tokens', async t => {
  configureKey(t);
  const auth = createSchoolAuth(async token => ({ uid: 'test', email: 'student@spcba.edu.ph',
    email_verified: token === 'verified', firebase: { sign_in_provider: 'password' } }));
  const app = express();
  app.use('/api/deepgram', auth.requireSchoolUser, router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const upstream = t.mock.method(global, 'fetch', async () => ({ ok: true,
    json: async () => ({ access_token: 'temporary', expires_in: 30 }) }));
  const url = `http://127.0.0.1:${server.address().port}/api/deepgram/token`;
  for (const [token, expected] of [[null, 401], ['unverified', 403]]) {
    const response = await nativeFetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    assert.equal(response.status, expected);
  }
  assert.equal(upstream.mock.callCount(), 0);
  const response = await nativeFetch(url, { headers: { Authorization: 'Bearer verified' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(upstream.mock.callCount(), 1);
});

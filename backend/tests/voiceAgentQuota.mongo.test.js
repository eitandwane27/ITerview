const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const VoiceAgentUsage = require('../models/VoiceAgentUsage');
const { readVoiceAgentQuota, reserveVoiceAgentQuota } = require('../services/voiceAgentQuotaService');

test('MongoDB grants each account its starting allowance and serializes reservations across connections', {
  skip: !process.env.VOICE_AGENT_QUOTA_TEST_MONGO_URI,
}, async t => {
  const collection = `voice_agent_quota_test_${randomUUID().replaceAll('-', '')}`;
  const first = mongoose.createConnection(process.env.VOICE_AGENT_QUOTA_TEST_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const second = mongoose.createConnection(process.env.VOICE_AGENT_QUOTA_TEST_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    await Promise.all([
      first.readyState === 1 ? first.dropCollection(collection).finally(() => first.close()) : first.close(),
      second.close(),
    ]);
  });
  await Promise.all([first.asPromise(), second.asPromise()]);
  const models = [first, second].map(connection => connection.model('VoiceQuotaTest', VoiceAgentUsage.schema, collection));
  const take = (instance, uid = 'account-a') => reserveVoiceAgentQuota(uid, models[instance]);
  const read = () => readVoiceAgentQuota('account-a', models[1]);
  const { remainingMs: startingMs } = await read();
  assert.equal(startingMs, 900_000);
  const usedMs = Math.floor(startingMs / 2);
  const initial = await Promise.all(Array.from({ length: 12 }, (_, i) => take(i % 2)));
  const grants = initial.filter(result => result.release);
  assert.equal(grants.length, 1);
  assert.equal(initial.filter(result => result.reason === 'active').length, 11);
  const [grant] = grants;
  assert.equal(grant.remainingMs, startingMs);
  assert.deepEqual(await read(), { remainingMs: null });
  assert.equal((await take(1, 'account-b')).remainingMs, startingMs);
  await grant.release(usedMs);
  assert.deepEqual(await read(), { remainingMs: startingMs - usedMs });

  const resumed = await take(1);
  assert.equal(resumed.remainingMs, startingMs - usedMs);
  await grant.release(0); // A stale close cannot refund a later reservation.
  assert.deepEqual(await take(0), { reason: 'active' });
  await resumed.release(resumed.remainingMs);
  assert.deepEqual(await read(), { remainingMs: 0 });
  assert.deepEqual(await take(0), { reason: 'exhausted' });
});

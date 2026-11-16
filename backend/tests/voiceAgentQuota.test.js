const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readVoiceAgentQuota, reserveVoiceAgentQuota } = require('../services/voiceAgentQuotaService');

test('new quota records get 15 minutes and saved balances can exceed that allowance', async t => {
  let usage = null;
  const model = {
    db: { readyState: 1 },
    findById: () => ({ maxTimeMS: () => ({ lean: async () => usage }) }),
    findOneAndUpdate: t.mock.fn(() => ({ lean: async () => usage })),
  };

  assert.deepEqual(await readVoiceAgentQuota('account', model), { remainingMs: 900_000 });
  assert.equal((await reserveVoiceAgentQuota('account', model)).remainingMs, 900_000);
  const update = model.findOneAndUpdate.mock.calls[0].arguments[1];
  assert.deepEqual(update[0].$set.reservation.$cond[0].$gt[0], { $ifNull: ['$remainingMs', 900_000] });

  usage = { remainingMs: 1_800_000 };
  assert.deepEqual(await readVoiceAgentQuota('account', model), { remainingMs: 1_800_000 });
  assert.equal((await reserveVoiceAgentQuota('account', model)).remainingMs, 1_800_000);
});

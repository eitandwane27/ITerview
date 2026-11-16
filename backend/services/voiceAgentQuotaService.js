const { randomUUID } = require('node:crypto');
const VoiceAgentUsage = require('../models/VoiceAgentUsage');

const DEFAULT_ALLOWANCE_MS = 15 * 60 * 1000;
const writeOptions = { maxTimeMS: 3000, writeConcern: { w: 'majority' } };

function isReservationActive(usage) {
  return usage?.reservation?.activeUntil > new Date();
}

async function readVoiceAgentQuota(uid, model = VoiceAgentUsage) {
  if (model.db.readyState !== 1) throw new Error('Voice quota storage unavailable');
  const usage = await model.findById(uid).maxTimeMS(3000).lean();
  return { remainingMs: isReservationActive(usage) ? null : usage?.remainingMs ?? DEFAULT_ALLOWANCE_MS };
}

async function reserveVoiceAgentQuota(uid, model = VoiceAgentUsage) {
  if (model.db.readyState !== 1) throw new Error('Voice quota storage unavailable');

  const id = randomUUID();
  const filter = { _id: uid };
  const balance = { $ifNull: ['$remainingMs', DEFAULT_ALLOWANCE_MS] };
  const canReserve = { $gt: [balance, 0] };
  const update = [{ $set: {
    remainingMs: 0,
    reservation: { $cond: [canReserve, {
      id,
      activeUntil: { $add: ['$$NOW', balance, 30_000] },
    }, '$reservation'] },
  } }];
  const options = { ...writeOptions, returnDocument: 'before', updatePipeline: true };
  let previous;
  try {
    previous = await model.findOneAndUpdate(filter, update, { ...options, upsert: true }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    previous = await model.findOneAndUpdate(filter, update, options).lean();
    if (!previous) throw new Error('Voice quota storage unavailable');
  }

  const remainingMs = previous?.remainingMs ?? DEFAULT_ALLOWANCE_MS;
  if (remainingMs <= 0) {
    return { reason: isReservationActive(previous) ? 'active' : 'exhausted' };
  }

  // shortcut: a crash or failed refund can cost the reservation, add usage checkpoints if lost time becomes a problem.
  // The deadline only changes the denial message. Only this session may refund the reservation.
  return {
    remainingMs,
    release(usedMs) {
      return model.updateOne({ ...filter, 'reservation.id': id }, {
        $set: { remainingMs: Math.max(0, remainingMs - usedMs) },
        $unset: { reservation: '' },
      }, writeOptions).exec();
    },
  };
}

module.exports = { readVoiceAgentQuota, reserveVoiceAgentQuota };

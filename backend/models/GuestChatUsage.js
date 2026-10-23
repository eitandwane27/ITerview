const mongoose = require("mongoose");

// One document per hashed guest IP or authenticated coach account. Both quotas
// change in one atomic update; coach and public guest allowances stay separate.
const guestChatUsageSchema = new mongoose.Schema({
  _id: { type: String },
  dailyStartedAt: { type: Date, required: true },
  dailyCount: { type: Number, required: true },
  windowStartedAt: { type: Date, required: true },
  windowCount: { type: Number, required: true },
  requestAllowed: { type: Boolean, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, bufferCommands: false });

guestChatUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("GuestChatUsage", guestChatUsageSchema);

const mongoose = require('mongoose');

const voiceAgentUsageSchema = new mongoose.Schema({
  _id: String,
  remainingMs: { type: Number, required: true },
  reservation: {
    id: String,
    activeUntil: Date,
  },
}, { versionKey: false, bufferCommands: false });

module.exports = mongoose.model('VoiceAgentUsage', voiceAgentUsageSchema);

const mongoose = require('mongoose');
const { VALID_ROLES } = require('../config/roleConfig');

// Snapshots survive replacement of the user's active main-set documents.
const schema = new mongoose.Schema({
  firebaseUid: { type: String, required: true },
  sourceKey: { type: String, required: true },
  set: { type: Number, enum: [1, 2, 3], required: true },
  questionIndex: { type: Number, min: 0, max: 4, required: true },
  text: { type: String, required: true },
  role: { type: String, enum: VALID_ROLES, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  tip: { type: String, default: '' },
  competency: { type: String, default: null },
  isSaved: { type: Boolean, default: true },
  savedAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ firebaseUid: 1, sourceKey: 1 }, { unique: true });
schema.index({ firebaseUid: 1, isSaved: 1, savedAt: -1 });

module.exports = mongoose.model('SavedQuestion', schema);

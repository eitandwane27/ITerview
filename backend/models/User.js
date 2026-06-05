const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // We use the ID provided by Firebase as our main link
  firebaseUid: {
    type: String,
    required: true,
    unique: true, 
  },
  email: {
    type: String,
    required: true,
  },
  // Here is where we will store the answers from your Likert Scale component
  preTestScores: {
    // You can adjust these categories based on your actual Likert questions
    confidence: { type: Number, default: null },
    communication: { type: Number, default: null },
    technical: { type: Number, default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// This creates the "users" collection inside your iterview_official database
module.exports = mongoose.model('User', userSchema);

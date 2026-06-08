const mongoose = require("mongoose");

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
  // Stores the pre-test Likert Scale baseline (H₀₂)
  // Shape mirrors the LikertScale.jsx payload:
  //   preConfidenceAnswers: [{ questionId: "q1", score: 3 }, ...]
  //   confidenceScore: sum of all 5 scores (max 25)
  preConfidenceAnswers: {
    type: [
      {
        questionId: { type: String },
        score: { type: Number },
      },
    ],
    default: [],
  },
  confidenceScore: { type: Number, default: null },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// This creates the "users" collection inside your iterview_official database
module.exports = mongoose.model("User", userSchema);

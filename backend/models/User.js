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

  role: {
    type: String,
    enum: ["frontend", "backend", "fullstack"],
    default: null,
  },

  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy",
  },

  unlockedDifficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy",
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

  // Stores the post-test Likert Scale scores (H₀₂ comparison)
  // Shape mirrors preConfidenceAnswers
  postConfidenceAnswers: {
    type: [
      {
        questionId: { type: String },
        score: { type: Number },
      },
    ],
    default: [],
  },
  postConfidenceScore: { type: Number, default: null },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// This creates the "users" collection inside your iterview_official database
module.exports = mongoose.model("User", userSchema);

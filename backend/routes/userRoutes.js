const express = require("express");
const router = express.Router();
const User = require("../models/User");

// POST /api/users/register
// Called right after Firebase creates a new account.
// Saves the user to MongoDB so we have a record there too.
router.post("/register", async (req, res) => {
  try {
    const { firebaseUid, email } = req.body;

    if (!firebaseUid || !email) {
      return res
        .status(400)
        .json({ message: "Firebase UID and Email are required" });
    }

    // upsert: true → create if not found, update if already there (safe for re-runs)
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { firebaseUid, email },
      { new: true, upsert: true },
    );

    console.log("✅ User synced to MongoDB:", user.email);
    res
      .status(201)
      .json({ message: "User registered and saved to MongoDB!", user });
  } catch (error) {
    console.error("❌ Error registering user:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// POST /api/users/login
// Called right after a successful Firebase sign-in.
// Ensures the user document exists in MongoDB (handles edge cases).
router.post("/login", async (req, res) => {
  try {
    const { firebaseUid, email } = req.body;

    if (!firebaseUid || !email) {
      return res
        .status(400)
        .json({ message: "Firebase UID and Email are required" });
    }

    // upsert: true → creates the doc if it somehow doesn't exist yet
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { firebaseUid, email },
      { new: true, upsert: true },
    );

    console.log("✅ User login synced to MongoDB:", user.email);
    res.status(200).json({ message: "Login synced to MongoDB!", user });
  } catch (error) {
    console.error("❌ Error syncing login:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// POST /api/users/pretest
// This endpoint receives data from your Likert Scale frontend
router.post("/pretest", async (req, res) => {
  try {
    const { firebaseUid, email, answers, confidenceScore } = req.body;

    if (!firebaseUid || !email) {
      return res
        .status(400)
        .json({ message: "Firebase UID and Email are required" });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $set: {
          email,
          preConfidenceAnswers: answers,
          confidenceScore,
        },
        $setOnInsert: { firebaseUid },
      },
      { new: true, upsert: true },
    );

    res
      .status(200)
      .json({ message: "Pre-test scores saved successfully!", user });
  } catch (error) {
    console.error("Error saving pre-test scores:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const User = require("../models/User");
const PreTestSession = require("../models/PreTestSession");
const PostTestSession = require("../models/PostTestSession");
const Set1Session = require("../models/Set1Session");
const Set2Session = require("../models/Set2Session");
const Set3Session = require("../models/Set3Session");


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
      { returnDocument: "after", upsert: true },
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
      { returnDocument: "after", upsert: true },
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
      { returnDocument: "after", upsert: true },
    );

    res
      .status(200)
      .json({ message: "Pre-test scores saved successfully!", user });
  } catch (error) {
    console.error("Error saving pre-test scores:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// GET /api/users/pretest-profile?uid=<firebaseUid>
// Returns the user's pre-test weakness tag, baseline score, and role
// for the Set 1 Briefing screen. Must be declared BEFORE /:firebaseUid
// to avoid the wildcard swallowing this route.
router.get("/pretest-profile", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    // Fetch both in parallel
    const [session, user] = await Promise.all([
      PreTestSession.findOne({ firebaseUid: uid }).select(
        "final_weakness_tag baseline_score_percentage"
      ),
      User.findOne({ firebaseUid: uid }).select("role"),
    ]);

    // Graceful fallback if pre-test was never completed
    return res.status(200).json({
      weaknessTag: session?.final_weakness_tag ?? null,
      baselineScore: session?.baseline_score_percentage ?? null,
      role: user?.role ?? null,
    });
  } catch (error) {
    console.error("❌ Error fetching pretest profile:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// GET /api/users/results-summary?uid=<firebaseUid>
// Returns a full pre-vs-post comparison payload for the Results page.
// Must be declared BEFORE /:firebaseUid to avoid the wildcard swallowing it.
router.get("/results-summary", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    // Fetch all database documents in parallel
    const [preSession, postSession, user, set1, set2, set3] = await Promise.all([
      PreTestSession.findOne({ firebaseUid: uid }).select(
        "baseline_score_percentage final_weakness_tag"
      ),
      PostTestSession.findOne({ firebaseUid: uid }).select(
        "final_score_percentage final_weakness_tag"
      ),
      User.findOne({ firebaseUid: uid }).select(
        "confidenceScore postConfidenceScore role difficulty unlockedDifficulty"
      ),
      Set1Session.findOne({ firebaseUid: uid }).select(
        "avg_clarity avg_correctness avg_completeness isCompleted"
      ),
      Set2Session.findOne({ firebaseUid: uid }).select(
        "avg_problem_solving avg_accuracy avg_depth isCompleted"
      ),
      Set3Session.findOne({ firebaseUid: uid }).select(
        "avg_situation avg_action avg_result isCompleted"
      ),
    ]);

    // Derived mastery score (Overall graduation post-test score)
    const postScore = postSession?.final_score_percentage ?? null;
    const preScore  = preSession?.baseline_score_percentage  ?? null;
    const preConf   = user?.confidenceScore                  ?? null;
    const postConf  = user?.postConfidenceScore              ?? null;

    // Formulate individual set averages (out of 10)
    const set1Score = set1 && set1.isCompleted && set1.avg_clarity !== null
      ? parseFloat(((set1.avg_clarity + set1.avg_correctness + set1.avg_completeness) / 3).toFixed(1))
      : null;

    const set2Score = set2 && set2.isCompleted && set2.avg_problem_solving !== null
      ? parseFloat(((set2.avg_problem_solving + set2.avg_accuracy + set2.avg_depth) / 3).toFixed(1))
      : null;

    const set3Score = set3 && set3.isCompleted && set3.avg_situation !== null
      ? parseFloat(((set3.avg_situation + set3.avg_action + set3.avg_result) / 3).toFixed(1))
      : null;

    // Determine target difficulty and unlock threshold logic
    const currentDiff = user?.difficulty ?? "easy";
    let nextDifficulty = "medium";
    if (currentDiff === "medium") nextDifficulty = "hard";
    if (currentDiff === "hard") nextDifficulty = "hard";

    // If score >= 70%, update unlockedDifficulty in User model if it's an upgrade
    const unlockThreshold = 70;
    const isUnlocked = postScore !== null && postScore >= unlockThreshold;

    if (isUnlocked && user) {
      let upgradedDiff = user.unlockedDifficulty;
      if (currentDiff === "easy" && user.unlockedDifficulty === "easy") {
        upgradedDiff = "medium";
      } else if (currentDiff === "medium" && (user.unlockedDifficulty === "easy" || user.unlockedDifficulty === "medium")) {
        upgradedDiff = "hard";
      }

      if (upgradedDiff !== user.unlockedDifficulty) {
        user.unlockedDifficulty = upgradedDiff;
        await user.save();
        console.log(`[DB] 🎓 Upgraded unlockedDifficulty to '${upgradedDiff}' for user: ${uid}`);
      }
    }

    return res.status(200).json({
      preConfidenceScore:  preConf,
      postConfidenceScore: postConf,
      masteryScore:        postScore,
      preTestScore:        preScore,
      improvementDelta:    preScore !== null && postScore !== null ? postScore - preScore : null,

      // Individual set scores details
      setScores: {
        set1: { label: "Set 1 · Personalized",   score: set1Score, outOf: 10, emoji: "🤖", completed: !!(set1?.isCompleted) },
        set2: { label: "Set 2 · Technical",       score: set2Score, outOf: 10, emoji: "💻", completed: !!(set2?.isCompleted) },
        set3: { label: "Set 3 · Behavioral STAR", score: set3Score, outOf: 10, emoji: "🎯", completed: !!(set3?.isCompleted) },
      },

      // STAR dimension averages from Set 3 (out of 10)
      starBreakdown: {
        situation: set3?.avg_situation ?? null,
        action:    set3?.avg_action    ?? null,
        result:    set3?.avg_result    ?? null,
      },

      targetDifficulty: currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1),
      nextDifficulty:   nextDifficulty.charAt(0).toUpperCase() + nextDifficulty.slice(1),
      unlocked:         isUnlocked,
      unlockThreshold,
      role:             user?.role ?? null,
    });
  } catch (error) {
    console.error("❌ Error fetching results summary:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// GET /api/users/:firebaseUid
// Retrieves user profile including their role.
router.get("/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// PUT /api/users/role
// Updates the user's target role and/or difficulty.
router.put("/role", async (req, res) => {
  try {
    const { firebaseUid, role, difficulty } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    const updateFields = {};

    if (role !== undefined) {
      if (!["frontend", "backend", "fullstack"].includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }
      updateFields.role = role;
    }

    if (difficulty !== undefined) {
      if (!["easy", "medium", "hard"].includes(difficulty)) {
        return res.status(400).json({ message: "Invalid difficulty specified" });
      }
      updateFields.difficulty = difficulty;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "Nothing to update. Provide role or difficulty." });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ User updated: role=${user.role}, difficulty=${user.difficulty} for:`, user.email);
    res.status(200).json({ message: "User profile updated successfully", user });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// POST /api/users/posttest
// Receives and saves post-test Likert confidence scores (H₀₂ post measurement)
router.post("/posttest", async (req, res) => {
  try {
    const { firebaseUid, email, answers, confidenceScore } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: "Firebase UID and Email are required" });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $set: {
          email,
          postConfidenceAnswers: answers,
          postConfidenceScore: confidenceScore,
        },
        $setOnInsert: { firebaseUid },
      },
      { returnDocument: "after", upsert: true }
    );

    res.status(200).json({ message: "Post-test scores saved successfully!", user });
  } catch (error) {
    console.error("Error saving post-test scores:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;


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
    const { uid, mode } = req.query;

    if (!uid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    // Fetch all database documents in parallel with answers array
    const [preSession, postSession, user, set1, set2, set3] = await Promise.all([
      PreTestSession.findOne({ firebaseUid: uid }).select(
        "baseline_score_percentage final_weakness_tag answers"
      ),
      PostTestSession.findOne({ firebaseUid: uid }).select(
        "final_score_percentage final_weakness_tag answers"
      ),
      User.findOne({ firebaseUid: uid }).select(
        "confidenceScore postConfidenceScore role difficulty unlockedDifficulty practiceHistory"
      ),
      Set1Session.findOne({ firebaseUid: uid }).select(
        "avg_clarity avg_correctness avg_completeness isCompleted answers"
      ),
      Set2Session.findOne({ firebaseUid: uid }).select(
        "avg_problem_solving avg_accuracy avg_depth isCompleted answers"
      ),
      Set3Session.findOne({ firebaseUid: uid }).select(
        "avg_situation avg_action avg_result isCompleted answers"
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

    // Calculate overall practice sets average (out of 10 and 100%)
    const completedPracticeScores = [set1Score, set2Score, set3Score].filter((s) => s !== null);
    const practiceSetsAvgScore = completedPracticeScores.length > 0
      ? parseFloat((completedPracticeScores.reduce((a, b) => a + b, 0) / completedPracticeScores.length).toFixed(1))
      : null;
    const practiceSetsAvgPercentage = practiceSetsAvgScore !== null
      ? parseFloat((practiceSetsAvgScore * 10).toFixed(1))
      : null;

    // Calculate grand average across the entire journey (Pre-Test, Practice Sets Avg, Post-Test)
    const journeyComponents = [];
    if (preScore !== null) journeyComponents.push(preScore);
    if (practiceSetsAvgPercentage !== null) journeyComponents.push(practiceSetsAvgPercentage);
    if (postScore !== null) journeyComponents.push(postScore);
    const overallJourneyAveragePercentage = journeyComponents.length > 0
      ? parseFloat((journeyComponents.reduce((a, b) => a + b, 0) / journeyComponents.length).toFixed(1))
      : null;

    // Helper for formatting question breakdowns
    const mapPrePostAnswers = (answers = []) =>
      answers.map((a) => {
        const avg = a.clarity_score && a.correctness_score && a.completeness_score
          ? parseFloat(((a.clarity_score + a.correctness_score + a.completeness_score) / 3).toFixed(1))
          : null;
        return {
          questionIndex: a.questionIndex,
          questionNumber: a.questionIndex + 1,
          question: a.question,
          transcript: a.transcript,
          metrics: {
            clarity: a.clarity_score ?? null,
            correctness: a.correctness_score ?? null,
            completeness: a.completeness_score ?? null,
          },
          questionAverage: avg,
          questionPercentage: avg !== null ? parseFloat((avg * 10).toFixed(1)) : null,
        };
      });

    // Determine target difficulty and unlock threshold logic
    const currentDiff = user?.difficulty ?? "easy";
    let nextDifficulty = "medium";
    if (currentDiff === "medium") nextDifficulty = "hard";
    if (currentDiff === "hard") nextDifficulty = "hard";

    // Unlocking requires BOTH Practice Sets Combined Average >= 70% AND Post-Test Graduation Score >= 70% (or in practice mode, Practice Average >= 70%)
    const unlockThreshold = 70;
    const isPracticeMode = mode === "practice";
    const isUnlocked = isPracticeMode
      ? (practiceSetsAvgPercentage !== null && practiceSetsAvgPercentage >= unlockThreshold)
      : (postScore !== null &&
         postScore >= unlockThreshold &&
         practiceSetsAvgPercentage !== null &&
         practiceSetsAvgPercentage >= unlockThreshold);

    if (isUnlocked && user) {
      let upgradedDiff = user.unlockedDifficulty;
      if (currentDiff === "easy" && (user.unlockedDifficulty === "easy" || !user.unlockedDifficulty)) {
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

    // Compute baseline 3C dimension breakdown from pre-test session or set1
    let preClarity = null, preCorrectness = null, preCompleteness = null;
    if (preSession?.answers && preSession.answers.length > 0) {
      const valid = preSession.answers.filter(
        (a) => a.clarity_score != null && a.correctness_score != null && a.completeness_score != null
      );
      if (valid.length > 0) {
        preClarity = parseFloat((valid.reduce((sum, a) => sum + a.clarity_score, 0) / valid.length).toFixed(1));
        preCorrectness = parseFloat((valid.reduce((sum, a) => sum + a.correctness_score, 0) / valid.length).toFixed(1));
        preCompleteness = parseFloat((valid.reduce((sum, a) => sum + a.completeness_score, 0) / valid.length).toFixed(1));
      }
    }

    if (preClarity === null && set1?.avg_clarity != null) {
      preClarity = set1.avg_clarity;
      preCorrectness = set1.avg_correctness;
      preCompleteness = set1.avg_completeness;
    }

    let threeCAvgOutOf10 = null;
    let threeCAvgPercentage = null;
    let lowestThreeCMetric = null;

    if (preClarity !== null && preCorrectness !== null && preCompleteness !== null) {
      threeCAvgOutOf10 = parseFloat(((preClarity + preCorrectness + preCompleteness) / 3).toFixed(1));
      threeCAvgPercentage = parseFloat((threeCAvgOutOf10 * 10).toFixed(1));

      const minVal = Math.min(preClarity, preCorrectness, preCompleteness);
      if (minVal === preClarity) lowestThreeCMetric = "clarity";
      else if (minVal === preCorrectness) lowestThreeCMetric = "correctness";
      else lowestThreeCMetric = "completeness";
    }

    return res.status(200).json({
      preConfidenceScore:  preConf,
      postConfidenceScore: postConf,
      masteryScore:        postScore,
      preTestScore:        preScore,
      improvementDelta:    preScore !== null && postScore !== null ? postScore - preScore : null,

      // 3C Baseline & Practice Breakdown
      threeCBreakdown: {
        clarity: preClarity,
        correctness: preCorrectness,
        completeness: preCompleteness,
        averageOutOf10: threeCAvgOutOf10,
        averagePercentage: threeCAvgPercentage,
        lowestMetric: lowestThreeCMetric,
      },

      // Overall Session Averages
      sessionAverages: {
        preTest: { scorePercentage: preScore, label: "Pre-Test Diagnostic" },
        set1: { scoreOutOf10: set1Score, scorePercentage: set1Score !== null ? parseFloat((set1Score * 10).toFixed(1)) : null, label: "Set 1 · Personalized" },
        set2: { scoreOutOf10: set2Score, scorePercentage: set2Score !== null ? parseFloat((set2Score * 10).toFixed(1)) : null, label: "Set 2 · Technical" },
        set3: { scoreOutOf10: set3Score, scorePercentage: set3Score !== null ? parseFloat((set3Score * 10).toFixed(1)) : null, label: "Set 3 · Behavioral STAR" },
        postTest: { scorePercentage: postScore, label: "Post-Test Graduation" },
        practiceSetsAverage: { scoreOutOf10: practiceSetsAvgScore, scorePercentage: practiceSetsAvgPercentage },
        overallJourneyAveragePercentage,
      },

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

      // Detailed Question-by-Question Breakdowns for Every Session
      questionBreakdowns: {
        preTest: {
          sessionLabel: "Pre-Test Diagnostic Interview",
          sessionAveragePercentage: preScore,
          questions: mapPrePostAnswers(preSession?.answers),
        },
        set1: {
          sessionLabel: "Practice Set 1 · Personalized (3C)",
          sessionAverageOutOf10: set1Score,
          sessionAveragePercentage: set1Score !== null ? parseFloat((set1Score * 10).toFixed(1)) : null,
          metricsAverage: {
            clarity: set1?.avg_clarity ?? null,
            correctness: set1?.avg_correctness ?? null,
            completeness: set1?.avg_completeness ?? null,
          },
          questions: (set1?.answers || []).map((a) => {
            const avg = a.clarity_score && a.correctness_score && a.completeness_score
              ? parseFloat(((a.clarity_score + a.correctness_score + a.completeness_score) / 3).toFixed(1))
              : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: { clarity: a.clarity_score, correctness: a.correctness_score, completeness: a.completeness_score },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat((avg * 10).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        set2: {
          sessionLabel: "Practice Set 2 · Technical Mastery",
          sessionAverageOutOf10: set2Score,
          sessionAveragePercentage: set2Score !== null ? parseFloat((set2Score * 10).toFixed(1)) : null,
          metricsAverage: {
            problemSolving: set2?.avg_problem_solving ?? null,
            accuracy: set2?.avg_accuracy ?? null,
            depth: set2?.avg_depth ?? null,
          },
          questions: (set2?.answers || []).map((a) => {
            const avg = a.problem_solving_score && a.accuracy_score && a.depth_score
              ? parseFloat(((a.problem_solving_score + a.accuracy_score + a.depth_score) / 3).toFixed(1))
              : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: { problemSolving: a.problem_solving_score, accuracy: a.accuracy_score, depth: a.depth_score },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat((avg * 10).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        set3: {
          sessionLabel: "Practice Set 3 · Behavioral STAR",
          sessionAverageOutOf10: set3Score,
          sessionAveragePercentage: set3Score !== null ? parseFloat((set3Score * 10).toFixed(1)) : null,
          metricsAverage: {
            situation: set3?.avg_situation ?? null,
            action: set3?.avg_action ?? null,
            result: set3?.avg_result ?? null,
          },
          questions: (set3?.answers || []).map((a) => {
            const avg = a.situation_score && a.action_score && a.result_score
              ? parseFloat(((a.situation_score + a.action_score + a.result_score) / 3).toFixed(1))
              : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: { situation: a.situation_score, action: a.action_score, result: a.result_score },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat((avg * 10).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        postTest: {
          sessionLabel: "Post-Test Graduation Challenge",
          sessionAveragePercentage: postScore,
          questions: mapPrePostAnswers(postSession?.answers),
        },
      },

      targetDifficulty: currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1),
      nextDifficulty:   nextDifficulty.charAt(0).toUpperCase() + nextDifficulty.slice(1),
      unlocked:         isUnlocked,
      unlockThreshold,
      role:             user?.role ?? null,
      preWeaknessTag:   preSession?.final_weakness_tag ?? null,
      postWeaknessTag:  postSession?.final_weakness_tag ?? null,
      practiceHistory:  user?.practiceHistory ?? [],
    });
  } catch (error) {
    console.error("❌ Error fetching results summary:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// GET /api/users/active-practice-session?uid=...
// Checks if the user has an in-progress practice session (Set 1, Set 2, or Set 3)
router.get("/active-practice-session", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ message: "UID is required" });
    }

    const [set1, set2, set3] = await Promise.all([
      Set1Session.findOne({ firebaseUid: uid }).select("isCompleted answers sessionId"),
      Set2Session.findOne({ firebaseUid: uid }).select("isCompleted answers sessionId"),
      Set3Session.findOne({ firebaseUid: uid }).select("isCompleted answers sessionId"),
    ]);

    let activeDoc = null;
    let activeSet = null;

    if (set3 && !set3.isCompleted) {
      activeDoc = set3;
      activeSet = 3;
    } else if (set2 && !set2.isCompleted) {
      activeDoc = set2;
      activeSet = 2;
    } else if (set1 && !set1.isCompleted) {
      activeDoc = set1;
      activeSet = 1;
    } else if (set1 && set1.isCompleted) {
      if (!set2 || !set2.isCompleted) {
        activeDoc = set2;
        activeSet = 2;
      } else if (!set3 || !set3.isCompleted) {
        activeDoc = set3;
        activeSet = 3;
      }
    }

    if (activeSet) {
      return res.status(200).json({
        hasActiveSession: true,
        activeSet,
        answersCount: activeDoc?.answers ? activeDoc.answers.length : 0,
        totalQuestions: 5,
        sessionId: activeDoc?.sessionId || null,
      });
    }

    return res.status(200).json({ hasActiveSession: false });
  } catch (error) {
    console.error("❌ Error fetching active practice session:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// PUT /api/users/role
// Updates user's target role, difficulty, and focus area in MongoDB.
router.put("/role", async (req, res) => {
  try {
    const { firebaseUid, role, difficulty, focusArea } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    const updateFields = {};
    if (role) updateFields.role = role;
    if (difficulty) updateFields.difficulty = difficulty;
    if (focusArea) updateFields.focusArea = focusArea;

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateFields },
      { returnDocument: "after", upsert: true }
    );

    console.log(`✅ Updated role/difficulty/focusArea for user ${firebaseUid}:`, updateFields);
    res.status(200).json({ message: "Role and focus area updated successfully!", user });
  } catch (error) {
    console.error("❌ Error updating role:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// GET /api/users/:firebaseUid
// Retrieves user profile including their role and diagnostic status.
router.get("/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const [user, preSession] = await Promise.all([
      User.findOne({ firebaseUid }),
      PreTestSession.findOne({ firebaseUid }).select("completedAt baseline_score_percentage"),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasCompletedDiagnostic = !!(
      preSession && (preSession.completedAt || preSession.baseline_score_percentage !== null)
    );

    res.status(200).json({ user, hasCompletedDiagnostic });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// POST /api/users/reset-practice-session
// Resets Set1, Set2, and Set3 sessions for the user to start a fresh practice run from Set 1, Q1
router.post("/reset-practice-session", async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ message: "firebaseUid is required" });
    }

    await Promise.all([
      Set1Session.deleteMany({ firebaseUid }),
      Set2Session.deleteMany({ firebaseUid }),
      Set3Session.deleteMany({ firebaseUid }),
    ]);

    console.log(`✅ Practice sessions reset for user: ${firebaseUid}`);
    res.status(200).json({ message: "Practice sessions reset successfully!" });
  } catch (error) {
    console.error("❌ Error resetting practice session:", error);
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

// POST /api/users/practice-history
// Appends a completed practice session entry to practiceHistory.
// Enforces a strict 5-session rolling cap using $push with $slice: -5.
router.post("/practice-history", async (req, res) => {
  try {
    const {
      firebaseUid,
      role,
      difficulty,
      focusArea,
      overallScorePercentage,
      threeCBreakdown,
      weaknessTag,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: "Firebase UID is required" });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingHistory = user.practiceHistory || [];
    const lastAttempt = existingHistory.length > 0 ? (existingHistory[existingHistory.length - 1].attemptNumber || existingHistory.length) : 0;
    const nextAttemptNumber = lastAttempt + 1;

    const newAttempt = {
      attemptNumber: nextAttemptNumber,
      completedAt: new Date(),
      role: role || user.role || "fullstack",
      difficulty: difficulty || user.difficulty || "easy",
      focusArea: focusArea || user.focusArea || "auto",
      overallScorePercentage: overallScorePercentage ?? null,
      threeCBreakdown: threeCBreakdown || null,
      weaknessTag: weaknessTag || null,
    };

    const updatedUser = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $push: {
          practiceHistory: {
            $each: [newAttempt],
            $slice: -5,
          },
        },
      },
      { returnDocument: "after" }
    );

    console.log(`✅ Saved practice attempt #${nextAttemptNumber} for user: ${firebaseUid}`);
    res.status(201).json({
      message: "Practice attempt saved successfully",
      practiceHistory: updatedUser.practiceHistory,
    });
  } catch (error) {
    console.error("❌ Error saving practice history:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;


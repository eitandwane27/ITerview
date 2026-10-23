const express = require('express');
const router = express.Router();
const { bindUserIdentity } = require('../middleware/schoolAuth');
router.use(bindUserIdentity);
router.param('firebaseUid', (req, res, next, uid) => {
  if (uid !== req.auth.uid) return res.status(403).json({ code: 'auth/forbidden', message: 'You can only access your own account.' });
  next();
});
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const PostTestSession = require('../models/PostTestSession');
const Set1Session = require('../models/Set1Session');
const Set2Session = require('../models/Set2Session');
const Set3Session = require('../models/Set3Session');
const { VALID_ROLES } = require('../config/roleConfig');
const { getResultsSummary, getActivePracticeSession } = require('../services/userProgressService');
const { calculatePracticeScores } = require('../utils/practiceScoring');

// POST /api/users/register
// Called right after Firebase creates a new account.
// Saves the user to MongoDB so we have a record there too.
router.post('/register', async (req, res) => {
  try {
    const { firebaseUid, email, displayName } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: 'Firebase UID and Email are required' });
    }

    // Build the update payload — only include displayName if provided
    const updatePayload = { firebaseUid, email };
    if (displayName !== undefined) updatePayload.displayName = displayName;

    // upsert: true → create if not found, update if already there (safe for re-runs)
    const user = await User.findOneAndUpdate({ firebaseUid }, updatePayload, {
      returnDocument: 'after',
      upsert: true,
    });

    console.log('✅ User synced to MongoDB:', user.email);
    res.status(201).json({ message: 'User registered and saved to MongoDB!', user });
  } catch (error) {
    console.error('❌ Error registering user:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST /api/users/login
// Called right after a successful Firebase sign-in.
// Ensures the user document exists in MongoDB (handles edge cases).
router.post('/login', async (req, res) => {
  try {
    const { firebaseUid, email, displayName } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: 'Firebase UID and Email are required' });
    }

    // Build the update payload — only include displayName if provided
    const updatePayload = { firebaseUid, email };
    if (displayName !== undefined) updatePayload.displayName = displayName;

    // upsert: true → creates the doc if it somehow doesn't exist yet
    const user = await User.findOneAndUpdate({ firebaseUid }, updatePayload, {
      returnDocument: 'after',
      upsert: true,
    });

    console.log('✅ User login synced to MongoDB:', user.email);
    res.status(200).json({ message: 'Login synced to MongoDB!', user });
  } catch (error) {
    console.error('❌ Error syncing login:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST /api/users/pretest
// This endpoint receives data from your Likert Scale frontend
router.post('/pretest', async (req, res) => {
  try {
    const { firebaseUid, email, answers, confidenceScore } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: 'Firebase UID and Email are required' });
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
      { returnDocument: 'after', upsert: true }
    );

    res.status(200).json({ message: 'Pre-test scores saved successfully!', user });
  } catch (error) {
    console.error('Error saving pre-test scores:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET /api/users/pretest-profile?uid=<firebaseUid>
// Returns the user's pre-test weakness tag, baseline score, and role
// for the Set 1 Briefing screen. Must be declared BEFORE /:firebaseUid
// to avoid the wildcard swallowing this route.
router.get('/pretest-profile', async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    // Fetch both in parallel
    const [session, user] = await Promise.all([
      PreTestSession.findOne({ firebaseUid: uid }).select(
        'final_weakness_tag baseline_score_percentage'
      ),
      User.findOne({ firebaseUid: uid }).select('role'),
    ]);

    // Graceful fallback if pre-test was never completed
    return res.status(200).json({
      weaknessTag: session?.final_weakness_tag ?? null,
      baselineScore: session?.baseline_score_percentage ?? null,
      role: user?.role ?? null,
    });
  } catch (error) {
    console.error('❌ Error fetching pretest profile:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET /api/users/results-summary?uid=<firebaseUid>
// Returns a full pre-vs-post comparison payload for the Results page.
// Must be declared BEFORE /:firebaseUid to avoid the wildcard swallowing it.
router.get('/results-summary', async (req, res) => {
  try {
    return res.status(200).json(await getResultsSummary(req.auth.uid));
  } catch (error) {
    console.error('Error fetching results summary:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET /api/users/active-practice-session?uid=...
// Returns the exact unfinished or next required journey step after a user leaves.
router.get('/active-practice-session', async (req, res) => {
  try {
    return res.status(200).json(await getActivePracticeSession(req.auth.uid));
  } catch (error) {
    console.error('Error fetching active journey session:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// PUT /api/users/role
// Updates user's target role, difficulty, focus area, and optionally displayName in MongoDB.
router.put('/role', async (req, res) => {
  try {
    const { firebaseUid, role, difficulty, focusArea, displayName } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    // Empty role values preserve the existing profile-only update behavior.
    if (role !== undefined && role !== null && role !== '' && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Select a supported target role.' });
    }

    const updateFields = {};
    if (role) updateFields.role = role;
    if (difficulty) updateFields.difficulty = difficulty;
    if (focusArea) updateFields.focusArea = focusArea;
    // Allow updating displayName (including empty string to clear it)
    if (displayName !== undefined) updateFields.displayName = displayName;

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateFields },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    console.log(`✅ Updated profile for user ${firebaseUid}:`, updateFields);
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid profile preferences.' });
    }
    console.error('❌ Error updating profile:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET /api/users/:firebaseUid
// Retrieves user profile including their role and diagnostic status.
router.get('/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const [user, preSession] = await Promise.all([
      User.findOne({ firebaseUid }),
      PreTestSession.findOne({ firebaseUid }).select('completedAt baseline_score_percentage'),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasCompletedDiagnostic = !!(
      preSession &&
      (preSession.completedAt || preSession.baseline_score_percentage != null)
    );

    res.status(200).json({ user, hasCompletedDiagnostic });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST /api/users/reset-practice-session
// Resets Set1, Set2, and Set3 sessions for the user to start a fresh practice run from Set 1, Q1
router.post('/reset-practice-session', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ message: 'firebaseUid is required' });
    }

    await Promise.all([
      Set1Session.deleteMany({ firebaseUid }),
      Set2Session.deleteMany({ firebaseUid }),
      Set3Session.deleteMany({ firebaseUid }),
    ]);

    console.log(`✅ Practice sessions reset for user: ${firebaseUid}`);
    res.status(200).json({
      message: 'Practice sessions reset successfully!',
      activeSession: await getActivePracticeSession(firebaseUid),
    });
  } catch (error) {
    console.error('❌ Error resetting practice session:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST /api/users/posttest
// Receives and saves post-test Likert confidence scores (H₀₂ post measurement)
router.post('/posttest', async (req, res) => {
  try {
    const { firebaseUid, email, answers, confidenceScore } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: 'Firebase UID and Email are required' });
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
      { returnDocument: 'after', upsert: true }
    );

    res.status(200).json({ message: 'Post-test scores saved successfully!', user });
  } catch (error) {
    console.error('Error saving post-test scores:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST /api/users/practice-history
// Appends a completed practice session entry to practiceHistory.
// Enforces a strict 20-session rolling cap using $push with $slice: -20.
router.post('/practice-history', async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // History can unlock difficulties. Every score and session setting must
    // come from backend records, never from the caller's submitted payload.
    const [set1, set2, set3] = await Promise.all([
      Set1Session.findOne({ firebaseUid }),
      Set2Session.findOne({ firebaseUid }),
      Set3Session.findOne({ firebaseUid }),
    ]);
    const practiceScores = calculatePracticeScores(set1, set2, set3);
    if (practiceScores.completedSetCount !== 3) {
      return res.status(409).json({ message: 'Complete all three practice sets before saving a practice attempt.' });
    }
    const role = set1.role || user.role || 'fullstack';
    const difficulty = set1.difficulty || user.difficulty || 'easy';
    if ([set2, set3].some(set => set.role && set.role !== role) ||
        (set2.difficulty && set2.difficulty !== difficulty)) {
      return res.status(409).json({ message: 'Practice sets must have matching role and difficulty settings.' });
    }
    const averageOutOf5 = Number(practiceScores.setScores.set1.toFixed(1));

    const existingHistory = user.practiceHistory || [];
    if (existingHistory.some(attempt => attempt.attemptId === set1.attemptId)) {
      return res.status(200).json({ message: 'Practice attempt already saved', practiceHistory: existingHistory });
    }
    const maxAttempt = existingHistory.reduce((max, item) => {
      const num = typeof item.attemptNumber === 'number' ? item.attemptNumber : 0;
      return Math.max(max, num);
    }, 0);
    const nextAttemptNumber = maxAttempt > 0 ? maxAttempt + 1 : existingHistory.length + 1;

    const newAttempt = {
      attemptNumber: nextAttemptNumber,
      attemptId: set1.attemptId,
      completedAt: new Date(),
      role,
      difficulty,
      focusArea: user.focusArea || 'auto',
      overallScorePercentage: practiceScores.overallScorePercentage,
      setScores: practiceScores.setScores,
      threeCBreakdown: {
        clarity: set1.avg_clarity,
        correctness: set1.avg_correctness,
        completeness: set1.avg_completeness,
        averageOutOf5,
        averageOutOf10: Number((averageOutOf5 * 2).toFixed(1)),
      },
      starBreakdown: {
        situation: set3.avg_situation,
        action: set3.avg_action,
        result: set3.avg_result,
      },
      weaknessTag: set3.final_weakness_tag || 'focus_completeness',
    };

    const updatedUser = await User.findOneAndUpdate(
      { firebaseUid, 'practiceHistory.attemptId': { $ne: set1.attemptId } },
      {
        $push: {
          practiceHistory: {
            $each: [newAttempt],
            $slice: -20,
          },
        },
      },
      { returnDocument: 'after' }
    );

    console.log(`✅ Saved practice attempt #${nextAttemptNumber} for user: ${firebaseUid}`);
    res.status(201).json({
      message: 'Practice attempt saved successfully',
      practiceHistory: updatedUser?.practiceHistory || (await User.findOne({ firebaseUid })).practiceHistory,
    });
  } catch (error) {
    console.error('❌ Error saving practice history:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;

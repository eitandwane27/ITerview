const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const PostTestSession = require('../models/PostTestSession');
const Set1Session = require('../models/Set1Session');
const Set2Session = require('../models/Set2Session');
const Set3Session = require('../models/Set3Session');

function isPercentage(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isScoreOutOfFive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;
}

function getLatestCompletedPracticeAttempt(practiceHistory = []) {
  if (!Array.isArray(practiceHistory)) return null;

  return practiceHistory.reduce((latest, attempt) => {
    if (!attempt || !isPercentage(attempt.overallScorePercentage)) return latest;
    if (!latest) return attempt;

    const attemptNumber = Number.isFinite(attempt.attemptNumber) ? attempt.attemptNumber : 0;
    const latestAttemptNumber = Number.isFinite(latest.attemptNumber) ? latest.attemptNumber : 0;
    const attemptTime = attempt.completedAt ? new Date(attempt.completedAt).getTime() : 0;
    const latestTime = latest.completedAt ? new Date(latest.completedAt).getTime() : 0;

    if (attemptNumber !== latestAttemptNumber) {
      return attemptNumber > latestAttemptNumber ? attempt : latest;
    }
    return attemptTime > latestTime ? attempt : latest;
  }, null);
}

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
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    // Fetch all database documents in parallel with answers array
    const [preSession, postSession, user, set1, set2, set3] = await Promise.all([
      PreTestSession.findOne({ firebaseUid: uid }).select(
        'baseline_score_percentage final_weakness_tag answers'
      ),
      PostTestSession.findOne({ firebaseUid: uid }).select(
        'final_score_percentage final_weakness_tag answers'
      ),
      User.findOne({ firebaseUid: uid }).select(
        'confidenceScore postConfidenceScore role difficulty unlockedDifficulty practiceHistory'
      ),
      Set1Session.findOne({ firebaseUid: uid }).select(
        'avg_clarity avg_correctness avg_completeness isCompleted answers'
      ),
      Set2Session.findOne({ firebaseUid: uid }).select(
        'avg_problem_solving avg_accuracy avg_depth isCompleted answers'
      ),
      Set3Session.findOne({ firebaseUid: uid }).select(
        'avg_situation avg_action avg_result isCompleted answers'
      ),
    ]);

    // Derived mastery score (Overall graduation post-test score)
    const postScore = postSession?.final_score_percentage ?? null;
    const preScore = preSession?.baseline_score_percentage ?? null;
    const preConf = user?.confidenceScore ?? null;
    const postConf = user?.postConfidenceScore ?? null;

    // Formulate individual set averages (out of 5)
    const set1Score =
      set1 && set1.isCompleted && set1.avg_clarity !== null
        ? parseFloat(
            ((set1.avg_clarity + set1.avg_correctness + set1.avg_completeness) / 3).toFixed(1)
          )
        : null;

    const set2Score =
      set2 && set2.isCompleted && set2.avg_problem_solving !== null
        ? parseFloat(
            ((set2.avg_problem_solving + set2.avg_accuracy + set2.avg_depth) / 3).toFixed(1)
          )
        : null;

    const set3Score =
      set3 && set3.isCompleted && set3.avg_situation !== null
        ? parseFloat(((set3.avg_situation + set3.avg_action + set3.avg_result) / 3).toFixed(1))
        : null;

    // Calculate overall practice sets average (out of 5 and 100%)
    const completedPracticeScores = [set1Score, set2Score, set3Score].filter((s) => s !== null);
    const hasCompletedAllLivePracticeSets = completedPracticeScores.length === 3;
    const livePracticeSetsAvgScore =
      completedPracticeScores.length > 0
        ? parseFloat(
            (
              completedPracticeScores.reduce((a, b) => a + b, 0) / completedPracticeScores.length
            ).toFixed(1)
          )
        : null;
    const livePracticeSetsAvgPercentage =
      livePracticeSetsAvgScore !== null
        ? parseFloat(((livePracticeSetsAvgScore / 5) * 100).toFixed(1))
        : null;

    // Set documents are mutable working state and are deleted when a fresh run
    // begins. practiceHistory is the durable record of completed runs, so keep
    // showing its latest result whenever no complete live three-set run exists.
    const latestCompletedAttempt = getLatestCompletedPracticeAttempt(user?.practiceHistory);
    const useLatestCompletedAttempt = Boolean(
      !hasCompletedAllLivePracticeSets && latestCompletedAttempt
    );
    const practiceSetsAvgPercentage = useLatestCompletedAttempt
      ? latestCompletedAttempt.overallScorePercentage
      : livePracticeSetsAvgPercentage;
    const practiceSetsAvgScore =
      practiceSetsAvgPercentage !== null
        ? parseFloat((practiceSetsAvgPercentage / 20).toFixed(1))
        : null;
    const completedPracticeSetCount = useLatestCompletedAttempt
      ? 3
      : completedPracticeScores.length;
    const hasCompletedAllPracticeSets = completedPracticeSetCount === 3;
    const historicalSetScores = useLatestCompletedAttempt
      ? latestCompletedAttempt.setScores || {}
      : {};
    const displayedSet1Score = useLatestCompletedAttempt
      ? isScoreOutOfFive(historicalSetScores.set1)
        ? historicalSetScores.set1
        : null
      : set1Score;
    const displayedSet2Score = useLatestCompletedAttempt
      ? isScoreOutOfFive(historicalSetScores.set2)
        ? historicalSetScores.set2
        : null
      : set2Score;
    const displayedSet3Score = useLatestCompletedAttempt
      ? isScoreOutOfFive(historicalSetScores.set3)
        ? historicalSetScores.set3
        : null
      : set3Score;
    const historicalStarBreakdown = useLatestCompletedAttempt
      ? latestCompletedAttempt.starBreakdown || {}
      : {};

    // Calculate grand average across the entire journey (Pre-Test, Practice Sets Avg, Post-Test)
    const journeyComponents = [];
    if (preScore !== null) journeyComponents.push(preScore);
    if (practiceSetsAvgPercentage !== null) journeyComponents.push(practiceSetsAvgPercentage);
    if (postScore !== null) journeyComponents.push(postScore);
    const overallJourneyAveragePercentage =
      journeyComponents.length > 0
        ? parseFloat(
            (journeyComponents.reduce((a, b) => a + b, 0) / journeyComponents.length).toFixed(1)
          )
        : null;

    // Helper for formatting question breakdowns
    const mapPrePostAnswers = (answers = []) =>
      answers.map((a) => {
        const avg =
          a.clarity_score != null && a.correctness_score != null && a.completeness_score != null
            ? parseFloat(
                ((a.clarity_score + a.correctness_score + a.completeness_score) / 3).toFixed(1)
              )
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
          questionPercentage: avg !== null ? parseFloat(((avg / 5) * 100).toFixed(1)) : null,
        };
      });

    // Determine target difficulty and unlock threshold logic
    const currentDiff = useLatestCompletedAttempt
      ? latestCompletedAttempt.difficulty || user?.difficulty || 'easy'
      : user?.difficulty || 'easy';
    let nextDifficulty = 'medium';
    if (currentDiff === 'medium') nextDifficulty = 'hard';
    if (currentDiff === 'hard') nextDifficulty = 'hard';

    // Difficulty advancement is based only on the combined average across Practice Sets 1–3.
    const unlockThreshold = 70;
    const isUnlocked =
      hasCompletedAllPracticeSets &&
      practiceSetsAvgPercentage !== null &&
      practiceSetsAvgPercentage >= unlockThreshold;

    if (isUnlocked && user) {
      let upgradedDiff = user.unlockedDifficulty;
      if (
        currentDiff === 'easy' &&
        (user.unlockedDifficulty === 'easy' || !user.unlockedDifficulty)
      ) {
        upgradedDiff = 'medium';
      } else if (
        currentDiff === 'medium' &&
        (user.unlockedDifficulty === 'easy' || user.unlockedDifficulty === 'medium')
      ) {
        upgradedDiff = 'hard';
      }

      if (upgradedDiff !== user.unlockedDifficulty) {
        // Atomic update avoids Mongoose VersionError / ParallelSaveError on concurrent GET requests
        await User.updateOne(
          { firebaseUid: uid, unlockedDifficulty: { $ne: upgradedDiff } },
          { $set: { unlockedDifficulty: upgradedDiff } }
        );
        // Also update local in-memory property so the current response payload reflects the new tier
        user.unlockedDifficulty = upgradedDiff;
        console.log(`[DB] 🎓 Upgraded unlockedDifficulty to '${upgradedDiff}' for user: ${uid}`);
      }
    }

    // Compute baseline 3C dimension breakdown from pre-test session or set1
    let preClarity = null,
      preCorrectness = null,
      preCompleteness = null;
    if (preSession?.answers && preSession.answers.length > 0) {
      const valid = preSession.answers.filter(
        (a) =>
          a.clarity_score != null && a.correctness_score != null && a.completeness_score != null
      );
      if (valid.length > 0) {
        preClarity = parseFloat(
          (valid.reduce((sum, a) => sum + a.clarity_score, 0) / valid.length).toFixed(1)
        );
        preCorrectness = parseFloat(
          (valid.reduce((sum, a) => sum + a.correctness_score, 0) / valid.length).toFixed(1)
        );
        preCompleteness = parseFloat(
          (valid.reduce((sum, a) => sum + a.completeness_score, 0) / valid.length).toFixed(1)
        );
      }
    }

    if (preClarity === null && set1?.avg_clarity != null) {
      preClarity = set1.avg_clarity;
      preCorrectness = set1.avg_correctness;
      preCompleteness = set1.avg_completeness;
    }

    let threeCAvgOutOf5 = null;
    let threeCAvgPercentage = null;
    let lowestThreeCMetric = null;

    if (preClarity !== null && preCorrectness !== null && preCompleteness !== null) {
      threeCAvgOutOf5 = parseFloat(
        ((preClarity + preCorrectness + preCompleteness) / 3).toFixed(1)
      );
      threeCAvgPercentage = parseFloat(((threeCAvgOutOf5 / 5) * 100).toFixed(1));

      const minVal = Math.min(preClarity, preCorrectness, preCompleteness);
      if (minVal === preClarity) lowestThreeCMetric = 'clarity';
      else if (minVal === preCorrectness) lowestThreeCMetric = 'correctness';
      else lowestThreeCMetric = 'completeness';
    }

    return res.status(200).json({
      preConfidenceScore: preConf,
      postConfidenceScore: postConf,
      masteryScore: postScore,
      preTestScore: preScore,
      improvementDelta: preScore !== null && postScore !== null ? postScore - preScore : null,

      // 3C Baseline & Practice Breakdown
      threeCBreakdown: {
        clarity: preClarity,
        correctness: preCorrectness,
        completeness: preCompleteness,
        averageOutOf5: threeCAvgOutOf5,
        averageOutOf10: threeCAvgOutOf5,
        averagePercentage: threeCAvgPercentage,
        lowestMetric: lowestThreeCMetric,
      },

      // Overall Session Averages
      sessionAverages: {
        preTest: { scorePercentage: preScore, label: 'Pre-Test Diagnostic' },
        set1: {
          scoreOutOf5: displayedSet1Score,
          scoreOutOf10: displayedSet1Score,
          scorePercentage:
            displayedSet1Score !== null
              ? parseFloat(((displayedSet1Score / 5) * 100).toFixed(1))
              : null,
          label: 'Set 1 · Personalized',
        },
        set2: {
          scoreOutOf5: displayedSet2Score,
          scoreOutOf10: displayedSet2Score,
          scorePercentage:
            displayedSet2Score !== null
              ? parseFloat(((displayedSet2Score / 5) * 100).toFixed(1))
              : null,
          label: 'Set 2 · Technical',
        },
        set3: {
          scoreOutOf5: displayedSet3Score,
          scoreOutOf10: displayedSet3Score,
          scorePercentage:
            displayedSet3Score !== null
              ? parseFloat(((displayedSet3Score / 5) * 100).toFixed(1))
              : null,
          label: 'Set 3 · Behavioral STAR',
        },
        postTest: { scorePercentage: postScore, label: 'Post-Test Graduation' },
        practiceSetsAverage: {
          scoreOutOf5: practiceSetsAvgScore,
          scoreOutOf10: practiceSetsAvgScore,
          scorePercentage: practiceSetsAvgPercentage,
        },
        overallJourneyAveragePercentage,
      },

      // This is deliberately separate from setScores. Older history entries
      // retain the combined score but not the three individual set scores.
      practiceProgress: {
        source: useLatestCompletedAttempt ? 'latest-completed-attempt' : 'current-sets',
        attemptNumber: useLatestCompletedAttempt
          ? latestCompletedAttempt.attemptNumber ?? null
          : null,
        completedSetCount: completedPracticeSetCount,
        completedAllSets: hasCompletedAllPracticeSets,
        scoreOutOf5: practiceSetsAvgScore,
        scorePercentage: practiceSetsAvgPercentage,
      },

      // Individual set scores details
      setScores: {
        set1: {
          label: 'Set 1 · Personalized',
          score: displayedSet1Score,
          outOf: 5,
          emoji: '🤖',
          completed: useLatestCompletedAttempt
            ? displayedSet1Score !== null
            : !!set1?.isCompleted,
        },
        set2: {
          label: 'Set 2 · Technical',
          score: displayedSet2Score,
          outOf: 5,
          emoji: '💻',
          completed: useLatestCompletedAttempt
            ? displayedSet2Score !== null
            : !!set2?.isCompleted,
        },
        set3: {
          label: 'Set 3 · Behavioral STAR',
          score: displayedSet3Score,
          outOf: 5,
          emoji: '🎯',
          completed: useLatestCompletedAttempt
            ? displayedSet3Score !== null
            : !!set3?.isCompleted,
        },
      },

      // STAR dimension averages from Set 3 (out of 5)
      starBreakdown: {
        situation: useLatestCompletedAttempt
          ? historicalStarBreakdown.situation ?? null
          : set3?.avg_situation ?? null,
        action: useLatestCompletedAttempt
          ? historicalStarBreakdown.action ?? null
          : set3?.avg_action ?? null,
        result: useLatestCompletedAttempt
          ? historicalStarBreakdown.result ?? null
          : set3?.avg_result ?? null,
      },

      // Detailed Question-by-Question Breakdowns for Every Session
      questionBreakdowns: {
        preTest: {
          sessionLabel: 'Pre-Test Diagnostic Interview',
          sessionAveragePercentage: preScore,
          questions: mapPrePostAnswers(preSession?.answers),
        },
        set1: {
          sessionLabel: 'Practice Set 1 · Personalized (3C)',
          sessionAverageOutOf5: set1Score,
          sessionAverageOutOf10: set1Score,
          sessionAveragePercentage:
            set1Score !== null ? parseFloat(((set1Score / 5) * 100).toFixed(1)) : null,
          metricsAverage: {
            clarity: set1?.avg_clarity ?? null,
            correctness: set1?.avg_correctness ?? null,
            completeness: set1?.avg_completeness ?? null,
          },
          questions: (set1?.answers || []).map((a) => {
            const avg =
              a.clarity_score != null && a.correctness_score != null && a.completeness_score != null
                ? parseFloat(
                    ((a.clarity_score + a.correctness_score + a.completeness_score) / 3).toFixed(1)
                  )
                : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: {
                clarity: a.clarity_score,
                correctness: a.correctness_score,
                completeness: a.completeness_score,
              },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat(((avg / 5) * 100).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        set2: {
          sessionLabel: 'Practice Set 2 · Technical Mastery',
          sessionAverageOutOf5: set2Score,
          sessionAverageOutOf10: set2Score,
          sessionAveragePercentage:
            set2Score !== null ? parseFloat(((set2Score / 5) * 100).toFixed(1)) : null,
          metricsAverage: {
            problemSolving: set2?.avg_problem_solving ?? null,
            accuracy: set2?.avg_accuracy ?? null,
            depth: set2?.avg_depth ?? null,
          },
          questions: (set2?.answers || []).map((a) => {
            const avg =
              a.problem_solving_score != null && a.accuracy_score != null && a.depth_score != null
                ? parseFloat(
                    ((a.problem_solving_score + a.accuracy_score + a.depth_score) / 3).toFixed(1)
                  )
                : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: {
                problemSolving: a.problem_solving_score,
                accuracy: a.accuracy_score,
                depth: a.depth_score,
              },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat(((avg / 5) * 100).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        set3: {
          sessionLabel: 'Practice Set 3 · Behavioral STAR',
          sessionAverageOutOf5: set3Score,
          sessionAverageOutOf10: set3Score,
          sessionAveragePercentage:
            set3Score !== null ? parseFloat(((set3Score / 5) * 100).toFixed(1)) : null,
          metricsAverage: {
            situation: set3?.avg_situation ?? null,
            action: set3?.avg_action ?? null,
            result: set3?.avg_result ?? null,
          },
          questions: (set3?.answers || []).map((a) => {
            const avg =
              a.situation_score != null && a.action_score != null && a.result_score != null
                ? parseFloat(((a.situation_score + a.action_score + a.result_score) / 3).toFixed(1))
                : null;
            return {
              questionNumber: a.questionIndex + 1,
              question: a.question,
              transcript: a.transcript,
              metrics: {
                situation: a.situation_score,
                action: a.action_score,
                result: a.result_score,
              },
              questionAverage: avg,
              questionPercentage: avg !== null ? parseFloat(((avg / 5) * 100).toFixed(1)) : null,
              tip: a.tip,
            };
          }),
        },
        postTest: {
          sessionLabel: 'Post-Test Graduation Challenge',
          sessionAveragePercentage: postScore,
          questions: mapPrePostAnswers(postSession?.answers),
        },
      },

      targetDifficulty: currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1),
      nextDifficulty: nextDifficulty.charAt(0).toUpperCase() + nextDifficulty.slice(1),
      unlocked: isUnlocked,
      unlockThreshold,
      role: user?.role ?? null,
      preWeaknessTag: preSession?.final_weakness_tag ?? null,
      postWeaknessTag: postSession?.final_weakness_tag ?? null,
      practiceHistory: user?.practiceHistory ?? [],
    });
  } catch (error) {
    console.error('❌ Error fetching results summary:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET /api/users/active-practice-session?uid=...
// Returns the exact unfinished or next required journey step after a user leaves.
router.get('/active-practice-session', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ message: 'UID is required' });
    }

    const [user, preTest, set1, set2, set3, postTest] = await Promise.all([
      User.findOne({ firebaseUid: uid }).select('confidenceScore postConfidenceScore'),
      PreTestSession.findOne({ firebaseUid: uid }).select(
        'completedAt answers sessionId baseline_score_percentage'
      ),
      Set1Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode'),
      Set2Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode'),
      Set3Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode'),
      PostTestSession.findOne({ firebaseUid: uid }).select(
        'completedAt answers sessionId final_score_percentage'
      ),
    ]);

    // A drill is never part of the resumable curriculum journey. Drill mode is
    // designed to stay memory-only, but filtering here makes the invariant
    // resilient if a stale or legacy drill document ever exists.
    const mainSetDocs = {
      1: set1?.mode === 'drill' ? null : set1,
      2: set2?.mode === 'drill' ? null : set2,
      3: set3?.mode === 'drill' ? null : set3,
    };
    const mainSetPayload = (activeSet, fallbackMode = 'diagnostic') => {
      const activeDoc = mainSetDocs[activeSet];
      const previousDoc = activeSet > 1 ? mainSetDocs[activeSet - 1] : null;
      const modeSource = activeDoc || previousDoc;
      return {
        hasActiveSession: true,
        hasResumableSession: Boolean(activeDoc && !activeDoc.isCompleted),
        nextStage: 'mainsets',
        activeSet,
        answersCount:
          activeDoc && !activeDoc.isCompleted && activeDoc.answers ? activeDoc.answers.length : 0,
        totalQuestions: 5,
        sessionId: activeDoc && !activeDoc.isCompleted ? activeDoc.sessionId || null : null,
        mode: modeSource?.mode === 'practice' ? 'practice' : fallbackMode,
      };
    };

    // An explicitly unfinished interview takes priority, even if someone entered
    // it manually before completing an earlier onboarding step.
    if (mainSetDocs[3] && !mainSetDocs[3].isCompleted) {
      return res.status(200).json(mainSetPayload(3));
    }
    if (mainSetDocs[2] && !mainSetDocs[2].isCompleted) {
      return res.status(200).json(mainSetPayload(2));
    }
    if (mainSetDocs[1] && !mainSetDocs[1].isCompleted) {
      return res.status(200).json(mainSetPayload(1));
    }

    if (preTest && !preTest.completedAt) {
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: true,
        nextStage: 'pretest',
        answersCount: preTest.answers?.length || 0,
        totalQuestions: 5,
        sessionId: preTest.sessionId || null,
      });
    }

    if (postTest && !postTest.completedAt) {
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: true,
        nextStage: 'posttest',
        answersCount: postTest.answers?.length || 0,
        totalQuestions: 5,
        sessionId: postTest.sessionId || null,
      });
    }

    const preTestComplete = Boolean(
      preTest?.completedAt || preTest?.baseline_score_percentage != null
    );
    if (!preTestComplete) {
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: false,
        nextStage:
          user?.confidenceScore === null || user?.confidenceScore === undefined
            ? 'likert-pre'
            : 'mic-test',
      });
    }

    const researchComplete = Boolean(postTest?.completedAt && user?.postConfidenceScore != null);
    const hasPracticeSet = Object.values(mainSetDocs).some(
      (session) => session?.mode === 'practice'
    );

    // Once the research journey is complete, only an already-started practice
    // sequence should be inferred. A user with no practice run stays on Dashboard.
    if (researchComplete) {
      if (hasPracticeSet) {
        if (!mainSetDocs[1] || !mainSetDocs[1].isCompleted) {
          return res.status(200).json(mainSetPayload(1, 'practice'));
        }
        if (!mainSetDocs[2] || !mainSetDocs[2].isCompleted) {
          return res.status(200).json(mainSetPayload(2, 'practice'));
        }
        if (!mainSetDocs[3] || !mainSetDocs[3].isCompleted) {
          return res.status(200).json(mainSetPayload(3, 'practice'));
        }
      }
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: false,
        nextStage: 'complete',
      });
    }

    if (!mainSetDocs[1] || !mainSetDocs[1].isCompleted) {
      return res.status(200).json(mainSetPayload(1));
    }
    if (!mainSetDocs[2] || !mainSetDocs[2].isCompleted) {
      return res.status(200).json(mainSetPayload(2));
    }
    if (!mainSetDocs[3] || !mainSetDocs[3].isCompleted) {
      return res.status(200).json(mainSetPayload(3));
    }
    if (!postTest?.completedAt) {
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: false,
        nextStage: 'posttest',
        answersCount: 0,
        totalQuestions: 5,
        sessionId: null,
      });
    }
    if (user?.postConfidenceScore === null || user?.postConfidenceScore === undefined) {
      return res.status(200).json({
        hasActiveSession: false,
        hasResumableSession: false,
        nextStage: 'likert-post',
      });
    }

    return res.status(200).json({
      hasActiveSession: false,
      hasResumableSession: false,
      nextStage: 'complete',
    });
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

    const updateFields = {};
    if (role) updateFields.role = role;
    if (difficulty) updateFields.difficulty = difficulty;
    if (focusArea) updateFields.focusArea = focusArea;
    // Allow updating displayName (including empty string to clear it)
    if (displayName !== undefined) updateFields.displayName = displayName;

    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: updateFields },
      { returnDocument: 'after', upsert: true }
    );

    console.log(`✅ Updated profile for user ${firebaseUid}:`, updateFields);
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (error) {
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
    res.status(200).json({ message: 'Practice sessions reset successfully!' });
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
    const {
      firebaseUid,
      role,
      difficulty,
      focusArea,
      overallScorePercentage,
      setScores,
      threeCBreakdown,
      starBreakdown,
      weaknessTag,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingHistory = user.practiceHistory || [];
    const maxAttempt = existingHistory.reduce((max, item) => {
      const num = typeof item.attemptNumber === 'number' ? item.attemptNumber : 0;
      return Math.max(max, num);
    }, 0);
    const nextAttemptNumber = maxAttempt > 0 ? maxAttempt + 1 : existingHistory.length + 1;

    const newAttempt = {
      attemptNumber: nextAttemptNumber,
      completedAt: new Date(),
      role: role || user.role || 'fullstack',
      difficulty: difficulty || user.difficulty || 'easy',
      focusArea: focusArea || user.focusArea || 'auto',
      overallScorePercentage: overallScorePercentage ?? null,
      setScores: setScores || null,
      threeCBreakdown: threeCBreakdown || null,
      starBreakdown: starBreakdown || null,
      weaknessTag: weaknessTag || null,
    };

    const updatedUser = await User.findOneAndUpdate(
      { firebaseUid },
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
      practiceHistory: updatedUser.practiceHistory,
    });
  } catch (error) {
    console.error('❌ Error saving practice history:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;

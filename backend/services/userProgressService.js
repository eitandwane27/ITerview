const { getAttemptSets } = require('../utils/practiceAttempt');
const User = require('../models/User');
const PreTestSession = require('../models/PreTestSession');
const PostTestSession = require('../models/PostTestSession');
const Set1Session = require('../models/Set1Session');
const Set2Session = require('../models/Set2Session');
const Set3Session = require('../models/Set3Session');
const { DIFFICULTIES, DIFFICULTY_UNLOCK_THRESHOLD } = require('../config/interviewConfig');
const { calculatePracticeScores } = require('../utils/practiceScoring');

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


// Shared with the dashboard so coaching uses the same score/unlock calculations.
async function getResultsSummary(uid, { persistUnlock = true } = {}) {
  // Fetch all database documents in parallel with answers array
  const [preSession, postSession, user, rawSet1, rawSet2, rawSet3] = await Promise.all([
    PreTestSession.findOne({ firebaseUid: uid }).select(
      'baseline_score_percentage final_weakness_tag answers'
    ),
    PostTestSession.findOne({ firebaseUid: uid }).select(
      'final_score_percentage final_weakness_tag answers'
    ),
    User.findOne({ firebaseUid: uid }).select(
      'confidenceScore postConfidenceScore role difficulty unlockedDifficulty focusArea practiceHistory'
    ),
    Set1Session.findOne({ firebaseUid: uid }).select(
      'avg_clarity avg_correctness avg_completeness isCompleted answers difficulty role attemptId'
    ),
    Set2Session.findOne({ firebaseUid: uid }).select(
      'avg_problem_solving avg_accuracy avg_depth isCompleted answers difficulty role attemptId'
    ),
    Set3Session.findOne({ firebaseUid: uid }).select(
      'avg_situation avg_action avg_result isCompleted answers difficulty role attemptId'
    ),
  ]);

  const [set1, set2, set3] = getAttemptSets(rawSet1, rawSet2, rawSet3);

  // Derived mastery score (Overall graduation post-test score)
  const postScore = postSession?.final_score_percentage ?? null;
  const preScore = preSession?.baseline_score_percentage ?? null;
  const preConf = user?.confidenceScore ?? null;
  const postConf = user?.postConfidenceScore ?? null;

  const livePractice = calculatePracticeScores(set1, set2, set3);
  const { set1: set1Score, set2: set2Score, set3: set3Score } = livePractice.setScores;
  const hasCompletedAllLivePracticeSets = livePractice.completedSetCount === 3;

  // Set documents are mutable working state and are deleted when a fresh run
  // begins. practiceHistory is the durable record of completed runs, so keep
  // showing its latest result whenever no complete live three-set run exists.
  const latestCompletedAttempt = getLatestCompletedPracticeAttempt(user?.practiceHistory);
  const useLatestCompletedAttempt = Boolean(
    !hasCompletedAllLivePracticeSets && latestCompletedAttempt
  );
  const rawPracticePercentage = useLatestCompletedAttempt
    ? latestCompletedAttempt.overallScorePercentage
    : livePractice.overallScorePercentage;
  const practiceSetsAvgPercentage = rawPracticePercentage !== null
    ? Number(rawPracticePercentage.toFixed(1)) : null;
  const practiceSetsAvgScore =
    practiceSetsAvgPercentage !== null
      ? parseFloat((practiceSetsAvgPercentage / 20).toFixed(1))
      : null;
  const completedPracticeSetCount = useLatestCompletedAttempt
    ? 3
    : livePractice.completedSetCount;
  const hasCompletedAllPracticeSets = completedPracticeSetCount === 3;
  const historicalSetScores = useLatestCompletedAttempt
    ? latestCompletedAttempt.setScores || {}
    : {};
  const displayedSet1Score = useLatestCompletedAttempt
    ? isScoreOutOfFive(historicalSetScores.set1)
      ? historicalSetScores.set1
      : null
    : set1Score !== null ? Number(set1Score.toFixed(1)) : null;
  const displayedSet2Score = useLatestCompletedAttempt
    ? isScoreOutOfFive(historicalSetScores.set2)
      ? historicalSetScores.set2
      : null
    : set2Score !== null ? Number(set2Score.toFixed(1)) : null;
  const displayedSet3Score = useLatestCompletedAttempt
    ? isScoreOutOfFive(historicalSetScores.set3)
      ? historicalSetScores.set3
      : null
    : set3Score !== null ? Number(set3Score.toFixed(1)) : null;
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

  // Profile selections cannot relabel completed evidence. Set 3's easy
  // behavioral calibration is independent of the technical difficulty.
  const completedDifficulty = useLatestCompletedAttempt
    ? latestCompletedAttempt.difficulty
    : hasCompletedAllLivePracticeSets && set1.difficulty === set2.difficulty
      ? set1.difficulty : null;
  const hasValidCompletedDifficulty = DIFFICULTIES.includes(completedDifficulty);
  const currentDiff = hasValidCompletedDifficulty
    ? completedDifficulty : DIFFICULTIES.includes(user?.difficulty) ? user.difficulty : 'easy';
  let nextDifficulty = 'medium';
  if (currentDiff === 'medium') nextDifficulty = 'hard';
  if (currentDiff === 'hard') nextDifficulty = 'hard';

  // Difficulty advancement is based only on the combined average across Practice Sets 1–3.
  const unlockThreshold = DIFFICULTY_UNLOCK_THRESHOLD;
  const isUnlocked =
    hasCompletedAllPracticeSets &&
    hasValidCompletedDifficulty &&
    rawPracticePercentage !== null &&
    rawPracticePercentage >= unlockThreshold;

  if (persistUnlock && isUnlocked && user) {
    let upgradedDiff = user.unlockedDifficulty;
    if (
      currentDiff === 'easy' &&
      (user.unlockedDifficulty === 'easy' || !user.unlockedDifficulty)
    ) {
      upgradedDiff = 'medium';
    } else if (
      currentDiff === 'medium' &&
      (!user.unlockedDifficulty || user.unlockedDifficulty === 'easy' || user.unlockedDifficulty === 'medium')
    ) {
      upgradedDiff = 'hard';
    }

    if (upgradedDiff !== user.unlockedDifficulty) {
      // Match only lower tiers so a stale Easy result cannot overwrite a
      // concurrent Medium result's Hard unlock. null also matches legacy users.
      const lowerTiers = [null, ...DIFFICULTIES.slice(0, DIFFICULTIES.indexOf(upgradedDiff))];
      const update = await User.updateOne(
        { firebaseUid: uid, unlockedDifficulty: { $in: lowerTiers } },
        { $set: { unlockedDifficulty: upgradedDiff } }
      );
      if (update.matchedCount === 0) {
        const latestUser = await User.findOne({ firebaseUid: uid }).select('unlockedDifficulty');
        user.unlockedDifficulty = latestUser?.unlockedDifficulty ?? user.unlockedDifficulty;
      } else {
        user.unlockedDifficulty = upgradedDiff;
        console.log(`[DB] 🎓 Upgraded unlockedDifficulty to '${upgradedDiff}' for user: ${uid}`);
      }
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

  return ({
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
      role: useLatestCompletedAttempt ? latestCompletedAttempt.role ?? null : set1?.role ?? set2?.role ?? set3?.role ?? null,
      difficulty: useLatestCompletedAttempt ? latestCompletedAttempt.difficulty ?? null : set1?.difficulty ?? set2?.difficulty ?? set3?.difficulty ?? null,
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
        role: set1?.role ?? null,
        difficulty: set1?.difficulty ?? null,
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
        role: set2?.role ?? null,
        difficulty: set2?.difficulty ?? null,
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
        role: set3?.role ?? null,
        difficulty: set3?.difficulty ?? null,
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
    difficulty: user?.difficulty ?? null,
    unlockedDifficulty: user?.unlockedDifficulty ?? null,
    focusArea: user?.focusArea ?? null,
    preWeaknessTag: preSession?.final_weakness_tag ?? null,
    postWeaknessTag: postSession?.final_weakness_tag ?? null,
    practiceHistory: user?.practiceHistory ?? [],
  });
}

async function getActivePracticeSession(uid) {
  const [user, preTest, set1, set2, set3, postTest] = await Promise.all([
    User.findOne({ firebaseUid: uid }).select('confidenceScore postConfidenceScore'),
    PreTestSession.findOne({ firebaseUid: uid }).select(
      'completedAt answers sessionId baseline_score_percentage'
    ),
    Set1Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode attemptId role difficulty'),
    Set2Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode attemptId role difficulty'),
    Set3Session.findOne({ firebaseUid: uid }).select('isCompleted answers sessionId mode attemptId role difficulty'),
    PostTestSession.findOne({ firebaseUid: uid }).select(
      'completedAt answers sessionId final_score_percentage'
    ),
  ]);

  // A drill is never part of the resumable curriculum journey. Drill mode is
  // designed to stay memory-only, but filtering here makes the invariant
  // resilient if a stale or legacy drill document ever exists.
  const [attemptSet1, attemptSet2, attemptSet3] = getAttemptSets(set1, set2, set3);
  const mainSetDocs = {
    1: attemptSet1?.mode === 'drill' || (attemptSet1?.isCompleted && !attemptSet1.attemptId) ? null : attemptSet1,
    2: attemptSet2?.mode === 'drill' ? null : attemptSet2,
    3: attemptSet3?.mode === 'drill' ? null : attemptSet3,
  };
  const mainSetPayload = (activeSet, fallbackMode = 'diagnostic') => {
    const activeDoc = mainSetDocs[activeSet];
    const previousDoc = activeSet > 1 ? mainSetDocs[activeSet - 1] : null;
    const modeSource = activeDoc || previousDoc;
    return {
      // A required Set 1 is not an active attempt until it has been created.
      // Later sets still belong to the attempt started by the previous set.
      hasActiveSession: Boolean(modeSource),
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
    return (mainSetPayload(3));
  }
  if (mainSetDocs[2] && !mainSetDocs[2].isCompleted) {
    return (mainSetPayload(2));
  }
  if (mainSetDocs[1] && !mainSetDocs[1].isCompleted) {
    return (mainSetPayload(1));
  }

  if (preTest && !preTest.completedAt) {
    return ({
      hasActiveSession: false,
      hasResumableSession: true,
      nextStage: 'pretest',
      answersCount: preTest.answers?.length || 0,
      totalQuestions: 5,
      sessionId: preTest.sessionId || null,
    });
  }

  if (postTest && !postTest.completedAt) {
    return ({
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
    return ({
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
        return (mainSetPayload(1, 'practice'));
      }
      if (!mainSetDocs[2] || !mainSetDocs[2].isCompleted) {
        return (mainSetPayload(2, 'practice'));
      }
      if (!mainSetDocs[3] || !mainSetDocs[3].isCompleted) {
        return (mainSetPayload(3, 'practice'));
      }
    }
    return ({
      hasActiveSession: false,
      hasResumableSession: false,
      nextStage: 'complete',
    });
  }

  if (!mainSetDocs[1] || !mainSetDocs[1].isCompleted) {
    return (mainSetPayload(1));
  }
  if (!mainSetDocs[2] || !mainSetDocs[2].isCompleted) {
    return (mainSetPayload(2));
  }
  if (!mainSetDocs[3] || !mainSetDocs[3].isCompleted) {
    return (mainSetPayload(3));
  }
  if (!postTest?.completedAt) {
    return ({
      hasActiveSession: false,
      hasResumableSession: false,
      nextStage: 'posttest',
      answersCount: 0,
      totalQuestions: 5,
      sessionId: null,
    });
  }
  if (user?.postConfidenceScore === null || user?.postConfidenceScore === undefined) {
    return ({
      hasActiveSession: false,
      hasResumableSession: false,
      nextStage: 'likert-post',
    });
  }

  return ({
    hasActiveSession: false,
    hasResumableSession: false,
    nextStage: 'complete',
  });
}

module.exports = { getResultsSummary, getActivePracticeSession };

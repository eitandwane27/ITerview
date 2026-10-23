const { getResultsSummary, getActivePracticeSession } = require("./userProgressService");
const { containsSensitiveContent, isInstructionOverride } = require("./chatbotGuardrails");
const { getRoleCatalogue } = require("./chatbotKnowledgeService");

const number = (value, max = 100) => typeof value === "number" && Number.isFinite(value)
  && value >= 0 && value <= max ? value : null;
const score = value => number(value, 5) !== null && value >= 1 ? value : null;
function text(value, max = 300) {
  if (typeof value !== "string" || containsSensitiveContent(value) || isInstructionOverride(value)) return null;
  return value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/\b(?:\+?\d[\s().-]*){10,}\b/g, "[contact detail removed]").trim().slice(0, max) || null;
}
function date(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
function metrics(values = {}) {
  return Object.fromEntries(["clarity", "correctness", "completeness", "problemSolving", "accuracy", "depth", "situation", "action", "result"]
    .filter(key => Object.hasOwn(values || {}, key)).map(key => [key, score(values[key])]));
}

function buildCoachProgress(summary = {}, active = {}, now = new Date()) {
  const catalogue = getRoleCatalogue();
  const role = catalogue.find(item => item.id === summary.role);
  const recentAttempts = (Array.isArray(summary.practiceHistory) ? summary.practiceHistory : []).slice(-20).map(attempt => ({
    attemptNumber: number(attempt.attemptNumber, Number.MAX_SAFE_INTEGER),
    completedAt: date(attempt.completedAt),
    role: catalogue.some(item => item.id === attempt.role) ? attempt.role : null,
    difficulty: ["easy", "medium", "hard"].includes(attempt.difficulty) ? attempt.difficulty : null,
    focusArea: text(attempt.focusArea, 40),
    scorePercentage: number(attempt.overallScorePercentage),
    threeCs: metrics(attempt.threeCBreakdown),
    star: metrics(attempt.starBreakdown),
    setScores: Object.fromEntries(["set1", "set2", "set3"].map(key => [key, score(attempt.setScores?.[key])])),
    weaknessTag: text(attempt.weaknessTag, 60),
  }));
  const assessments = Object.fromEntries(["preTest", "set1", "set2", "set3", "postTest"].map(key => {
    const session = summary.questionBreakdowns?.[key] || {};
    return [key, {
      role: catalogue.some(item => item.id === session.role) ? session.role : null,
      difficulty: ["easy", "medium", "hard"].includes(session.difficulty) ? session.difficulty : null,
      scorePercentage: number(session.sessionAveragePercentage),
      metrics: metrics(session.metricsAverage),
      questions: (Array.isArray(session.questions) ? session.questions : []).slice(0, 5).map(question => ({
        questionNumber: number(question.questionNumber, 5),
        question: text(question.question, 260),
        answer: text(question.transcript, 450),
        metrics: metrics(question.metrics),
        scorePercentage: number(question.questionPercentage),
        feedback: text(question.tip, 220),
      })),
    }];
  }));
  const preTestScore = number(summary.preTestScore);
  const practiceScore = number(summary.practiceProgress?.scorePercentage);
  const postTestScore = number(summary.masteryScore);
  const hasAssessmentData = [preTestScore, practiceScore, postTestScore].some(value => value !== null)
    || recentAttempts.some(attempt => attempt.scorePercentage !== null)
    || Object.values(metrics(summary.threeCBreakdown)).some(value => value !== null)
    || Object.values(assessments).some(session => Object.values(session.metrics).some(value => value !== null)
      || session.questions.some(question => Object.values(question.metrics).some(value => value !== null)));
  const snapshot = {
    fetchedAt: now.toISOString(), hasAssessmentData,
    role: role?.id ?? null, roleLabel: role?.label ?? null,
    difficulty: ["easy", "medium", "hard"].includes(summary.difficulty) ? summary.difficulty : null,
    unlockedDifficulty: ["easy", "medium", "hard"].includes(summary.unlockedDifficulty) ? summary.unlockedDifficulty : null,
    focusArea: text(summary.focusArea, 40),
    preTestScore, practiceScore, postTestScore,
    threeCs: metrics(summary.threeCBreakdown),
    threeCsSource: "Starting assessment; Set 1 averages are the legacy fallback when baseline dimensions are unavailable.",
    weakestMetric: ["clarity", "correctness", "completeness"].includes(summary.threeCBreakdown?.lowestMetric)
      ? summary.threeCBreakdown.lowestMetric : null,
    savedPracticeAttempts: recentAttempts.length,
    nextStage: ["likert-pre", "mic-test", "pretest", "mainsets", "posttest", "likert-post", "complete"].includes(active.nextStage)
      ? active.nextStage : null,
    activeSet: number(active.activeSet, 3), answersCount: number(active.answersCount, 5),
    hasResumableSession: active.hasResumableSession === true,
  };
  return {
    snapshot,
    context: {
      ...snapshot, metricScale: "Interview dimensions are out of 5; overall scores are percentages. Null means not assessed, not zero.",
      confidence: { before: number(summary.preConfidenceScore, 25), after: number(summary.postConfidenceScore, 25),
        scale: "Raw total of five 1–5 confidence survey answers, out of 25; distinct from interview assessment metrics." },
      practice: {
        source: ["latest-completed-attempt", "current-sets"].includes(summary.practiceProgress?.source) ? summary.practiceProgress.source : null,
        role: catalogue.some(item => item.id === summary.practiceProgress?.role) ? summary.practiceProgress.role : null,
        difficulty: ["easy", "medium", "hard"].includes(summary.practiceProgress?.difficulty) ? summary.practiceProgress.difficulty : null,
        attemptNumber: number(summary.practiceProgress?.attemptNumber, Number.MAX_SAFE_INTEGER),
        completedSets: number(summary.practiceProgress?.completedSetCount, 3),
        advancementEligible: summary.unlocked === true,
        unlockThresholdPercentage: number(summary.unlockThreshold),
        scoringNote: "Displayed percentages may be rounded. advancementEligible comes from the application's unrounded calculation; use that flag rather than recomputing eligibility from the displayed score.",
      },
      baselineWeakness: text(summary.preWeaknessTag, 60), finalWeakness: text(summary.postWeaknessTag, 60),
      star: metrics(summary.starBreakdown), assessments, recentAttempts,
      scope: "Only this account's saved assessments and up to 20 retained practice attempts. Unsaved activity is unavailable. Current-set question feedback may differ from the archived attempt shown on the dashboard; keep their sources distinct.",
    },
  };
}

async function loadCoachProgress(uid) {
  if (typeof uid !== "string" || !uid) throw new Error("Authenticated user required");
  const [summary, active] = await Promise.all([
    getResultsSummary(uid, { persistUnlock: false }), getActivePracticeSession(uid),
  ]);
  return buildCoachProgress(summary, active);
}

module.exports = { loadCoachProgress, buildCoachProgress };

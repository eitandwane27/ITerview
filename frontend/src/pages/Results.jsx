// frontend/src/pages/Results.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  TrendingUp,
  Award,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Home,
  RotateCcw,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  MessageSquare,
  Compass,
  FileText,
  Target,
  Code,
  Users,
} from 'lucide-react';
import logoSrc from '../assets/logo';
import TestWorkspace from '../components/TestWorkspace';
import {
  averageThreeCs,
  getPracticeFocus,
  getScoreComparison,
  isValidScore,
  lowestThreeC,
  PRACTICE_FOCUS,
} from '../utils/assessmentGuidance';
import './Results.css';

const SCORE_MAX = 5;
const PERCENT_MAX = 100;
const CONFIDENCE_ITEM_COUNT = 5;

function isScoreOutOfFive(value) {
  return isValidScore(value) && value >= 1 && value <= SCORE_MAX;
}

function percentageToScoreOutOfFive(value) {
  if (!isValidScore(value) || value < 0 || value > PERCENT_MAX) return null;
  return Math.round((value / 20) * 10) / 10;
}

function confidenceTotalToMean(value) {
  const minimumTotal = CONFIDENCE_ITEM_COUNT;
  const maximumTotal = CONFIDENCE_ITEM_COUNT * SCORE_MAX;
  if (!isValidScore(value) || value < minimumTotal || value > maximumTotal) return null;
  return Math.round((value / CONFIDENCE_ITEM_COUNT) * 10) / 10;
}

function scoreWidth(value) {
  return isScoreOutOfFive(value) ? `${(value / SCORE_MAX) * 100}%` : '0%';
}

function isPercentage(value) {
  return isValidScore(value) && value >= 0 && value <= PERCENT_MAX;
}

function formatScore(value) {
  if (!isValidScore(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(Number.isInteger(rounded * 10) ? 1 : 2);
}

function formatDifficulty(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// ── Motion-safe count-up hook ─────────────────────────────────────────────
function useCountUp(target, duration = 1200, decimals = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;

    let start = null;
    const step = (ts) => {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        setValue(decimals ? +target.toFixed(decimals) : Math.round(target));
        return;
      }
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const current = eased * target;
      setValue(decimals ? +current.toFixed(decimals) : Math.round(current));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, decimals]);

  return value;
}

// ── Realistic Mock Dataset for Visual Verification & Dev ───────────────────
const MOCK_RESULTS_DATA = {
  preConfidenceScore: 14,
  postConfidenceScore: 21,
  masteryScore: 84,
  preTestScore: 62,
  improvementDelta: 22,
  unlocked: true,
  targetDifficulty: 'medium',
  nextDifficulty: 'hard',
  unlockThreshold: 70,
  threeCBreakdown: {
    clarity: 4.2,
    correctness: 4.5,
    completeness: 3.8,
    averageOutOf5: 4.2,
    averagePercentage: 84.0,
    lowestMetric: 'completeness',
  },
  sessionAverages: {
    preTest: { scorePercentage: 62.0, label: 'Pre-Test Diagnostic' },
    set1: { scoreOutOf5: 4.0, scorePercentage: 80.0, label: 'Set 1: Personalized' },
    set2: { scoreOutOf5: 4.3, scorePercentage: 86.0, label: 'Set 2: Technical' },
    set3: { scoreOutOf5: 4.1, scorePercentage: 82.0, label: 'Set 3: Behavioral STAR' },
    postTest: { scorePercentage: 84.0, label: 'Post-Test Graduation' },
    practiceSetsAverage: { scoreOutOf5: 4.1, scorePercentage: 82.0 },
    overallJourneyAveragePercentage: 76.0,
  },
  setScores: {
    set1: { label: 'Set 1: Personalized Foundation', score: 4.0, outOf: 5, completed: true },
    set2: { label: 'Set 2: Technical Deep Dive', score: 4.3, outOf: 5, completed: true },
    set3: { label: 'Set 3: Behavioral STAR Storytelling', score: 4.1, outOf: 5, completed: true },
  },
  starBreakdown: {
    situation: 4.3,
    action: 4.5,
    result: 3.9,
  },
  questionBreakdowns: {
    preTest: {
      sessionLabel: 'Pre-Test Diagnostic Interview',
      sessionAveragePercentage: 62.0,
      questions: [
        {
          questionNumber: 1,
          question:
            'Can you explain the difference between synchronous and asynchronous execution in Node.js?',
          transcript:
            'Synchronous execution blocks the event loop while asynchronous operations run non-blockingly using callbacks or promises.',
          metrics: { clarity: 3.5, correctness: 4.0, completeness: 3.0 },
          questionAverage: 3.5,
          questionPercentage: 70.0,
          tip: 'Elaborate on how the Node.js libuv thread pool executes I/O operations behind the scenes.',
        },
      ],
    },
    set1: {
      sessionLabel: 'Practice Set 1: Personalized 3C Focus',
      sessionAveragePercentage: 80.0,
      questions: [
        {
          questionNumber: 1,
          question:
            'How do you structure database schemas in MongoDB to avoid performance bottlenecks with large collections?',
          transcript:
            'I usually design schemas around query access patterns. I index high-frequency search fields and embed related data when documents stay under 16MB.',
          metrics: { clarity: 4.0, correctness: 4.2, completeness: 3.8 },
          questionAverage: 4.0,
          questionPercentage: 80.0,
          tip: 'Great explanation of indexing. Mention compound indexes and sparse index trade-offs to show advanced mastery.',
        },
      ],
    },
    set2: {
      sessionLabel: 'Practice Set 2: Technical Problem Solving',
      sessionAveragePercentage: 86.0,
      questions: [
        {
          questionNumber: 1,
          question:
            'Walk me through how React virtual DOM diffing algorithm reconciles state updates in a high-traffic dashboard.',
          transcript:
            'React creates a tree of elements in memory. When state updates, it compares previous and new virtual DOM trees using heuristic O(n) diffing, batching DOM operations.',
          metrics: { problemSolving: 4.5, accuracy: 4.4, depth: 4.0 },
          questionAverage: 4.3,
          questionPercentage: 86.0,
          tip: 'Clear conceptual explanation. You can also mention key prop importance and how Fiber enables concurrent rendering.',
        },
      ],
    },
    set3: {
      sessionLabel: 'Practice Set 3: Behavioral STAR Storytelling',
      sessionAveragePercentage: 82.0,
      questions: [
        {
          questionNumber: 1,
          question:
            'Describe a situation where you encountered an unexpected API failure right before a sprint demo.',
          transcript:
            'Our authentication gateway began returning 504 gateway timeouts. I isolated the connection pool bottleneck, implemented exponential retry, and restored stability 15 minutes before the demo.',
          metrics: { situation: 4.2, action: 4.5, result: 3.9 },
          questionAverage: 4.2,
          questionPercentage: 84.0,
          tip: 'Strong narrative structure. Quantify the final impact more specifically, like team feedback or user latency metrics.',
        },
      ],
    },
    postTest: {
      sessionLabel: 'Post-Test Graduation Challenge',
      sessionAveragePercentage: 84.0,
      questions: [
        {
          questionNumber: 1,
          question:
            'How would you architect a distributed caching layer using Redis for a microservices cluster?',
          transcript:
            'I implement a Cache-Aside pattern with TTL expiration. Reads check Redis first; on miss, the service queries MongoDB and populates Redis. For writes, we invalidate cache keys to prevent stale reads.',
          metrics: { clarity: 4.5, correctness: 4.6, completeness: 4.1 },
          questionAverage: 4.4,
          questionPercentage: 88.0,
          tip: 'Exceptional architectural response with clear system boundaries and resilience awareness.',
        },
      ],
    },
  },
};

export default function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('postTest');
  const [openQuestions, setOpenQuestions] = useState({ 0: true });

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isPracticeMode = query.get('mode') === 'practice';
  const isMockMode = query.get('mock') === 'true';

  // Fetch results summary
  useEffect(() => {
    // If mock mode is explicitly requested, bypass auth and load mock data
    if (isMockMode) {
      setData(MOCK_RESULTS_DATA);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Fallback for development if no session is active
        if (import.meta.env.DEV) {
          console.info(
            'Development environment detected without active user. Serving mock result data for visual review.'
          );
          setData(MOCK_RESULTS_DATA);
          setLoading(false);
          return;
        }
        navigate('/login');
        return;
      }

      try {
        const endpoint = `/api/users/results-summary?uid=${user.uid}${isPracticeMode ? '&mode=practice' : ''}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to load results summary.');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Error loading results:', err);
        setError(
          'Unable to retrieve interview results. Please ensure you have completed the prerequisite sessions.'
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, isPracticeMode, isMockMode]);

  // Derived telemetry calculations
  const preConf = confidenceTotalToMean(data?.preConfidenceScore);
  const postConf = confidenceTotalToMean(data?.postConfidenceScore);
  const preTestScore = percentageToScoreOutOfFive(data?.preTestScore);
  const postTestScore = percentageToScoreOutOfFive(data?.masteryScore);
  const confidenceComparison = getScoreComparison(preConf, postConf);
  const comparison = getScoreComparison(preTestScore, postTestScore);

  const animDelta = useCountUp(confidenceComparison?.delta, 1500, 1);
  const animPre = useCountUp(preConf, 1200, 1);
  const animPost = useCountUp(postConf, 1200, 1);

  const practiceAverageScore = isScoreOutOfFive(
    data?.sessionAverages?.practiceSetsAverage?.scoreOutOf5
  )
    ? data.sessionAverages.practiceSetsAverage.scoreOutOf5
    : percentageToScoreOutOfFive(data?.sessionAverages?.practiceSetsAverage?.scorePercentage);
  const displayScore = isPracticeMode ? practiceAverageScore : postTestScore;
  const animMastery = useCountUp(displayScore, 1400, 1);

  const unlockTargetScore = isPercentage(data?.unlockThreshold) ? data.unlockThreshold / 20 : null;
  const currentDifficulty = formatDifficulty(data?.targetDifficulty);
  const nextDifficulty = formatDifficulty(data?.nextDifficulty);
  const hasNextDifficulty = Boolean(
    currentDifficulty &&
    nextDifficulty &&
    currentDifficulty.toLowerCase() !== nextDifficulty.toLowerCase()
  );
  const currentCompletedPracticeSetCount = ['set1', 'set2', 'set3'].filter(
    (setKey) => data?.setScores?.[setKey]?.completed === true
  ).length;
  const savedCompletedPracticeSetCount = data?.practiceProgress?.completedSetCount;
  const completedPracticeSetCount = Number.isInteger(savedCompletedPracticeSetCount)
    ? Math.min(3, Math.max(0, savedCompletedPracticeSetCount))
    : currentCompletedPracticeSetCount;
  const hasCompletedAllPracticeSets =
    data?.practiceProgress?.completedAllSets === true || completedPracticeSetCount === 3;
  const isShowingSavedPracticeAttempt =
    data?.practiceProgress?.source === 'latest-completed-attempt';
  const practiceProgressDescription = isShowingSavedPracticeAttempt
    ? `Latest saved completed session${data?.practiceProgress?.attemptNumber ? ` · Attempt ${data.practiceProgress.attemptNumber}` : ''}`
    : hasCompletedAllPracticeSets
      ? 'Final average across all three practice sets'
      : `Current average across ${completedPracticeSetCount} of 3 completed sets`;
  const hasPracticeAverage = isScoreOutOfFive(practiceAverageScore);
  const practiceAverageMet =
    hasCompletedAllPracticeSets &&
    hasPracticeAverage &&
    unlockTargetScore &&
    practiceAverageScore >= unlockTargetScore;
  const practicePointsNeeded =
    hasPracticeAverage && unlockTargetScore
      ? Math.max(0, unlockTargetScore - practiceAverageScore)
      : null;
  const isNextDifficultyUnlocked = hasNextDifficulty && data?.unlocked === true;

  const startingThreeCs = averageThreeCs(data?.questionBreakdowns?.preTest?.questions);
  const progressThreeCs = averageThreeCs(data?.questionBreakdowns?.postTest?.questions);
  const displayedThreeCs = isPracticeMode ? data?.threeCBreakdown || {} : progressThreeCs;
  const clarityScore = displayedThreeCs.clarity ?? null;
  const correctnessScore = displayedThreeCs.correctness ?? null;
  const completenessScore = displayedThreeCs.completeness ?? null;
  const focusKey = lowestThreeC(displayedThreeCs);
  const nextFocus = getPracticeFocus(focusKey || data?.postWeaknessTag);
  const dimensionChanges = Object.keys(PRACTICE_FOCUS)
    .filter((key) => isValidScore(startingThreeCs[key]) && isValidScore(progressThreeCs[key]))
    .map((key) => ({
      key,
      delta: Math.round((progressThreeCs[key] - startingThreeCs[key]) * 10) / 10,
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  const animClarity = useCountUp(
    isScoreOutOfFive(clarityScore) ? (clarityScore / 5) * 100 : 0,
    1100
  );
  const animCorrectness = useCountUp(
    isScoreOutOfFive(correctnessScore) ? (correctnessScore / 5) * 100 : 0,
    1100
  );
  const animCompleteness = useCountUp(
    isScoreOutOfFive(completenessScore) ? (completenessScore / 5) * 100 : 0,
    1100
  );

  const toggleQuestion = (idx) => {
    setOpenQuestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // ── Loading Skeleton Screen ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rs-root">
        <header className="rs-topbar">
          <div className="rs-topbar-inner">
            <div className="rs-topbar-left">
              <div className="rs-topbar-brand">
                <img src={logoSrc} alt="ITerview Logo" className="rs-topbar-logo" />
                <span>ITerview</span>
              </div>
            </div>
            <div className="rs-topbar-right">
              <span className="rs-topbar-mode-badge">Compiling Telemetry...</span>
            </div>
          </div>
        </header>

        <main className="rs-main">
          <div className="rs-skeleton-header" />
          <div className="rs-skeleton-subtitle" />
          <div className="rs-hero-grid">
            <div className="rs-skeleton-card">
              <div className="rs-skeleton-block" style={{ width: '40%', height: '24px' }} />
              <div
                className="rs-skeleton-block"
                style={{ width: '60%', height: '70px', margin: 'auto' }}
              />
              <div className="rs-skeleton-block" style={{ width: '100%', height: '40px' }} />
            </div>
            <div className="rs-skeleton-card">
              <div className="rs-skeleton-block" style={{ width: '40%', height: '24px' }} />
              <div
                className="rs-skeleton-block"
                style={{ width: '60%', height: '70px', margin: 'auto' }}
              />
              <div className="rs-skeleton-block" style={{ width: '100%', height: '40px' }} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Error Screen ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="rs-root">
        <header className="rs-topbar">
          <div className="rs-topbar-inner">
            <div className="rs-topbar-left">
              <div className="rs-topbar-brand">
                <img src={logoSrc} alt="ITerview Logo" className="rs-topbar-logo" />
                <span>ITerview</span>
              </div>
            </div>
          </div>
        </header>

        <main className="rs-main">
          <div className="rs-card rs-error-card">
            <div className="rs-error-icon-box">
              <AlertTriangle size={32} />
            </div>
            <h2 className="rs-error-title">Could Not Retrieve Session Summary</h2>
            <p className="rs-error-desc">
              {error ||
                'Make sure you complete both the pre-test baseline, practice sets, and post-test graduation sessions.'}
            </p>
            <button
              className="rs-btn-primary"
              onClick={() => navigate('/dashboard')}
              style={{ marginTop: '8px' }}
            >
              <Home size={18} />
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const activeQuestions = data.questionBreakdowns?.[activeTab]?.questions || [];
  const activeSessionLabel =
    {
      preTest: 'Starting check (pre-test)',
      postTest: 'Progress check (post-test)',
      set1: 'Practice set 1',
      set2: 'Practice set 2',
      set3: 'Practice set 3',
    }[activeTab] || 'Session questions';

  // A direct report URL follows the same reflection-before-results sequence.
  if (!isPracticeMode && isValidScore(data.masteryScore) && data.postConfidenceScore == null) {
    return <Navigate to="/likert-post" replace />;
  }
  if (!isPracticeMode && !isValidScore(data.masteryScore)) {
    if (!isValidScore(data.preTestScore)) return <Navigate to="/dashboard" replace />;
    return (
      <TestWorkspace
        variant="pre"
        isSessionComplete
        result={{
          score: data.preTestScore,
          weakness: data.preWeaknessTag || data.threeCBreakdown?.lowestMetric,
        }}
        onExit={() => navigate('/dashboard')}
        onContinue={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <div className="rs-root">
      {/* ── Sticky Top Navigation ────────────────────────────────────────── */}
      <header className="rs-topbar">
        <div className="rs-topbar-inner">
          <div className="rs-topbar-left">
            <div className="rs-topbar-brand">
              <img src={logoSrc} alt="ITerview Logo" className="rs-topbar-logo" />
              <span>ITerview</span>
            </div>
            <span
              className={`rs-topbar-mode-badge ${
                isPracticeMode ? 'rs-topbar-mode-badge--practice' : ''
              }`}
            >
              {isPracticeMode ? 'Practice Session Summary' : 'Session Results & Graduation'}
            </span>
          </div>

          <div className="rs-topbar-right">
            <button
              className="rs-topbar-return-btn"
              onClick={() => navigate('/dashboard')}
              title="Return to Dashboard"
            >
              <Home size={15} />
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* ── Level Unlocked Celebration Banner ────────────────────────────── */}
      {isNextDifficultyUnlocked && (
        <aside className="rs-unlock-banner" role="status" aria-live="polite">
          <div className="rs-unlock-banner-content">
            <div className="rs-unlock-banner-main">
              <div className="rs-unlock-banner-icon-wrap">
                <Award size={24} />
              </div>
              <div>
                <h3 className="rs-unlock-banner-title">Milestone Level Unlocked!</h3>
                <p className="rs-unlock-banner-desc">
                  You met the {formatScore(unlockTargetScore)} / 5.0 benchmark. You have officially
                  unlocked <strong>{nextDifficulty}</strong> difficulty.
                </p>
              </div>
            </div>
            <div className="rs-unlock-pill">
              <Sparkles size={14} />
              {nextDifficulty} Tier Ready
            </div>
          </div>
        </aside>
      )}

      {/* ── Main Scroll Viewport ─────────────────────────────────────────── */}
      <main className="rs-main">
        {/* Page Greeting */}
        <section className="rs-header-section">
          <h1 className="rs-page-title">
            {isPracticeMode ? 'Your practice results' : 'Your starting and progress checks'}
          </h1>
          <p className="rs-page-subtitle">
            {isPracticeMode
              ? 'Review your answers and choose what to practise next.'
              : 'Compare your five starting answers with your five answers after practice.'}
          </p>
        </section>

        {!isPracticeMode && (
          <section
            className="rs-card rs-assessment-summary"
            aria-label="What changed and what comes next"
          >
            <h2 className="rs-card-title">{comparison?.heading || 'Your results are ready'}</h2>
            <p>
              {comparison?.description ||
                'Your comparison will appear when both assessment scores are available.'}
            </p>
            {dimensionChanges[0] && (
              <p>
                {PRACTICE_FOCUS[dimensionChanges[0].key].label}:{' '}
                {startingThreeCs[dimensionChanges[0].key]} →{' '}
                {progressThreeCs[dimensionChanges[0].key]} / 5.{' '}
                {dimensionChanges[0].delta === 0
                  ? 'This dimension stayed the same.'
                  : 'This was your largest change across the three dimensions.'}
              </p>
            )}
            <p>
              <strong>Next practice: </strong>
              {nextFocus?.next ||
                'Review an answer and practise a clearer, more complete explanation.'}
            </p>
            <p className="rs-assessment-note">
              These scores describe your answers to this assessment.
            </p>
            <button type="button" className="rs-btn-primary" onClick={() => navigate('/dashboard')}>
              Continue practice <ArrowRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {/* ─── 1. Hero Dual Telemetry Stage (50/50 Split) ──────────────────── */}
        <section className="rs-hero-grid" aria-label="Performance Highlights">
          {/* Mastery Score Card */}
          <article className="rs-card rs-mastery-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--mint">
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">
                    {isPracticeMode ? 'Practice score' : 'Progress-check score'}
                  </h2>
                  <p className="rs-card-subtitle">
                    {isPracticeMode
                      ? 'Your completed practice sets'
                      : 'Your five answers after practice'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rs-mastery-display">
              <div className="rs-mastery-metric">
                <span className="rs-mastery-value">
                  {isScoreOutOfFive(displayScore) ? animMastery : 'Unavailable'}
                </span>
                {isScoreOutOfFive(displayScore) && <span className="rs-mastery-denom">/5.0</span>}
              </div>
              <p className="rs-mastery-caption">
                {isPracticeMode
                  ? 'Average across your practice sets'
                  : 'Progress check (post-test)'}
              </p>
            </div>

            {!isPracticeMode && (
              <div className="rs-progression-row">
                <div className="rs-progression-item">
                  <span className="rs-progression-label">Starting check</span>
                  <span className="rs-progression-score">
                    {isScoreOutOfFive(preTestScore)
                      ? `${preTestScore.toFixed(1)} / 5.0`
                      : 'Unavailable'}
                  </span>
                </div>

                <div className="rs-stage-arrow">
                  <ArrowRight size={18} />
                </div>

                <div className="rs-progression-item">
                  <span className="rs-progression-label">Progress check</span>
                  <span
                    className="rs-progression-score"
                    style={{ color: 'var(--rs-correctness-ink)' }}
                  >
                    {isScoreOutOfFive(postTestScore)
                      ? `${postTestScore.toFixed(1)} / 5.0`
                      : 'Unavailable'}
                  </span>
                </div>

                {comparison && (
                  <div
                    className={`rs-progression-delta-tag ${
                      comparison.delta > 0
                        ? 'rs-progression-delta-tag--positive'
                        : comparison.delta < 0
                          ? 'rs-progression-delta-tag--negative'
                          : 'rs-progression-delta-tag--neutral'
                    }`}
                  >
                    {comparison.label}
                  </div>
                )}
              </div>
            )}
          </article>

          {/* Confidence Growth Card */}
          <article className="rs-card rs-confidence-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--blue">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">How your confidence changed</h2>
                  <p className="rs-card-subtitle">Your own ratings before and after practice</p>
                </div>
              </div>
            </div>

            <div className="rs-delta-display">
              <div className="rs-delta-metric">
                <span
                  className={`rs-delta-value${!confidenceComparison ? ' rs-delta-value--unavailable' : ''}`}
                >
                  {confidenceComparison
                    ? `${confidenceComparison.delta > 0 ? '+' : ''}${animDelta}`
                    : 'Unavailable'}
                </span>
                {confidenceComparison && <span className="rs-delta-unit">on the 1–5 scale</span>}
              </div>
              <p className="rs-delta-caption">Change in your average confidence rating</p>
            </div>

            <div className="rs-comparison-track">
              <div className="rs-stage-pill">
                <span className="rs-stage-label">Before practice</span>
                <span className="rs-stage-value">
                  {isScoreOutOfFive(preConf) ? `${animPre.toFixed(1)} / 5.0` : 'Unavailable'}
                </span>
              </div>
              <div className="rs-stage-arrow">
                <ArrowRight size={18} />
              </div>
              <div className="rs-stage-pill">
                <span className="rs-stage-label">After practice</span>
                <span className="rs-stage-value rs-stage-value--highlight">
                  {isScoreOutOfFive(postConf) ? `${animPost.toFixed(1)} / 5.0` : 'Unavailable'}
                </span>
              </div>
            </div>
          </article>
        </section>

        {hasNextDifficulty && unlockTargetScore && (
          <section
            className={`rs-card rs-difficulty-card${
              isNextDifficultyUnlocked ? ' rs-difficulty-card--unlocked' : ''
            }`}
            aria-labelledby="rs-difficulty-title"
          >
            <div className="rs-difficulty-header">
              <div className="rs-difficulty-heading">
                <div className="rs-card-icon-badge rs-card-icon-badge--blue">
                  <Target size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="rs-card-title" id="rs-difficulty-title">
                    {isNextDifficultyUnlocked
                      ? `${nextDifficulty} difficulty unlocked`
                      : `Unlock ${nextDifficulty} difficulty`}
                  </h2>
                  <p className="rs-card-subtitle">
                    Complete Sets 1–3 with a combined average of {formatScore(unlockTargetScore)} /
                    5.0 or higher.
                  </p>
                </div>
              </div>

              <div className="rs-difficulty-route-wrap">
                <div
                  className="rs-difficulty-route"
                  aria-label={`${currentDifficulty} to ${nextDifficulty} difficulty`}
                >
                  <span className="rs-difficulty-tier">{currentDifficulty}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                  <span className="rs-difficulty-tier rs-difficulty-tier--next">
                    {nextDifficulty}
                  </span>
                </div>
                <span
                  className={`rs-difficulty-state ${
                    isNextDifficultyUnlocked
                      ? 'rs-difficulty-state--unlocked'
                      : 'rs-difficulty-state--pending'
                  }`}
                >
                  {isNextDifficultyUnlocked ? (
                    <>
                      <CheckCircle2 size={14} aria-hidden="true" /> Unlocked
                    </>
                  ) : (
                    <>
                      <Clock size={14} aria-hidden="true" />{' '}
                      {!hasCompletedAllPracticeSets
                        ? `${completedPracticeSetCount} of 3 sets complete`
                        : practicePointsNeeded !== null
                          ? `${formatScore(practicePointsNeeded)} ${practicePointsNeeded === 1 ? 'point' : 'points'} needed`
                          : 'Complete Sets 1–3'}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="rs-difficulty-requirement">
              <div className="rs-difficulty-requirement-header">
                <div>
                  <h3>Sets 1–3 combined average</h3>
                  <p>{practiceProgressDescription}</p>
                </div>
                <span className="rs-difficulty-score">
                  {hasPracticeAverage
                    ? `${formatScore(practiceAverageScore)} / 5.0`
                    : 'Not available'}
                </span>
              </div>

              <div
                className="rs-difficulty-track"
                {...(hasPracticeAverage
                  ? {
                      role: 'progressbar',
                      'aria-label': 'Sets 1–3 combined average progress',
                      'aria-valuemin': 0,
                      'aria-valuemax': SCORE_MAX,
                      'aria-valuenow': practiceAverageScore,
                      'aria-valuetext': `${formatScore(practiceAverageScore)} out of 5; target ${formatScore(unlockTargetScore)} out of 5`,
                    }
                  : {})}
              >
                <span
                  className={`rs-difficulty-fill${
                    practiceAverageMet ? ' rs-difficulty-fill--met' : ''
                  }`}
                  style={{ width: scoreWidth(practiceAverageScore) }}
                  aria-hidden="true"
                />
                <span
                  className="rs-difficulty-target-marker"
                  style={{ left: `${(unlockTargetScore / SCORE_MAX) * 100}%` }}
                  aria-hidden="true"
                />
              </div>

              <div className="rs-difficulty-requirement-footer">
                <span>Target: {formatScore(unlockTargetScore)} / 5.0</span>
                <span
                  className={`rs-difficulty-gap${
                    practiceAverageMet ? ' rs-difficulty-gap--met' : ''
                  }`}
                >
                  {practiceAverageMet ? (
                    <>
                      <CheckCircle2 size={14} aria-hidden="true" /> Threshold reached
                    </>
                  ) : !hasCompletedAllPracticeSets ? (
                    `Complete all three sets (${completedPracticeSetCount}/3 complete)`
                  ) : practicePointsNeeded !== null ? (
                    <>
                      <Clock size={14} aria-hidden="true" /> {formatScore(practicePointsNeeded)}{' '}
                      {practicePointsNeeded === 1 ? 'point' : 'points'} needed
                    </>
                  ) : (
                    'Complete Sets 1–3'
                  )}
                </span>
              </div>
            </div>

            <p className="rs-difficulty-note">
              {isShowingSavedPracticeAttempt
                ? 'This score was restored from your completed practice history. Focus drills do not change difficulty progress.'
                : 'Only this combined practice average unlocks the next difficulty. Your progress-check score does not affect advancement.'}
            </p>
          </section>
        )}

        {/* ─── 2. The 3C Rubric Diagnostic Breakdown ───────────────────────── */}
        <section className="rs-card rs-rubric-card" aria-label="3C Rubric Diagnostic Breakdown">
          <div className="rs-card-header">
            <div className="rs-card-header-left">
              <div className="rs-card-icon-badge rs-card-icon-badge--cyan">
                <Compass size={20} />
              </div>
              <div>
                <h2 className="rs-card-title">What makes a strong answer</h2>
                <p className="rs-card-subtitle">
                  {isPracticeMode
                    ? 'Your practice feedback across three dimensions'
                    : 'Your progress-check answers across three dimensions'}
                </p>
              </div>
            </div>
          </div>

          <div className="rs-rubric-grid">
            {/* Clarity */}
            <div className="rs-rubric-box rs-rubric-box--clarity">
              <div className="rs-rubric-top">
                <div className="rs-rubric-dimension">
                  <span className="rs-rubric-indicator-dot rs-rubric-indicator-dot--clarity" />
                  Clarity
                </div>
                {focusKey === 'clarity' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--clarity">
                  {isScoreOutOfFive(clarityScore) ? clarityScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">Was your explanation easy to follow?</p>
              <div className="rs-progress-track">
                <div
                  className="rs-progress-bar rs-progress-bar--clarity"
                  style={{ width: `${animClarity}%` }}
                />
              </div>
            </div>

            {/* Correctness */}
            <div className="rs-rubric-box rs-rubric-box--correctness">
              <div className="rs-rubric-top">
                <div className="rs-rubric-dimension">
                  <span className="rs-rubric-indicator-dot rs-rubric-indicator-dot--correctness" />
                  Correctness
                </div>
                {focusKey === 'correctness' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--correctness">
                  {isScoreOutOfFive(correctnessScore) ? correctnessScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">Was the information accurate?</p>
              <div className="rs-progress-track">
                <div
                  className="rs-progress-bar rs-progress-bar--correctness"
                  style={{ width: `${animCorrectness}%` }}
                />
              </div>
            </div>

            {/* Completeness */}
            <div className="rs-rubric-box rs-rubric-box--completeness">
              <div className="rs-rubric-top">
                <div className="rs-rubric-dimension">
                  <span className="rs-rubric-indicator-dot rs-rubric-indicator-dot--completeness" />
                  Completeness
                </div>
                {focusKey === 'completeness' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--completeness">
                  {isScoreOutOfFive(completenessScore) ? completenessScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">Did you cover the important parts?</p>
              <div className="rs-progress-track">
                <div
                  className="rs-progress-bar rs-progress-bar--completeness"
                  style={{ width: `${animCompleteness}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. Practice Sets Breakdown & STAR Behavioral Analysis ───────── */}
        <section className="rs-mid-grid">
          {/* Sets Breakdown */}
          <article className="rs-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--blue">
                  <Target size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">Practice Progression</h2>
                  <p className="rs-card-subtitle">Session scores across calibrated stages</p>
                </div>
              </div>
            </div>

            <div className="rs-sets-list">
              {/* Set 1 */}
              <div
                className={`rs-set-item ${
                  data.setScores?.set1?.completed ? '' : 'rs-set-item--incomplete'
                }`}
              >
                <div className="rs-set-item-left">
                  <div className="rs-set-icon-box">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="rs-set-title">Set 1: Personalized Foundation</h3>
                    <p className="rs-set-meta">Tailored 3C focus calibration</p>
                  </div>
                </div>
                <div className="rs-set-score-box">
                  <span className="rs-set-score-text">
                    {isScoreOutOfFive(data.setScores?.set1?.score)
                      ? `${data.setScores.set1.score.toFixed(1)} / 5.0`
                      : 'Pending'}
                  </span>
                  <span
                    className={`rs-set-status-pill ${
                      data.setScores?.set1?.completed
                        ? 'rs-set-status-pill--completed'
                        : 'rs-set-status-pill--pending'
                    }`}
                  >
                    {data.setScores?.set1?.completed ? (
                      <>
                        <CheckCircle2 size={11} /> Completed
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> Pending
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Set 2 */}
              <div
                className={`rs-set-item ${
                  data.setScores?.set2?.completed ? '' : 'rs-set-item--incomplete'
                }`}
              >
                <div className="rs-set-item-left">
                  <div className="rs-set-icon-box rs-set-icon-box--2">
                    <Code size={18} />
                  </div>
                  <div>
                    <h3 className="rs-set-title">Set 2: Technical Deep Dive</h3>
                    <p className="rs-set-meta">Problem solving, accuracy, depth</p>
                  </div>
                </div>
                <div className="rs-set-score-box">
                  <span className="rs-set-score-text">
                    {isScoreOutOfFive(data.setScores?.set2?.score)
                      ? `${data.setScores.set2.score.toFixed(1)} / 5.0`
                      : 'Pending'}
                  </span>
                  <span
                    className={`rs-set-status-pill ${
                      data.setScores?.set2?.completed
                        ? 'rs-set-status-pill--completed'
                        : 'rs-set-status-pill--pending'
                    }`}
                  >
                    {data.setScores?.set2?.completed ? (
                      <>
                        <CheckCircle2 size={11} /> Completed
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> Pending
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Set 3 */}
              <div
                className={`rs-set-item ${
                  data.setScores?.set3?.completed ? '' : 'rs-set-item--incomplete'
                }`}
              >
                <div className="rs-set-item-left">
                  <div className="rs-set-icon-box rs-set-icon-box--3">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="rs-set-title">Set 3: Behavioral STAR</h3>
                    <p className="rs-set-meta">Structured engineering storytelling</p>
                  </div>
                </div>
                <div className="rs-set-score-box">
                  <span className="rs-set-score-text">
                    {isScoreOutOfFive(data.setScores?.set3?.score)
                      ? `${data.setScores.set3.score.toFixed(1)} / 5.0`
                      : 'Pending'}
                  </span>
                  <span
                    className={`rs-set-status-pill ${
                      data.setScores?.set3?.completed
                        ? 'rs-set-status-pill--completed'
                        : 'rs-set-status-pill--pending'
                    }`}
                  >
                    {data.setScores?.set3?.completed ? (
                      <>
                        <CheckCircle2 size={11} /> Completed
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> Pending
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* STAR Behavioral Breakdown */}
          <article className="rs-card rs-star-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--amber">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">Set 3: STAR Dimensions</h2>
                  <p className="rs-card-subtitle">Behavioral storytelling criteria (1–5 scale)</p>
                </div>
              </div>
            </div>

            <div className="rs-star-bars">
              {/* Situation & Task */}
              <div className="rs-star-row">
                <div className="rs-star-row-header">
                  <div className="rs-star-label-group">
                    <span className="rs-star-tag">Situation & Task</span>
                    <span className="rs-star-sublabel">(Context)</span>
                  </div>
                  <span className="rs-star-value">
                    {isScoreOutOfFive(data.starBreakdown?.situation)
                      ? `${data.starBreakdown.situation.toFixed(1)} / 5.0`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--situation"
                    style={{
                      width: scoreWidth(data.starBreakdown?.situation),
                    }}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="rs-star-row">
                <div className="rs-star-row-header">
                  <div className="rs-star-label-group">
                    <span className="rs-star-tag">Action Taken</span>
                    <span className="rs-star-sublabel">(Strategy)</span>
                  </div>
                  <span className="rs-star-value">
                    {isScoreOutOfFive(data.starBreakdown?.action)
                      ? `${data.starBreakdown.action.toFixed(1)} / 5.0`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--action"
                    style={{
                      width: scoreWidth(data.starBreakdown?.action),
                    }}
                  />
                </div>
              </div>

              {/* Result */}
              <div className="rs-star-row">
                <div className="rs-star-row-header">
                  <div className="rs-star-label-group">
                    <span className="rs-star-tag">Result & Impact</span>
                    <span className="rs-star-sublabel">(Outcomes)</span>
                  </div>
                  <span className="rs-star-value">
                    {isScoreOutOfFive(data.starBreakdown?.result)
                      ? `${data.starBreakdown.result.toFixed(1)} / 5.0`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--result"
                    style={{
                      width: scoreWidth(data.starBreakdown?.result),
                    }}
                  />
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ─── 4. Question-by-Question Coaching Insights Drawer ───────────── */}
        {data.questionBreakdowns && (
          <section
            className="rs-card rs-questions-card"
            aria-label="Question by Question Breakdown"
          >
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--blue">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">Question by Question Coaching</h2>
                  <p className="rs-card-subtitle">
                    {activeSessionLabel} (Transcripts, rubric metrics, and personalized mentor tips)
                  </p>
                </div>
              </div>
            </div>

            {/* Session Tabs */}
            <div className="rs-session-tabs" role="tablist">
              {['preTest', 'set1', 'set2', 'set3', 'postTest'].map((tabKey) => {
                const sessionInfo = data.questionBreakdowns[tabKey];
                if (!sessionInfo || !sessionInfo.questions || sessionInfo.questions.length === 0) {
                  return null;
                }
                const labelMap = {
                  preTest: 'Starting check',
                  set1: 'Set 1',
                  set2: 'Set 2',
                  set3: 'Set 3',
                  postTest: 'Progress check',
                };
                return (
                  <button
                    key={tabKey}
                    role="tab"
                    aria-selected={activeTab === tabKey}
                    className={`rs-session-tab ${
                      activeTab === tabKey ? 'rs-session-tab--active' : ''
                    }`}
                    onClick={() => {
                      setActiveTab(tabKey);
                      setOpenQuestions({ 0: true });
                    }}
                  >
                    {labelMap[tabKey] || tabKey}
                  </button>
                );
              })}
            </div>

            {/* Questions List */}
            <div className="rs-questions-list">
              {activeQuestions.length === 0 ? (
                <p style={{ color: 'var(--rs-ink-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                  No question transcripts recorded for this stage.
                </p>
              ) : (
                activeQuestions.map((q, idx) => {
                  const isOpen = !!openQuestions[idx];
                  return (
                    <div
                      key={idx}
                      className={`rs-question-item ${isOpen ? 'rs-question-item--open' : ''}`}
                    >
                      <div
                        className="rs-question-header"
                        onClick={() => toggleQuestion(idx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleQuestion(idx);
                          }
                        }}
                      >
                        <div className="rs-question-header-left">
                          <span className="rs-qnum-badge">Q{q.questionNumber || idx + 1}</span>
                          <h4 className="rs-question-text">{q.question}</h4>
                        </div>
                        <div className="rs-question-header-right">
                          {isScoreOutOfFive(q.questionAverage) && (
                            <span className="rs-qscore-badge">
                              {q.questionAverage.toFixed(1)} / 5.0
                            </span>
                          )}
                          <div
                            className={`rs-question-chevron ${
                              isOpen ? 'rs-question-chevron--rotated' : ''
                            }`}
                          >
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="rs-question-body">
                          {/* User Transcript */}
                          {q.transcript && (
                            <div className="rs-transcript-box">
                              <div className="rs-transcript-header">
                                <MessageSquare size={13} />
                                Candidate Verbal Answer
                              </div>
                              <p className="rs-transcript-content">"{q.transcript}"</p>
                            </div>
                          )}

                          {/* Rubric Dimension Chips */}
                          {q.metrics && (
                            <div className="rs-metrics-chips">
                              {Object.entries(q.metrics).map(([mKey, mVal]) => {
                                if (!isScoreOutOfFive(mVal)) return null;
                                const niceLabel =
                                  mKey === 'problemSolving'
                                    ? 'Problem Solving'
                                    : mKey.charAt(0).toUpperCase() + mKey.slice(1);
                                return (
                                  <div key={mKey} className="rs-metric-chip">
                                    <span>{niceLabel}:</span>
                                    <span className="rs-metric-chip-value">
                                      {typeof mVal === 'number' ? mVal.toFixed(1) : mVal} / 5
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Coach Tip */}
                          {q.tip && (
                            <div className="rs-tip-box">
                              <Lightbulb size={18} className="rs-tip-icon" />
                              <p className="rs-tip-text">
                                <strong>Mentor Feedback:</strong> {q.tip}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ─── 5. Tactile CTAs ─────────────────────────────────────────────── */}
        <div className="rs-cta-group">
          {data.unlocked ? (
            <button
              id="btn-try-next-difficulty"
              className="rs-btn-primary"
              onClick={() => navigate('/dashboard')}
            >
              <Sparkles size={18} />
              Try {data.nextDifficulty} Difficulty
            </button>
          ) : (
            <button
              id="btn-continue-session"
              className="rs-btn-primary"
              onClick={() =>
                navigate(isPracticeMode ? '/interview?set=1&mode=practice' : '/dashboard')
              }
            >
              <RotateCcw size={18} />
              {isPracticeMode ? 'Continue Practice Session' : 'Return to Dashboard'}
            </button>
          )}

          <button
            id="btn-back-dashboard"
            className="rs-btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            <Home size={18} />
            Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}

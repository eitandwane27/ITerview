// frontend/src/pages/Results.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import './Results.css';

// ── Motion-safe count-up hook ─────────────────────────────────────────────
function useCountUp(target, duration = 1200, decimals = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;

    let start = null;
    const step = (ts) => {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    situation: 8.5,
    action: 9.0,
    result: 7.8,
  },
  questionBreakdowns: {
    preTest: {
      sessionLabel: 'Pre-Test Diagnostic Interview',
      sessionAveragePercentage: 62.0,
      questions: [
        {
          questionNumber: 1,
          question: 'Can you explain the difference between synchronous and asynchronous execution in Node.js?',
          transcript: 'Synchronous execution blocks the event loop while asynchronous operations run non-blockingly using callbacks or promises.',
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
          question: 'How do you structure database schemas in MongoDB to avoid performance bottlenecks with large collections?',
          transcript: 'I usually design schemas around query access patterns. I index high-frequency search fields and embed related data when documents stay under 16MB.',
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
          question: 'Walk me through how React virtual DOM diffing algorithm reconciles state updates in a high-traffic dashboard.',
          transcript: 'React creates a tree of elements in memory. When state updates, it compares previous and new virtual DOM trees using heuristic O(n) diffing, batching DOM operations.',
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
          question: 'Describe a situation where you encountered an unexpected API failure right before a sprint demo.',
          transcript: 'Our authentication gateway began returning 504 gateway timeouts. I isolated the connection pool bottleneck, implemented exponential retry, and restored stability 15 minutes before the demo.',
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
          question: 'How would you architect a distributed caching layer using Redis for a microservices cluster?',
          transcript: 'I implement a Cache-Aside pattern with TTL expiration. Reads check Redis first; on miss, the service queries MongoDB and populates Redis. For writes, we invalidate cache keys to prevent stale reads.',
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
          console.info('Development environment detected without active user. Serving mock result data for visual review.');
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
        setError('Unable to retrieve interview results. Please ensure you have completed the prerequisite sessions.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, isPracticeMode, isMockMode]);

  // Derived telemetry calculations
  const preConf = data?.preConfidenceScore ?? 0;
  const postConf = data?.postConfidenceScore ?? 0;
  const deltaRaw = postConf - preConf;
  const deltaPct = data ? Math.round((deltaRaw / 25) * 100) : 0;
  const prePct = data ? Math.round((preConf / 25) * 100) : 0;
  const postPct = data ? Math.round((postConf / 25) * 100) : 0;

  const animDelta = useCountUp(deltaPct, 1500);
  const animPre = useCountUp(prePct, 1200);
  const animPost = useCountUp(postPct, 1200);

  const displayScore = isPracticeMode
    ? (data?.sessionAverages?.practiceSetsAverage?.scorePercentage ?? null)
    : (data?.masteryScore ?? null);
  const animMastery = useCountUp(displayScore, 1400);

  const clarityScore = data?.threeCBreakdown?.clarity ?? null;
  const correctnessScore = data?.threeCBreakdown?.correctness ?? null;
  const completenessScore = data?.threeCBreakdown?.completeness ?? null;

  const animClarity = useCountUp(clarityScore ? (clarityScore / 5) * 100 : 0, 1100);
  const animCorrectness = useCountUp(correctnessScore ? (correctnessScore / 5) * 100 : 0, 1100);
  const animCompleteness = useCountUp(completenessScore ? (completenessScore / 5) * 100 : 0, 1100);

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
              <div className="rs-skeleton-block" style={{ width: '60%', height: '70px', margin: 'auto' }} />
              <div className="rs-skeleton-block" style={{ width: '100%', height: '40px' }} />
            </div>
            <div className="rs-skeleton-card">
              <div className="rs-skeleton-block" style={{ width: '40%', height: '24px' }} />
              <div className="rs-skeleton-block" style={{ width: '60%', height: '70px', margin: 'auto' }} />
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
              {error || 'Make sure you complete both the pre-test baseline, practice sets, and post-test graduation sessions.'}
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
  const activeSessionLabel = data.questionBreakdowns?.[activeTab]?.sessionLabel || 'Session Questions';

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
      {data.unlocked && (
        <aside className="rs-unlock-banner" role="status" aria-live="polite">
          <div className="rs-unlock-banner-content">
            <div className="rs-unlock-banner-main">
              <div className="rs-unlock-banner-icon-wrap">
                <Award size={24} />
              </div>
              <div>
                <h3 className="rs-unlock-banner-title">Milestone Level Unlocked!</h3>
                <p className="rs-unlock-banner-desc">
                  You surpassed the {data.unlockThreshold}% benchmark threshold. You have officially unlocked{' '}
                  <strong>{data.nextDifficulty}</strong> difficulty.
                </p>
              </div>
            </div>
            <div className="rs-unlock-pill">
              <Sparkles size={14} />
              {data.nextDifficulty} Tier Ready
            </div>
          </div>
        </aside>
      )}

      {/* ── Main Scroll Viewport ─────────────────────────────────────────── */}
      <main className="rs-main">
        {/* Page Greeting */}
        <section className="rs-header-section">
          <h1 className="rs-page-title">
            {isPracticeMode ? 'Practice Performance Analysis' : 'Interview Diagnostic Summary'}
          </h1>
          <p className="rs-page-subtitle">
            Comprehensive breakdown of your technical communication, structured answers, and verbal confidence growth.
          </p>
        </section>

        {/* ─── 1. Hero Dual Telemetry Stage (50/50 Split) ──────────────────── */}
        <section className="rs-hero-grid" aria-label="Performance Highlights">
          {/* Confidence Growth Card */}
          <article className="rs-card rs-confidence-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--blue">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">Confidence Growth</h2>
                  <p className="rs-card-subtitle">Self-efficacy Likert telemetry delta</p>
                </div>
              </div>
            </div>

            <div className="rs-delta-display">
              <div className="rs-delta-metric">
                <span className="rs-delta-sign">{deltaPct >= 0 ? '+' : ''}</span>
                <span className="rs-delta-value">{animDelta}</span>
                <span className="rs-delta-unit">%</span>
              </div>
              <p className="rs-delta-caption">Improvement between Pre-Test and Post-Test</p>
            </div>

            <div className="rs-comparison-track">
              <div className="rs-stage-pill">
                <span className="rs-stage-label">Pre-Test</span>
                <span className="rs-stage-value">{animPre}%</span>
              </div>
              <div className="rs-stage-arrow">
                <ArrowRight size={18} />
              </div>
              <div className="rs-stage-pill">
                <span className="rs-stage-label">Post-Test</span>
                <span className="rs-stage-value rs-stage-value--highlight">{animPost}%</span>
              </div>
            </div>
          </article>

          {/* Mastery Score Card */}
          <article className="rs-card rs-mastery-card">
            <div className="rs-card-header">
              <div className="rs-card-header-left">
                <div className="rs-card-icon-badge rs-card-icon-badge--mint">
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="rs-card-title">
                    {isPracticeMode ? 'Practice Mastery Score' : 'Graduation Mastery Score'}
                  </h2>
                  <p className="rs-card-subtitle">Overall evaluated technical competence</p>
                </div>
              </div>
            </div>

            <div className="rs-mastery-display">
              <div className="rs-mastery-metric">
                <span className="rs-mastery-value">
                  {animMastery !== null ? animMastery : 'N/A'}
                </span>
                <span className="rs-mastery-denom">/100</span>
              </div>
              <p className="rs-mastery-caption">
                {isPracticeMode ? 'Practice sets combined benchmark' : 'Post-Test graduation evaluation'}
              </p>
            </div>

            {!isPracticeMode && (
              <div className="rs-progression-row">
                <div className="rs-progression-item">
                  <span className="rs-progression-label">Baseline Pre-Test</span>
                  <span className="rs-progression-score">
                    {data.preTestScore !== null ? `${data.preTestScore}%` : 'N/A'}
                  </span>
                </div>

                <div className="rs-stage-arrow">
                  <ArrowRight size={18} />
                </div>

                <div className="rs-progression-item">
                  <span className="rs-progression-label">Graduation Post-Test</span>
                  <span className="rs-progression-score" style={{ color: 'var(--rs-correctness)' }}>
                    {data.masteryScore !== null ? `${data.masteryScore}%` : 'N/A'}
                  </span>
                </div>

                {data.improvementDelta !== null && (
                  <div
                    className={`rs-progression-delta-tag ${
                      data.improvementDelta >= 0
                        ? 'rs-progression-delta-tag--positive'
                        : 'rs-progression-delta-tag--negative'
                    }`}
                  >
                    {data.improvementDelta >= 0 ? '+' : ''}
                    {data.improvementDelta}%
                  </div>
                )}
              </div>
            )}
          </article>
        </section>

        {/* ─── 2. The 3C Rubric Diagnostic Breakdown ───────────────────────── */}
        <section className="rs-card rs-rubric-card" aria-label="3C Rubric Diagnostic Breakdown">
          <div className="rs-card-header">
            <div className="rs-card-header-left">
              <div className="rs-card-icon-badge rs-card-icon-badge--cyan">
                <Compass size={20} />
              </div>
              <div>
                <h2 className="rs-card-title">The 3C Rubric Diagnostic</h2>
                <p className="rs-card-subtitle">
                  Core speech evaluation framework: Clarity (Sky Blue), Correctness (Cool Mint), Completeness (Golden Amber)
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
                {data.threeCBreakdown?.lowestMetric === 'clarity' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--clarity">
                  {clarityScore !== null ? clarityScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">
                Pacing, articulate enunciation, structural coherence, and minimal filler words.
              </p>
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
                {data.threeCBreakdown?.lowestMetric === 'correctness' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--correctness">
                  {correctnessScore !== null ? correctnessScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">
                Technical accuracy, valid concepts, proper terminology, and sound algorithmic reasoning.
              </p>
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
                {data.threeCBreakdown?.lowestMetric === 'completeness' && (
                  <span className="rs-rubric-focus-badge">Focus Area</span>
                )}
              </div>
              <div className="rs-rubric-score-row">
                <span className="rs-rubric-num rs-rubric-num--completeness">
                  {completenessScore !== null ? completenessScore.toFixed(1) : 'N/A'}
                </span>
                <span className="rs-rubric-denom">/5.0</span>
              </div>
              <p className="rs-rubric-desc">
                Depth of explanation, coverage of edge cases, architectural trade-offs, and examples.
              </p>
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
                    {data.setScores?.set1?.score !== null
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
                    {data.setScores?.set2?.score !== null
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
                    {data.setScores?.set3?.score !== null
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
                  <p className="rs-card-subtitle">Behavioral storytelling criteria (0-10 scale)</p>
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
                    {data.starBreakdown?.situation !== null
                      ? `${data.starBreakdown.situation.toFixed(1)} / 10`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--situation"
                    style={{
                      width: `${
                        data.starBreakdown?.situation !== null
                          ? (data.starBreakdown.situation / 10) * 100
                          : 0
                      }%`,
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
                    {data.starBreakdown?.action !== null
                      ? `${data.starBreakdown.action.toFixed(1)} / 10`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--action"
                    style={{
                      width: `${
                        data.starBreakdown?.action !== null
                          ? (data.starBreakdown.action / 10) * 100
                          : 0
                      }%`,
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
                    {data.starBreakdown?.result !== null
                      ? `${data.starBreakdown.result.toFixed(1)} / 10`
                      : 'Not assessed'}
                  </span>
                </div>
                <div className="rs-star-track">
                  <div
                    className="rs-star-fill rs-star-fill--result"
                    style={{
                      width: `${
                        data.starBreakdown?.result !== null
                          ? (data.starBreakdown.result / 10) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ─── 4. Question-by-Question Coaching Insights Drawer ───────────── */}
        {data.questionBreakdowns && (
          <section className="rs-card rs-questions-card" aria-label="Question by Question Breakdown">
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
                  preTest: 'Pre-Test',
                  set1: 'Set 1',
                  set2: 'Set 2',
                  set3: 'Set 3',
                  postTest: 'Post-Test',
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
                          {q.questionAverage !== null && (
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
                                if (mVal === null || mVal === undefined) return null;
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

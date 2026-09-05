import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  LogOut,
  Lock,
  Mic,
  History,
  Gauge,
  Briefcase,
  Sparkles,
  ChevronDown,
  Play,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Target,
  PackageCheck,
  RotateCcw,
  AlertCircle,
  Star,
  Settings,
  Code,
  Users,
  Video,
  Coffee,
} from 'lucide-react';
import { signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import SetBriefingOverlay from '../components/SetBriefingOverlay';
import logoSrc from '../assets/logo';
import './Dashboard.css';

// ─── Data ────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: '', label: 'Select a role...' },
  { value: 'frontend', label: 'Frontend Developer' },
  { value: 'backend', label: 'Backend Developer' },
  { value: 'fullstack', label: 'Fullstack Developer' },
];

const FOCUS_OPTIONS = [
  {
    value: 'auto',
    label: 'Auto-Detect (AI-Recommended)',
    desc: 'AI targets your lowest scoring 3C metric from previous baseline diagnostic',
  },
  {
    value: 'clarity',
    label: 'Clarity',
    desc: 'Focuses on speech pacing, clarity, and structural coherence',
  },
  {
    value: 'correctness',
    label: 'Correctness',
    desc: 'Focuses on accuracy, concepts, and technical depth',
  },
  {
    value: 'completeness',
    label: 'Completeness',
    desc: 'Focuses on detailed answers and comprehensive coverage',
  },
  {
    value: 'star',
    label: 'STAR Behavioral',
    desc: 'Focuses on structured behavioral storytelling',
  },
];

const NAV_TABS = ['Interview Prep', 'My Progress', 'History'];

const TAB_ICONS = {
  'Interview Prep': Mic,
  'My Progress': TrendingUp,
  History: History,
};

// "Choose your practice" grid. `tint` is tied to the session type the card
// triggers, `preset` is forwarded to handleStartSession on launch, only
// role/focus/difficulty, the axes the launch flow actually honors. Resume
// lives in the banner, not in this grid, so the grid never reflows with
// session state.
const PRACTICE_CARDS = [
  {
    id: 'warmup',
    title: 'Warm-up Question',
    desc: 'A quick question to get your brain in interview mode.',
    tint: 'amber',
    preset: { difficulty: 'easy' },
  },
  {
    id: 'frontend',
    title: 'Frontend Practice',
    desc: 'Practice real frontend interview questions.',
    tint: 'mint',
    preset: { role: 'frontend' },
  },
  {
    id: 'behavioral',
    title: 'Behavioral Round',
    desc: 'Strengthen your stories and communicate with impact.',
    tint: 'lavender',
    preset: { focus: 'star' },
  },
  {
    id: 'clarity',
    title: 'Clarity Drill',
    desc: 'Practice structuring your thoughts clearly and concisely.',
    tint: 'cyan',
    preset: { focus: 'clarity' },
  },
  {
    id: 'mock',
    title: 'Mock Interview',
    desc: 'A mixed round that simulates the real interview flow.',
    tint: 'blue',
    preset: {},
  },
];

// Fox Coach sidebar card, XP values are a static template until the XP /
// leveling system exists; swap them for real user data then.
const COACH = { level: 3, xp: 340, xpGoal: 600 };

// Session facts, mirror the backend set contract: every practice set is exactly
// 5 questions (generated upfront in set1/2/3Socket; the resume banner shows
// "Q{n}/5"). The rolling history cap is enforced server-side with $push + $slice: -20
// (backend/routes/userRoutes.js and backend/controllers/set3Socket.js).
const QUESTIONS_PER_SESSION = 5;
const PRACTICE_HISTORY_LIMIT = 20;
// How many history rows render before the "Show older sessions" toggle.
const HISTORY_VISIBLE_COUNT = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Live clock, isolated behind memo so its 1s tick never re-renders the
// Dashboard tree, the interval's state lives in this component only.
const LiveClock = memo(function LiveClock() {
  const time = useClock();
  return (
    <time className="db-clock" aria-label="Current time">
      {time}
    </time>
  );
});

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Map a stored role value ('frontend') to its display label
// ('Frontend Developer'); falls back to a capitalized raw value.
function formatRoleLabel(value) {
  if (!value) return 'Developer';
  const match = ROLE_OPTIONS.find((o) => o.value === value);
  return match ? match.label : value.charAt(0).toUpperCase() + value.slice(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const BaselineCard = memo(function BaselineCard({
  baseline,
  mastery,
  growth,
  clarity,
  correctness,
  completeness,
  lowest,
  onViewDetails,
}) {
  return (
    <section className="db-baseline-card">
      <div className="db-baseline-card__header">
        <div className="db-baseline-card__text">
          <h2 className="db-baseline-card__title">Your progress at a glance</h2>
          <p className="db-baseline-card__sub">
            Baseline from your pre-test. Every session builds on this start line.
          </p>
        </div>
        <button type="button" className="db-view-link db-view-link--pill" onClick={onViewDetails}>
          View details <ArrowRight size={14} />
        </button>
      </div>

      <div className="db-baseline-card__body">
        {/* Baseline → Mastery journey */}
        <div className="db-progression">
          <div className="db-progression__label">Your journey so far</div>
          <div className="db-progression__scores">
            <div className="db-progression__baseline">
              {baseline != null ? `${baseline}%` : '—'}
            </div>
            <ArrowRight size={18} className="db-progression__arrow" aria-hidden="true" />
            <div className="db-progression__mastery">{mastery != null ? `${mastery}%` : '—'}</div>
          </div>
          {growth != null && (
            <div className="db-delta-pill">
              <TrendingUp size={12} className="db-delta-pill__icon" aria-hidden="true" />
              <div className="db-delta-pill__text">
                {growth >= 0 ? '+' : ''}
                {growth}% growth
              </div>
            </div>
          )}
        </div>

        {/* 3C Grid */}
        <div className="db-3c-grid">
          <div
            className={`db-3c-cell db-3c-cell--clarity ${lowest === 'clarity' ? 'db-3c-cell--lowest' : ''}`}
          >
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <MessageSquare size={13} className="db-3c-cell__icon db-3c-cell__icon--clarity" />
                <span className="db-3c-cell__name db-3c-cell__name--clarity">Clarity</span>
              </span>
              {lowest === 'clarity' && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--clarity">
              {clarity != null ? `${clarity} / 5` : '—'}
            </div>
          </div>

          <div
            className={`db-3c-cell db-3c-cell--correctness ${lowest === 'correctness' ? 'db-3c-cell--lowest' : ''}`}
          >
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <Target size={13} className="db-3c-cell__icon db-3c-cell__icon--correctness" />
                <span className="db-3c-cell__name">Correctness</span>
              </span>
              {lowest === 'correctness' && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--correctness">
              {correctness != null ? `${correctness} / 5` : '—'}
            </div>
          </div>

          <div
            className={`db-3c-cell db-3c-cell--completeness ${lowest === 'completeness' ? 'db-3c-cell--lowest' : ''}`}
          >
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <PackageCheck
                  size={13}
                  className="db-3c-cell__icon db-3c-cell__icon--completeness"
                />
                <span className="db-3c-cell__name">Completeness</span>
              </span>
              {lowest === 'completeness' && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--completeness">
              {completeness != null ? `${completeness} / 5` : '—'}
            </div>
          </div>
        </div>

        <p className="db-3c-grid__foot">
          Each dimension is scored out of 5. Your overall progress is shown as a percentage.
        </p>
      </div>
    </section>
  );
});

// ─── Empty state for My Progress when baseline is not yet calibrated ─────────
const ProgressEmptyState = memo(function ProgressEmptyState({
  selectedRole,
  onSelectRole,
  roleOptions,
  onStartPretest,
  onSwitchTab,
}) {
  return (
    <div className="db-progress-empty-deck">
      {/* ── Hero Calibration Card ── */}
      <section className="db-progress-empty-hero" aria-labelledby="db-progress-empty-title">
        <div className="db-progress-empty-hero__content">
          <div className="db-progress-empty-hero__badge">
            <span className="db-pulse-dot" aria-hidden="true" />
            <span>Baseline Diagnostic Required</span>
          </div>

          <h2 id="db-progress-empty-title" className="db-progress-empty-hero__title">
            Establish your diagnostic baseline
          </h2>

          <p className="db-progress-empty-hero__sub">
            Your 5-minute kickoff pre-test calibrates your starting benchmark across all three
            core evaluation pillars: <strong>Clarity</strong>, <strong>Correctness</strong>, and{' '}
            <strong>Completeness</strong>. Once completed, your progress trajectory, difficulty
            tiers, and AI-targeted practice drills unlock right here.
          </p>

          <div className="db-progress-empty-hero__controls">
            <div className="db-select-wrap db-progress-empty-hero__select">
              <Briefcase
                size={17}
                className="db-select-wrap__icon db-select-wrap__icon--violet"
              />
              <select
                id="progress-role-select"
                className="db-select"
                aria-label="Target role for pre-test"
                value={selectedRole}
                onChange={(e) => onSelectRole?.(e.target.value)}
              >
                {(roleOptions || ROLE_OPTIONS).map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === ''}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} className="db-select-wrap__chevron" />
            </div>

            <button
              type="button"
              className="db-cta-btn db-progress-empty-hero__cta"
              onClick={onStartPretest}
              disabled={!selectedRole}
            >
              <Play size={16} aria-hidden="true" />
              Take the pre-test
            </button>

            <button
              type="button"
              className="db-btn-secondary db-progress-empty-hero__tab-link"
              onClick={() => onSwitchTab?.('Interview Prep')}
            >
              Go to Interview Prep
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>

          {!selectedRole && (
            <p className="db-cta-helper">Select a target role above to begin your diagnostic.</p>
          )}

          <div className="db-progress-empty-hero__pills">
            <span className="db-micro-pill">
              <Sparkles size={12} className="db-micro-pill__icon" />
              Takes ~5 minutes
            </span>
            <span className="db-micro-pill">
              <Gauge size={12} className="db-micro-pill__icon" />
              Calibrates adaptive difficulty
            </span>
            <span className="db-micro-pill">
              <TrendingUp size={12} className="db-micro-pill__icon" />
              Sets your starting line
            </span>
          </div>
        </div>

        <div className="db-progress-empty-hero__art" aria-hidden="true">
          <div className="db-diagnostic-radar">
            <div className="db-radar-circle db-radar-circle--outer" />
            <div className="db-radar-circle db-radar-circle--mid" />
            <div className="db-radar-circle db-radar-circle--inner" />
            <div className="db-radar-core">
              <Gauge size={30} strokeWidth={2.2} />
            </div>
            <div className="db-radar-chip db-radar-chip--clarity">
              <MessageSquare size={12} />
              <span>Clarity</span>
            </div>
            <div className="db-radar-chip db-radar-chip--correctness">
              <Target size={12} />
              <span>Correctness</span>
            </div>
            <div className="db-radar-chip db-radar-chip--completeness">
              <PackageCheck size={12} />
              <span>Completeness</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3C Blueprint Preview Grid ── */}
      <section className="db-progress-3c-preview" aria-labelledby="db-3c-preview-heading">
        <div className="db-progress-section-header">
          <div>
            <h3 id="db-3c-preview-heading" className="db-progress-section-title">
              The 3C Evaluation Model
            </h3>
            <p className="db-progress-section-sub">
              Every practice answer is scored out of 5 across three key dimensions.
            </p>
          </div>
          <span className="db-blueprint-badge">Blueprint Preview</span>
        </div>

        <div className="db-3c-grid">
          {/* Clarity */}
          <div className="db-3c-cell db-3c-cell--clarity db-3c-cell--preview">
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <MessageSquare size={14} className="db-3c-cell__icon db-3c-cell__icon--clarity" />
                <span className="db-3c-cell__name db-3c-cell__name--clarity">Clarity</span>
              </span>
              <span className="db-blueprint-tag">Calibrates in pre-test</span>
            </div>
            <p className="db-3c-cell__preview-desc">
              Speech pacing, structure, conciseness, and articulation of technical concepts.
            </p>
            <div className="db-3c-cell__preview-target">
              <span className="db-preview-label">Starting score</span>
              <span className="db-preview-score">Pending</span>
            </div>
          </div>

          {/* Correctness */}
          <div className="db-3c-cell db-3c-cell--correctness db-3c-cell--preview">
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <Target size={14} className="db-3c-cell__icon db-3c-cell__icon--correctness" />
                <span className="db-3c-cell__name">Correctness</span>
              </span>
              <span className="db-blueprint-tag">Calibrates in pre-test</span>
            </div>
            <p className="db-3c-cell__preview-desc">
              Technical depth, accurate syntax, proper terminology, and foundational concepts.
            </p>
            <div className="db-3c-cell__preview-target">
              <span className="db-preview-label">Starting score</span>
              <span className="db-preview-score">Pending</span>
            </div>
          </div>

          {/* Completeness */}
          <div className="db-3c-cell db-3c-cell--completeness db-3c-cell--preview">
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <PackageCheck
                  size={14}
                  className="db-3c-cell__icon db-3c-cell__icon--completeness"
                />
                <span className="db-3c-cell__name">Completeness</span>
              </span>
              <span className="db-blueprint-tag">Calibrates in pre-test</span>
            </div>
            <p className="db-3c-cell__preview-desc">
              Edge-case handling, real-world trade-offs, practical examples, and depth of coverage.
            </p>
            <div className="db-3c-cell__preview-target">
              <span className="db-preview-label">Starting score</span>
              <span className="db-preview-score">Pending</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Progression Roadmap ── */}
      <section className="db-progress-roadmap" aria-labelledby="db-roadmap-heading">
        <div className="db-progress-section-header">
          <div>
            <h3 id="db-roadmap-heading" className="db-progress-section-title">
              Your Analytics Journey
            </h3>
            <p className="db-progress-section-sub">
              How ITerview tracks and accelerates your interview readiness.
            </p>
          </div>
        </div>

        <div className="db-roadmap-grid">
          <div className="db-roadmap-step db-roadmap-step--active">
            <div className="db-roadmap-step__number">01</div>
            <div className="db-roadmap-step__body">
              <div className="db-roadmap-step__status-row">
                <h4 className="db-roadmap-step__title">Kickoff Diagnostic</h4>
                <span className="db-step-badge db-step-badge--active">Current Step</span>
              </div>
              <p className="db-roadmap-step__desc">
                Take the 5-question pre-test to generate your baseline score and uncover your
                growth targets.
              </p>
            </div>
          </div>

          <div className="db-roadmap-step">
            <div className="db-roadmap-step__number">02</div>
            <div className="db-roadmap-step__body">
              <div className="db-roadmap-step__status-row">
                <h4 className="db-roadmap-step__title">AI-Targeted Practice</h4>
                <span className="db-step-badge">Next Step</span>
              </div>
              <p className="db-roadmap-step__desc">
                Sessions automatically adapt to strengthen your lowest scoring 3C metric and weak
                topics.
              </p>
            </div>
          </div>

          <div className="db-roadmap-step">
            <div className="db-roadmap-step__number">03</div>
            <div className="db-roadmap-step__body">
              <div className="db-roadmap-step__status-row">
                <h4 className="db-roadmap-step__title">Mastery Trajectory</h4>
                <span className="db-step-badge">Outcome</span>
              </div>
              <p className="db-roadmap-step__desc">
                Track score improvements, monitor rolling 20-session history, and unlock higher
                difficulty tiers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Blueprint Ghost Stats Strip ── */}
      <div className="db-stats-row db-stats-row--preview">
        <div className="db-stat-card db-stat-card--ghost">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--mint" aria-hidden="true" />
            3C Composite Average
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value db-stat-card__value--ghost">Awaiting Pre-test</span>
          </div>
        </div>

        <div className="db-stat-card db-stat-card--ghost">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--violet" aria-hidden="true" />
            Practice Sessions
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value db-stat-card__value--ghost">0</span>
            <span className="db-stat-card__meta">completed</span>
          </div>
        </div>

        <div className="db-stat-card db-stat-card--ghost">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--amber" aria-hidden="true" />
            AI Target Area
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value db-stat-card__value--topic db-stat-card__value--ghost">
              Auto-calibrating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Metrics state components (loading / error) ───────────────

const MetricsStates = memo(function MetricsStates({ dataStatus, onRetry }) {
  if (dataStatus === 'loading') {
    return (
      <div className="db-baseline-card db-baseline-card--loading" aria-hidden="true">
        <div className="db-skeleton db-skeleton--baseline-title" />
        <div className="db-skeleton db-skeleton--baseline-body" />
      </div>
    );
  }

  if (dataStatus === 'error') {
    return (
      <div className="db-baseline-card db-metrics-card db-metrics-card--error" role="alert">
        <div className="db-metrics-card__icon">
          <AlertCircle size={20} />
        </div>
        <div className="db-metrics-card__text">
          <h2 className="db-metrics-card__title">Couldn't load your dashboard</h2>
          <p className="db-metrics-card__sub">
            We couldn't fetch your session data. Check your connection and try again.
          </p>
        </div>
        <button type="button" className="db-btn-secondary" onClick={onRetry}>
          <RotateCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return null;
});

// One row in the practice log, memoized so the list never re-renders when
// unrelated dashboard state changes (attempt objects keep stable references).
const AttemptCard = memo(function AttemptCard({ attempt }) {
  return (
    <div className="db-attempt-card">
      <div className="db-attempt-card__left">
        <span className="db-attempt-badge">
          {attempt.attemptNumber != null ? `Attempt #${attempt.attemptNumber}` : 'Practice session'}
        </span>
        <div>
          <div className="db-attempt-card__title">
            <span>{formatRoleLabel(attempt.role)}</span>
            {' · '}
            {attempt.difficulty || 'Easy'}
            <span className="db-badge db-badge--purple">
              <Mic size={11} strokeWidth={2.2} />
              Focus: {attempt.focusArea || 'Auto'}
            </span>
          </div>
          <div className="db-attempt-card__meta">
            {attempt.completedAt
              ? new Date(attempt.completedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recently'}
          </div>
        </div>
      </div>
      <div className="db-attempt-card__right">
        {attempt.threeCBreakdown && (
          <div className="db-3c-mini">
            <span>
              Clarity: <strong>{attempt.threeCBreakdown.clarity ?? '—'}</strong>
            </span>
            <span>
              Correct: <strong>{attempt.threeCBreakdown.correctness ?? '—'}</strong>
            </span>
            <span>
              Complete: <strong>{attempt.threeCBreakdown.completeness ?? '—'}</strong>
            </span>
          </div>
        )}
        <span className="db-attempt-score">
          {attempt.overallScorePercentage !== null && attempt.overallScorePercentage !== undefined
            ? `${attempt.overallScorePercentage}%`
            : attempt.threeCBreakdown?.averageOutOf5
              ? `${(attempt.threeCBreakdown.averageOutOf5 * 20).toFixed(0)}%`
              : attempt.threeCBreakdown?.averageOutOf10
                ? `${(attempt.threeCBreakdown.averageOutOf10 * 10).toFixed(0)}%`
                : '—'}
        </span>
      </div>
    </div>
  );
});

// Practice history panel, memoized; re-renders only when its data changes.
const HistoryPanel = memo(function HistoryPanel({ dataStatus, practiceHistory }) {
  const [showAll, setShowAll] = useState(false);
  // Newest first, computed once per data change, not inline on every render.
  const history = useMemo(() => (practiceHistory || []).slice().reverse(), [practiceHistory]);
  const visibleHistory = showAll ? history : history.slice(0, HISTORY_VISIBLE_COUNT);
  const hiddenCount = history.length - HISTORY_VISIBLE_COUNT;

  return (
    <section className="db-setup-card db-history-card">
      <div className="db-setup-card__header">
        <div className="db-setup-card__text">
          <h2 className="db-setup-card__title">
            <History size={17} className="db-setup-card__title-icon" />
            Practice History & Session Logs
          </h2>
          <p className="db-setup-card__sub">
            Your past practice sessions, 3C breakdowns, and rolling history.
          </p>
        </div>
        <span className="db-history-badge">Max {PRACTICE_HISTORY_LIMIT} Rolling History</span>
      </div>

      {dataStatus === 'loading' ? (
        <div className="db-history-skeleton" aria-hidden="true">
          <div className="db-skeleton db-skeleton--history-row" />
          <div className="db-skeleton db-skeleton--history-row" />
        </div>
      ) : dataStatus === 'error' ? (
        <div className="db-empty">
          Couldn't load your practice history. Check your connection and try again.
        </div>
      ) : history.length > 0 ? (
        <div className="db-history-list">
          {visibleHistory.map((attempt, idx) => (
            <AttemptCard key={attempt._id || idx} attempt={attempt} />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="db-history-toggle"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? 'Show less'
                : `Show ${hiddenCount} older session${hiddenCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      ) : (
        <div className="db-empty">
          No practice attempts logged yet. Launch a practice session above to begin your rolling{' '}
          {PRACTICE_HISTORY_LIMIT}-session history!
        </div>
      )}
    </section>
  );
});

// ─── My Progress digest, the diagnostic baseline lives here now ────────────
// The launch surface stays single-task; review surfaces (this panel + History)
// own the numbers. Same dataStatus machine, same components, same world.

const ProgressPanel = memo(function ProgressPanel({
  dataStatus,
  onRetry,
  onViewReport,
  baseline,
  mastery,
  growth,
  clarity,
  correctness,
  completeness,
  average3C,
  lowestMetric,
  weakTopic,
  sessionsCount,
  selectedRole,
  onSelectRole,
  roleOptions,
  onStartPretest,
  onSwitchTab,
}) {
  if (dataStatus === 'loading' || dataStatus === 'error') {
    return <MetricsStates dataStatus={dataStatus} onRetry={onRetry} />;
  }

  if (dataStatus === 'empty' || baseline == null) {
    return (
      <ProgressEmptyState
        selectedRole={selectedRole}
        onSelectRole={onSelectRole}
        roleOptions={roleOptions}
        onStartPretest={onStartPretest}
        onSwitchTab={onSwitchTab}
      />
    );
  }

  return (
    <div className="db-progress-deck">
      {/* Journey hero, baseline → mastery + 3C grid (the digest centrepiece) */}
      <BaselineCard
        baseline={baseline}
        mastery={mastery}
        growth={growth}
        clarity={clarity}
        correctness={correctness}
        completeness={completeness}
        lowest={lowestMetric}
        onViewDetails={onViewReport}
      />

      {/* Supplementary summary, the numbers behind the journey */}
      <div className="db-stats-row">
        <div className="db-stat-card">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--mint" aria-hidden="true" />
            3C Average
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value">{average3C != null ? `${average3C}%` : '—'}</span>
            {/* Growth is shown once, in the BaselineCard delta pill above. */}
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--violet" aria-hidden="true" />
            Sessions
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value">{sessionsCount}</span>
            <span className="db-stat-card__meta">completed</span>
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-card__label">
            <span className="db-stat-dot db-stat-dot--amber" aria-hidden="true" />
            Weak topic
          </div>
          <div className="db-stat-card__value-row">
            <span className="db-stat-card__value db-stat-card__value--topic">
              {weakTopic ? weakTopic.charAt(0).toUpperCase() + weakTopic.slice(1) : '—'}
            </span>
            {weakTopic && <span className="db-stat-card__delta">AI targeted</span>}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Practice card ("Choose your practice" grid) ─────────────────────────────
// The whole card is the button, no hidden "+" affordance. The visible
// "Start" pill is decorative (aria-hidden); the button's accessible name
// comes from its text content (title + desc). Spans instead of divs/headings
// keep the button's content model valid (phrasing content only).

// Emblem icon per practice card, the same lucide set the filter chips use,
// so the grid reads as one system. When a real mascot asset for a card lands,
// drop an <img> inside the tile, the slot sizes it.
const CARD_ART_ICONS = {
  warmup: Coffee,
  frontend: Code,
  behavioral: Users,
  clarity: Sparkles,
  mock: Video,
};

const PracticeCard = memo(function PracticeCard({ card, onLaunch }) {
  const ArtIcon = CARD_ART_ICONS[card.id] || Sparkles;
  return (
    <button
      type="button"
      className={`db-practice-card db-practice-card--${card.tint}`}
      onClick={() => onLaunch(card)}
    >
      <span className="db-practice-card__media">
        {/* ══ CARD ART ══
            Finished in-system emblem: tinted icon tile on a soft disc with
            floating shapes + a dashed ground arc. When the real
            "{card.title}" mascot illustration is ready, replace <ArtIcon />
            with <img src={mascotAsset} alt="" />, the tile slot sizes it. */}
        <span className="db-practice-card__art" aria-hidden="true">
          <span className="db-art-shape db-art-shape--ring" />
          <span className="db-art-shape db-art-shape--dot-a" />
          <span className="db-art-shape db-art-shape--dot-b" />
          <span className="db-art-shape db-art-shape--plus" />
          <span className="db-art-tile">
            <ArtIcon size={30} strokeWidth={2.1} />
          </span>
          <span className="db-art-ground" />
        </span>
      </span>
      <span className="db-practice-card__body">
        <span className="db-practice-card__text">
          <span className="db-practice-card__title">{card.title}</span>
          <span className="db-practice-card__desc">{card.desc}</span>
        </span>
        <span className="db-practice-card__cta" aria-hidden="true">
          Start
          <ArrowRight size={14} />
        </span>
      </span>
    </button>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Interview Prep');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedFocus, setSelectedFocus] = useState('auto');
  const [userName, setUserName] = useState('U');
  const [fullName, setFullName] = useState('Alex');
  const [unlockedDifficulty, setUnlockedDifficulty] = useState('easy');
  const [hasCompletedDiagnostic, setHasCompletedDiagnostic] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [dataStatus, setDataStatus] = useState('loading'); // "loading" | "ready" | "empty" | "error"
  const [formError, setFormError] = useState(null);
  const [isConfirmFresh, setIsConfirmFresh] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [freshResetError, setFreshResetError] = useState(null);

  // Pre-Flight Mission Calibration modal state
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editFocus, setEditFocus] = useState('auto');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  // Profile dialog keyboard story: move focus into the dialog on open and
  // restore it to the avatar trigger when it closes (the Tab trap + Escape
  // handling live on the dialog node itself so they always see fresh state).
  const profileModalRef = useRef(null);
  const avatarBtnRef = useRef(null);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const modal = profileModalRef.current;
    const avatarBtn = avatarBtnRef.current;
    const firstFocusable = modal?.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable || modal)?.focus();
    return () => {
      avatarBtn?.focus();
    };
  }, [isProfileModalOpen]);

  // Fetch saved role + user display info + diagnostic summary on mount
  const fetchUserData = useCallback(async (user) => {
    if (!user) return;
    setDataStatus('loading');
    const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
    setUserName(initial);
    setFullName(user.displayName || (user.email ? user.email.split('@')[0] : 'User'));

    let userLoadOk = false;
    let summaryOk = false;
    let completedDiagnostic = false;
    let summaryData = null;

    try {
      const [res, summaryRes, activeRes] = await Promise.all([
        fetch(`/api/users/${user.uid}`),
        fetch(`/api/users/results-summary?uid=${user.uid}`),
        fetch(`/api/users/active-practice-session?uid=${user.uid}`),
      ]);

      if (res.ok) {
        userLoadOk = true;
        const data = await res.json();
        if (data.user?.role) setSelectedRole(data.user.role);
        if (data.user?.unlockedDifficulty) setUnlockedDifficulty(data.user.unlockedDifficulty);
        if (data.user?.focusArea) setSelectedFocus(data.user.focusArea);
        if (data.user?.displayName) setFullName(data.user.displayName);
        if (data.hasCompletedDiagnostic !== undefined) {
          completedDiagnostic = Boolean(data.hasCompletedDiagnostic);
          setHasCompletedDiagnostic(completedDiagnostic);
        }
      }

      if (summaryRes.ok) {
        summaryOk = true;
        summaryData = await summaryRes.json();
        setDiagnosticData(summaryData);
      }

      if (activeRes && activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveSession(activeData);
      }
    } catch (err) {
      console.error('Error fetching user details or summary:', err);
      setDataStatus('error');
      return;
    }

    if (!userLoadOk) {
      setDataStatus('error');
      return;
    }
    setDataStatus(completedDiagnostic ? (summaryOk && summaryData ? 'ready' : 'error') : 'empty');
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchUserData(auth.currentUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserData(user);
      }
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  const retryLoad = useCallback(() => {
    if (auth.currentUser) fetchUserData(auth.currentUser);
  }, [fetchUserData]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('/landing');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }, [navigate]);

  // Stable navigation callback so memoized children (BaselineCard) skip re-renders.
  const handleViewResults = useCallback(() => navigate('/results'), [navigate]);

  // Open profile modal, seed edit fields from current state
  const handleOpenProfileModal = useCallback(() => {
    setEditName(fullName);
    setEditRole(selectedRole);
    setEditFocus(selectedFocus);
    setProfileError(null);
    setIsProfileModalOpen(true);
  }, [fullName, selectedRole, selectedFocus]);

  const handleCloseProfileModal = useCallback(() => {
    if (isSavingProfile) return; // prevent close during save
    setIsProfileModalOpen(false);
    setProfileError(null);
  }, [isSavingProfile]);

  // Save profile: update Firebase Auth displayName + MongoDB via PUT /api/users/role
  const handleSaveProfile = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const trimmedName = editName.trim();
    setIsSavingProfile(true);
    setProfileError(null);

    try {
      // 1. Update Firebase Auth profile (displayName field)
      await updateProfile(firebaseUser, { displayName: trimmedName || null });

      // 2. Persist displayName + role + focusArea to MongoDB in one atomic call
      const res = await fetch('/api/users/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          displayName: trimmedName,
          role: editRole || selectedRole,
          focusArea: editFocus || selectedFocus,
        }),
      });

      if (!res.ok) throw new Error('Failed to save profile');

      // 3. Update local state immediately for a snappy UX
      const displayedName =
        trimmedName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
      setFullName(displayedName);
      setUserName(displayedName[0].toUpperCase());
      if (editRole) setSelectedRole(editRole);
      if (editFocus) setSelectedFocus(editFocus);

      setIsProfileModalOpen(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      setProfileError('Failed to save your profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  }, [editName, editRole, editFocus, selectedRole, selectedFocus]);

  // WAI-ARIA tabs pattern: arrow-key navigation across the tablist
  const handleTabKeyDown = useCallback(
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const currentIdx = NAV_TABS.indexOf(activeTab);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const nextTab = NAV_TABS[(currentIdx + dir + NAV_TABS.length) % NAV_TABS.length];
      setActiveTab(nextTab);
      document.getElementById(`tab-${nextTab.toLowerCase().replace(/ /g, '-')}`)?.focus();
    },
    [activeTab]
  );

  // Single source of truth for "a practice session is in flight", used by the
  // launch handler, the card guard, the config bar locks, and the banner.
  const isSessionActive = !!(activeSession?.hasActiveSession && hasCompletedDiagnostic);

  // `overrides` lets the practice cards preset role/focus/difficulty for this
  // launch (e.g. Clarity Drill → focus 'clarity') without racing React's async
  // state updates, the launch uses the resolved values directly.
  const handleStartSession = useCallback(
    async (overrides = {}) => {
      const role = overrides.role ?? selectedRole;
      const difficulty = overrides.difficulty ?? selectedDifficulty;
      const focus = overrides.focus ?? selectedFocus;

      if (!role) {
        setFormError('Select a target role to continue.');
        return;
      }
      const user = auth.currentUser;
      if (!user) {
        setFormError('Please log in first.');
        return;
      }
      setFormError(null);

      // Reflect any card preset in the session console selects immediately.
      if (overrides.role) setSelectedRole(overrides.role);
      if (overrides.focus) setSelectedFocus(overrides.focus);
      if (overrides.difficulty) setSelectedDifficulty(overrides.difficulty);

      if (!hasCompletedDiagnostic) {
        try {
          await fetch('/api/users/role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebaseUid: user.uid,
              role,
              difficulty,
              focusArea: focus,
            }),
          });
        } catch (err) {
          console.error('Error saving role:', err);
        }
        navigate('/likert-pre');
        return;
      }

      // Check if there is an in-progress active session
      let isResume = Boolean(activeSession?.hasActiveSession);
      let targetSet = isResume ? activeSession.activeSet : 1;
      try {
        const activeCheckRes = await fetch(`/api/users/active-practice-session?uid=${user.uid}`);
        if (activeCheckRes.ok) {
          const activeCheckData = await activeCheckRes.json();
          if (activeCheckData.hasActiveSession && activeCheckData.activeSet) {
            isResume = true;
            targetSet = activeCheckData.activeSet;
          } else {
            isResume = false;
          }
        }
      } catch (e) {
        console.error('Active session check fallback error:', e);
      }

      if (isResume) {
        // Resume directly into in-progress set (Set 1, 2, or 3)
        navigate(`/interview?set=${targetSet}&mode=practice&focusArea=${focus}&resume=true`);
        return;
      }

      // For fresh Set 1 practice kickoff, open the Pre-Flight Mission Calibration Modal
      setIsBriefingModalOpen(true);
    },
    [
      selectedRole,
      selectedDifficulty,
      selectedFocus,
      hasCompletedDiagnostic,
      activeSession,
      navigate,
    ]
  );

  // Launch a practice card, applies its preset (if any), then starts.
  // Cards cannot silently hijack an active session (resuming ignored their
  // presets anyway): the banner owns resume, so a card click during a live
  // session surfaces guidance instead of a confusing mid-session swap.
  const handleCardLaunch = useCallback(
    (card) => {
      if (isSessionActive) {
        setFormError(
          'You have a session in progress. Resume it from the banner, or start fresh to change your setup.'
        );
        return;
      }
      handleStartSession(card.preset || {});
    },
    [handleStartSession, isSessionActive]
  );

  const handleConfirmLaunch = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch('/api/users/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: user.uid,
          role: selectedRole,
          difficulty: selectedDifficulty,
          focusArea: selectedFocus,
        }),
      });
    } catch (err) {
      console.error('Error saving role & focus area:', err);
    }
    setIsBriefingModalOpen(false);
    navigate(`/interview?set=1&mode=practice&focusArea=${selectedFocus}`);
  }, [selectedRole, selectedDifficulty, selectedFocus, navigate]);

  const handleCloseBriefing = useCallback(() => {
    setIsBriefingModalOpen(false);
  }, []);

  // "Start Fresh Session" is destructive, it wipes the in-progress session
  // and unlocks the locked selects. It always passes through an explicit
  // confirmation gate before the reset endpoint runs.
  const handleRequestFresh = useCallback(() => {
    setFreshResetError(null);
    setIsConfirmFresh(true);
  }, []);

  const handleCancelFresh = useCallback(() => {
    setFreshResetError(null);
    setIsConfirmFresh(false);
  }, []);

  const handleResetAndStartNew = useCallback(async () => {
    setIsResetting(true);
    setFreshResetError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setIsConfirmFresh(false);
        return;
      }
      const res = await fetch('/api/users/reset-practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUid: user.uid }),
      });
      if (!res.ok) throw new Error('Reset failed');
      setActiveSession({ hasActiveSession: false });
      setIsConfirmFresh(false);
    } catch (err) {
      console.error('Error resetting session:', err);
      setFreshResetError("Couldn't discard the session. Check your connection and try again.");
    } finally {
      setIsResetting(false);
    }
  }, []);

  // Derived display values, real data only; null until a diagnostic exists
  const breakdown = diagnosticData?.threeCBreakdown || {};
  const clarity = breakdown.clarity ?? null;
  const correctness = breakdown.correctness ?? null;
  const completeness = breakdown.completeness ?? null;
  const lowestMetric = breakdown.lowestMetric || null;
  const baselineScore = diagnosticData?.preTestScore ?? null;
  const masteryScore = diagnosticData?.masteryScore ?? null;
  const growthDelta =
    diagnosticData?.improvementDelta != null
      ? diagnosticData.improvementDelta
      : baselineScore != null && masteryScore != null
        ? masteryScore - baselineScore
        : null;
  const avg3C =
    diagnosticData?.threeCBreakdown?.averagePercentage ?? diagnosticData?.masteryScore ?? null;
  const weakTopic = diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || null;
  const sessionsCount = diagnosticData?.practiceHistory?.length ?? 0;

  return (
    <div className="db-root">
      {/* ── Sidebar ── */}
      <aside className="db-sidebar">
        <div className="db-sidebar__logo-group">
          <img src={logoSrc} alt="ITerview" className="db-logo-img" />
          <span className="db-sidebar__wordmark">ITerview</span>
        </div>

        <nav
          className="db-sidebar__nav"
          role="tablist"
          aria-label="Dashboard sections"
          onKeyDown={handleTabKeyDown}
        >
          {NAV_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const tabId = `tab-${tab.toLowerCase().replace(/ /g, '-')}`;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab.toLowerCase().replace(/ /g, '-')}`}
                tabIndex={activeTab === tab ? 0 : -1}
                className={`db-nav-item ${activeTab === tab ? 'db-nav-item--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={18} />
                <span>{tab}</span>
              </button>
            );
          })}
        </nav>

        {/* Settings sits outside the tablist, it opens the profile modal and is
            not a tab, so it must not pollute the tablist semantics. */}
        <button
          type="button"
          className="db-nav-item db-nav-item--settings"
          onClick={handleOpenProfileModal}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <div className="db-sidebar__spacer" aria-hidden="true" />

        {/* Fox Coach, ══ MASCOT TEMPLATE ══
            Drop the coach illustration into the slot below when ready, e.g.
            <img src={foxCoach} alt="" />, the slot sizes it automatically. */}
        <section className="db-coach-card" aria-label="Fox Coach">
          <div className="db-coach-card__mascot">
            <div className="db-mascot-slot" aria-hidden="true">
              <span className="db-mascot-slot__hint">Mascot</span>
            </div>
          </div>
          <h3 className="db-coach-card__name">Fox Coach</h3>
          <span className="db-coach-card__level">
            <Star size={12} aria-hidden="true" />
            Level {COACH.level}
          </span>
          <p className="db-coach-card__hint">Keep practicing!</p>
          <div
            className="db-coach-card__bar"
            role="progressbar"
            aria-label="XP progress"
            aria-valuemin={0}
            aria-valuemax={COACH.xpGoal}
            aria-valuenow={COACH.xp}
          >
            <div
              className="db-coach-card__bar-fill"
              style={{ width: `${Math.min(100, (COACH.xp / COACH.xpGoal) * 100)}%` }}
            />
          </div>
          <span className="db-coach-card__xp">
            {COACH.xp} / {COACH.xpGoal} XP
          </span>
        </section>

        {/* User + sign-out */}
        <div className="db-sidebar__footer">
          <button
            type="button"
            className="db-user-avatar"
            onClick={handleOpenProfileModal}
            title="Edit profile"
            aria-label="Open profile settings"
            id="btn-profile-avatar"
            ref={avatarBtnRef}
          >
            {userName}
          </button>
          <span className="db-sidebar__user-name" title={fullName}>
            {fullName}
          </span>
          <button
            type="button"
            className="db-signout-btn"
            title="Sign Out"
            id="btn-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="db-main">
        {/* Page Header */}
        <div className="db-page-header">
          <div className="db-page-header__text">
            <h1 className="db-greeting">
              {getGreeting()}, {fullName}!
              <span className="db-greeting__wave" aria-hidden="true">
                👋
              </span>
            </h1>
            <p className="db-sub-greeting">
              Let's get you interview-ready with focused, friendly practice.
            </p>
          </div>
          <div className="db-page-header__actions">
            {dataStatus !== 'loading' &&
              (hasCompletedDiagnostic ? (
                <button
                  type="button"
                  className="db-status-chip db-status-chip--active"
                  onClick={handleViewResults}
                  title="View your diagnostic results"
                >
                  <span className="db-pulse-dot" aria-hidden="true" />
                  <span className="db-status-chip__label">Practice unlocked. Keep going!</span>
                  <ArrowRight size={13} className="db-status-chip__arrow" aria-hidden="true" />
                </button>
              ) : (
                <span className="db-status-chip db-status-chip--pending" role="status">
                  <span className="db-pulse-dot" aria-hidden="true" />
                  <span className="db-status-chip__label">Kickoff pre-test next</span>
                </span>
              ))}
            <LiveClock />
          </div>
        </div>

        {/* ══ Interview Prep Panel ══ */}
        <div
          role="tabpanel"
          id="tabpanel-interview-prep"
          aria-labelledby="tab-interview-prep"
          hidden={activeTab !== 'Interview Prep'}
          className="db-prep-stack"
        >
          {activeTab === 'Interview Prep' &&
            (dataStatus === 'loading' ? (
              <div className="db-prep-skeleton" aria-hidden="true">
                <div className="db-skeleton db-skeleton--history-row" />
                <div className="db-skeleton db-skeleton--baseline-body" />
              </div>
            ) : dataStatus === 'error' ? (
              <MetricsStates dataStatus="error" onRetry={retryLoad} />
            ) : !hasCompletedDiagnostic ? (
              /* ── Pre-diagnostic pivot: one job, one primary path.
                 Tools that would silently redirect to the pre-test are
                 hidden, the page owns a single call to action. ── */
              <section className="db-onboarding" aria-label="Kickoff pre-test">
                <div className="db-onboarding__icon">
                  <Gauge size={22} aria-hidden="true" />
                </div>
                <div className="db-onboarding__text">
                  <h2 className="db-onboarding__title">Start with your kickoff pre-test</h2>
                  <p className="db-onboarding__sub">
                    A short diagnostic sets your baseline across the 3C metrics: Clarity,
                    Correctness, and Completeness. Practice sessions, progress tracking, and
                    difficulty tiers unlock right after.
                  </p>
                </div>
                <div className="db-onboarding__controls">
                  <div className="db-select-wrap">
                    <Briefcase
                      size={17}
                      className="db-select-wrap__icon db-select-wrap__icon--violet"
                    />
                    <select
                      id="role-select"
                      className="db-select"
                      aria-label="Target role"
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value);
                        if (formError) setFormError(null);
                      }}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} disabled={o.value === ''}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={17} className="db-select-wrap__chevron" />
                  </div>
                  <button
                    type="button"
                    className="db-cta-btn"
                    onClick={() => handleStartSession()}
                    disabled={!selectedRole}
                  >
                    <Play size={16} aria-hidden="true" />
                    Take the pre-test
                  </button>
                </div>
                {!selectedRole && !formError && (
                  <p className="db-cta-helper">Select a target role to continue.</p>
                )}
                {formError && (
                  <p className="db-form-error" role="alert">
                    <AlertCircle size={15} />
                    {formError}
                  </p>
                )}
              </section>
            ) : (
              <>
                {/* ── Progress snapshot, the journey stays visible on the launch tab ── */}
                <section
                  className="db-progress-snapshot"
                  aria-labelledby="db-progress-snapshot-title"
                >
                  <div className="db-progress-snapshot__intro">
                    <span className="db-progress-snapshot__icon" aria-hidden="true">
                      <TrendingUp size={18} />
                    </span>
                    <span className="db-progress-snapshot__intro-copy">
                      <h2 id="db-progress-snapshot-title" className="db-progress-snapshot__title">
                        Progress snapshot
                      </h2>
                      <span className="db-progress-snapshot__sub">Diagnostic to current score</span>
                    </span>
                  </div>

                  <div
                    className="db-progress-snapshot__journey"
                    role="img"
                    aria-label={`Score journey: baseline ${
                      baselineScore != null ? `${baselineScore}%` : 'not set'
                    }, current ${masteryScore != null ? `${masteryScore}%` : 'not set'}`}
                  >
                    <span className="db-progress-snapshot__checkpoint">
                      <span className="db-progress-snapshot__label">Baseline</span>
                      <strong className="db-progress-snapshot__score">
                        {baselineScore != null ? `${baselineScore}%` : '—'}
                      </strong>
                    </span>
                    <span className="db-progress-snapshot__connector" aria-hidden="true">
                      <span className="db-progress-snapshot__line" />
                      <ArrowRight size={14} />
                    </span>
                    <span className="db-progress-snapshot__checkpoint db-progress-snapshot__checkpoint--current">
                      <span className="db-progress-snapshot__label">Current</span>
                      <strong className="db-progress-snapshot__score">
                        {masteryScore != null ? `${masteryScore}%` : '—'}
                      </strong>
                    </span>
                  </div>

                  {growthDelta != null && (
                    <div
                      className={`db-progress-snapshot__change ${
                        growthDelta < 0 ? 'db-progress-snapshot__change--negative' : ''
                      }`}
                    >
                      <span className="db-progress-snapshot__label">Change</span>
                      <strong className="db-progress-snapshot__change-value">
                        {growthDelta >= 0 ? '+' : ''}
                        {growthDelta}%
                      </strong>
                    </div>
                  )}

                  <button
                    type="button"
                    className="db-progress-snapshot__action"
                    onClick={() => setActiveTab('My Progress')}
                  >
                    View report
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </section>

                {/* ── Session console bar, configure & launch ── */}
                <section className="db-config-bar" aria-label="Session setup">
                  {/* Target Role */}
                  <div className="db-config-bar__field">
                    <label htmlFor="role-select" className="db-config-bar__label">
                      Target role
                    </label>
                    <div className="db-select-wrap">
                      <Briefcase
                        size={17}
                        className="db-select-wrap__icon db-select-wrap__icon--violet"
                      />
                      <select
                        id="role-select"
                        className="db-select"
                        value={selectedRole}
                        onChange={(e) => {
                          setSelectedRole(e.target.value);
                          if (formError) setFormError(null);
                        }}
                        disabled={isSessionActive}
                        title={
                          isSessionActive
                            ? "Target Role is locked during active practice session. Click 'Start Fresh Session' below to edit."
                            : ''
                        }
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} disabled={o.value === ''}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={17} className="db-select-wrap__chevron" />
                    </div>
                  </div>

                  {/* 3C Focus Area */}
                  <div className="db-config-bar__field">
                    <label htmlFor="focus-select" className="db-config-bar__label">
                      Focus area
                    </label>
                    <div className="db-select-wrap">
                      <Sparkles
                        size={17}
                        className="db-select-wrap__icon db-select-wrap__icon--violet"
                      />
                      <select
                        id="focus-select"
                        className="db-select"
                        value={selectedFocus}
                        onChange={(e) => setSelectedFocus(e.target.value)}
                        disabled={isSessionActive}
                        title={
                          isSessionActive
                            ? "Focus Area is locked during active practice session. Click 'Start Fresh Session' below to edit."
                            : ''
                        }
                      >
                        {FOCUS_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={17} className="db-select-wrap__chevron" />
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="db-config-bar__field">
                    <label htmlFor="difficulty-select" className="db-config-bar__label">
                      Difficulty
                    </label>
                    <div className="db-select-wrap">
                      <Gauge
                        size={17}
                        className="db-select-wrap__icon db-select-wrap__icon--violet"
                      />
                      <select
                        id="difficulty-select"
                        className="db-select"
                        value={selectedDifficulty}
                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                        disabled={isSessionActive}
                        title={
                          isSessionActive
                            ? "Difficulty is locked during active practice session. Click 'Start Fresh Session' below to edit."
                            : ''
                        }
                      >
                        <option value="easy">Easy</option>
                        <option value="medium" disabled={unlockedDifficulty === 'easy'}>
                          Medium · keep practicing to unlock
                        </option>
                        <option value="hard" disabled={unlockedDifficulty !== 'hard'}>
                          Hard · keep practicing to unlock
                        </option>
                      </select>
                      <ChevronDown size={17} className="db-select-wrap__chevron" />
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-start-pretest"
                    className="db-cta-btn db-config-bar__cta"
                    onClick={() => handleStartSession()}
                    disabled={!selectedRole || dataStatus === 'loading'}
                  >
                    <Play size={16} />
                    {dataStatus === 'loading'
                      ? 'Loading…'
                      : isSessionActive
                        ? 'Resume session'
                        : 'Start session'}
                  </button>
                </section>

                {dataStatus !== 'loading' && !selectedRole && !formError && (
                  <p className="db-cta-helper">Select a target role to continue.</p>
                )}
                {formError && (
                  <p className="db-form-error" role="alert">
                    <AlertCircle size={15} />
                    {formError}
                  </p>
                )}
                {isSessionActive && (
                  <div className="db-lock-note">
                    <Lock size={14} />
                    <span>
                      Target Role, Focus Area & Difficulty are locked for your active session. Click{' '}
                      <strong>"Start Fresh Session"</strong> in the banner below to reset & enable
                      options.
                    </span>
                  </div>
                )}

                {/* In-Progress Session Resume Banner */}
                {isSessionActive && (
                  <div className="db-resume-banner">
                    <div className="db-resume-banner__head">
                      <span className="db-resume-banner__title">
                        <Play size={14} className="db-resume-banner__title-icon" />
                        In-Progress Practice Session Detected
                      </span>
                      <span className="db-resume-banner__badge">
                        Set {activeSession.activeSet} · Q{activeSession.answersCount + 1}/5
                      </span>
                    </div>
                    <p className="db-resume-banner__desc">
                      Pick up where you left off, or discard this session and start fresh with new
                      settings.
                    </p>
                    {isConfirmFresh ? (
                      <div
                        className="db-resume-banner__confirm"
                        role="alertdialog"
                        aria-label="Discard in-progress session"
                      >
                        <div className="db-resume-banner__confirm-text">
                          <span className="db-resume-banner__confirm-title">
                            <AlertCircle
                              size={14}
                              className="db-resume-banner__confirm-icon"
                              aria-hidden="true"
                            />
                            Discard this in-progress session?
                          </span>
                          <span className="db-resume-banner__confirm-desc">
                            Your answers in Set {activeSession.activeSet} will be permanently lost.
                            Your role and focus will unlock so you can start fresh.
                          </span>
                        </div>
                        <div className="db-resume-banner__confirm-actions">
                          <button
                            type="button"
                            onClick={handleCancelFresh}
                            className="db-btn-secondary db-btn-secondary--sm"
                            disabled={isResetting}
                          >
                            Keep session
                          </button>
                          <button
                            type="button"
                            onClick={handleResetAndStartNew}
                            className="db-btn-danger db-btn-danger--sm"
                            disabled={isResetting}
                          >
                            <RotateCcw size={14} />
                            {isResetting ? 'Discarding…' : 'Yes, discard session'}
                          </button>
                        </div>
                        {freshResetError && (
                          <p className="db-form-error" role="alert">
                            <AlertCircle size={15} />
                            {freshResetError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="db-resume-banner__actions">
                        {/* The banner owns the resume action, no duplicate
                          "Resume" card in the practice grid anymore. */}
                        <button
                          type="button"
                          onClick={() => handleStartSession()}
                          className="db-cta-btn db-cta-btn--sm"
                        >
                          <Play size={14} aria-hidden="true" />
                          Resume session
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestFresh}
                          className="db-btn-secondary db-btn-secondary--sm"
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          Start Fresh Session
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Choose your practice ── */}
                <section className="db-practice-section">
                  <h2 className="db-practice-section__title">Choose your practice</h2>
                  <p className="db-practice-section__sub">
                    Pick a session that fits your goals. Every session is {QUESTIONS_PER_SESSION}{' '}
                    questions. You can change anytime.
                  </p>
                  <div className="db-practice-cards">
                    {PRACTICE_CARDS.map((card) => (
                      <PracticeCard key={card.id} card={card} onLaunch={handleCardLaunch} />
                    ))}
                  </div>
                </section>
              </>
            ))}
        </div>

        {/* ══ History Panel ══ */}
        <div
          role="tabpanel"
          id="tabpanel-history"
          aria-labelledby="tab-history"
          hidden={activeTab !== 'History'}
        >
          {activeTab === 'History' && (
            <HistoryPanel
              dataStatus={dataStatus}
              practiceHistory={diagnosticData?.practiceHistory}
            />
          )}
        </div>

        {/* ══ My Progress Panel ══ */}
        <div
          role="tabpanel"
          id="tabpanel-my-progress"
          aria-labelledby="tab-my-progress"
          hidden={activeTab !== 'My Progress'}
        >
          {activeTab === 'My Progress' && (
            <ProgressPanel
              dataStatus={dataStatus}
              onRetry={retryLoad}
              onViewReport={handleViewResults}
              baseline={baselineScore}
              mastery={masteryScore}
              growth={growthDelta}
              clarity={clarity}
              correctness={correctness}
              completeness={completeness}
              average3C={avg3C}
              lowestMetric={lowestMetric}
              weakTopic={weakTopic}
              sessionsCount={sessionsCount}
              selectedRole={selectedRole}
              onSelectRole={(role) => {
                setSelectedRole(role);
                if (formError) setFormError(null);
              }}
              roleOptions={ROLE_OPTIONS}
              onStartPretest={() => handleStartSession()}
              onSwitchTab={setActiveTab}
            />
          )}
        </div>
      </main>
      {/* /db-content */}

      {/* ── Profile Settings Modal ── */}
      {isProfileModalOpen && (
        <div className="db-modal-backdrop" onClick={handleCloseProfileModal}>
          <div
            className="db-modal"
            ref={profileModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-profile-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                if (!isSavingProfile) handleCloseProfileModal();
                return;
              }
              if (e.key !== 'Tab') return;
              const focusables = Array.from(
                e.currentTarget.querySelectorAll(
                  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
              ).filter((el) => el.offsetParent !== null || el === document.activeElement);
              if (focusables.length === 0) {
                e.preventDefault();
                return;
              }
              const first = focusables[0];
              const last = focusables[focusables.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }}
          >
            {/* Modal Header */}
            <div className="db-modal__header">
              <div className="db-modal__header-text">
                <h2 id="db-profile-modal-title" className="db-modal__title">
                  Profile Settings
                </h2>
                <p className="db-modal__sub">Update your display name, role, and focus area.</p>
              </div>
              <button
                type="button"
                className="db-modal__close"
                onClick={handleCloseProfileModal}
                aria-label="Close profile settings"
                disabled={isSavingProfile}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="db-modal__body">
              {/* Display Name */}
              <div className="db-modal__field">
                <label htmlFor="modal-display-name" className="db-modal__label">
                  Display name
                </label>
                <input
                  id="modal-display-name"
                  type="text"
                  className="db-modal__input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name (shown in greeting)"
                  maxLength={60}
                  disabled={isSavingProfile}
                  autoComplete="off"
                />
                <p className="db-modal__hint">
                  Shown as &ldquo;Good morning, {editName || '…'}&rdquo;
                </p>
              </div>

              {/* Target Role */}
              <div className="db-modal__field">
                <label htmlFor="modal-role" className="db-modal__label">
                  Target role
                </label>
                <div className="db-select-wrap">
                  <Briefcase
                    size={17}
                    className="db-select-wrap__icon db-select-wrap__icon--violet"
                  />
                  <select
                    id="modal-role"
                    className="db-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={isSavingProfile}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.value === ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={17} className="db-select-wrap__chevron" />
                </div>
              </div>

              {/* Focus Area */}
              <div className="db-modal__field">
                <label htmlFor="modal-focus" className="db-modal__label">
                  Focus area
                </label>
                <div className="db-select-wrap">
                  <Sparkles
                    size={17}
                    className="db-select-wrap__icon db-select-wrap__icon--violet"
                  />
                  <select
                    id="modal-focus"
                    className="db-select"
                    value={editFocus}
                    onChange={(e) => setEditFocus(e.target.value)}
                    disabled={isSavingProfile}
                  >
                    {FOCUS_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={17} className="db-select-wrap__chevron" />
                </div>
              </div>

              {/* Error message */}
              {profileError && (
                <p className="db-form-error" role="alert">
                  <AlertCircle size={15} />
                  {profileError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="db-modal__footer">
              <button
                type="button"
                className="db-btn-secondary"
                onClick={handleCloseProfileModal}
                disabled={isSavingProfile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="db-cta-btn"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                id="btn-save-profile"
              >
                {isSavingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pre-Flight Mission Calibration Modal ── */}
      <AnimatePresence>
        {isBriefingModalOpen && (
          <SetBriefingOverlay
            role={selectedRole}
            focusArea={selectedFocus}
            diagnosticData={diagnosticData}
            onConfirm={handleConfirmLaunch}
            onClose={handleCloseBriefing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

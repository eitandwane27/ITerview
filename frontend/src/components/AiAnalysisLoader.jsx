import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion as Motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Sparkles, Check, AlertCircle, RefreshCw, ArrowRight, Lock, X, Target, BadgeCheck, ListChecks } from 'lucide-react';
import './AiAnalysisLoader.css';

// ── Role & Weakness Registry (Mirrors backend/config/roleConfig.js) ─────────
const ROLE_CONFIG_INFO = {
  frontend: {
    label: 'Frontend Developer',
    scopeSnippet: 'DOM Manipulation, CSS Cascade & State',
  },
  backend: {
    label: 'Backend Developer',
    scopeSnippet: 'REST APIs, Express Middleware & DB Queries',
  },
  fullstack: {
    label: 'Fullstack Developer',
    scopeSnippet: 'Client-Server Flow, Auth & API Architecture',
  },
};

const WEAKNESS_INFO = {
  focus_clarity: { label: 'Clarity & structured explanations', tag: 'Clarity' },
  focus_correctness: { label: 'Technical precision & accuracy', tag: 'Correctness' },
  focus_completeness: { label: 'Comprehensive multi-part depth', tag: 'Completeness' },
};

const FOCUS_INFO = {
  auto: { label: 'Auto-detect focus', short: 'Auto' },
  clarity: { label: 'Clarity focus', short: 'Clarity' },
  correctness: { label: 'Correctness focus', short: 'Correctness' },
  completeness: { label: 'Completeness focus', short: 'Completeness' },
  star: { label: 'STAR behavioral', short: 'STAR' },
};

// Chip tone per focus key — rubric-aware tints (DESIGN.md 3C mapping)
const FOCUS_TONE = {
  auto: 'blue',
  clarity: 'cyan',
  correctness: 'mint',
  completeness: 'amber',
  star: 'indigo',
};

// ── 3C Metric display config (Clarity sky · Correctness mint · Completeness amber)
const METRIC_CONFIG = {
  clarity: { label: 'Clarity', icon: Target },
  correctness: { label: 'Correctness', icon: BadgeCheck },
  completeness: { label: 'Completeness', icon: ListChecks },
};

// ── Motion vocabulary — calm, springy, choreographed in and out ─────────────
const EASE_OUT = [0.22, 1, 0.36, 1];

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT, staggerChildren: 0.07, delayChildren: 0.1 },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: { duration: 0.22, ease: 'easeIn' },
  },
};

const stackVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const riseVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

// ── Synthesis dial geometry (SVG progress ring) ──────────────────────────────
const DIAL_SIZE = 128;
const DIAL_STROKE = 8;
const DIAL_R = (DIAL_SIZE - DIAL_STROKE) / 2 - 3;
const DIAL_C = 2 * Math.PI * DIAL_R;

export default function AiAnalysisLoader({
  setNumber = 1,
  role = 'frontend',
  weakness = 'focus_completeness',
  focusArea = '',
  statusMessage = '',
  isReady = false,
  error = null,
  onComplete,
  onRetry,
  onSkip,
  onClose,
  onConfirm,
  diagnosticData = null,
  timeoutMs = 16000,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const isMountedRef = useRef(true);
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Modal behavior: lock background scroll while the synthesis overlay is up
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Normalize role and weakness inputs
  const roleKey = (role || 'frontend').toLowerCase().replace(/\s+/g, '');
  const activeRole = ROLE_CONFIG_INFO[roleKey] || ROLE_CONFIG_INFO.frontend;

  const weaknessKey = (weakness || 'focus_completeness').toLowerCase().includes('clarity')
    ? 'focus_clarity'
    : (weakness || '').toLowerCase().includes('correct')
      ? 'focus_correctness'
      : 'focus_completeness';
  const activeWeakness = WEAKNESS_INFO[weaknessKey];

  const focusKey = (focusArea || '').toLowerCase();
  const focusEntry = FOCUS_INFO[focusKey] || null;
  const focusSuffix =
    focusEntry && focusKey !== 'auto' ? ` Session focus: ${focusEntry.short}.` : '';

  // Coach-voice telemetry steps (grounded in roleConfig.js — no vendor jargon)
  const steps = useMemo(() => {
    if (setNumber === 2) {
      return [
        {
          title: 'Mapping the skills to test',
          detail: 'Picking the core concepts for your graduation challenge',
        },
        {
          title: `Choosing ${activeRole.label} topics`,
          detail: `Focusing on ${activeRole.scopeSnippet.toLowerCase()}`,
        },
        {
          title: 'Setting the difficulty bar',
          detail: 'Tuning scoring so it stretches you, not stumps you',
        },
        {
          title: 'Recording your question audio',
          detail: "Getting the coach's voice ready so you can start instantly",
        },
      ];
    }
    return [
      {
        title: 'Reading your baseline answers',
        detail: 'Reviewing the flow and structure of your pre-test responses',
      },
      {
        title: `Finding your growth edge (${activeWeakness.tag})`,
        detail: `We'll lean into ${activeWeakness.label.toLowerCase()}`,
      },
      {
        title: `Choosing ${activeRole.label} topics`,
        detail: `Focusing on ${activeRole.scopeSnippet.toLowerCase()}`,
      },
      {
        title: 'Recording your question audio',
        detail: "Getting the coach's voice ready so you can start instantly",
      },
    ];
  }, [setNumber, activeRole, activeWeakness]);

  // Effective stage — jumps to "complete" the moment the backend signals isReady
  const activeStep = isReady ? steps.length : currentStep;
  const isComplete = activeStep >= steps.length;
  const progressPercent = Math.min(100, Math.round((activeStep / steps.length) * 100));

  // Focus trap + keyboard shortcuts (Escape to dismiss, Enter to proceed)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }
      if (e.key === 'Enter' && isComplete && onConfirm) {
        onConfirm();
        return;
      }

      // Tab focus trap: keep focus within the modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!focusable.length) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Auto-focus the close button or modal root when mounted
    const focusTarget = closeButtonRef.current || modalRef.current;
    focusTarget?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onConfirm, isComplete]);

  // Step timing orchestration (elapsed timer + timeout guard)
  useEffect(() => {
    isMountedRef.current = true;

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const timeoutTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (!isReady && currentStep < steps.length) {
        setIsTimedOut(true);
      }
    }, timeoutMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      clearTimeout(timeoutTimer);
    };
  }, [isReady, currentStep, steps.length, timeoutMs]);

  // Autonomous step progression until isReady is true
  useEffect(() => {
    if (isReady) {
      // Completion is derived from isReady during render — no state sync needed
      const finishTimer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 700);
      return () => clearTimeout(finishTimer);
    }

    // Progression pacing (1.1s, 2.5s, 4.2s, 5.8s)
    const timers = [
      setTimeout(() => setCurrentStep(1), 1100),
      setTimeout(() => setCurrentStep(2), 2500),
      setTimeout(() => setCurrentStep(3), 4200),
      setTimeout(() => setCurrentStep(4), 5800),
      setTimeout(() => {
        if (onComplete && !isTimedOut && !error) {
          onComplete();
        }
      }, 7200),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isReady, steps.length, onComplete, isTimedOut, error]);

  // ── 3C Diagnostic Baseline helpers ─────────────────────────────────────────
  const has3C =
    diagnosticData?.threeCBreakdown && typeof diagnosticData.threeCBreakdown.clarity === 'number';

  const statusText = error
    ? 'Paused'
    : isTimedOut
      ? 'Still working'
      : isComplete
        ? 'Ready for you'
        : 'Composing';
  const statusTone = error || isTimedOut ? 'warning' : isComplete ? 'done' : 'active';

  const handleBackdropClick = (e) => {
    // Only dismiss on direct backdrop click, not on card clicks bubbling up
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <Motion.div
        className="aal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aal-modal-title"
        ref={modalRef}
        tabIndex={-1}
        onClick={handleBackdropClick}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Soft desk-lamp ambience over a clean slate canvas */}
        <div className="aal-ambient" aria-hidden="true" />
        <div className="aal-dots" aria-hidden="true" />

        <Motion.div
          className="aal-card"
          variants={cardVariants}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header — brand + live status + dismiss ── */}
          <Motion.header variants={riseVariants} className="aal-header">
            <div className="aal-brand">
              <span className="aal-brand-badge" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <span className="aal-brand-text">
                <span className="aal-brand-name">ITerview Coach</span>
                <span className="aal-brand-sub">Preparing your session</span>
              </span>
            </div>
            <div className="aal-header-side">
              <span className={`aal-status aal-status--${statusTone}`} aria-live="polite">
                <span className="aal-status-dot" aria-hidden="true" />
                {statusText}
              </span>
              {onClose && (
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="aal-close"
                  onClick={onClose}
                  aria-label="Dismiss"
                  title="Dismiss (Esc)"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </Motion.header>

          {/* ── Synthesis dial + heading — the single focal moment ── */}
          <Motion.section variants={riseVariants} className="aal-core">
            <div className={`aal-dial${isComplete ? ' is-complete' : ''}`} aria-hidden="true">
              <svg className="aal-dial-svg" viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
                <circle
                  className="aal-dial-track-ring"
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={DIAL_R}
                  strokeWidth={DIAL_STROKE}
                  fill="none"
                />
                <Motion.circle
                  className="aal-dial-arc"
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={DIAL_R}
                  strokeWidth={DIAL_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={DIAL_C}
                  initial={{ strokeDashoffset: DIAL_C }}
                  animate={{ strokeDashoffset: DIAL_C * (1 - progressPercent / 100) }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
              </svg>
              <div className="aal-dial-center">
                <AnimatePresence mode="wait" initial={false}>
                  {isComplete ? (
                    <Motion.span
                      key="complete"
                      className="aal-dial-complete"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 24 }}
                    >
                      <Check size={22} strokeWidth={2.5} />
                    </Motion.span>
                  ) : (
                    <Motion.div
                      key="progress"
                      className="aal-dial-progress"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="aal-dial-percent">{progressPercent}%</span>
                      {/* Signal cyan — reserved for live voice/TTS synthesis telemetry */}
                      <span className="aal-dial-wave">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <i key={n} className={`aal-wave-bar aal-wave-bar--${n}`} />
                        ))}
                      </span>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="aal-heading">
              <h2 className="aal-title" id="aal-modal-title">
                {isComplete
                  ? setNumber === 2
                    ? 'Your technical challenge is ready'
                    : 'Your practice set is ready'
                  : setNumber === 2
                    ? 'Preparing your technical challenge'
                    : 'Tailoring your practice set'}
              </h2>
              <p className="aal-subtitle">
                {statusMessage ||
                  (setNumber === 2
                    ? `We're choosing the right technical questions for ${activeRole.label}.${focusSuffix}`
                    : `We're personalizing every question for ${activeRole.label}, leaning into ${activeWeakness.label}.${focusSuffix}`)}
              </p>
              <div className="aal-chips">
                <span className="aal-chip aal-chip--indigo" title="Target role">
                  {activeRole.label}
                </span>
                {focusEntry && (
                  <span
                    className={`aal-chip aal-chip--${FOCUS_TONE[focusKey] || 'blue'}`}
                    title="Session focus"
                  >
                    {focusEntry.label}
                  </span>
                )}
              </div>
            </div>
          </Motion.section>

          {/* ── 3C diagnostic baseline triad ── */}
          {has3C && (
            <Motion.section
              variants={riseVariants}
              className="aal-triad"
              aria-label="3C diagnostic baseline"
            >
              {['clarity', 'correctness', 'completeness'].map((metric) => {
                const cfg = METRIC_CONFIG[metric];
                const score = diagnosticData.threeCBreakdown[metric];
                const isLowest = diagnosticData.threeCBreakdown.lowestMetric === metric;
                const pct = Math.min(100, Math.round((score / 5) * 100));
                return (
                  <div
                    key={metric}
                    className={`aal-metric aal-metric--${metric}${isLowest ? ' aal-metric--focus' : ''}`}
                  >
                    <div className="aal-metric-head">
                      <span className="aal-metric-icon" aria-hidden="true">
                        <cfg.icon size={14} strokeWidth={2.25} />
                      </span>
                      <span className="aal-metric-label">{cfg.label}</span>
                      {isLowest && (
                        <span className="aal-metric-tag" aria-label="Focus area">
                          Focus
                        </span>
                      )}
                    </div>
                    <div className="aal-metric-score">
                      {score.toFixed(1)}
                      <span className="aal-metric-max">/5</span>
                    </div>
                    <div className="aal-metric-track" aria-hidden="true">
                      <div className="aal-metric-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </Motion.section>
          )}

          {/* ── Segmented progress track ── */}
          <Motion.div
            variants={riseVariants}
            className="aal-track"
            role="progressbar"
            aria-valuenow={activeStep}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-label={`Progress: ${activeStep} of ${steps.length} stages complete`}
          >
            <div className="aal-track-segments">
              {steps.map((_, i) => {
                const isDone = activeStep > i;
                const isCurrent = activeStep === i;
                return (
                  <div
                    key={i}
                    className={`aal-track-segment ${isDone ? 'done' : isCurrent ? 'active' : ''}`}
                  />
                );
              })}
            </div>
          </Motion.div>

          {/* ── Stage checklist — staggered in, checks pop on completion ── */}
          <Motion.ul variants={stackVariants} className="aal-stages">
            {steps.map((step, i) => {
              const isDoneRow = activeStep > i;
              const isCurrent = activeStep === i;
              return (
                <Motion.li
                  key={i}
                  variants={riseVariants}
                  className={`aal-stage ${isDoneRow ? 'is-done' : isCurrent ? 'is-active' : ''}`}
                >
                  <div className="aal-stage-indicator" aria-hidden="true">
                    {isDoneRow ? (
                      <Motion.span
                        className="aal-stage-check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </Motion.span>
                    ) : (
                      <span className="aal-stage-dot" />
                    )}
                  </div>
                  <div className="aal-stage-text">
                    <span className="aal-stage-title">{step.title}</span>
                    <span className="aal-stage-detail">{step.detail}</span>
                  </div>
                  {isDoneRow && (
                    <span className="aal-stage-badge aal-stage-badge--done" aria-hidden="true">
                      Done
                    </span>
                  )}
                  {isCurrent && (
                    <span className="aal-stage-badge aal-stage-badge--live" aria-hidden="true">
                      Working…
                    </span>
                  )}
                </Motion.li>
              );
            })}
          </Motion.ul>

          {/* ── Patience banner (error / slow generation) ── */}
          <AnimatePresence>
            {(error || isTimedOut) && (
              <Motion.div
                className="aal-banner"
                role="status"
                initial={{ opacity: 0, height: 0, y: 8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="aal-banner-main">
                  <AlertCircle className="aal-banner-icon" size={18} aria-hidden="true" />
                  <div>
                    <p className="aal-banner-title">
                      {error ? 'Something went wrong' : 'Taking longer than usual'}
                    </p>
                    <p className="aal-banner-text">
                      {error ||
                        `Question generation is still running (${elapsedSec}s so far). You can keep waiting — or head straight in.`}
                    </p>
                  </div>
                </div>
                <div className="aal-banner-actions">
                  {onRetry && (
                    <button type="button" onClick={onRetry} className="aal-btn aal-btn-secondary">
                      <RefreshCw size={14} className="aal-btn-icon" aria-hidden="true" />
                      Try again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (onSkip) onSkip();
                      else if (onComplete) onComplete();
                    }}
                    className="aal-btn aal-btn-primary"
                  >
                    Head in now
                    <ArrowRight size={14} className="aal-btn-icon" aria-hidden="true" />
                  </button>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* ── Footer — privacy note + timing telemetry ── */}
          <Motion.footer variants={riseVariants} className="aal-footer">
            <span className="aal-footer-meta">
              <Lock size={13} aria-hidden="true" />
              <span>Private session — your answers stay on your account</span>
            </span>
            <span className="aal-footer-timing" aria-live="polite">
              <span className="aal-elapsed">{elapsedSec}s</span>
              <span className="aal-stepcount">
                Step {Math.min(activeStep + 1, steps.length)} of {steps.length}
              </span>
              {onClose && (
                <span className="aal-esc" aria-hidden="true">
                  Esc to dismiss
                </span>
              )}
            </span>
          </Motion.footer>
        </Motion.div>
      </Motion.div>
    </MotionConfig>
  );
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import './AiAnalysisLoader.css';

// ── Role & Weakness Registry (Mirrors backend/config/roleConfig.js) ─────────
const ROLE_CONFIG_INFO = {
  frontend: {
    label: 'Frontend Developer',
    scopeSnippet: 'DOM Manipulation, CSS Cascade & State',
    accent: 'cyan',
  },
  backend: {
    label: 'Backend Developer',
    scopeSnippet: 'REST APIs, Express Middleware & DB Queries',
    accent: 'purple',
  },
  fullstack: {
    label: 'Fullstack Developer',
    scopeSnippet: 'Client-Server Flow, Auth & API Architecture',
    accent: 'cyan',
  },
};

const WEAKNESS_INFO = {
  focus_clarity: {
    label: 'Clarity & Structured Explanations',
    tag: 'Clarity Target',
    accent: 'cyan',
  },
  focus_correctness: {
    label: 'Technical Precision & Accuracy',
    tag: 'Correctness Target',
    accent: 'green',
  },
  focus_completeness: {
    label: 'Comprehensive Multi-Part Depth',
    tag: 'Completeness Target',
    accent: 'amber',
  },
};

const FOCUS_INFO = {
  auto: 'AI Auto-Detect',
  clarity: 'Clarity Focus',
  correctness: 'Correctness Focus',
  completeness: 'Completeness Focus',
  star: 'STAR Behavioral',
};

// ── 3C Metric display config ─────────────────────────────────────────────────
const METRIC_CONFIG = {
  clarity: { label: 'Clarity', icon: '🎯', accentVar: '--aal-cyan', dimVar: '--aal-cyan-dim' },
  correctness: {
    label: 'Correctness',
    icon: '✅',
    accentVar: '--aal-green',
    dimVar: '--aal-green-dim',
  },
  completeness: {
    label: 'Completeness',
    icon: '📋',
    accentVar: '--aal-amber',
    dimVar: '--aal-amber-dim',
  },
};

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

  // Focus trap + keyboard shortcuts (Escape to close, Enter to proceed)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }
      if (e.key === 'Enter' && currentStep >= steps.length && onConfirm) {
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
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Auto-focus the close button or modal root when mounted
    const focusTarget = closeButtonRef.current || modalRef.current;
    focusTarget?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onConfirm, currentStep]);

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
  const focusLabel = FOCUS_INFO[focusKey] || null;
  const focusSuffix =
    focusLabel && focusKey !== 'auto' ? ` Session focus: ${focusLabel.replace(' Focus', '')}.` : '';

  // Dynamic telemetry steps grounded in roleConfig.js
  const steps = useMemo(() => {
    if (setNumber === 2) {
      return [
        {
          title: 'Analyzing Technical Mastery Requirements',
          detail: 'Configuring algorithm, data flow, and architecture prompts',
        },
        {
          title: `Targeting Core Technical Domains (${activeRole.label})`,
          detail: `Focusing on: ${activeRole.scopeSnippet}`,
        },
        {
          title: 'Calibrating Difficulty & Rubric Thresholds',
          detail: 'Setting precision and depth scoring criteria',
        },
        {
          title: 'Synthesizing Set 2 Questions & Luna Voice Audio',
          detail: 'Compiling technical question audio buffer for instant start',
        },
      ];
    }
    return [
      {
        title: 'Evaluating Baseline Audio & 3C Scores',
        detail: 'Processing pre-test speech rhythm, syntax, and phrasing',
      },
      {
        title: `Calibrating Weakness Engine (${activeWeakness.tag})`,
        detail: `Targeting growth in: ${activeWeakness.label}`,
      },
      {
        title: `Loading Topics from roleConfig (${activeRole.label})`,
        detail: `Filtering: ${activeRole.scopeSnippet}`,
      },
      {
        title: 'Synthesizing Set 1 Questions & Luna Voice Audio',
        detail: 'Compiling personalized question audio buffer for instant start',
      },
    ];
  }, [setNumber, activeRole, activeWeakness]);

  // Step timing orchestration (for smooth progression or until isReady is true)
  useEffect(() => {
    isMountedRef.current = true;

    // Elapsed timer
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    // Timeout guard
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

  // Autonomous step progression if not explicitly controlled by external isReady
  useEffect(() => {
    if (isReady) {
      setCurrentStep(steps.length);
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

  const progressPercent = Math.min(100, Math.round((currentStep / steps.length) * 100));

  // ── 3C Diagnostic Baseline helpers ──────────────────────────────────────────
  const has3C =
    diagnosticData?.threeCBreakdown && typeof diagnosticData.threeCBreakdown.clarity === 'number';

  const handleBackdropClick = (e) => {
    // Only dismiss on direct backdrop click, not on card clicks bubbling up
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <motion.div
      className="aal-studio-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aal-modal-title"
      ref={modalRef}
      tabIndex={-1}
      onClick={handleBackdropClick}
      // Full-overlay fade so the dark studio never hard-cuts on session start/end.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
    >
      {/* Ambient Blueprint & Radial Glow */}
      <div className="aal-ambient-glow" aria-hidden="true" />
      <div className="aal-blueprint-grid" aria-hidden="true" />

      {/* Main Studio Card */}
      <motion.div
        className="aal-studio-card"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Strip */}
        <header className="aal-top-header">
          <div className="aal-brand-group">
            <Cpu className="aal-brand-icon" aria-hidden="true" />
            <span className="aal-header-title">AI Synthesis Engine</span>
          </div>

          <div className="aal-header-badges">
            <span className="aal-role-chip" title="Target Role Track">
              {activeRole.label}
            </span>
            {focusLabel && (
              <span className="aal-focus-chip" title="Session Focus Target">
                {focusLabel}
              </span>
            )}
            <span
              className={`aal-status-pill ${error || isTimedOut ? 'warning' : 'active'}`}
              aria-live="polite"
            >
              <span className="aal-pulse-dot" aria-hidden="true" />
              {error ? 'Generation Paused' : isTimedOut ? 'Awaiting Signal' : 'DeepSeek Active'}
            </span>

            {/* Close button — only shown when a dismiss handler is provided */}
            {onClose && (
              <button
                ref={closeButtonRef}
                type="button"
                className="aal-close-btn"
                onClick={onClose}
                aria-label="Dismiss"
                title="Dismiss (Esc)"
              >
                <X className="aal-close-icon" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {/* AI Radar Core Anchor */}
        <div className="aal-core-section">
          <div className="aal-radar-disc" aria-hidden="true">
            <div className="aal-radar-beam" />
            <div className="aal-radar-ring outer" />
            <div className="aal-radar-ring mid" />
            <div className="aal-radar-ring inner" />

            {/* Live 5-bar Waveform Equalizer */}
            <div className="aal-mini-waveform">
              <span className="aal-wave-bar bar-1" />
              <span className="aal-wave-bar bar-2" />
              <span className="aal-wave-bar bar-3" />
              <span className="aal-wave-bar bar-4" />
              <span className="aal-wave-bar bar-5" />
            </div>
          </div>

          <div className="aal-heading-block">
            <h2 className="aal-main-title" id="aal-modal-title">
              {currentStep >= steps.length
                ? setNumber === 2
                  ? 'Set 2 Ready for Technical Interview'
                  : 'Set 1 Ready for Interview'
                : setNumber === 2
                  ? 'Generating Set 2 Technical Questions'
                  : 'Personalizing Set 1 Interview'}
            </h2>
            <p className="aal-subtitle">
              {statusMessage ||
                (setNumber === 2
                  ? `Calibrating technical mastery questions for ${activeRole.label}.${focusSuffix}`
                  : `Calibrating questions for ${activeRole.label} targeting ${activeWeakness.label}.${focusSuffix}`)}
            </p>
          </div>
        </div>

        {/* ── Optional 3C Diagnostic Baseline Triad ── */}
        {has3C && (
          <div className="aal-3c-triad" aria-label="3C Diagnostic Baseline">
            {['clarity', 'correctness', 'completeness'].map((metric) => {
              const cfg = METRIC_CONFIG[metric];
              const score = diagnosticData.threeCBreakdown[metric];
              const isLowest = diagnosticData.threeCBreakdown.lowestMetric === metric;
              const pct = Math.round((score / 10) * 100);
              return (
                <div key={metric} className={`aal-3c-card ${isLowest ? 'aal-3c-card--focus' : ''}`}>
                  <div className="aal-3c-card-header">
                    <span className="aal-3c-icon" aria-hidden="true">
                      {cfg.icon}
                    </span>
                    <span className="aal-3c-label">{cfg.label}</span>
                    {isLowest && (
                      <span className="aal-3c-focus-tag" aria-label="Focus area">
                        Focus
                      </span>
                    )}
                  </div>
                  <div className="aal-3c-score">
                    {score.toFixed(1)}
                    <span className="aal-3c-score-max">/10</span>
                  </div>
                  <div className="aal-3c-track" aria-hidden="true">
                    <div
                      className={`aal-3c-fill aal-3c-fill--${metric}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Segmented Progress Track */}
        <div
          className="aal-progress-wrapper"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label={`Synthesis progress: ${currentStep} of ${steps.length} stages complete`}
        >
          <div className="aal-track-segments">
            {steps.map((_, i) => {
              const isDone = currentStep > i;
              const isCurrent = currentStep === i;
              return (
                <div
                  key={i}
                  className={`aal-track-segment ${isDone ? 'done' : isCurrent ? 'active' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {/* Telemetry Stage Checklist */}
        <ul className="aal-stages-list">
          {steps.map((step, i) => {
            const isDone = currentStep > i;
            const isCurrent = currentStep === i;
            return (
              <li
                key={i}
                className={`aal-stage-row ${
                  isDone ? 'is-done' : isCurrent ? 'is-active' : 'is-pending'
                }`}
              >
                <div className="aal-stage-indicator" aria-hidden="true">
                  {isDone ? (
                    <Check className="aal-check-icon" />
                  ) : isCurrent ? (
                    <span className="aal-active-spark" />
                  ) : (
                    <span className="aal-pending-dot" />
                  )}
                </div>

                <div className="aal-stage-info">
                  <div className="aal-stage-title">{step.title}</div>
                  <div className="aal-stage-detail">{step.detail}</div>
                </div>

                {isDone && (
                  <span className="aal-done-badge" aria-hidden="true">
                    Verified
                  </span>
                )}
                {isCurrent && (
                  <span className="aal-generating-badge" aria-hidden="true">
                    Synthesizing...
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Error / Timeout Warning State */}
        <AnimatePresence>
          {(error || isTimedOut) && (
            <motion.div
              className="aal-timeout-banner"
              initial={{ opacity: 0, height: 0, y: 10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="aal-timeout-content">
                <AlertCircle className="aal-timeout-icon" aria-hidden="true" />
                <div className="aal-timeout-text">
                  <strong>{error ? 'Synthesis Error' : 'Backend Generation in Progress'}</strong>
                  <p>
                    {error ||
                      `AI question generation is taking longer than usual (~${elapsedSec}s elapsed). You can wait for the socket stream or proceed directly.`}
                  </p>
                </div>
              </div>

              <div className="aal-timeout-actions">
                {onRetry && (
                  <button type="button" onClick={onRetry} className="aal-btn-retry">
                    <RefreshCw className="aal-btn-icon" />
                    Retry Generation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (onSkip) onSkip();
                    else if (onComplete) onComplete();
                  }}
                  className="aal-btn-proceed"
                >
                  Enter Interview Arena
                  <ArrowRight className="aal-btn-icon" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Studio Footer Strip */}
        <footer className="aal-card-footer">
          <div className="aal-engine-meta">
            <ShieldCheck className="aal-footer-icon" aria-hidden="true" />
            <span>DeepSeek V3 & Aura-2 TTS Pipeline</span>
          </div>

          <div className="aal-step-meta" aria-live="polite">
            <span className="aal-elapsed-tag">~{elapsedSec}s</span>
            <span className="aal-step-tag">
              Stage {Math.min(currentStep, steps.length)} of {steps.length} ({progressPercent}%)
            </span>
            {onClose && (
              <span className="aal-shortcut-hint" aria-hidden="true">
                Esc to dismiss
              </span>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

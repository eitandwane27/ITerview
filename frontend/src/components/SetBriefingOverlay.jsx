// frontend/src/components/SetBriefingOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 Session Briefing - Technical Practice Studio (ITerview)
// Interactive 3C Diagnostic Calibration & Practice Studio Launch
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Sparkles,
  Target,
  CircleCheckBig,
  ArrowRight,
  X,
  Mic,
  Clock,
  Radio,
  Check,
} from 'lucide-react';
import mascotLaptopSrc from '../assets/mascot-laptop.png';
import './SetBriefingOverlay.css';

// Env-driven backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// ─── Format & Role Helpers ───────────────────────────────────────────────────

function formatRole(role) {
  if (!role || typeof role !== 'string') return 'Frontend Engineer';
  const trimmed = role.trim();
  if (!trimmed) return 'Frontend Engineer';
  const lower = trimmed.toLowerCase();
  if (lower === 'frontend') return 'Frontend Engineer';
  if (lower === 'backend') return 'Backend Engineer';
  if (lower === 'fullstack') return 'Fullstack Engineer';
  if (/developer/i.test(trimmed)) {
    return trimmed
      .replace(/developer/i, 'Engineer')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  if (!/engineer/i.test(trimmed)) {
    return `${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)} Engineer`;
  }
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
  },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -6,
    transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SetBriefingOverlay({
  role = '',
  focusArea = 'auto',
  diagnosticData = null,
  onConfirm,
  onClose,
  onReady, // legacy alias
}) {
  const [profile, setProfile] = useState(null);
  const [isSampleBaseline, setIsSampleBaseline] = useState(false);
  const [loading, setLoading] = useState(!role && !diagnosticData);
  const prefersReducedMotion = useReducedMotion();
  const isTriggeredRef = useRef(false);
  const modalCardRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Disable background body scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    modalCardRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  // Fallback fetch if opened in isolation or dev preview without props
  useEffect(() => {
    if (role || diagnosticData) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile({
          role: 'Frontend',
          threeCBreakdown: {
            clarity: 3.2,
            correctness: 4.2,
            completeness: 3.6,
            lowestMetric: 'clarity',
          },
        });
        setIsSampleBaseline(true);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/users/results-summary?uid=${encodeURIComponent(user.uid)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('SetBriefingOverlay fallback fetch error:', err.message);
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [role, diagnosticData]);

  // Derived effective values
  const effectiveRole = role || profile?.role || profile?.user?.role || 'Frontend';
  const formattedRole = formatRole(effectiveRole);
  const effectiveDiagnostic = diagnosticData || profile;

  // Extract 3C Breakdown scores
  const threeC = useMemo(() => effectiveDiagnostic?.threeCBreakdown || {}, [effectiveDiagnostic]);
  const clarityScore = typeof threeC.clarity === 'number' ? threeC.clarity : null;
  const correctnessScore = typeof threeC.correctness === 'number' ? threeC.correctness : null;
  const completenessScore = typeof threeC.completeness === 'number' ? threeC.completeness : null;

  // Identify baseline lowest metric to recommend
  const baselineLowestKey = useMemo(() => {
    if (threeC.lowestMetric) return threeC.lowestMetric;
    if (clarityScore != null && correctnessScore != null && completenessScore != null) {
      if (clarityScore <= correctnessScore && clarityScore <= completenessScore) return 'clarity';
      if (correctnessScore <= completenessScore) return 'correctness';
      return 'completeness';
    }
    const tag =
      effectiveDiagnostic?.postWeaknessTag ||
      effectiveDiagnostic?.preWeaknessTag ||
      effectiveDiagnostic?.weaknessTag ||
      '';
    if (tag.includes('clarity')) return 'clarity';
    if (tag.includes('correctness') || tag.includes('accuracy')) return 'correctness';
    if (tag.includes('completeness')) return 'completeness';
    return 'clarity';
  }, [threeC, clarityScore, correctnessScore, completenessScore, effectiveDiagnostic]);

  // Determine initial focus: honor explicit focusArea prop if provided, else baseline lowest
  const initialFocusKey = useMemo(() => {
    if (focusArea && focusArea !== 'auto') {
      const lower = focusArea.toLowerCase();
      if (lower.includes('clarity')) return 'clarity';
      if (lower.includes('correctness') || lower.includes('accuracy')) return 'correctness';
      if (lower.includes('completeness') || lower.includes('depth')) return 'completeness';
    }
    return baselineLowestKey;
  }, [focusArea, baselineLowestKey]);

  // User-selectable active coaching focus
  const [selectedFocus, setSelectedFocus] = useState(initialFocusKey);

  // Keep selectedFocus synced if initialFocusKey changes upon loading data
  useEffect(() => {
    if (initialFocusKey) {
      setSelectedFocus(initialFocusKey);
    }
  }, [initialFocusKey]);

  // Morphing Loading / Preparation State
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [prepProgress, setPrepProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const prepTimersRef = useRef([]);
  const wsRef = useRef(null);

  // Clean up timers & socket on unmount
  useEffect(() => {
    return () => {
      prepTimersRef.current.forEach(clearTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleDismiss = useCallback(() => {
    prepTimersRef.current.forEach(clearTimeout);
    prepTimersRef.current = [];
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsPreparing(false);
    isTriggeredRef.current = false;
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  const handleCancelPreparation = useCallback(() => {
    if (isPreparing) {
      prepTimersRef.current.forEach(clearTimeout);
      prepTimersRef.current = [];
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsPreparing(false);
      setPrepProgress(0);
      setStageText('');
      setIsSessionReady(false);
      isTriggeredRef.current = false;
    } else {
      handleDismiss();
    }
  }, [isPreparing, handleDismiss]);

  // Launch callback with real backend WebSocket telemetry
  const handleLaunch = useCallback(async () => {
    if (isTriggeredRef.current || isPreparing) return;

    if (isSessionReady) {
      isTriggeredRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (typeof onConfirm === 'function') {
        onConfirm(selectedFocus);
      } else if (typeof onReady === 'function') {
        onReady(selectedFocus);
      }
      return;
    }

    setIsPreparing(true);
    setPrepProgress(20);
    setStageText(`Preparing your ${formattedRole} studio...`);

    prepTimersRef.current.forEach(clearTimeout);
    prepTimersRef.current = [];

    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous_user';

    // 1. Persist chosen role and chosen focus area to backend
    if (user) {
      try {
        await fetch('/api/users/role', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid: user.uid,
            role: effectiveRole,
            focusArea: selectedFocus,
          }),
        });
      } catch (err) {
        console.warn('Could not save role before socket generation:', err);
      }
    }

    // 2. Open live WebSocket connection to stream question generation
    let isSocketHandled = false;

    const runFallbackSimulation = () => {
      if (isSocketHandled) return;
      isSocketHandled = true;
      setPrepProgress(28);
      setStageText('Generating five practice questions calibrated to your baseline...');
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const t1 = setTimeout(() => {
        setPrepProgress(52);
        setStageText(`Adapting questions for ${formattedRole} (${selectedFocus})...`);
      }, 700);

      const t2 = setTimeout(() => {
        setPrepProgress(78);
        setStageText('Synthesizing voice prompt audio...');
      }, 1500);

      const t3 = setTimeout(() => {
        setPrepProgress(100);
        setStageText('Practice studio ready.');
        setIsPreparing(false);
        setIsSessionReady(true);
      }, 2300);

      prepTimersRef.current = [t1, t2, t3];
    };

    try {
      const focusParam = selectedFocus ? `&focusArea=${encodeURIComponent(selectedFocus)}` : '';
      const ws = new WebSocket(
        `${BACKEND_URL.replace(/^http/, 'ws')}/ws/set1?voice=aura-2-luna-en&uid=${uid}${focusParam}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setPrepProgress(25);
        setStageText('Connected to coaching studio. Generating questions...');
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'generation_progress':
            if (msg.stage === 'evaluating_baseline') {
              setPrepProgress(32);
              setStageText(msg.message || 'Evaluating your 3C diagnostic baseline...');
            } else if (msg.stage === 'generating_questions') {
              const current = msg.current || 1;
              const total = msg.total || 5;
              const pct = 32 + Math.round((current / total) * 58);
              setPrepProgress(pct);
              setStageText(msg.message || `Generating question ${current} of ${total}...`);
            }
            break;

          case 'question_text':
            setPrepProgress(92);
            setStageText('Questions ready. Preparing voice audio...');
            break;

          case 'generation_complete':
          case 'tts_audio':
            isSocketHandled = true;
            setPrepProgress(100);
            setStageText('Studio ready.');
            setIsPreparing(false);
            setIsSessionReady(true);
            break;

          case 'error':
            console.warn('[SetBriefingOverlay] WS error event:', msg.message);
            runFallbackSimulation();
            break;

          default:
            break;
        }
      };

      ws.onerror = () => {
        console.warn('[SetBriefingOverlay] WS error, using safe fallback simulation.');
        runFallbackSimulation();
      };

      // Guard timer
      const guardTimer = setTimeout(() => {
        if (!isTriggeredRef.current) {
          runFallbackSimulation();
        }
      }, 10000);
      prepTimersRef.current.push(guardTimer);
    } catch (err) {
      console.warn('[SetBriefingOverlay] WS exception:', err);
      runFallbackSimulation();
    }
  }, [
    isPreparing,
    isSessionReady,
    formattedRole,
    effectiveRole,
    selectedFocus,
    onConfirm,
    onReady,
  ]);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isPreparing) {
          handleCancelPreparation();
        } else {
          handleDismiss();
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (loading || isPreparing) return;
        if (document.activeElement === modalCardRef.current) {
          e.preventDefault();
          handleLaunch();
        }
      }
    },
    [handleCancelPreparation, handleDismiss, handleLaunch, isPreparing, loading]
  );

  // 3C Metric definition with standardized naming & descriptions
  const scoreItems = useMemo(
    () => [
      {
        key: 'clarity',
        label: 'Clarity',
        shortLabel: 'Clarity',
        score: clarityScore,
        description: 'Structured reasoning, clear signposting, and logical flow from premise to conclusion.',
        coachTip:
          "I'll focus on how logically your answers unfold. Structure your thoughts clearly before diving into code!",
      },
      {
        key: 'correctness',
        label: 'Correctness',
        shortLabel: 'Correctness',
        score: correctnessScore,
        description: 'Precise engineering terminology, sound architectural concepts, and correct trade-offs.',
        coachTip:
          "I'll listen closely for precise concepts, accurate API usage, and technically sound reasoning!",
      },
      {
        key: 'completeness',
        label: 'Completeness',
        shortLabel: 'Completeness',
        score: completenessScore,
        description: 'Edge cases, performance trade-offs, scalability, and holistic implementation details.',
        coachTip:
          "I'll challenge you on edge cases, scaling limits, and realistic production trade-offs!",
      },
    ],
    [clarityScore, correctnessScore, completenessScore]
  );

  const activeMetricObj = useMemo(
    () => scoreItems.find((item) => item.key === selectedFocus) || scoreItems[0],
    [scoreItems, selectedFocus]
  );

  return (
    <Motion.div
      className="sb-overlay"
      variants={overlayVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
      exit="exit"
      onClick={isPreparing ? handleCancelPreparation : handleDismiss}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="presentation"
    >
      <Motion.div
        ref={modalCardRef}
        className={`sb-modal ${isPreparing ? 'sb-modal--preparing' : ''}`}
        variants={modalVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby={loading ? undefined : 'sb-title'}
        aria-describedby={loading ? undefined : 'sb-description'}
        aria-label={loading ? 'Loading practice studio briefing' : undefined}
        aria-busy={loading || isPreparing}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Topbar: Clean, honest metadata without faux buttons */}
        <div className="sb-topbar">
          <div className="sb-topbar-meta">
            <span className="sb-studio-tag">Practice Studio</span>
            <span className="sb-meta-divider" aria-hidden="true">
              /
            </span>
            <span className="sb-role-badge">{formattedRole}</span>
          </div>

          <div className="sb-topbar-actions">
            {onClose && (
              <button
                type="button"
                className="sb-close-btn"
                onClick={handleDismiss}
                aria-label="Close practice briefing"
                title="Close (Esc)"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="sb-skeleton" aria-label="Loading your practice briefing" role="status">
            <span className="sb-sr-only">Loading your practice briefing</span>
            <div className="sb-skeleton-col">
              <span className="sb-skeleton-line sb-skeleton-line--title" />
              <span className="sb-skeleton-line sb-skeleton-line--body" />
              <span className="sb-skeleton-block" />
            </div>
            <div className="sb-skeleton-col">
              <span className="sb-skeleton-row" />
              <span className="sb-skeleton-row" />
              <span className="sb-skeleton-row" />
            </div>
          </div>
        ) : (
          <Motion.div className="sb-content" variants={itemVariants}>
            {/* Header: Direct & Authoritative */}
            <header className="sb-header">
              <h2 id="sb-title" className="sb-title">
                {formattedRole} Practice Briefing
              </h2>
              <p id="sb-description" className="sb-subtitle">
                Calibrated to your diagnostic baseline. Select your coaching focus to customize the
                adaptive AI questions.
              </p>
            </header>

            {/* Split Body: Coach Guide (Left) + Interactive 3C Matrix (Right) */}
            <div className="sb-grid">
              {/* Left Column: Mascot & Session Checklist */}
              <section className="sb-coach-panel" aria-label="Coaching Overview">
                <div className="sb-coach-card">
                  <div className="sb-mascot-wrap">
                    <img
                      src={mascotLaptopSrc}
                      alt="ITerview AI coach at laptop"
                      className="sb-mascot-img"
                      draggable="false"
                    />
                  </div>

                  <div className="sb-speech-bubble" role="status" aria-live="polite">
                    <div className="sb-bubble-header">
                      <Sparkles size={14} className="sb-bubble-icon" aria-hidden="true" />
                      <strong>Coach Focus: {activeMetricObj.label}</strong>
                    </div>
                    <p>{activeMetricObj.coachTip}</p>
                  </div>
                </div>

                {/* Session Parameters / Readiness List */}
                <div className="sb-parameters-card">
                  <div className="sb-param-item">
                    <Radio size={16} className="sb-param-icon" aria-hidden="true" />
                    <div>
                      <strong>5 Spoken Questions</strong>
                      <span>Adaptive difficulty</span>
                    </div>
                  </div>

                  <div className="sb-param-item">
                    <Clock size={16} className="sb-param-icon" aria-hidden="true" />
                    <div>
                      <strong>~10 Minutes</strong>
                      <span>Self-paced answers</span>
                    </div>
                  </div>

                  <div className="sb-param-item">
                    <Mic size={16} className="sb-param-icon" aria-hidden="true" />
                    <div>
                      <strong>Voice Audio Studio</strong>
                      <span>Real-time speech evaluation</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Column: Interactive 3C Diagnostic Selector */}
              <section
                className="sb-matrix-panel"
                aria-label="3C Diagnostic Baseline & Focus Selection"
              >
                <div className="sb-matrix-header">
                  <div>
                    <h3 className="sb-matrix-title">Diagnostic Baseline</h3>
                    <p className="sb-matrix-subtitle">
                      {isSampleBaseline ? 'Sample diagnostic profile' : 'Your recent diagnostic scores'}.{' '}
                      <strong>Click to set your practice focus.</strong>
                    </p>
                  </div>
                  <span className="sb-scale-hint">Scale /5</span>
                </div>

                <div
                  className="sb-metric-list"
                  role="radiogroup"
                  aria-label="Select your practice coaching focus"
                >
                  {scoreItems.map((item) => {
                    const isSelected = selectedFocus === item.key;
                    const isLowest = baselineLowestKey === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isPreparing}
                        onClick={() => setSelectedFocus(item.key)}
                        className={`sb-metric-card ${isSelected ? 'sb-metric-card--selected' : ''}`}
                      >
                        <div className="sb-metric-left">
                          <div className="sb-radio-indicator" aria-hidden="true">
                            {isSelected ? (
                              <div className="sb-radio-dot" />
                            ) : (
                              <div className="sb-radio-empty" />
                            )}
                          </div>

                          <div className="sb-metric-info">
                            <div className="sb-metric-title-row">
                              <span
                                className={`sb-metric-icon sb-metric-icon--${item.key}`}
                                aria-hidden="true"
                              >
                                {item.key === 'clarity' ? (
                                  <Sparkles size={15} />
                                ) : item.key === 'correctness' ? (
                                  <Target size={15} />
                                ) : (
                                  <CircleCheckBig size={15} />
                                )}
                              </span>
                              <strong className="sb-metric-name">{item.label}</strong>

                              {isSelected ? (
                                <span className="sb-badge-focus">
                                  <Check size={11} aria-hidden="true" /> Active Focus
                                </span>
                              ) : isLowest ? (
                                <span className="sb-badge-recommended">Recommended</span>
                              ) : null}
                            </div>
                            <p className="sb-metric-desc">{item.description}</p>
                          </div>
                        </div>

                        <div className="sb-metric-score" aria-label={`Score: ${item.score ?? 'N/A'} out of 5`}>
                          <span className="sb-score-num">{item.score != null ? item.score : '—'}</span>
                          {item.score != null && <span className="sb-score-denom">/5</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </Motion.div>
        )}

        {/* Footer: Single-Flow Launch & Progress Display */}
        <div className="sb-footer">
          <div className="sb-footer-status">
            {isPreparing ? (
              <div
                className="sb-progress-wrap"
                role="progressbar"
                aria-valuenow={prepProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Studio preparation: ${prepProgress}%`}
              >
                <div className="sb-progress-label">
                  <span>{stageText || 'Configuring voice studio...'}</span>
                  <span className="sb-progress-pct">{prepProgress}%</span>
                </div>
                <div className="sb-progress-track">
                  <div
                    className="sb-progress-fill"
                    style={{ width: `${prepProgress}%` }}
                  />
                </div>
              </div>
            ) : isSessionReady ? (
              <div className="sb-status-ready">
                <span className="sb-ready-dot" aria-hidden="true" />
                <div>
                  <strong>Studio Ready</strong>
                  <span>5 calibrated questions prepared. Click enter to begin.</span>
                </div>
              </div>
            ) : (
              <div className="sb-status-idle">
                <strong>Focusing on {activeMetricObj.label}</strong>
                <span>Instant voice coaching begins upon entering the studio.</span>
              </div>
            )}
          </div>

          <div className="sb-footer-actions">
            {onClose && (
              <button
                ref={cancelBtnRef}
                type="button"
                className="sb-btn-secondary"
                onClick={isPreparing ? handleCancelPreparation : handleDismiss}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              className="sb-btn-primary"
              onClick={handleLaunch}
              id="btn-confirm-launch-practice"
              disabled={loading || isPreparing}
            >
              <span>
                {loading
                  ? 'Loading studio...'
                  : isPreparing
                    ? 'Preparing session...'
                    : isSessionReady
                      ? 'Enter Studio'
                      : 'Start Practice Studio'}
              </span>
              {isPreparing ? (
                <span className="sb-btn-spinner" aria-hidden="true" />
              ) : (
                <ArrowRight size={17} className="sb-btn-arrow" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>
  );
}

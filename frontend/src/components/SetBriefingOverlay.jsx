// frontend/src/components/SetBriefingOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 Session Briefing — Technical Practice Studio (ITerview)
// Streamlined Studio Briefing · 3C Diagnostic Baseline · Practice Session
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Sparkles,
  Target,
  Mic,
  ArrowRight,
  X,
  Bot,
  TrendingUp,
  BarChart3,
  Loader2,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import './SetBriefingOverlay.css';

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

function getRoleScopeSummary(role) {
  const lower = (role || '').toLowerCase();
  if (lower.includes('frontend')) return 'HTML/CSS · JavaScript · DOM · Web APIs';
  if (lower.includes('backend')) return 'APIs · Node/Express · Databases · Architecture';
  if (lower.includes('fullstack')) return 'Client-Server · Data Flow · APIs · Performance';
  return 'Core Concepts · Architecture · Problem Solving';
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
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.04,
      delayChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -8,
    transition: { duration: 0.16, ease: 'easeInOut' },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
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
  const [loading, setLoading] = useState(!role && !diagnosticData);
  const isTriggeredRef = useRef(false);
  const modalCardRef = useRef(null);
  const launchBtnRef = useRef(null);

  // Theme — mirrors Dashboard's localStorage-backed toggle ("iterview-theme").
  // Read once at mount: the overlay is short-lived and always opened after the
  // dashboard has rendered, so the stored preference is current.
  const [theme] = useState(() => {
    try {
      return localStorage.getItem('iterview-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // Disable background body scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
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
            clarity: 6.5,
            correctness: 8.5,
            completeness: 7.2,
            lowestMetric: 'clarity',
          },
        });
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
  const roleScope = getRoleScopeSummary(effectiveRole);
  const effectiveDiagnostic = diagnosticData || profile;

  // Extract 3C Breakdown scores
  const threeC = effectiveDiagnostic?.threeCBreakdown || {};
  const clarityScore = typeof threeC.clarity === 'number' ? threeC.clarity : null;
  const correctnessScore = typeof threeC.correctness === 'number' ? threeC.correctness : null;
  const completenessScore = typeof threeC.completeness === 'number' ? threeC.completeness : null;

  const isAuto = !focusArea || focusArea === 'auto';

  // Determine target metric (either custom focusArea or lowest metric from diagnostic)
  const targetKey = useMemo(() => {
    if (focusArea && focusArea !== 'auto') {
      const lower = focusArea.toLowerCase();
      if (lower.includes('clarity')) return 'clarity';
      if (lower.includes('correctness') || lower.includes('accuracy')) return 'correctness';
      if (lower.includes('completeness') || lower.includes('depth')) return 'completeness';
    }
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
    if (tag.includes('correctness')) return 'correctness';
    if (tag.includes('completeness')) return 'completeness';
    return null;
  }, [focusArea, threeC, clarityScore, correctnessScore, completenessScore, effectiveDiagnostic]);

  // Pattern B: Morphing Loading / Preparation State
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepStage, setPrepStage] = useState(0);
  const [prepProgress, setPrepProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const prepTimersRef = useRef([]);
  const wsRef = useRef(null);

  // Telemetry stages for Pattern B morphing preparation
  const targetLabel = useMemo(() => {
    if (targetKey === 'clarity') return 'Clarity & Delivery';
    if (targetKey === 'correctness') return 'Technical Accuracy';
    if (targetKey === 'completeness') return 'Depth & Completeness';
    return 'Technical Mastery';
  }, [targetKey]);

  const prepStages = useMemo(
    () => [
      { label: `Analyzing diagnostic baseline for ${formattedRole}...`, pct: 20 },
      { label: `Calibrating rubric targeting ${targetLabel}...`, pct: 48 },
      { label: `Synthesizing 5 personalized questions (DeepSeek)...`, pct: 76 },
      { label: `Compiling Aura-2 voice audio stream...`, pct: 94 },
      { label: `Session ready! Launching Practice Arena...`, pct: 100 },
    ],
    [formattedRole, targetLabel]
  );

  // Clean up preparation timers and WebSocket on unmount
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

  // Dismiss callback
  const handleDismiss = useCallback(() => {
    if (isPreparing) {
      prepTimersRef.current.forEach(clearTimeout);
      prepTimersRef.current = [];
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsPreparing(false);
      isTriggeredRef.current = false;
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [isPreparing, onClose]);

  // Cancel / Abort preparation if user cancels
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
      setPrepStage(0);
      setPrepProgress(0);
      setStageText('');
      isTriggeredRef.current = false;
    } else {
      handleDismiss();
    }
  }, [isPreparing, handleDismiss]);

  // Launch callback with real backend WebSocket telemetry
  const handleLaunch = useCallback(async () => {
    if (isTriggeredRef.current || isPreparing) return;
    setIsPreparing(true);
    setPrepProgress(18);
    setStageText(`Initializing session for ${formattedRole}...`);

    // Clear any previous timers
    prepTimersRef.current.forEach(clearTimeout);
    prepTimersRef.current = [];

    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous_user';

    // 1. Persist role and focus area to backend if authenticated
    if (user) {
      try {
        await fetch('/api/users/role', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid: user.uid,
            role: effectiveRole,
            focusArea: focusArea || 'auto',
          }),
        });
      } catch (err) {
        console.warn('Could not save role before socket generation:', err);
      }
    }

    // 2. Open live WebSocket connection to trigger & stream question generation
    let isSocketHandled = false;

    const runFallbackSimulation = () => {
      if (isSocketHandled) return;
      isSocketHandled = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      // Smooth fallback progression
      const t1 = setTimeout(() => {
        setPrepStage(1);
        setPrepProgress(prepStages[1].pct);
        setStageText(prepStages[1].label);
      }, 700);

      const t2 = setTimeout(() => {
        setPrepStage(2);
        setPrepProgress(prepStages[2].pct);
        setStageText(prepStages[2].label);
      }, 1600);

      const t3 = setTimeout(() => {
        setPrepStage(3);
        setPrepProgress(prepStages[3].pct);
        setStageText(prepStages[3].label);
      }, 2500);

      const t4 = setTimeout(() => {
        setPrepStage(4);
        setPrepProgress(prepStages[4].pct);
        setStageText(prepStages[4].label);
      }, 3300);

      const tFinal = setTimeout(() => {
        isTriggeredRef.current = true;
        if (typeof onConfirm === 'function') {
          onConfirm();
        } else if (typeof onReady === 'function') {
          onReady();
        }
      }, 3900);

      prepTimersRef.current = [t1, t2, t3, t4, tFinal];
    };

    try {
      const focusParam = focusArea ? `&focusArea=${encodeURIComponent(focusArea)}` : '';
      const ws = new WebSocket(
        `ws://localhost:5000/ws/set1?voice=aura-2-luna-en&uid=${uid}${focusParam}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setPrepProgress(25);
        setStageText(`Connected to DeepSeek AI Engine...`);
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
              setPrepProgress(28);
              setStageText(msg.message || `Evaluating baseline 3C scores...`);
            } else if (msg.stage === 'generating_questions') {
              const current = msg.current || 1;
              const total = msg.total || 5;
              const pct = 30 + Math.round((current / total) * 60);
              setPrepProgress(pct);
              setStageText(
                msg.message || `Synthesizing question ${current} of ${total} (${formattedRole})...`
              );
            }
            break;

          case 'question_text':
            setPrepProgress(94);
            setStageText(`Question ready · Compiling voice audio...`);
            break;

          case 'generation_complete':
          case 'tts_audio':
            isSocketHandled = true;
            setPrepProgress(100);
            setStageText(`Session ready! Launching Practice Arena...`);
            setTimeout(() => {
              if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
              }
              isTriggeredRef.current = true;
              if (typeof onConfirm === 'function') {
                onConfirm();
              } else if (typeof onReady === 'function') {
                onReady();
              }
            }, 450);
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
        console.warn('[SetBriefingOverlay] WS connection failed, running fallback simulation.');
        runFallbackSimulation();
      };

      // Guard timer: if real WS takes > 12s, complete safely
      const guardTimer = setTimeout(() => {
        if (!isTriggeredRef.current) {
          runFallbackSimulation();
        }
      }, 12000);
      prepTimersRef.current.push(guardTimer);
    } catch (err) {
      console.warn('[SetBriefingOverlay] WS exception:', err);
      runFallbackSimulation();
    }
  }, [isPreparing, formattedRole, effectiveRole, focusArea, prepStages, onConfirm, onReady]);

  // Auto focus launch button
  useEffect(() => {
    if (!loading && launchBtnRef.current) {
      launchBtnRef.current.focus();
    }
  }, [loading]);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleDismiss();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault();
        handleLaunch();
        return;
      }
      if (e.key === 'Tab') {
        const modal = modalCardRef.current;
        if (!modal) return;
        const focusables = Array.from(
          modal.querySelectorAll(
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
      }
    },
    [handleDismiss, handleLaunch]
  );

  return (
    <motion.div
      className="sb-overlay"
      data-theme={theme}
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleDismiss}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="presentation"
    >
      <motion.div
        ref={modalCardRef}
        className="sb-modal"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Atmospheric Glow & Active Scanner ── */}
        <div className="sb-modal-bloom" aria-hidden="true" />
        {isPreparing && <div className="sb-modal-scanner" aria-hidden="true" />}

        {/* ── 1. Header Section ── */}
        <motion.div className="sb-header" variants={itemVariants}>
          <div className="sb-header-main">
            <h2 id="sb-title" className="sb-title">
              {isPreparing ? 'Calibrating your session...' : `${formattedRole} · Set 01`}
            </h2>

            <div className="sb-role-strip">
              <span className="sb-role-scope">{roleScope}</span>
            </div>
          </div>

          <div className="sb-header-side">
            {isPreparing ? (
              <span className="sb-tag sb-tag--synthesis">
                <Cpu size={11} className="sb-tag-icon sb-spin-slow" />
                Generating questions…
              </span>
            ) : isAuto ? (
              <span className="sb-tag sb-tag--cyan">
                <Sparkles size={11} className="sb-tag-icon" />
                Auto-calibrated Focus
              </span>
            ) : (
              <span className="sb-tag sb-tag--sun">
                <Target size={11} className="sb-tag-icon" />
                Custom Target
              </span>
            )}

            {onClose && (
              <button
                type="button"
                className="sb-close-btn"
                onClick={handleDismiss}
                aria-label="Close session calibration modal"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </motion.div>

        {/* ── 2. 3C Diagnostic Baseline (Airy Triad Grid) ── */}
        <motion.div className="sb-breakdown-section" variants={itemVariants}>
          <div className="sb-section-header">
            <div className="sb-section-title-wrap">
              <BarChart3 size={13} className="sb-section-icon" />
              <span className="sb-section-title">
                {isPreparing ? 'Calibrating Metric Thresholds' : 'Diagnostic Baseline'}
              </span>
            </div>
            <span className="sb-section-sub">
              {isPreparing ? `Targeting ${targetLabel}` : 'Scored out of 10'}
            </span>
          </div>

          <div className="sb-triad-grid">
            {/* Metric 1: Clarity (Sky) */}
            <div
              className={`sb-triad-card sb-triad-card--sky ${
                targetKey === 'clarity' ? 'sb-triad-card--active' : ''
              } ${isPreparing && targetKey === 'clarity' ? 'sb-triad-card--calibrating' : ''}`}
            >
              <div className="sb-triad-head">
                <div className="sb-triad-indicator">
                  <span className="sb-triad-dot sb-triad-dot--sky" />
                  <span className="sb-triad-label">Clarity</span>
                </div>
                {targetKey === 'clarity' && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">{clarityScore != null ? clarityScore : '7.0'}</span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--sky"
                  style={{
                    width: `${Math.min(100, ((clarityScore != null ? clarityScore : 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 2: Accuracy / Correctness (Mint) */}
            <div
              className={`sb-triad-card sb-triad-card--mint ${
                targetKey === 'correctness' ? 'sb-triad-card--active' : ''
              } ${isPreparing && targetKey === 'correctness' ? 'sb-triad-card--calibrating' : ''}`}
            >
              <div className="sb-triad-head">
                <div className="sb-triad-indicator">
                  <span className="sb-triad-dot sb-triad-dot--mint" />
                  <span className="sb-triad-label">Accuracy</span>
                </div>
                {targetKey === 'correctness' && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">
                  {correctnessScore != null ? correctnessScore : '7.0'}
                </span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--mint"
                  style={{
                    width: `${Math.min(100, ((correctnessScore != null ? correctnessScore : 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 3: Depth / Completeness (Lilac) */}
            <div
              className={`sb-triad-card sb-triad-card--lilac ${
                targetKey === 'completeness' ? 'sb-triad-card--active' : ''
              } ${isPreparing && targetKey === 'completeness' ? 'sb-triad-card--calibrating' : ''}`}
            >
              <div className="sb-triad-head">
                <div className="sb-triad-indicator">
                  <span className="sb-triad-dot sb-triad-dot--lilac" />
                  <span className="sb-triad-label">Completeness</span>
                </div>
                {targetKey === 'completeness' && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">
                  {completenessScore != null ? completenessScore : '7.0'}
                </span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--lilac"
                  style={{
                    width: `${Math.min(100, ((completenessScore != null ? completenessScore : 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 3. Session Blueprint Strip (Integrated Features) ── */}
        <motion.div className="sb-blueprint-strip" variants={itemVariants}>
          <div className="sb-blueprint-item">
            <div className="sb-blueprint-icon-halo sb-blueprint-icon-halo--cyan">
              <Mic size={13} />
            </div>
            <div className="sb-blueprint-text">
              <span className="sb-blueprint-title">5 Voice Prompts</span>
              <span className="sb-blueprint-desc">Targeted technical set</span>
            </div>
          </div>

          <div className="sb-blueprint-divider" aria-hidden="true" />

          <div className="sb-blueprint-item">
            <div className="sb-blueprint-icon-halo sb-blueprint-icon-halo--lilac">
              <Bot size={13} />
            </div>
            <div className="sb-blueprint-text">
              <span className="sb-blueprint-title">AI Coach Tips</span>
              <span className="sb-blueprint-desc">Dynamic guidance</span>
            </div>
          </div>

          <div className="sb-blueprint-divider" aria-hidden="true" />

          <div className="sb-blueprint-item">
            <div className="sb-blueprint-icon-halo sb-blueprint-icon-halo--mint">
              <TrendingUp size={13} />
            </div>
            <div className="sb-blueprint-text">
              <span className="sb-blueprint-title">Live 3C Scoring</span>
              <span className="sb-blueprint-desc">Rubric updates</span>
            </div>
          </div>
        </motion.div>

        {/* ── 4. Action Footer — Pattern B Morphing Execution ── */}
        <motion.div className="sb-footer" variants={itemVariants}>
          <div className="sb-actions">
            {onClose && (
              <button
                type="button"
                className="sb-btn-secondary"
                onClick={isPreparing ? handleCancelPreparation : handleDismiss}
              >
                {isPreparing ? 'Cancel' : 'Cancel'}
              </button>
            )}

            {isPreparing ? (
              <div
                className="sb-morphing-btn"
                role="progressbar"
                aria-valuenow={prepProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Session calibration progress: ${prepProgress}%`}
              >
                {/* Progress fill bar */}
                <div className="sb-morphing-fill" style={{ width: `${prepProgress}%` }} />

                {/* Content row */}
                <div className="sb-morphing-content">
                  <div className="sb-morphing-left">
                    <div className="sb-mini-pulse-ring" aria-hidden="true">
                      <span className="sb-mini-pulse-core" />
                    </div>
                    <span className="sb-morphing-text">
                      {stageText || prepStages[prepStage]?.label}
                    </span>
                  </div>
                  <span className="sb-morphing-pct">{prepProgress}%</span>
                </div>
              </div>
            ) : (
              <button
                ref={launchBtnRef}
                type="button"
                className="sb-btn-primary"
                onClick={handleLaunch}
                id="btn-confirm-launch-practice"
              >
                <span>Start Set 1 Practice</span>
                <ArrowRight size={15} className="sb-btn-arrow" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="sb-shortcut-hint" aria-hidden="true">
            {isPreparing ? (
              <span>
                Synthesizing session parameters · Press <kbd className="sb-kbd">Esc</kbd> to abort
              </span>
            ) : (
              <>
                <span>
                  Press <kbd className="sb-kbd">Enter ↵</kbd> to begin
                </span>
                <span className="sb-shortcut-sep">·</span>
                <span>
                  <kbd className="sb-kbd">Esc</kbd> to dismiss
                </span>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

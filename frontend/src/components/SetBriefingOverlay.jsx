// frontend/src/components/SetBriefingOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 Session Briefing — Technical Practice Studio (ITerview)
// Studio DNA · Playful Palette · Dynamic AI Weakness Engine Calibration
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  Target,
  Compass,
  CheckCircle2,
  Mic,
  ArrowRight,
  X,
  Layers,
  Activity,
  ShieldCheck,
  Sparkles,
  Bot,
  TrendingUp,
  Cpu,
  BarChart3,
} from "lucide-react";
import "./SetBriefingOverlay.css";

// ─── Format & Role Helpers ───────────────────────────────────────────────────

function formatRole(role) {
  if (!role || typeof role !== "string") return "Frontend Engineer";
  const trimmed = role.trim();
  if (!trimmed) return "Frontend Engineer";
  const lower = trimmed.toLowerCase();
  if (lower === "frontend") return "Frontend Engineer";
  if (lower === "backend") return "Backend Engineer";
  if (lower === "fullstack") return "Fullstack Engineer";
  if (/developer/i.test(trimmed)) {
    return trimmed
      .replace(/developer/i, "Engineer")
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (!/engineer/i.test(trimmed)) {
    return `${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)} Engineer`;
  }
  return trimmed.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function getRoleScopeSummary(role) {
  const lower = (role || "").toLowerCase();
  if (lower.includes("frontend")) return "HTML/CSS · JavaScript · DOM · Web APIs";
  if (lower.includes("backend")) return "APIs · Node/Express · Databases · Architecture";
  if (lower.includes("fullstack")) return "Client-Server · Data Flow · APIs · Performance";
  return "Core Concepts · Architecture · Problem Solving";
}

// ─── Focus Area Themes & Rationale Config ────────────────────────────────────

const FOCUS_CONFIGS = {
  clarity: {
    key: "clarity",
    label: "Clarity & Structure",
    theme: "sky", // #5FB8FF
    accentColor: "#5FB8FF",
    icon: Compass,
    eyebrow: "AI WEAKNESS TARGET",
    description:
      "The Weakness Engine will prompt for step-by-step reasoning, concise summaries, and logical answer flow to sharpen your verbal delivery.",
  },
  correctness: {
    key: "correctness",
    label: "Technical Accuracy",
    theme: "mint", // #4FD6A3
    accentColor: "#4FD6A3",
    icon: CheckCircle2,
    eyebrow: "AI WEAKNESS TARGET",
    description:
      "The Weakness Engine will test core mechanics, precise technical terminology, and syntax accuracy across your role's domain.",
  },
  completeness: {
    key: "completeness",
    label: "Depth & Edge Cases",
    theme: "lilac", // #B28CFF
    accentColor: "#B28CFF",
    icon: Layers,
    eyebrow: "AI WEAKNESS TARGET",
    description:
      "The Weakness Engine will challenge you on architectural trade-offs, real-world constraints, and overlooked edge cases.",
  },
  communication: {
    key: "communication",
    label: "Delivery & Pacing",
    theme: "sun", // #FFC94D
    accentColor: "#FFC94D",
    icon: Activity,
    eyebrow: "COMMUNICATION TARGET",
    description:
      "The AI Coach monitors speech pacing, articulation, and filler words to ensure crisp, interview-ready presentation.",
  },
  star: {
    key: "star",
    label: "STAR Behavioral",
    theme: "cyan", // #06B6D4
    accentColor: "#06B6D4",
    icon: Target,
    eyebrow: "BEHAVIORAL TARGET",
    description:
      "Methodical behavioral response modeling: Situation, Task, Action, and Measurable Business Result.",
  },
  general: {
    key: "general",
    label: "3C Foundation",
    theme: "cyan",
    accentColor: "#06B6D4",
    icon: ShieldCheck,
    eyebrow: "CALIBRATION TARGET",
    description:
      "Balanced technical simulation testing clarity, accuracy, and completeness across your primary role scope.",
  },
};

function resolveFocusConfig(focusArea, diagnosticData, fallbackTag) {
  const breakdown = diagnosticData?.threeCBreakdown || {};
  const lowestMetric =
    breakdown.lowestMetric ||
    diagnosticData?.postWeaknessTag ||
    diagnosticData?.preWeaknessTag ||
    fallbackTag ||
    null;

  const isAuto = !focusArea || focusArea === "auto";
  const rawKey = (isAuto ? (lowestMetric || "general") : focusArea)
    .toLowerCase()
    .replace(/focus[_-]/g, "")
    .replace(/_/g, "-");

  let configKey = "general";
  if (rawKey.includes("clarity")) configKey = "clarity";
  else if (rawKey.includes("correctness")) configKey = "correctness";
  else if (rawKey.includes("completeness")) configKey = "completeness";
  else if (rawKey.includes("communication")) configKey = "communication";
  else if (rawKey.includes("star") || rawKey.includes("behavioral")) configKey = "star";

  const config = FOCUS_CONFIGS[configKey] || FOCUS_CONFIGS.general;
  return { ...config, isAuto, effectiveKey: configKey };
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: "easeIn" },
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
    transition: { duration: 0.16, ease: "easeInOut" },
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
  role = "",
  focusArea = "auto",
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

  // Disable background body scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
          role: "Frontend",
          weaknessTag: "focus_clarity",
          threeCBreakdown: {
            clarity: 6.5,
            correctness: 8.5,
            completeness: 7.2,
            lowestMetric: "clarity",
          },
        });
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/users/results-summary?uid=${encodeURIComponent(user.uid)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("SetBriefingOverlay fallback fetch error:", err.message);
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
  const effectiveRole = role || profile?.role || profile?.user?.role || "Frontend";
  const formattedRole = formatRole(effectiveRole);
  const roleScope = getRoleScopeSummary(effectiveRole);
  const effectiveDiagnostic = diagnosticData || profile;

  const focusConfig = useMemo(() => {
    return resolveFocusConfig(
      focusArea,
      effectiveDiagnostic,
      profile?.postWeaknessTag || profile?.preWeaknessTag || profile?.weaknessTag
    );
  }, [focusArea, effectiveDiagnostic, profile]);

  // Extract 3C Breakdown scores
  const threeC = effectiveDiagnostic?.threeCBreakdown || {};
  const clarityScore = typeof threeC.clarity === "number" ? threeC.clarity : null;
  const correctnessScore = typeof threeC.correctness === "number" ? threeC.correctness : null;
  const completenessScore = typeof threeC.completeness === "number" ? threeC.completeness : null;

  const lowestMetricKey =
    threeC.lowestMetric ||
    (clarityScore != null && correctnessScore != null && completenessScore != null
      ? (clarityScore <= correctnessScore && clarityScore <= completenessScore
          ? "clarity"
          : correctnessScore <= completenessScore
          ? "correctness"
          : "completeness")
      : null);

  const targetScore =
    focusConfig.effectiveKey === "clarity"
      ? clarityScore
      : focusConfig.effectiveKey === "correctness"
      ? correctnessScore
      : focusConfig.effectiveKey === "completeness"
      ? completenessScore
      : null;

  // Launch callback
  const handleLaunch = useCallback(() => {
    if (isTriggeredRef.current) return;
    isTriggeredRef.current = true;
    if (typeof onConfirm === "function") {
      onConfirm();
    } else if (typeof onReady === "function") {
      onReady();
    }
  }, [onConfirm, onReady]);

  // Dismiss callback
  const handleDismiss = useCallback(() => {
    if (typeof onClose === "function") {
      onClose();
    }
  }, [onClose]);

  // Auto focus launch button
  useEffect(() => {
    if (!loading && launchBtnRef.current) {
      launchBtnRef.current.focus();
    }
  }, [loading]);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleDismiss();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        if (document.activeElement?.tagName === "BUTTON") return;
        e.preventDefault();
        handleLaunch();
        return;
      }
      if (e.key === "Tab") {
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

  const FocusIcon = focusConfig.icon;

  return (
    <motion.div
      className="sb-overlay"
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
        {/* ── Top Atmospheric Glow ── */}
        <div className="sb-modal-bloom" aria-hidden="true" />

        {/* ── 1. Header Section ── */}
        <motion.div className="sb-header" variants={itemVariants}>
          <div className="sb-header-main">
            <div className="sb-kicker-row">
              <div className="sb-kicker-pill">
                <span className="sb-pulse-dot" aria-hidden="true" />
                <span className="sb-kicker-text">SET 01 · WEAKNESS ENGINE</span>
              </div>

              {focusConfig.isAuto ? (
                <span className="sb-badge sb-badge--cyan">
                  <Sparkles size={11} className="sb-badge-icon" />
                  Auto-calibrated
                </span>
              ) : (
                <span className="sb-badge sb-badge--sun">
                  <Target size={11} className="sb-badge-icon" />
                  Custom Focus
                </span>
              )}
            </div>

            <h2 id="sb-title" className="sb-title">
              Session Calibration
            </h2>

            <div className="sb-role-strip">
              <span className="sb-role-name">{formattedRole}</span>
              <span className="sb-role-dot">·</span>
              <span className="sb-role-scope">{roleScope}</span>
            </div>
          </div>

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
        </motion.div>

        {/* ── 2. Primary Focus Card (Hero Highlight) ── */}
        <motion.div
          className={`sb-focus-card sb-focus-card--${focusConfig.theme}`}
          variants={itemVariants}
        >
          <div className="sb-focus-card-header">
            <div className="sb-focus-icon-wrap">
              <FocusIcon size={16} className="sb-focus-icon" />
            </div>

            <div className="sb-focus-meta">
              <span className="sb-focus-eyebrow">{focusConfig.eyebrow}</span>
              <h3 className="sb-focus-name">{focusConfig.label}</h3>
            </div>

            {targetScore != null && (
              <div className="sb-score-chip sb-score-chip--target">
                <span className="sb-score-chip-label">Diagnostic</span>
                <span className="sb-score-chip-val">{targetScore} / 10</span>
              </div>
            )}
          </div>

          <p className="sb-focus-desc">{focusConfig.description}</p>
        </motion.div>

        {/* ── 3. 3C Diagnostic Breakdown (Live Backend Data) ── */}
        <motion.div className="sb-breakdown-section" variants={itemVariants}>
          <div className="sb-section-header">
            <span className="sb-section-title">
              <BarChart3 size={13} className="sb-section-icon" />
              3C Diagnostic Baseline
            </span>
            <span className="sb-section-sub">Scored out of 10</span>
          </div>

          <div className="sb-triad-grid">
            {/* Metric 1: Clarity (Sky) */}
            <div
              className={`sb-triad-card sb-triad-card--sky ${
                lowestMetricKey === "clarity" || focusConfig.effectiveKey === "clarity"
                  ? "sb-triad-card--active"
                  : ""
              }`}
            >
              <div className="sb-triad-head">
                <span className="sb-triad-dot sb-triad-dot--sky" />
                <span className="sb-triad-label">Clarity</span>
                {lowestMetricKey === "clarity" && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">
                  {clarityScore != null ? clarityScore : "7.0"}
                </span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--sky"
                  style={{
                    width: `${Math.min(100, ((clarityScore || 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 2: Accuracy / Correctness (Mint) */}
            <div
              className={`sb-triad-card sb-triad-card--mint ${
                lowestMetricKey === "correctness" || focusConfig.effectiveKey === "correctness"
                  ? "sb-triad-card--active"
                  : ""
              }`}
            >
              <div className="sb-triad-head">
                <span className="sb-triad-dot sb-triad-dot--mint" />
                <span className="sb-triad-label">Accuracy</span>
                {lowestMetricKey === "correctness" && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">
                  {correctnessScore != null ? correctnessScore : "7.0"}
                </span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--mint"
                  style={{
                    width: `${Math.min(100, ((correctnessScore || 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 3: Depth / Completeness (Lilac) */}
            <div
              className={`sb-triad-card sb-triad-card--lilac ${
                lowestMetricKey === "completeness" || focusConfig.effectiveKey === "completeness"
                  ? "sb-triad-card--active"
                  : ""
              }`}
            >
              <div className="sb-triad-head">
                <span className="sb-triad-dot sb-triad-dot--lilac" />
                <span className="sb-triad-label">Completeness</span>
                {lowestMetricKey === "completeness" && (
                  <span className="sb-mini-tag sb-mini-tag--rose">Focus</span>
                )}
              </div>
              <div className="sb-triad-val-row">
                <span className="sb-triad-val">
                  {completenessScore != null ? completenessScore : "7.0"}
                </span>
                <span className="sb-triad-max">/ 10</span>
              </div>
              <div className="sb-mini-track">
                <div
                  className="sb-mini-fill sb-mini-fill--lilac"
                  style={{
                    width: `${Math.min(100, ((completenessScore || 7.0) / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 4. Live Studio Features (What Backend Delivers) ── */}
        <motion.div className="sb-features-strip" variants={itemVariants}>
          <div className="sb-feature-pill">
            <Mic size={13} className="sb-feature-icon sb-feature-icon--cyan" />
            <span className="sb-feature-text">5 Voice Questions</span>
          </div>

          <div className="sb-feature-pill">
            <Bot size={13} className="sb-feature-icon sb-feature-icon--lilac" />
            <span className="sb-feature-text">Instant AI Coach Tip</span>
          </div>

          <div className="sb-feature-pill">
            <TrendingUp size={13} className="sb-feature-icon sb-feature-icon--mint" />
            <span className="sb-feature-text">Live 3C Evaluation</span>
          </div>
        </motion.div>

        {/* ── 5. Action Footer ── */}
        <motion.div className="sb-footer" variants={itemVariants}>
          <div className="sb-actions">
            {onClose && (
              <button
                type="button"
                className="sb-btn-secondary"
                onClick={handleDismiss}
              >
                Cancel
              </button>
            )}

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
          </div>

          <div className="sb-shortcut-hint" aria-hidden="true">
            <span>
              Press <kbd className="sb-kbd">Enter ↵</kbd> to begin
            </span>
            <span className="sb-shortcut-sep">·</span>
            <span>
              <kbd className="sb-kbd">Esc</kbd> to dismiss
            </span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

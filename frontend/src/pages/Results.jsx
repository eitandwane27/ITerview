// frontend/src/pages/Results.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Results / Graduation Page — ITerview Design System (Soft Productivity SaaS)
//
// DATA IS FULLY STATIC for now. Once the backend /api/users/results-summary
// endpoint exists, replace STATIC_DATA with a real fetch() call using
// the current Firebase user's UID.
//
// Route: /results
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Results.css";

// ── Static placeholder data ────────────────────────────────────────────────
// TODO: Replace with GET /api/users/results-summary?uid=<firebaseUid>
const STATIC_DATA = {
  // Confidence delta (post − pre, out of 25)
  preConfidenceScore: 13,
  postConfidenceScore: 20,

  // Overall interview mastery 0–100
  masteryScore: 78,

  // Per-set scores (null = not completed)
  setScores: {
    set1: { label: "Set 1 · Personalized",   score: 7.8, outOf: 10, emoji: "🤖", completed: true  },
    set2: { label: "Set 2 · Technical",       score: 7.2, outOf: 10, emoji: "💻", completed: true  },
    set3: { label: "Set 3 · Behavioral STAR", score: 8.1, outOf: 10, emoji: "🎯", completed: true  },
  },

  // Set 3 STAR dimension averages (out of 10)
  starBreakdown: {
    situation: 7.5,
    action:    8.3,
    result:    8.6,
  },

  // Graduation / unlock logic
  targetDifficulty: "Easy",
  nextDifficulty:   "Medium",
  unlocked:         true,        // masteryScore >= 75 unlocks next tier
  unlockThreshold:  75,
};

// ── Animated count-up hook ─────────────────────────────────────────────────
function useCountUp(target, duration = 1400, decimals = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    let start = null;
    const step = (ts) => {
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

// ── Score bar sub-component ────────────────────────────────────────────────
function ScoreBar({ label, value, max = 10, color = "primary" }) {
  const pct = Math.min(100, (value / max) * 100);
  const animated = useCountUp(pct, 1200);
  return (
    <div className="rs-bar-row">
      <div className="rs-bar-label">
        <span className="rs-bar-name">{label}</span>
        <span className="rs-bar-value">{value.toFixed(1)}<span className="rs-bar-max">/{max}</span></span>
      </div>
      <div className="rs-bar-track" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className={`rs-bar-fill rs-bar-fill--${color}`} style={{ width: `${animated}%` }} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Results() {
  const navigate = useNavigate();
  const d = STATIC_DATA;

  // Derived confidence delta values
  const deltaRaw  = d.postConfidenceScore - d.preConfidenceScore;
  const deltaPct  = Math.round((deltaRaw / 25) * 100);
  const preLabel  = Math.round((d.preConfidenceScore  / 25) * 100);
  const postLabel = Math.round((d.postConfidenceScore / 25) * 100);

  // Animated values
  const animDelta   = useCountUp(deltaPct,          1600);
  const animMastery = useCountUp(d.masteryScore,    1400);
  const animPre     = useCountUp(preLabel,           1200);
  const animPost    = useCountUp(postLabel,          1200);

  return (
    <div className="rs-root">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="rs-topbar">
        <div className="rs-topbar-brand">ITerview</div>
        <span className="rs-topbar-badge">Session Results</span>
      </header>

      {/* ── Confetti / Grad Banner ─────────────────────────── */}
      {d.unlocked && (
        <div className="rs-unlock-banner" role="alert" aria-live="polite">
          <span className="rs-unlock-icon">🎓</span>
          <div>
            <strong>Level Unlocked!</strong> You cleared the {d.unlockThreshold}% threshold
            and unlocked <em>{d.nextDifficulty}</em> difficulty.
          </div>
        </div>
      )}

      {/* ── Scroll Canvas ───────────────────────────────────── */}
      <main className="rs-main">

        {/* ─── 1. Hero Delta Card ──────────────────────────── */}
        <section className="rs-card rs-hero-card" aria-labelledby="hero-heading">
          <div className="rs-card-header">
            <div className="rs-card-icon rs-card-icon--purple">📈</div>
            <h2 id="hero-heading" className="rs-card-title">Confidence Growth</h2>
          </div>

          <div className="rs-inner-card rs-hero-inner">
            {/* Giant delta number */}
            <div className="rs-delta-hero">
              <span className="rs-delta-sign">+</span>
              <span className="rs-delta-num">{animDelta}</span>
              <span className="rs-delta-unit">%</span>
            </div>
            <p className="rs-delta-label">Improvement from Pre-Test to Post-Test</p>

            {/* Before / after pills */}
            <div className="rs-confidence-compare">
              <div className="rs-conf-pill">
                <span className="rs-conf-pill-label">Before</span>
                <span className="rs-conf-pill-value">{animPre}%</span>
              </div>
              <div className="rs-conf-arrow">→</div>
              <div className="rs-conf-pill rs-conf-pill--after">
                <span className="rs-conf-pill-label">After</span>
                <span className="rs-conf-pill-value">{animPost}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. Interview Mastery Score ──────────────────── */}
        <section className="rs-card" aria-labelledby="mastery-heading">
          <div className="rs-card-header">
            <div className="rs-card-icon rs-card-icon--green">🏆</div>
            <h2 id="mastery-heading" className="rs-card-title">Interview Mastery Score</h2>
          </div>

          <div className="rs-inner-card">
            {/* Circular-ish score badge */}
            <div className="rs-mastery-badge">
              <span className="rs-mastery-num">{animMastery}</span>
              <span className="rs-mastery-denom">/100</span>
            </div>

            {/* Per-set breakdown */}
            <div className="rs-set-breakdown">
              {Object.values(d.setScores).map((s) => (
                <SetScoreChip key={s.label} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── 3. Set 3 STAR Breakdown ─────────────────────── */}
        <section className="rs-card" aria-labelledby="star-heading">
          <div className="rs-card-header">
            <div className="rs-card-icon rs-card-icon--orange">⭐</div>
            <h2 id="star-heading" className="rs-card-title">Set 3 · STAR Breakdown</h2>
          </div>

          <div className="rs-inner-card rs-star-inner">
            <ScoreBar label="Situation" value={d.starBreakdown.situation} color="purple" />
            <ScoreBar label="Action"    value={d.starBreakdown.action}    color="blue"   />
            <ScoreBar label="Result"    value={d.starBreakdown.result}    color="green"  />
          </div>
        </section>

        {/* ─── 4. CTAs ─────────────────────────────────────── */}
        <div className="rs-cta-group">
          {d.unlocked ? (
            <button
              id="btn-try-next-difficulty"
              className="rs-btn rs-btn--primary"
              onClick={() => navigate("/dashboard")}
            >
              🚀 Try {d.nextDifficulty} Difficulty
            </button>
          ) : (
            <button
              id="btn-back-dashboard"
              className="rs-btn rs-btn--primary"
              onClick={() => navigate("/dashboard")}
            >
              🏠 Back to Dashboard
            </button>
          )}

          <button
            id="btn-back-dashboard-secondary"
            className="rs-btn rs-btn--secondary"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>

          {/* Placeholder — no real PDF endpoint yet */}
          <button
            id="btn-download-pdf"
            className="rs-btn rs-btn--ghost"
            disabled
            title="Coming soon"
          >
            📄 Download Summary PDF
          </button>
        </div>

      </main>
    </div>
  );
}

// ── Set Score Chip (used inside Mastery card) ──────────────────────────────
function SetScoreChip({ label, score, outOf, emoji, completed }) {
  const animated = useCountUp(score, 1100, 1);
  return (
    <div className={`rs-set-chip ${completed ? "" : "rs-set-chip--incomplete"}`}>
      <span className="rs-set-chip-emoji">{emoji}</span>
      <div className="rs-set-chip-body">
        <span className="rs-set-chip-label">{label}</span>
        {completed
          ? <span className="rs-set-chip-score">{animated}/{outOf}</span>
          : <span className="rs-set-chip-incomplete">Not completed</span>
        }
      </div>
    </div>
  );
}

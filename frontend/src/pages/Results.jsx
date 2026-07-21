// frontend/src/pages/Results.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import "./Results.css";

// ── Animated count-up hook ─────────────────────────────────────────────────
function useCountUp(target, duration = 1400, decimals = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;
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
  const pct = value !== null ? Math.min(100, (value / max) * 100) : 0;
  const animated = useCountUp(pct, 1200);

  if (value === null) {
    return (
      <div className="rs-bar-row">
        <div className="rs-bar-label">
          <span className="rs-bar-name">{label}</span>
          <span className="rs-bar-value" style={{ color: "var(--text-muted)" }}>Not assessed</span>
        </div>
        <div className="rs-bar-track">
          <div className="rs-bar-fill rs-bar-fill--muted" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

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

// ── Set Score Chip (used inside Mastery card) ──────────────────────────────
function SetScoreChip({ label, score, outOf, emoji, completed }) {
  const animated = useCountUp(score || 0, 1100, 1);
  return (
    <div className={`rs-set-chip ${completed ? "" : "rs-set-chip--incomplete"}`}>
      <span className="rs-set-chip-emoji">{emoji}</span>
      <div className="rs-set-chip-body">
        <span className="rs-set-chip-label">{label}</span>
        {completed && score !== null
          ? <span className="rs-set-chip-score">{animated}/{outOf}</span>
          : <span className="rs-set-chip-incomplete">Incomplete / Pending</span>
        }
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Results() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch results-summary once user is authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      try {
        const response = await fetch(`/api/users/results-summary?uid=${user.uid}`);
        if (!response.ok) {
          throw new Error("Failed to load results summary.");
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error("Error loading results:", err);
        setError("Unable to retrieve interview results. Please ensure you have completed the sessions.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Derived confidence delta values
  const deltaRaw  = data ? (data.postConfidenceScore - data.preConfidenceScore) : 0;
  const deltaPct  = data ? Math.round((deltaRaw / 25) * 100) : 0;
  const preLabel  = data ? Math.round((data.preConfidenceScore  / 25) * 100) : 0;
  const postLabel = data ? Math.round((data.postConfidenceScore / 25) * 100) : 0;

  // Animated values
  const animDelta   = useCountUp(deltaPct,                                     1600);
  const animMastery = useCountUp(data ? data.masteryScore : null,              1400);
  const animPre     = useCountUp(preLabel,                                     1200);
  const animPost    = useCountUp(postLabel,                                    1200);

  // Loading skeleton screen
  if (loading) {
    return (
      <div className="rs-root rs-loading-container">
        <header className="rs-topbar">
          <div className="rs-topbar-brand">ITerview</div>
          <span className="rs-topbar-badge">Loading...</span>
        </header>
        <main className="rs-main" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
          <div className="rs-loading-card">
            <div className="rs-loading-spinner" />
            <p>Compiling your overall technical growth profiles...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error screen
  if (error || !data) {
    return (
      <div className="rs-root">
        <header className="rs-topbar">
          <div className="rs-topbar-brand">ITerview</div>
          <span className="rs-topbar-badge" style={{ background: "var(--color-badge-red-bg)", color: "var(--color-badge-red)" }}>Error</span>
        </header>
        <main className="rs-main" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
          <div className="rs-card" style={{ maxWidth: "500px", textAlign: "center", padding: "2rem" }}>
            <span style={{ fontSize: "3rem" }}>⚠️</span>
            <h2 style={{ marginTop: "1rem" }}>Could Not Retrieve Session Summary</h2>
            <p style={{ margin: "1rem 0", color: "var(--text-muted)" }}>{error || "Make sure you complete both the pre-test, intermediate practice sets, and post-test sessions."}</p>
            <button className="rs-btn rs-btn--primary" onClick={() => navigate("/dashboard")} style={{ margin: "0 auto" }}>
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="rs-root">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="rs-topbar">
        <div className="rs-topbar-brand">ITerview</div>
        <span className="rs-topbar-badge">Session Results</span>
      </header>

      {/* ── Confetti / Grad Banner ─────────────────────────── */}
      {data.unlocked && (
        <div className="rs-unlock-banner" role="alert" aria-live="polite">
          <span className="rs-unlock-icon">🎓</span>
          <div>
            <strong>Level Unlocked!</strong> You cleared the {data.unlockThreshold}% threshold
            and unlocked <em>{data.nextDifficulty}</em> difficulty.
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
              <span className="rs-delta-sign">{deltaPct >= 0 ? "+" : ""}</span>
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
              <span className="rs-mastery-num">{animMastery !== null ? animMastery : "—"}</span>
              <span className="rs-mastery-denom">/100</span>
            </div>

            {/* 📈 Pre-Test vs Post-Test performance comparison */}
            <div className="rs-performance-compare" style={{ display: "flex", gap: "16px", marginTop: "12px", width: "100%", justifyContent: "center", alignItems: "center" }}>
              <div className="rs-conf-pill">
                <span className="rs-conf-pill-label">Pre-Test Baseline</span>
                <span className="rs-conf-pill-value" style={{ color: "var(--color-ink-secondary)" }}>
                  {data.preTestScore !== null ? `${data.preTestScore}%` : "—"}
                </span>
              </div>
              <div className="rs-conf-arrow">→</div>
              <div className="rs-conf-pill rs-conf-pill--after">
                <span className="rs-conf-pill-label">Post-Test Graduation</span>
                <span className="rs-conf-pill-value" style={{ color: "var(--color-badge-green)" }}>
                  {data.masteryScore !== null ? `${data.masteryScore}%` : "—"}
                </span>
              </div>
            </div>

            {data.improvementDelta !== null && (
              <p className="rs-delta-label" style={{ color: data.improvementDelta >= 0 ? "var(--color-badge-green)" : "var(--color-badge-orange)", marginTop: "8px", fontWeight: "600" }}>
                {data.improvementDelta >= 0 ? "📊 Score Improvement: " : "📊 Score Decrease: "}
                <strong>{data.improvementDelta >= 0 ? "+" : ""}{data.improvementDelta}%</strong>
              </p>
            )}

            {/* Per-set breakdown */}
            <div className="rs-set-breakdown" style={{ marginTop: "16px" }}>
              {Object.entries(data.setScores).map(([key, s]) => (
                <SetScoreChip key={key} {...s} />
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
            <ScoreBar label="Situation" value={data.starBreakdown.situation} color="purple" />
            <ScoreBar label="Action"    value={data.starBreakdown.action}    color="blue"   />
            <ScoreBar label="Result"    value={data.starBreakdown.result}    color="green"  />
          </div>
        </section>

        {/* ─── 4. CTAs ─────────────────────────────────────── */}
        <div className="rs-cta-group">
          {data.unlocked ? (
            <button
              id="btn-try-next-difficulty"
              className="rs-btn rs-btn--primary"
              onClick={() => navigate("/dashboard")}
            >
              🚀 Try {data.nextDifficulty} Difficulty
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
        </div>

      </main>
    </div>
  );
}

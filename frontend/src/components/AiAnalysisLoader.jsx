import React, { useState, useEffect } from "react";
import "./AiAnalysisLoader.css";

const STEPS = [
  { label: "Processing audio transcripts..." },
  { label: "Analyzing Clarity, Correctness & Completeness..." },
  { label: "Identifying technical strengths..." },
  { label: "Customizing Set 1 for your profile..." },
];

const STEP_TIMINGS = [1000, 2200, 3400, 4800];

export default function AiAnalysisLoader({ onComplete }) {
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    const timers = [
      ...STEP_TIMINGS.map((delay, i) =>
        setTimeout(() => setAnalysisStep(i + 1), delay)
      ),
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="ai-analysis-container">
      <div className="ai-analysis-card">

        {/* ── Header strip — sidebar-section-label style ──────────────── */}
        <div className="aal-header">
          <span className="aal-header-label">AI Evaluation Engine</span>
          {/* AI online badge — mirrors DESIGN.md ai-engine-status pattern */}
          <span className="aal-header-badge" aria-label="AI Online">
            <span className="aal-header-badge-dot" aria-hidden="true" />
            AI Online
          </span>
          <span className="aal-header-dot" aria-hidden="true" />
        </div>

        {/* ── Body — inner lavender card (card-in-card) ───────────────── */}
        <div className="aal-body">

          {/* Icon with lavender scanline sweep */}
          <div className="aal-icon-wrap" aria-hidden="true">
            <span className="aal-icon">🧠</span>
          </div>

          {/* Title — card-title style */}
          <div className="aal-title-block">
            <h2 className="aal-title">AI Analysis in Progress</h2>
            <p className="aal-subtitle">
              Please wait while we evaluate your baseline.
            </p>
          </div>

          {/* Segmented progress bar — 4 pill segments, lavender fill */}
          <div
            className="aal-progress-track"
            role="progressbar"
            aria-valuenow={analysisStep}
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-label={`Analysis progress: ${analysisStep} of ${STEPS.length} steps complete`}
          >
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`aal-segment ${analysisStep > i ? "active" : ""}`}
              />
            ))}
          </div>

          {/* Checklist — done items surface to white, pending stay on lavender */}
          <ul className="aal-checklist">
            {STEPS.map((step, i) => {
              const done = analysisStep > i;
              return (
                <li
                  key={i}
                  className={`aal-check-item ${done ? "done" : ""}`}
                >
                  <span
                    className="aal-check-icon"
                    aria-hidden="true"
                  >
                    {done ? "✓" : ""}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Footer — uppercase label + lavender step counter ────────── */}
        <div className="aal-footer">
          <span className="aal-footer-note">Processing responses</span>
          <span className="aal-step-counter" aria-live="polite">
            {analysisStep}/{STEPS.length}
          </span>
        </div>

      </div>
    </div>
  );
}

// src/pages/LikertScale.jsx
// Confidence self-assessment (H₀₂ baseline) — 5-item Likert scale
// Collects scores 1–5 per question → stores in React state → submits to backend (MongoDB)
// On completion → navigates to /mic-test (Pre-Test) or /results (Post-Test)

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./LikertScale.css";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK
// These 5 items measure self-confidence for H₀₂ (pre-test baseline).
// The same 5 items are reused on the POST Likert Scale (route: /likert-post)
// ─────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q1",
    text: "How confident do you feel about answering interview questions in English?",
  },
  {
    id: "q2",
    text: "How comfortable are you explaining your technical projects to a stranger?",
  },
  {
    id: "q3",
    text: "How well do you think you can handle unexpected or follow-up questions?",
  },
  {
    id: "q4",
    text: "How prepared do you feel for a real IT job interview right now?",
  },
  {
    id: "q5",
    text: "How confident are you that your answers clearly show your technical skills?",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER OPTIONS  (value = 1–5 as per Likert convention)
// MongoDB document field: confidenceScore = sum of all 5 values (max: 25)
// ─────────────────────────────────────────────────────────────────────────────
const OPTIONS = [
  { value: 1, emoji: "😰", title: "Not at all", sub: "I feel very uncertain" },
  { value: 2, emoji: "😐", title: "Slightly", sub: "I have some doubts" },
  { value: 3, emoji: "🙂", title: "Moderately", sub: "I'm somewhat confident" },
  { value: 4, emoji: "😊", title: "Confident", sub: "I feel fairly ready" },
  {
    value: 5,
    emoji: "🔥",
    title: "Very Confident",
    sub: "I feel completely ready",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB Template (reference — actual POST is handled in the backend route)
// POST /api/likert  →  Body shape:
// {
//   userId:          string,   // Firebase UID
//   phase:           "pre" | "post",
//   answers: [
//     { questionId: "q1", score: 3 },
//     { questionId: "q2", score: 4 },
//     { questionId: "q3", score: 2 },
//     { questionId: "q4", score: 5 },
//     { questionId: "q5", score: 3 },
//   ],
//   confidenceScore: 17,       // sum(answers[].score) — used by Results page
//   submittedAt:     ISODate,  // server-side timestamp
// }
// ─────────────────────────────────────────────────────────────────────────────

export default function LikertScale({ phase = "pre" }) {
  const navigate = useNavigate();

  // current question index (0–4)
  const [currentIndex, setCurrentIndex] = useState(0);

  // answers: { q1: 3, q2: null, ... }
  const [answers, setAnswers] = useState(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, null])),
  );

  // true once all 5 answers are submitted and we show the completion card
  const [isDone, setIsDone] = useState(false);

  // saved total confidence score (1–25) for the done-screen score chip
  const [doneScore, setDoneScore] = useState(null);

  // ── Derived state ───────────────────────────────────────
  const currentQuestion = QUESTIONS[currentIndex];
  const currentAnswer = answers[currentQuestion.id];
  const progressPercent = (currentIndex / QUESTIONS.length) * 100;
  const totalQuestions = QUESTIONS.length;

  // ── Handlers ────────────────────────────────────────────
  const handleSelect = (value) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = async () => {
    if (currentAnswer === null) return; // guard — button disabled anyway

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // All answered — build the structured payload
      const answersArray = QUESTIONS.map((q) => ({
        questionId: q.id,
        score: answers[q.id],
      }));
      const confidenceScore = answersArray.reduce((sum, a) => sum + a.score, 0);

      // POST to the correct endpoint depending on phase
      // pre  → /api/users/pretest
      // post → /api/users/posttest
      const endpoint = phase === "post" ? "/api/users/posttest" : "/api/users/pretest";
      try {
        const user = auth.currentUser;
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firebaseUid: user.uid,
            email: user.email,
            answers: answersArray,
            confidenceScore,
          }),
        });
        console.log(`[LikertScale] ${phase}-test scores saved to MongoDB ✅`);
      } catch (err) {
        console.error(`[LikertScale] Failed to save ${phase}-test scores:`, err);
      }

      setDoneScore(confidenceScore);
      setIsDone(true);
    }
  };

  const handleContinue = () => {
    // After pre-test Likert → go to Pre-Test Interview Voice Screen
    // After post-test Likert → go to Results Page
    if (phase === "pre") {
      navigate("/mic-test");
    } else {
      navigate("/results");
    }
  };

  // ── Render: Completion Screen ────────────────────────────
  if (isDone) {
    // Confidence tier label for post-test score chip
    const tier =
      doneScore >= 20
        ? "Strong Confidence"
        : doneScore >= 13
          ? "Moderate Confidence"
          : "Building Confidence";

    return (
      <div className="likert-container">
        <TopBar phase={phase} />
        <main className="likert-main">
          <div className="likert-done-card">
            <div className="likert-done-inner">

              {/* Animated SVG checkmark with pulse ring */}
              <div className="likert-done-icon-wrap" aria-hidden="true">
                <div className="likert-done-pulse" />
                <div className="likert-done-circle">
                  <svg className="likert-done-check" viewBox="0 0 52 52">
                    <path
                      className="likert-done-check-path"
                      fill="none"
                      d="M14 27l8 8 16-16"
                    />
                  </svg>
                </div>
              </div>

              <h2>Assessment Complete!</h2>
              <p>
                {phase === "pre"
                  ? "Your confidence baseline has been recorded. Time to show what you've got."
                  : "Great work. Your post-test confidence has been captured."}
              </p>

              {/* Score chip — post-test only */}
              {phase === "post" && doneScore !== null && (
                <div className="likert-score-chip">
                  <div className="likert-score-main">
                    <span className="likert-score-number">{doneScore}</span>
                    <span className="likert-score-denom">/ 25</span>
                  </div>
                  <span className="likert-score-tier">{tier}</span>
                </div>
              )}

              <button
                id="likert-continue-btn"
                className="likert-btn-next"
                onClick={handleContinue}
              >
                {phase === "pre" ? "Start Pre-Test →" : "View Results →"}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Render: Question Screen ──────────────────────────────
  return (
    <div className="likert-container">
      <TopBar phase={phase} />

      {/* Progress Bar */}
      <div className="likert-progress-wrap">
        <div className="likert-progress-label">
          <span>Confidence Assessment</span>
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
        </div>
        <div
          className="likert-progress-bar"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
        >
          <div
            className="likert-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <main className="likert-main">
        {/* Outer white card — key forces remount/animation on question change */}
        <div className="likert-question-card" key={currentQuestion.id}>
          <p className="likert-question-number">Question {currentIndex + 1}</p>
          <p className="likert-question-text">{currentQuestion.text}</p>

          {/* Inner lavender card — signature card-in-card pattern */}
          <div className="likert-options-inner">
            <div
              className="likert-options"
              role="radiogroup"
              aria-label={`Options for question ${currentIndex + 1}`}
            >
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`likert-option-${opt.value}`}
                  className={`likert-option${currentAnswer === opt.value ? " selected" : ""}`}
                  onClick={() => handleSelect(opt.value)}
                  role="radio"
                  aria-checked={currentAnswer === opt.value}
                >
                  <span className="likert-option-emoji" aria-hidden="true">
                    {opt.emoji}
                  </span>
                  <span className="likert-option-label">
                    <span className="likert-option-title">{opt.title}</span>
                    <span className="likert-option-sub">{opt.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="likert-nav">
          <button
            id="likert-next-btn"
            className="likert-btn-next"
            onClick={handleNext}
            disabled={currentAnswer === null}
          >
            {currentIndex < totalQuestions - 1 ? "Next →" : "Submit"}
          </button>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Top Bar
// Mirrors .pt-topbar / MainSets TopBar pattern
// ─────────────────────────────────────────────────────────────────────────────
function TopBar({ phase }) {
  return (
    <header className="likert-topbar">
      <div className="likert-topbar-content">
        <h1>ITerview</h1>
        <span>
          {phase === "pre" ? "Pre-Test" : "Post-Test"} · Confidence Check
        </span>
      </div>
    </header>
  );
}

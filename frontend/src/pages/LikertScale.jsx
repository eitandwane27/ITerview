import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import logoSrc from '../assets/logo';
import './LikertScale.css';

const Motion = motion;

const QUESTIONS = [
  {
    id: 'q1',
    text: 'How confident do you feel about answering interview questions in English?',
  },
  {
    id: 'q2',
    text: 'How comfortable are you explaining your technical projects to a stranger?',
  },
  {
    id: 'q3',
    text: 'How well do you think you can handle unexpected or follow-up questions?',
  },
  {
    id: 'q4',
    text: 'How prepared do you feel for a real IT job interview right now?',
  },
  {
    id: 'q5',
    text: 'How confident are you that your answers clearly show your technical skills?',
  },
];

const OPTIONS = [
  { value: 1, title: 'Not at all', sub: 'I feel very uncertain' },
  { value: 2, title: 'Slightly', sub: 'I have some doubts' },
  { value: 3, title: 'Moderately', sub: "I'm somewhat confident" },
  { value: 4, title: 'Confident', sub: 'I feel fairly ready' },
  { value: 5, title: 'Very confident', sub: 'I feel completely ready' },
];

const INITIAL_ANSWERS = Object.fromEntries(QUESTIONS.map((question) => [question.id, null]));

export default function LikertScale({ phase = 'pre' }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const optionRefs = useRef([]);
  const questionHeadingRef = useRef(null);
  const shouldFocusQuestion = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [isDone, setIsDone] = useState(false);
  const [doneScore, setDoneScore] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const currentQuestion = QUESTIONS[currentIndex];
  const currentAnswer = answers[currentQuestion.id];
  const totalQuestions = QUESTIONS.length;
  const progressRatio = (currentIndex + 1) / totalQuestions;

  const handleSelect = (value) => {
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: value }));
    setSubmitError('');
  };

  const handleBack = () => {
    if (currentIndex === 0 || isSubmitting) return;
    shouldFocusQuestion.current = true;
    setSubmitError('');
    setCurrentIndex((index) => index - 1);
  };

  const handleNext = async () => {
    if (currentAnswer === null || isSubmitting) return;

    if (currentIndex < totalQuestions - 1) {
      shouldFocusQuestion.current = true;
      setCurrentIndex((index) => index + 1);
      return;
    }

    const answersArray = QUESTIONS.map((question) => ({
      questionId: question.id,
      score: answers[question.id],
    }));
    const confidenceScore = answersArray.reduce((sum, answer) => sum + answer.score, 0);
    const endpoint = phase === 'post' ? '/api/users/posttest' : '/api/users/pretest';

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: user.uid,
          email: user.email,
          answers: answersArray,
          confidenceScore,
        }),
      });

      if (!response.ok) throw new Error('We could not save your answers. Please try again.');

      setDoneScore(confidenceScore);
      setIsDone(true);
    } catch (error) {
      console.error(`[LikertScale] Failed to save ${phase}-test scores:`, error);
      setSubmitError(error.message || 'We could not save your answers. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptionKeyDown = (event) => {
    const digit = Number(event.key);
    const isDigitShortcut = Number.isInteger(digit) && digit >= 1 && digit <= OPTIONS.length;

    if (isDigitShortcut) {
      event.preventDefault();
      handleSelect(digit);
      optionRefs.current[digit - 1]?.focus();
      return;
    }

    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;

    if (!direction) return;

    event.preventDefault();
    const selectedIndex = currentAnswer === null ? 2 : currentAnswer - 1;
    const nextIndex = (selectedIndex + direction + OPTIONS.length) % OPTIONS.length;
    handleSelect(OPTIONS[nextIndex].value);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleQuestionAnimationComplete = () => {
    if (!shouldFocusQuestion.current) return;
    questionHeadingRef.current?.focus({ preventScroll: true });
    shouldFocusQuestion.current = false;
  };

  const handleContinue = () => {
    navigate(phase === 'pre' ? '/mic-test' : '/results');
  };

  if (isDone) {
    const tier =
      doneScore >= 20
        ? 'Strong confidence'
        : doneScore >= 13
          ? 'Moderate confidence'
          : 'Building confidence';
    const tierClass =
      doneScore >= 20 ? 'tier-strong' : doneScore >= 13 ? 'tier-moderate' : 'tier-building';

    return (
      <div className="likert-container">
        <TopBar phase={phase} progressRatio={1} isDone />
        <main className="likert-main likert-main--done">
          <Motion.section
            className="likert-done-card"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            aria-labelledby="likert-complete-title"
          >
            <div className="likert-celebration" aria-hidden="true">
              <Motion.span
                className="likert-spark likert-spark--left"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotate: -25 }}
                animate={{ opacity: 1, scale: 1, rotate: -10 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 260, damping: 16 }}
              >
                <Sparkles size={22} strokeWidth={2.2} />
              </Motion.span>
              <Motion.div
                className="likert-done-mark"
                initial={reduceMotion ? false : { scale: 0.82, rotate: -7 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 17 }}
              >
                <img src={logoSrc} alt="" />
                <span className="likert-done-check">
                  <Check size={20} strokeWidth={3} />
                </span>
              </Motion.div>
              <Motion.span
                className="likert-spark likert-spark--right"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotate: 25 }}
                animate={{ opacity: 1, scale: 1, rotate: 10 }}
                transition={{ delay: 0.26, type: 'spring', stiffness: 260, damping: 16 }}
              >
                <Sparkles size={18} strokeWidth={2.2} />
              </Motion.span>
            </div>

            <div className="likert-done-copy">
              <p className="likert-complete-kicker">All five answers saved</p>
              <h2 id="likert-complete-title">Assessment complete!</h2>
              <p>
                {phase === 'pre'
                  ? "Your confidence baseline is ready. Now let's warm up your microphone."
                  : 'Great work. Your post-test confidence is ready to compare.'}
              </p>
            </div>

            {phase === 'post' && doneScore !== null && (
              <div className="likert-score-chip" aria-label={`${doneScore} out of 25, ${tier}`}>
                <div className="likert-score-main">
                  <span className="likert-score-number">{doneScore}</span>
                  <span className="likert-score-denom">out of 25</span>
                </div>
                <span className={`likert-score-tier ${tierClass}`}>{tier}</span>
              </div>
            )}

            <button
              id="likert-continue-btn"
              className="likert-btn likert-btn--primary likert-done-continue"
              onClick={handleContinue}
              type="button"
            >
              {phase === 'pre' ? 'Check my microphone' : 'View my results'}
              <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </Motion.section>
        </main>
      </div>
    );
  }

  return (
    <div className="likert-container">
      <TopBar
        phase={phase}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        progressRatio={progressRatio}
      />

      <main className="likert-main">
        <AnimatePresence mode="wait" initial={false}>
          <Motion.section
            className="likert-question-card"
            key={currentQuestion.id}
            initial={reduceMotion ? false : { opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
            onAnimationComplete={handleQuestionAnimationComplete}
            aria-labelledby={`likert-question-${currentQuestion.id}`}
          >
            <div className="likert-question-heading">
              <p className="likert-question-number">Question {currentIndex + 1}</p>
              <h2
                id={`likert-question-${currentQuestion.id}`}
                ref={questionHeadingRef}
                className="likert-question-text"
                tabIndex={-1}
              >
                {currentQuestion.text}
              </h2>
              <p className="likert-question-help">Choose the answer that feels true right now.</p>
            </div>

            <div
              className="likert-options"
              role="radiogroup"
              aria-label={`Confidence options for question ${currentIndex + 1}`}
              onKeyDown={handleOptionKeyDown}
            >
              {OPTIONS.map((option) => {
                const isSelected = currentAnswer === option.value;

                return (
                  <Motion.button
                    key={option.value}
                    id={`likert-option-${option.value}`}
                    ref={(element) => {
                      optionRefs.current[option.value - 1] = element;
                    }}
                    className={`likert-option${isSelected ? ' selected' : ''}`}
                    onClick={() => handleSelect(option.value)}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected || (currentAnswer === null && option.value === 3) ? 0 : -1}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  >
                    <span className="likert-option-topline">
                      <span className="likert-option-meter" aria-hidden="true">
                        {OPTIONS.map((segment) => (
                          <span
                            key={segment.value}
                            className={segment.value <= option.value ? 'is-active' : ''}
                            style={{ '--lk-segment': segment.value }}
                          />
                        ))}
                      </span>
                      <kbd aria-hidden="true">{option.value}</kbd>
                    </span>

                    <span className="likert-option-label">
                      <span className="likert-option-title">{option.title}</span>
                      <span className="likert-option-sub">{option.sub}</span>
                    </span>

                    <span className="likert-option-status" aria-hidden="true">
                      <AnimatePresence initial={false}>
                        {isSelected && (
                          <Motion.span
                            initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                          >
                            <Check size={16} strokeWidth={3} />
                          </Motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </Motion.button>
                );
              })}
            </div>

            <p className="likert-keyboard-hint">Tip: use the arrow keys or press 1-5.</p>
          </Motion.section>
        </AnimatePresence>

        {submitError && (
          <Motion.div
            className="likert-error"
            role="alert"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>{submitError}</span>
          </Motion.div>
        )}

        <nav className="likert-nav" aria-label="Assessment navigation">
          <button
            className="likert-btn likert-btn--secondary"
            onClick={handleBack}
            disabled={currentIndex === 0 || isSubmitting}
            type="button"
          >
            <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
            <span className="likert-btn-label">Back</span>
          </button>

          <button
            id="likert-next-btn"
            className="likert-btn likert-btn--primary"
            onClick={handleNext}
            disabled={currentAnswer === null || isSubmitting}
            type="button"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle
                  className="likert-spinner"
                  size={18}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Saving
              </>
            ) : (
              <>
                {submitError
                  ? 'Try again'
                  : currentIndex < totalQuestions - 1
                    ? 'Continue'
                    : 'Finish assessment'}
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
              </>
            )}
          </button>
        </nav>
      </main>
    </div>
  );
}

function TopBar({
  phase,
  currentIndex = 0,
  totalQuestions = QUESTIONS.length,
  progressRatio,
  isDone,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="likert-topbar">
      <div className="likert-topbar-content">
        <div className="likert-brand">
          <img src={logoSrc} alt="" className="likert-logo-img" />
          <span className="likert-brand-text">ITerview</span>
        </div>
        <span className="likert-phase-badge">
          {phase === 'pre' ? 'Pre-Test Confidence Check' : 'Post-Test Confidence Check'}
        </span>
      </div>

      <div className="likert-progress-wrap">
        <div
          className="likert-progress-bar"
          role="progressbar"
          aria-label="Assessment progress"
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-valuenow={isDone ? totalQuestions : currentIndex + 1}
        >
          <Motion.div
            className="likert-progress-fill"
            initial={false}
            animate={{ scaleX: progressRatio }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 150, damping: 24, mass: 0.8 }
            }
          />
        </div>
        <span className="likert-progress-count" aria-live="polite">
          {isDone ? 'Complete' : `${currentIndex + 1} of ${totalQuestions}`}
        </span>
      </div>
    </header>
  );
}

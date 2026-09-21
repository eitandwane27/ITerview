import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion as Motion, useIsPresent, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  Check,
  LoaderCircle,
  LogOut,
  Mic,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import logoSrc from '../assets/logo';
import AssessmentJourney from './AssessmentJourney';
import StartingScoreDetails from './StartingScoreDetails';
import TestBriefing from './TestBriefing';
import { getPracticeFocus } from '../utils/assessmentGuidance';
import './TestWorkspace.css';

// The approved single-column concept uses DESIGN.md tokens. Progress springs
// and question slides match LikertScale; long answers grow with the page.
const SWAP_EASE = [0.23, 1, 0.32, 1];
const PROGRESS_SPRING = { type: 'spring', stiffness: 150, damping: 24, mass: 0.8 };

const AnimatedContent = forwardRef(function AnimatedContent({ children, focusRef, reduced }, ref) {
  const present = useIsPresent();
  useEffect(() => {
    if (present) focusRef?.current?.focus({ preventScroll: true });
  }, [present, focusRef]);
  return (
    <Motion.div
      ref={ref}
      className="test-content"
      aria-hidden={!present}
      inert={!present ? true : undefined}
      initial={reduced ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
      transition={{ duration: reduced ? 0.12 : 0.24, ease: SWAP_EASE }}
    >
      {children}
    </Motion.div>
  );
});

const AnswerEditor = forwardRef(function AnswerEditor({ value, ...props }, ref) {
  const editorRef = useRef(null);
  useImperativeHandle(ref, () => editorRef.current, []);
  useLayoutEffect(() => {
    const resize = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.style.height = 'auto';
      editor.style.height = `${editor.scrollHeight + 2}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);
  return <textarea ref={editorRef} value={value} {...props} />;
});

export default function TestWorkspace({
  variant = 'pre',
  showBriefing = false,
  authLoading = false,
  isConnected = false,
  isRecording = false,
  isPlayingAudio = false,
  isSessionComplete = false,
  connectionLost = false,
  alreadyCompleted = null,
  result = null,
  reflectionComplete = false,
  currentQuestion = 1,
  currentQuestionText = '',
  status = '',
  finalTranscript = '',
  partialTranscript = '',
  confirmedTranscript = '',
  awaitingConfirmation = false,
  submissionPhase = 'idle',
  verifyError = '',
  error = '',
  volume = 0,
  volumeFillRef,
  verifyTextareaRef,
  onStart,
  onExit,
  onReconnect,
  onReplay,
  onRecord,
  onStop,
  onAnswerChange,
  onConfirm,
  onNext,
  onReRecord,
  onContinue,
  onViewResults,
  onDismissError,
  children,
}) {
  const reduced = useReducedMotion();
  const startRef = useRef(null);
  const recordRef = useRef(null);
  const confirmRef = useRef(null);
  const continueRef = useRef(null);
  const pre = variant === 'pre';
  const complete = isSessionComplete || Boolean(alreadyCompleted);
  const intro = showBriefing && !complete;
  const review = awaitingConfirmation && !complete && !intro;
  const saved = Boolean(alreadyCompleted);
  const score = saved ? alreadyCompleted : result;
  const practiceFocus = pre ? getPracticeFocus(score?.weakness) : null;
  const question = Math.min(5, Math.max(1, currentQuestion));
  const saving = submissionPhase === 'saving';
  const ready = submissionPhase === 'ready';
  const answered = complete ? 5 : Math.min(5, question - 1 + (ready ? 1 : 0));
  const progressPosition = intro ? 0 : complete ? 5 : question;
  const screenKey = intro
    ? 'intro'
    : complete
      ? 'results'
      : `${review ? 'review' : 'question'}-${question}`;
  const canRecord =
    isConnected && !connectionLost && !isPlayingAudio && Boolean(currentQuestionText);
  const canReplay = canRecord && !isRecording && !review;
  const focusRef = intro
    ? startRef
    : complete
      ? continueRef
      : review
        ? ready
          ? confirmRef
          : verifyTextareaRef
        : recordRef;
  useEffect(() => {
    if (ready) confirmRef.current?.focus({ preventScroll: true });
  }, [ready]);
  const recordLabel = isRecording
    ? 'Stop recording'
    : isPlayingAudio
      ? 'Question playing'
      : connectionLost
        ? 'Reconnect to record'
        : !canRecord
          ? 'Preparing question…'
          : 'Start recording';

  return (
    <div
      className={`test-page test-page--${variant}${intro ? ' test-page--briefing' : ''}${isRecording ? ' test-page--recording' : ''}${isPlayingAudio ? ' test-page--speaking' : ''}`}
    >
      {children}
      <header className="test-topbar">
        <div className="test-topbar-inner">
          <div className="test-brand">
            <img src={logoSrc} alt="" width="36" height="36" />
            <span>ITerview</span>
          </div>
          <span className="test-phase">{pre ? 'Pre-test' : 'Post-test'}</span>
          <button
            type="button"
            className="test-button test-exit"
            onClick={onExit}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <main
        className={`test-body${intro ? ' test-body--briefing' : ''}`}
        aria-label={pre ? 'Pre-test' : 'Post-test'}
      >
        {!intro && (
          <div className="test-progress-row">
            <div
              className="test-progress"
              role="progressbar"
              aria-label={pre ? 'Pre-test progress' : 'Post-test progress'}
              aria-valuenow={progressPosition}
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuetext={
                intro
                  ? 'Ready to start five questions'
                  : complete
                    ? 'All five answers confirmed'
                    : `Question ${question} of 5. ${answered} answers confirmed`
              }
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`test-progress-step${i < answered ? ' is-done' : ''}${!intro && !complete && i === question - 1 ? ' is-current' : ''}`}
                >
                  <Motion.span
                    className="test-progress-fill"
                    initial={false}
                    animate={{ scaleX: i < progressPosition ? 1 : 0 }}
                    transition={reduced ? { duration: 0 } : PROGRESS_SPRING}
                  />
                </span>
              ))}
            </div>
            <span className="test-count" aria-hidden="true">
              {progressPosition} / 5
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {connectionLost && !complete && (
            <Motion.div
              className="test-reconnect"
              role="alert"
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: SWAP_EASE }}
            >
              <AlertCircle aria-hidden="true" />
              <p>Connection lost.</p>
              <button
                type="button"
                className="test-button test-button--secondary"
                onClick={onReconnect}
              >
                Reconnect
              </button>
            </Motion.div>
          )}
        </AnimatePresence>

        <section
          className={`test-workspace${intro || complete ? ' test-workspace--milestone' : ''}${intro ? ' test-workspace--briefing' : ''}`}
          aria-label={
            intro
              ? 'Test introduction'
              : complete
                ? 'Test results'
                : 'Question and answer workspace'
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <AnimatedContent key={screenKey} focusRef={focusRef} reduced={reduced}>
              {intro ? (
                <TestBriefing
                  variant={variant}
                  authLoading={authLoading}
                  onStart={onStart}
                  startRef={startRef}
                  reduced={reduced}
                />
              ) : complete ? (
                <>
                  <AssessmentJourney current={pre ? 1 : 2} complete={!pre && reflectionComplete} />
                  <Motion.div
                    className="test-done-mark"
                    aria-hidden="true"
                    initial={reduced ? false : { scale: 0.82, rotate: -7 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 17 }}
                  >
                    <Check />
                  </Motion.div>
                  <h1 className="test-milestone">
                    {pre ? 'Your starting point is saved' : 'Your progress check is saved'}
                  </h1>
                  <p className="test-lede">
                    {pre
                      ? practiceFocus?.starting ||
                        'Next, practise building clear, accurate answers that cover the important parts.'
                      : reflectionComplete
                        ? 'Your starting and progress-check answers are ready to compare.'
                        : 'Finish a short confidence check, then see how your answers compare.'}
                  </p>
                  <div className="test-content-footer">
                    <button
                      ref={continueRef}
                      type="button"
                      className="test-button test-button--primary"
                      onClick={!pre && reflectionComplete ? onViewResults : onContinue}
                    >
                      {pre
                        ? 'Start practice'
                        : reflectionComplete
                          ? 'View full results'
                          : 'Finish confidence check'}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                  {pre && <StartingScoreDetails score={score?.score} />}
                </>
              ) : (
                <>
                  <div className="test-question-heading">
                    <h1 className="test-question">
                      {currentQuestionText || 'Preparing your question…'}
                    </h1>
                    <button
                      type="button"
                      className={`test-button test-replay${isPlayingAudio ? ' is-playing' : ''}`}
                      onClick={onReplay}
                      disabled={!canReplay}
                      aria-label={isPlayingAudio ? 'Question is playing' : 'Hear question again'}
                      title={isPlayingAudio ? 'Question is playing' : 'Hear question again'}
                    >
                      <Volume2 aria-hidden="true" />
                    </button>
                  </div>
                  <div className={`test-transcript${review ? ' test-transcript--review' : ''}`}>
                    <div className="test-transcript-head">
                      {review ? (
                        <label htmlFor={`test-answer-${variant}`}>Transcript</label>
                      ) : (
                        <span>Transcript</span>
                      )}
                      {isRecording && (
                        <span className="test-live">
                          <AudioLines aria-hidden="true" />
                          Live
                        </span>
                      )}
                      {ready && (
                        <span className="test-saved">
                          <Check aria-hidden="true" />
                          Saved
                        </span>
                      )}
                    </div>
                    {review ? (
                      <AnswerEditor
                        id={`test-answer-${variant}`}
                        ref={verifyTextareaRef}
                        className="test-answer"
                        value={confirmedTranscript}
                        onChange={(e) => onAnswerChange(e.target.value)}
                        disabled={saving || ready}
                        rows={5}
                        placeholder="Your answer appears here."
                        aria-describedby={verifyError ? `test-answer-error-${variant}` : undefined}
                        aria-invalid={Boolean(verifyError)}
                      />
                    ) : (
                      <>
                        <span className="test-sr-only" aria-live="polite">
                          {finalTranscript}
                        </span>
                        <p
                          className={
                            finalTranscript || partialTranscript
                              ? 'test-transcript-text'
                              : 'test-transcript-empty'
                          }
                        >
                          {finalTranscript || partialTranscript ? (
                            <>
                              {finalTranscript}
                              {partialTranscript && (
                                <span className="test-transcript-partial">
                                  {' '}
                                  {partialTranscript}
                                </span>
                              )}
                            </>
                          ) : question === 1 ? (
                            'Listen, record, then check your transcript.'
                          ) : (
                            'Your answer appears here.'
                          )}
                        </p>
                      </>
                    )}
                    {isRecording && (
                      <div
                        className="test-volume-track"
                        role="meter"
                        aria-label="Microphone input level"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={volume}
                      >
                        <div
                          ref={volumeFillRef}
                          className="test-volume-fill"
                          style={{ width: `${volume}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {verifyError && review && (
                    <p
                      className="test-answer-error"
                      id={`test-answer-error-${variant}`}
                      role="alert"
                    >
                      {verifyError}
                    </p>
                  )}
                  <div className="test-content-footer">
                    {review ? (
                      <div className="test-actions">
                        {!ready && (
                          <button
                            type="button"
                            className="test-button test-button--secondary test-rerecord"
                            onClick={onReRecord}
                            disabled={saving || !isConnected || connectionLost || isPlayingAudio}
                            aria-label="Record again"
                            title="Record again"
                          >
                            <RotateCcw aria-hidden="true" />
                          </button>
                        )}
                        <button
                          ref={confirmRef}
                          type="button"
                          className="test-button test-button--primary"
                          onClick={ready ? onNext : onConfirm}
                          disabled={saving || !isConnected || connectionLost}
                        >
                          {saving ? (
                            <LoaderCircle className="test-spinner" aria-hidden="true" />
                          ) : ready ? (
                            <ArrowRight aria-hidden="true" />
                          ) : (
                            <Check aria-hidden="true" />
                          )}
                          <span>
                            {saving
                              ? 'Saving…'
                              : ready
                                ? question === 5
                                  ? 'Finish check'
                                  : 'Next question'
                                : 'Confirm answer'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="test-record-control">
                        <button
                          ref={recordRef}
                          type="button"
                          className={`test-button test-button--primary test-mic${isRecording ? ' test-button--recording' : ''}`}
                          onClick={isRecording ? onStop : onRecord}
                          disabled={!isRecording && !canRecord}
                          aria-label={
                            isRecording
                              ? 'Stop recording'
                              : isPlayingAudio
                                ? 'Waiting for the question to finish'
                                : 'Start recording your answer'
                          }
                          aria-describedby={`test-record-label-${variant}`}
                        >
                          {isRecording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                        </button>
                        <p
                          className="test-record-label"
                          id={`test-record-label-${variant}`}
                          role="status"
                        >
                          {recordLabel}
                        </p>
                      </div>
                    )}
                    <details className="test-help">
                      <summary>Help</summary>
                      <div className="test-help-content">
                        <p>
                          {pre
                            ? 'These five answers set your starting point for practice.'
                            : 'These five answers will be compared with your starting answers.'}
                        </p>
                        <p>
                          Use the speaker to hear the question again. Record your answer, stop, then
                          check the transcript before confirming. Correct transcription mistakes
                          without changing your answer.
                        </p>
                      </div>
                    </details>
                  </div>
                </>
              )}
            </AnimatedContent>
          </AnimatePresence>
        </section>
        <p className="test-sr-only" role="status">
          {status}
        </p>
      </main>
      <AnimatePresence initial={false}>
        {error && (
          <Motion.div
            className="test-error-toast"
            role="alert"
            style={{ x: '-50%' }}
            initial={reduced ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 6 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: SWAP_EASE }}
          >
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
            <button
              type="button"
              className="test-button test-toast-close"
              onClick={onDismissError}
              aria-label="Dismiss error"
            >
              <X aria-hidden="true" />
            </button>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

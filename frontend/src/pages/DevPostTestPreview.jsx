// Dev-only state harness for both test variants. Uses the same TestWorkspace
// as PreTest and PostTest, without auth, sockets or microphone permissions.
// Route: /dev/post-test. Scores, transcript and audio activity are illustrative.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import TestWorkspace from '../components/TestWorkspace';
import './DevPostTestPreview.css';

// Sample session copy — the real page receives all of this from the socket.
const QUESTION_TEXT =
  'Walk me through a project you are proud of and the trade-offs you made along the way.';
const ANSWER_TEXT =
  'I rebuilt the onboarding flow for our design system. The old flow lost people on step two, so we mapped every drop-off point, rewrote the surrounding copy, and shipped it behind a flag.';
const LISTENING_FINAL =
  'I rebuilt the onboarding flow for our design system — the old flow lost people on step two, so we';
const PARTIAL_FRAMES = [
  'mapped every drop-off',
  'mapped every drop-off point',
  'and rewrote the copy',
];

// ── Scripted frames ─────────────────────────────────────────────────────────
// One entry per stage of the real pipeline; each frame sets only the fields it
// needs (the rest fall back to the idle defaults in the render).
const STATES = {
  briefing: {
    label: 'Briefing',
    hint: 'The gate before the socket connects — "Start the challenge" is what opens the WebSocket.',
    showBriefing: true,
    currentQuestion: 1,
  },
  question: {
    label: 'Question',
    hint: 'Question audio finished. Start answering or hear the question again.',
    status: 'Ready when you are — press the mic to answer.',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
  },
  speaking: {
    label: 'Speaking',
    hint: 'Question 2 playing from the audio queue — the mic stays disabled while Luna talks.',
    status: 'Luna is speaking — listen first, then answer.',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    isPlayingAudio: true,
  },
  listening: {
    label: 'Listening',
    hint: 'Mic live: PCM streaming, transcript echoing back, cyan meter animating (ref-painted).',
    status: 'Recording your answer…',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    isRecording: true,
    finalTranscript: LISTENING_FINAL,
  },
  review: {
    label: 'Review',
    hint: 'Review the editable transcript, then confirm or record again.',
    status: 'Review your answer — you can edit it before confirming.',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    awaitingConfirmation: true,
    confirmedTranscript: ANSWER_TEXT,
  },
  saving: {
    label: 'Saving',
    hint: 'submit_answer in flight — the CTA is disabled, so it cannot double-fire.',
    status: 'Saving your answer…',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    awaitingConfirmation: true,
    confirmedTranscript: ANSWER_TEXT,
    submissionPhase: 'saving',
  },
  ready: {
    label: 'Ready',
    hint: 'feedback_complete arrived: the same button morphs into "Next question" — no second gate.',
    status: "Answer recorded. Continue when you're ready.",
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    awaitingConfirmation: true,
    confirmedTranscript: ANSWER_TEXT,
    submissionPhase: 'ready',
  },
  finish: {
    label: 'Last answer',
    hint: 'Question 5 confirmed — the morphing CTA becomes "Finish & see my results".',
    status: "Answer recorded. Continue when you're ready.",
    question: QUESTION_TEXT,
    currentQuestion: 5,
    isConnected: true,
    awaitingConfirmation: true,
    confirmedTranscript: ANSWER_TEXT,
    submissionPhase: 'ready',
  },
  complete: {
    label: 'Score reveal',
    hint: 'session_complete: graduation reveal (final score + weakest 3C). The loader only launches from the CTA.',
    status: 'Graduation challenge complete — your results are ready.',
    question: QUESTION_TEXT,
    currentQuestion: 5,
    isConnected: true,
    isSessionComplete: true,
    result: { score: 87, weakness: 'focus_clarity' },
  },
  saved: {
    label: 'Already completed',
    hint: 'posttest_completed: the once-only gate renders a saved-score panel instead of a session.',
    status: 'Graduation challenge already completed.',
    alreadyCompleted: { score: 74, weakness: 'focus_completeness' },
    currentQuestion: 1,
  },
  offline: {
    label: 'Connection lost',
    hint: 'Connection dropped: answering is paused until you reconnect.',
    status: 'Connection lost.',
    question: QUESTION_TEXT,
    currentQuestion: 3,
    connectionLost: true,
  },
  error: {
    label: 'Error toast',
    hint: 'Coral toast, auto-expires after 8s and is dismissable — it never blocks the stage.',
    status: 'Microphone error: permission denied.',
    question: QUESTION_TEXT,
    currentQuestion: 2,
    isConnected: true,
    error: 'Microphone error: permission denied by the browser.',
  },
};

const ORDER = Object.keys(STATES);

export default function DevPostTestPreview() {
  const navigate = useNavigate();
  const [variant, setVariant] = useState('post');
  const [stateId, setStateId] = useState('briefing');
  const [questionOverride, setQuestionOverride] = useState(null);
  const [volume, setVolume] = useState(0);
  const [partial, setPartial] = useState(PARTIAL_FRAMES[0]);
  const [answer, setAnswer] = useState(ANSWER_TEXT);
  const [verifyError, setVerifyError] = useState('');
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [notice, setNotice] = useState('');
  const volumeFillRef = useRef(null);
  const verifyTextareaRef = useRef(null);
  const saveTimerRef = useRef(null);
  const s = STATES[stateId];
  const currentQuestion = questionOverride ?? s.currentQuestion ?? 1;

  useEffect(() => () => window.clearTimeout(saveTimerRef.current), []);
  useEffect(() => {
    if (stateId !== 'listening') return undefined;
    let frame = 0;
    let step = 0;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const t = (now - t0) / 1000;
      const level = Math.max(
        4,
        Math.min(100, Math.round(56 + 28 * Math.sin(t * 2.4) + 16 * Math.sin(t * 5.7 + 1.3)))
      );
      if (volumeFillRef.current) volumeFillRef.current.style.width = `${level}%`;
      if (++frame % 20 === 0) setVolume(level);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const partialTimer = setInterval(() => {
      step = (step + 1) % PARTIAL_FRAMES.length;
      setPartial(PARTIAL_FRAMES[step]);
    }, 1400);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(partialTimer);
    };
  }, [stateId]);

  const selectFrame = (id) => {
    window.clearTimeout(saveTimerRef.current);
    setQuestionOverride(null);
    setVolume(0);
    setPartial(PARTIAL_FRAMES[0]);
    setAnswer(ANSWER_TEXT);
    setVerifyError('');
    setErrorDismissed(false);
    setNotice('');
    setStateId(id);
  };

  const confirm = () => {
    if (!answer.trim()) {
      setVerifyError('Your answer is empty. Record again or add your answer before confirming.');
      return;
    }
    setVerifyError('');
    setStateId('saving');
    saveTimerRef.current = window.setTimeout(() => setStateId('ready'), 650);
  };

  return (
    <div className="dev-test-preview">
      <TestWorkspace
        variant={variant}
        showBriefing={Boolean(s.showBriefing)}
        isConnected={Boolean(s.isConnected)}
        isRecording={Boolean(s.isRecording)}
        isPlayingAudio={Boolean(s.isPlayingAudio)}
        isSessionComplete={Boolean(s.isSessionComplete)}
        connectionLost={Boolean(s.connectionLost)}
        alreadyCompleted={s.alreadyCompleted || null}
        result={variant === 'pre' ? { score: 62, weakness: 'focus_clarity' } : s.result || null}
        currentQuestion={currentQuestion}
        currentQuestionText={s.question || ''}
        status={s.status || ''}
        finalTranscript={s.finalTranscript || ''}
        partialTranscript={s.isRecording ? partial : ''}
        confirmedTranscript={answer}
        awaitingConfirmation={Boolean(s.awaitingConfirmation)}
        submissionPhase={s.submissionPhase || 'idle'}
        verifyError={verifyError}
        error={!errorDismissed ? s.error || '' : ''}
        volume={s.isRecording ? volume : 0}
        volumeFillRef={volumeFillRef}
        verifyTextareaRef={verifyTextareaRef}
        onStart={() => {
          selectFrame('question');
          setQuestionOverride(1);
        }}
        onExit={() => setNotice('The live page returns to your dashboard.')}
        onReconnect={() => {
          setQuestionOverride(currentQuestion);
          setStateId('question');
        }}
        onReplay={() => {
          setStateId('speaking');
          saveTimerRef.current = window.setTimeout(() => setStateId('question'), 1800);
        }}
        onRecord={() => setStateId('listening')}
        onStop={() => setStateId('review')}
        onAnswerChange={setAnswer}
        onConfirm={confirm}
        onNext={() => {
          if (currentQuestion >= 5) setStateId('complete');
          else {
            setQuestionOverride(currentQuestion + 1);
            setStateId('question');
          }
        }}
        onReRecord={() => {
          setVerifyError('');
          setStateId('listening');
        }}
        onContinue={() =>
          setNotice(
            variant === 'pre'
              ? 'The live page opens your practice analysis, then Set 1.'
              : 'The live page opens the final confidence check before revealing your results.'
          )
        }
        onViewResults={() => setNotice('The live page opens your saved progress report.')}
        onDismissError={() => setErrorDismissed(true)}
      />
      <div className="dev-test-controls" role="region" aria-label="Dev preview controls">
        <div className="dev-test-controls-head">
          <span>Design preview · {variant === 'pre' ? 'Pre-test' : 'Post-test'}</span>
          <div role="group" aria-label="Preview test type">
            <button
              type="button"
              onClick={() => {
                setVariant('pre');
                selectFrame('briefing');
              }}
              aria-pressed={variant === 'pre'}
            >
              Pre-test
            </button>
            <button
              type="button"
              onClick={() => {
                setVariant('post');
                selectFrame('briefing');
              }}
              aria-pressed={variant === 'post'}
            >
              Post-test
            </button>
          </div>
        </div>
        <div className="dev-test-frames" role="group" aria-label="Preview session state">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectFrame(id)}
              aria-pressed={stateId === id}
            >
              {STATES[id].label}
            </button>
          ))}
        </div>
        <p>{STATES[stateId].hint}</p>
        <div className="dev-test-controls-foot">
          <span>Shared live-page components · Sample scores and simulated audio</span>
          <button
            type="button"
            onClick={() => navigate(variant === 'pre' ? '/pre-test' : '/post-test')}
          >
            Open the real page
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </div>
    </div>
  );
}

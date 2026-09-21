import { ArrowRight, FileText, LoaderCircle, Mic, Volume2 } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import mascotSrc from '../assets/mascot-headset.png';
import AssessmentJourney from './AssessmentJourney';
import './TestBriefing.css';

const ACTIONS = [
  { label: 'Listen', Icon: Volume2 },
  { label: 'Speak', Icon: Mic },
  { label: 'Review', Icon: FileText },
];

export default function TestBriefing({ variant, authLoading, onStart, startRef, reduced }) {
  const pre = variant === 'pre';

  return (
    <div className="test-briefing">
      <AssessmentJourney current={pre ? 0 : 2} appearance="playful" />
      <div className="test-briefing-hero">
        <Motion.div
          className="test-briefing-art"
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0, y: 8, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        >
          <span className="test-briefing-backdrop" />
          <img src={mascotSrc} alt="" width="1135" height="1354" draggable="false" />
          <div className="test-briefing-mic">
            <span className="test-briefing-mic-head">
              <Mic />
            </span>
            <span className="test-briefing-mic-stand" />
            <span className="test-briefing-mic-base" />
          </div>
        </Motion.div>
        <div className="test-briefing-copy">
          <span className="test-briefing-count">5 questions</span>
          <h1 className="test-briefing-title">
            <span>{pre ? 'Your first answers.' : 'Same questions.'}</span>
            <span>{pre ? 'Your starting point.' : 'A fresh attempt.'}</span>
          </h1>
          <p className="test-briefing-description">
            {pre
              ? 'Five answers help choose your practice. Repeat them after practice to compare.'
              : 'Answer the same five questions again to see how your answers have changed.'}
          </p>
          <ol className="test-briefing-actions" aria-label="How to answer each question">
            {ACTIONS.map((action, index) => {
              const { label, Icon } = action;
              return (
                <li key={label}>
                  <span className="test-briefing-action-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span>{label}</span>
                  {index < ACTIONS.length - 1 && (
                    <ArrowRight className="test-briefing-action-arrow" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
          <div className="test-content-footer test-briefing-footer">
            <button
              ref={startRef}
              type="button"
              className="test-button test-button--primary test-briefing-start"
              disabled={authLoading}
              onClick={onStart}
              id={pre ? 'btn-start-baseline' : 'btn-start-graduation'}
            >
              <span>
                {authLoading
                  ? 'Checking account…'
                  : pre
                    ? 'Start my check'
                    : 'Start progress check'}
              </span>
              {authLoading ? (
                <LoaderCircle className="test-spinner" aria-hidden="true" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </button>
            <p className="test-briefing-note">
              Taken once. Check your transcript before submitting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

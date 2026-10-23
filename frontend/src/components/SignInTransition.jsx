import { memo, useEffect, useId, useRef } from 'react';
import { Check, LoaderCircle, Sparkle } from 'lucide-react';
import logo from '../assets/logo';
import mascot from '../assets/mascot-head.png';
import './SignInTransition.css';

const HEADINGS = {
  account: 'Checking your school account…',
  dashboard: 'Opening your dashboard…',
  complete: 'You’re in. Let’s get you ready.',
  leaving: 'You’re in. Let’s get you ready.',
};

const SignInTransition = memo(function SignInTransition({ phase = 'account', overlay = false }) {
  const headingId = useId();
  const screen = useRef(null);
  const complete = phase === 'complete' || phase === 'leaving';
  const accountDone = phase !== 'account';
  const progressLabel = complete ? 'Dashboard ready' : accountDone ? 'Opening your dashboard' : 'Confirming school access';

  useEffect(() => {
    if (overlay) screen.current?.focus({ preventScroll: true });
  }, [overlay]);

  return (
    <section
      ref={screen}
      className={`sit-screen sit-screen--${phase}${overlay ? ' sit-screen--overlay' : ''}`}
      role="status"
      aria-live="polite"
      aria-labelledby={headingId}
      tabIndex={-1}
      data-testid="sign-in-transition"
      data-phase={phase}
    >
      <header className="sit-brand" aria-label="ITerview">
        <img src={logo} alt="" width="52" height="42" />
        <span>ITerview</span>
      </header>

      <div className="sit-layout">
        <div className="sit-art" aria-hidden="true">
          <div className="sit-orbit"><span /></div>
          <Sparkle className="sit-spark sit-spark--left" strokeWidth={0} fill="currentColor" />
          <Sparkle className="sit-spark sit-spark--right" strokeWidth={0} fill="currentColor" />
          <div className="sit-mascot-float">
            <img className="sit-mascot" src={mascot} alt="" width="1456" height="1088" fetchPriority="high" />
          </div>
          <div className="sit-shadow" />
        </div>

        <div className="sit-content">
          <p className="sit-eyebrow">A moment before you begin</p>
          <h1 id={headingId} className="sit-heading">{HEADINGS[phase]}</h1>
          <p className="sit-description">Getting you ready for your next interview.</p>

          <ol className="sit-steps" aria-label="Sign-in progress">
            <li className={accountDone ? 'sit-step is-done' : 'sit-step is-current'} aria-current={!accountDone ? 'step' : undefined}>
              <span className="sit-step__marker" aria-hidden="true">
                {accountDone ? <Check /> : <LoaderCircle className="sit-spinner" />}
              </span>
              <span>{accountDone ? 'School access confirmed' : 'Confirming school access'}</span>
            </li>
            <li className={complete ? 'sit-step is-done' : accountDone ? 'sit-step is-current' : 'sit-step'} aria-current={accountDone && !complete ? 'step' : undefined}>
              <span className="sit-step__marker" aria-hidden="true">
                {complete ? <Check /> : accountDone ? <LoaderCircle className="sit-spinner" /> : <span className="sit-pending" />}
              </span>
              <span>{complete ? 'Your dashboard is ready' : 'Opening your dashboard'}</span>
            </li>
          </ol>

          <div
            className="sit-progress"
            role="progressbar"
            aria-label="Sign-in progress"
            aria-valuetext={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={complete ? 100 : undefined}
          >
            <span className="sit-progress__fill" />
            <span className="sit-progress__sweep" />
          </div>
        </div>
      </div>
    </section>
  );
});

export default SignInTransition;

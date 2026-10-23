import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useSchoolAuth } from './schoolAuth';
import { SignInTransitionContext } from './signInTransition';
import SignInTransition from '../components/SignInTransition';

// Presentation timing never delays authentication or dashboard requests.
const MIN_VISIBLE_MS = 2200;
const SUCCESS_HOLD_MS = 600;
const REVEAL_MS = 240;

export default function SignInTransitionProvider({ children }) {
  const { status, user } = useSchoolAuth();
  const { pathname } = useLocation();
  const [transition, setTransition] = useState(null);
  const current = useRef(null);
  const timers = useRef([]);
  const content = useRef(null);
  const origin = useRef(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    current.current = null;
    setTransition(null);
  }, [clearTimers]);

  const begin = useCallback(() => {
    clearTimers();
    origin.current = document.activeElement;
    const next = { phase: 'account', startedAt: performance.now(), pathname, userUid: user?.uid };
    current.current = next;
    setTransition(next);
    return next;
  }, [clearTimers, pathname, user?.uid]);

  const openingDashboard = useCallback((ticket) => {
    const active = current.current;
    if (!active || (ticket && ticket !== active) || active.phase !== 'account') return;
    active.phase = 'dashboard';
    setTransition({ ...active });
  }, []);

  const finish = useCallback(() => {
    const active = current.current;
    if (!active || active.finishing) return;
    active.finishing = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const remaining = reducedMotion ? 0 : Math.max(0, MIN_VISIBLE_MS - (performance.now() - active.startedAt));
    timers.current.push(setTimeout(() => {
      if (current.current !== active) return;
      active.phase = 'complete';
      setTransition({ ...active });
      timers.current.push(setTimeout(() => {
        if (current.current !== active) return;
        active.phase = 'leaving';
        setTransition({ ...active });
        timers.current.push(setTimeout(() => {
          if (current.current === active) cancel();
        }, reducedMotion ? 0 : REVEAL_MS));
      }, reducedMotion ? 80 : SUCCESS_HOLD_MS));
    }, remaining));
  }, [cancel]);

  useEffect(() => {
    const active = current.current;
    if (!active) return;
    if (user) active.userUid = user.uid;
    if (['verify', 'wrong-school', 'error'].includes(status) ||
        (status === 'signed-out' && active.userUid)) {
      const timer = setTimeout(() => { if (current.current === active) cancel(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [status, user, cancel]);

  useEffect(() => {
    const active = current.current;
    if (active && pathname !== active.pathname && pathname !== '/dashboard') {
      const timer = setTimeout(() => { if (current.current === active) cancel(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [pathname, cancel]);

  const active = Boolean(transition);
  useEffect(() => {
    if (!active) return;
    // The auth modal owns body overflow; use the root to avoid competing locks.
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
      const target = origin.current?.isConnected
        ? origin.current
        : document.querySelector('[role="alert"], main h1, input');
      if (target instanceof HTMLElement) {
        if (!target.matches('button, input, a, [tabindex]')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    };
  }, [active]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <SignInTransitionContext.Provider value={{ active, begin, openingDashboard, finish, cancel }}>
      <div ref={content} inert={active} aria-hidden={active || undefined}>
        {children}
      </div>
      {transition && createPortal(
        <SignInTransition phase={transition.phase} overlay />,
        document.body
      )}
    </SignInTransitionContext.Provider>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { NikkiOpeningContext } from './nikkiOpeningContext';
import NikkiOpening from './NikkiOpening';

const MIN_OPENING_MS = 2000;
const READY_HOLD_MS = 500;
const REVEAL_MS = 300;

export default function NikkiOpeningProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState(null);
  const current = useRef(null);
  const timers = useRef([]);
  const origin = useRef(null);
  const restoreTo = useRef(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    current.current = null;
    setPhase(null);
  }, [clearTimers]);

  const cancel = useCallback(() => {
    const opening = current.current;
    restoreTo.current = opening?.from;
    if (opening?.navigated) navigate(opening.from, { replace: true });
    dismiss();
  }, [dismiss, navigate]);

  const begin = useCallback(() => {
    if (current.current) return;
    origin.current = document.activeElement;
    restoreTo.current = null;
    const opening = {
      from: `${location.pathname}${location.search}${location.hash}`,
      startedAt: performance.now(),
      navigated: false,
      finishing: false,
    };
    current.current = opening;
    setPhase('waking');
    const later = (callback, delay) => timers.current.push(setTimeout(() => {
      if (current.current === opening) callback();
    }, delay));
    later(() => setPhase('noticing'), 400);
    later(() => setPhase('curious'), 900);
    // Cover the route change before mounting the destination. Its real orb
    // renders at full size behind the opaque scrim, then reports its first frame.
    later(() => setPhase('covering'), 1400);
    later(() => {
      opening.navigated = true;
      navigate('/voice-agent');
    }, 1650);
    later(() => setPhase('error'), 12_000);
  }, [location, navigate]);

  const destinationReady = useCallback(() => {
    const opening = current.current;
    if (!opening?.navigated || opening.finishing) return;
    opening.finishing = true;
    clearTimers();
    const remaining = Math.max(0, MIN_OPENING_MS - (performance.now() - opening.startedAt));
    const later = (callback, delay) => timers.current.push(setTimeout(() => {
      if (current.current === opening) callback();
    }, delay));
    later(() => setPhase('ready'), remaining);
    later(() => setPhase('leaving'), remaining + READY_HOLD_MS);
    later(() => {
      restoreTo.current = '/voice-agent';
      dismiss();
    }, remaining + READY_HOLD_MS + REVEAL_MS);
  }, [clearTimers, dismiss]);

  useEffect(() => {
    const opening = current.current;
    if (!opening) return;
    const path = `${location.pathname}${location.search}${location.hash}`;
    const leftOpeningRoute = opening.navigated ? path !== '/voice-agent' : path !== opening.from;
    if (leftOpeningRoute) {
      if (path === opening.from) restoreTo.current = opening.from;
      const timer = setTimeout(dismiss, 0);
      return () => clearTimeout(timer);
    }
  }, [location, dismiss]);

  const active = phase !== null;
  useEffect(() => {
    if (!active) return;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, [active]);

  useEffect(() => {
    // Router navigation can commit after the dialog closes. Restore focus only
    // once the intended page is mounted and the inert attribute is removed.
    const path = `${location.pathname}${location.search}${location.hash}`;
    if (active || path !== restoreTo.current) return;
    const frame = requestAnimationFrame(() => {
      const target = path === '/voice-agent'
        ? document.querySelector('#voice-agent-status')
        : origin.current?.isConnected ? origin.current : document.querySelector('.db-coach-card');
      if (target instanceof HTMLElement) {
        if (!target.matches('button, [tabindex]')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
        restoreTo.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, location]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <NikkiOpeningContext.Provider value={{ begin, destinationReady }}>
      <div inert={active} aria-hidden={active || undefined}>{children}</div>
      {active && createPortal(<NikkiOpening phase={phase} durationMs={MIN_OPENING_MS} onCancel={cancel} />, document.body)}
    </NikkiOpeningContext.Provider>
  );
}

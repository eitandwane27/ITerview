import { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

// Adapted from transitions.dev's panel reveal: navigation stays immediate,
// persistent panels keep their state, and a new selection settles in place.
export default function DashboardPanel({ active, children, ...props }) {
  const panelRef = useRef(null);
  const wasActive = useRef(active);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const entering = active && !wasActive.current;
    wasActive.current = active;
    if (!entering || reduceMotion || !panelRef.current?.animate) return;
    const animation = panelRef.current.animate(
      [{ opacity: 0.55 }, { opacity: 1 }],
      { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
    // Rapid navigation cancels the previous reveal instead of queuing it.
    return () => animation.cancel();
  }, [active, reduceMotion]);

  return <div {...props} ref={panelRef} role="tabpanel" hidden={!active}>{children}</div>;
}

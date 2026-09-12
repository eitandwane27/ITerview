// frontend/src/components/motion/CountUp.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Number counter that starts when the element scrolls into view, easing toward
// `to` with the design token curve. Under `prefers-reduced-motion` it renders
// the final value immediately (no counting, no timer work).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { EASE } from './motion';

export const CountUp = ({
  to,
  duration = 1.2,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, reduce, to, duration, delay]);

  const formatted =
    decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default CountUp;

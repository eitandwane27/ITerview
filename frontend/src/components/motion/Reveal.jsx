// frontend/src/components/motion/Reveal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One scroll-reveal primitive for the whole landing page.
//
// Honor-a11y contract:
//   * `initial={false}` under `prefers-reduced-motion: reduce` → content is
//     rendered fully visible, never hidden by a transform/opacity pre-state.
//   * Only transform + opacity animate (never layout properties).
//   * Reveals run once (`whileInView` + `once: true`).
//
// `as` mirrors the `motion.*` tag (e.g. "article") so grid items keep their
// original element identity and the layout does not change inside grids.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE, REVEAL_Y, REVEAL_VIEWPORT } from './motion';

export const Reveal = ({
  as = 'div',
  children,
  className,
  delay = 0,
  y = REVEAL_Y,
  duration = 0.7,
  viewport = REVEAL_VIEWPORT,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default Reveal;

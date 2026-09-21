import React from 'react';
import { motion as Motion } from 'framer-motion';
import mascotHeadSrc from '../assets/mascot-head.png';
import './Set3TransitionOverlay.css';

// ─── Motion variants (frontend.md § Loading States & Modal Overlays) ──────────
// "Entrance = fade + subtle scale (0.96 -> 1.0), not slide-up"
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
      delay: 0.08,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: 'easeOut', delay },
  }),
};

export default function Set3TransitionOverlay({ onReady }) {
  return (
    <Motion.div
      className="s3-overlay"
      data-spacing-scope
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Outer white card: Extra-Large Squircle (24px) */}
      <Motion.div className="s3-card" variants={cardVariants}>
        {/* Completion badge: Cool Mint tokens */}
        <Motion.div className="s3-badge" variants={fadeUp} custom={0.15}>
          <span className="s3-badge-dot" aria-hidden="true" />
          Set 2 Complete
        </Motion.div>

        {/* AI Coach mascot in Deep Tech Indigo / Icy Blue squircle ring */}
        <Motion.div className="s3-icon-ring" variants={fadeUp} custom={0.25}>
          <img
            src={mascotHeadSrc}
            alt="iTerview AI Coach mascot"
            className="s3-mascot-img"
          />
        </Motion.div>

        {/* Title: Fredoka display font */}
        <Motion.h2 className="s3-title" variants={fadeUp} custom={0.32}>
          Prepare for Set 3
        </Motion.h2>

        {/* Divider */}
        <Motion.div className="s3-divider" variants={fadeUp} custom={0.38} aria-hidden="true" />

        {/* Description: Plus Jakarta Sans body */}
        <Motion.p className="s3-description" variants={fadeUp} custom={0.44}>
          The AI will now shift focus to your behavioral skills using the{' '}
          <span className="s3-method-highlight">STAR method</span> (Situation, Action, Result).
          Expect questions testing collaboration, conflict resolution, resilience, and initiative.
        </Motion.p>

        {/* CTA: Tactile 3D Royal Cobalt pill button per DESIGN.md */}
        <Motion.div className="s3-actions" variants={fadeUp} custom={0.52}>
          <button className="s3-btn-primary" onClick={onReady} id="s3-begin-btn">
            Begin Behavioral Set
          </button>
        </Motion.div>
      </Motion.div>
    </Motion.div>
  );
}

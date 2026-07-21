import React from "react";
import { motion } from "framer-motion";
import "./Set3TransitionOverlay.css";

// ─── Motion variants ──────────────────────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 26,
      delay: 0.08,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: "easeOut", delay },
  }),
};

export default function Set3TransitionOverlay({ onReady }) {
  return (
    <motion.div
      className="s3-overlay"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="s3-card" variants={cardVariants}>
        {/* Completion badge */}
        <motion.div className="s3-badge" variants={fadeUp} custom={0.15}>
          <span className="s3-badge-dot" aria-hidden="true" />
          Set 2 Complete
        </motion.div>

        {/* Behavioral icon ring */}
        <motion.div className="s3-icon-ring" variants={fadeUp} custom={0.25}>
          <span className="s3-icon" role="img" aria-label="Behavioral icon">
            🤝
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2 className="s3-title" variants={fadeUp} custom={0.32}>
          Prepare for Set 3
        </motion.h2>

        {/* Divider */}
        <motion.div
          className="s3-divider"
          variants={fadeUp}
          custom={0.38}
          aria-hidden="true"
        />

        {/* Description */}
        <motion.p className="s3-description" variants={fadeUp} custom={0.44}>
          The AI will now shift focus to your behavioral skills using the{" "}
          <span className="s3-method-highlight">STAR method</span> (Situation, Action, Result). 
          Expect questions testing collaboration, conflict resolution, resilience, and initiative.
        </motion.p>

        {/* CTA */}
        <motion.div className="s3-actions" variants={fadeUp} custom={0.52}>
          <button
            className="s3-btn-primary"
            onClick={onReady}
            id="s3-begin-btn"
          >
            Begin Behavioral Set
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

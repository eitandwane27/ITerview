import React from "react";
import { motion } from "framer-motion";
import "./Set2TransitionOverlay.css";

// ─── Motion variants (frontend.md § Loading States & Modal Overlays) ──────────
// "Entrance = fade + subtle scale (0.96 → 1.0), not slide-up"
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

// Staggered fade for child elements
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: "easeOut", delay },
  }),
};

// ─── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_META = {
  frontend: { icon: "🎨", label: "Frontend Developer" },
  backend: { icon: "⚙️", label: "Backend Developer" },
  fullstack: { icon: "🚀", label: "Fullstack Developer" },
};

export default function Set2TransitionOverlay({ onReady, role = "Frontend" }) {
  const meta = ROLE_META[role.toLowerCase()] ?? {
    icon: "💻",
    label: `${role} Developer`,
  };

  return (
    <motion.div
      className="s2-overlay"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* ── Outer white card ─────────────────────────────────────── */}
      <motion.div className="s2-card" variants={cardVariants}>
        {/* Completion badge — badge-green tokens */}
        <motion.div className="s2-badge" variants={fadeUp} custom={0.15}>
          <span className="s2-badge-dot" aria-hidden="true" />
          Set 1 Complete
        </motion.div>

        {/* Role icon in lavender inner-card ring */}
        <motion.div className="s2-icon-ring" variants={fadeUp} custom={0.25}>
          <span className="s2-icon" role="img" aria-label={meta.label}>
            {meta.icon}
          </span>
        </motion.div>

        {/* Title — section-title token */}
        <motion.h2 className="s2-title" variants={fadeUp} custom={0.32}>
          Prepare for Set 2
        </motion.h2>

        {/* Divider */}
        <motion.div
          className="s2-divider"
          variants={fadeUp}
          custom={0.38}
          aria-hidden="true"
        />

        {/* Description — body-secondary token */}
        <motion.p className="s2-description" variants={fadeUp} custom={0.44}>
          The AI will now shift focus to your technical knowledge as a{" "}
          <span className="s2-role-highlight">{meta.label}</span>. Expect
          standard industry questions on core concepts and mechanics.
        </motion.p>

        {/* CTA — primary button, rounded.lg, no shadow per DESIGN.md */}
        <motion.div className="s2-actions" variants={fadeUp} custom={0.52}>
          <button
            className="s2-btn-primary"
            onClick={onReady}
            id="s2-begin-btn"
          >
            Begin Technical Set
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

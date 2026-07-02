// frontend/src/components/SetBriefingOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 Mission Briefing — rendered as a full-screen overlay on top of MainSets
//
// Props:
//   onReady — called when the user clicks "I'm Ready →", dismissing the overlay
//
// Flow:
//  1. On mount: fetch /api/users/pretest-profile?uid=<firebaseUid>
//  2. Build a personalized coach message from the returned weakness tag + role
//  3. Animate the card in → icon pops → typewriter message reveals →
//     focus chips stagger in → sub-message fades → CTA button glows in
//  4. Clicking the typewriter area skips instantly to the full message
//  5. "I'm Ready →" calls onReady() to dismiss the overlay

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useTypewriter } from "../hooks/useTypewriter";
import { Bot, Target, MessageSquare, Lightbulb, CheckCircle2, Star } from "lucide-react";
import "./SetBriefingOverlay.css";

// ─── Chip mapping — 3 C's ────────────────────────────────────────────────────
// On-the-spot labels for Communication · Clarity · Correctness
function getChip(tag) {
  if (!tag) return { label: "General Practice", icon: Target };
  const t = tag.toLowerCase().replace(/_/g, "-");
  if (t.includes("communication"))  return { label: "Communication", icon: MessageSquare };
  if (t.includes("clarity"))        return { label: "Clarity",       icon: Lightbulb };
  if (t.includes("correctness"))    return { label: "Correctness",   icon: CheckCircle2 };
  return { label: "General Practice", icon: Target };
}

// ─── Coach message builder ────────────────────────────────────────────────────
function buildMessage(weaknessTag, role) {
  const chipLabel = getChip(weaknessTag).label;
  const roleLabel = role
    ? `${role.charAt(0).toUpperCase() + role.slice(1)} Developer`
    : null;

  if (!weaknessTag) {
    return roleLabel
      ? `The AI has prepared a personalized Set 1 session for you as a ${roleLabel}. Let's get started.`
      : "The AI has prepared a personalized session for Set 1. Let's get started.";
  }

  return roleLabel
    ? `Based on your Pre-Test, the AI identified that your ${roleLabel} path will benefit most from focusing on ${chipLabel}. Set 1 is built around that.`
    : `Based on your Pre-Test, the AI identified that you'll benefit most from focusing on ${chipLabel}. Set 1 is built around that.`;
}

// ─── Framer-motion variants ───────────────────────────────────────────────────
const cardVariants = {
  hidden:  { opacity: 0, y: 28, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, y: -20, scale: 0.97,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit:    { opacity: 0, transition: { duration: 0.35 } },
};

const iconVariants = {
  hidden:  { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1, scale: 1,
    transition: { type: "spring", stiffness: 280, damping: 20, delay: 0.15 },
  },
};

const chipsContainerVariants = {
  hidden:   {},
  visible:  { transition: { staggerChildren: 0.1 } },
};

const chipVariants = {
  hidden:  { opacity: 0, y: 10, scale: 0.94 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const fadeUpVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, ease: "easeOut", delay },
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function SetBriefingOverlay({ onReady }) {
  const navigate = useNavigate();

  const [profile,  setProfile]  = useState(null); // { weaknessTag, baselineScore, role }
  const [loading,  setLoading]  = useState(true);

  // ── Fetch profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }
      try {
        const res  = await fetch(`/api/users/pretest-profile?uid=${user.uid}`);
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("❌ SetBriefingOverlay fetch error:", err);
        setProfile({ weaknessTag: null, baselineScore: null, role: null });
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // ── Derived display values ──────────────────────────────────────────────────
  const coachMessage = profile ? buildMessage(profile.weaknessTag, profile.role) : "";
  const chip         = profile ? getChip(profile.weaknessTag) : null;

  // ── Typewriter — only starts once loading is false ──────────────────────────
  const { displayText, isDone, skip } = useTypewriter(
    loading ? "" : coachMessage,
    28,
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="briefing-overlay-wrapper"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="briefing-card"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* ── Header: icon + eyebrow label ── */}
        <motion.div
          className="briefing-icon-wrap"
          variants={iconVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="briefing-icon" aria-hidden="true">
            <Bot size={18} className="briefing-icon-svg" />
          </div>
          <span className="briefing-eyebrow">AI Briefing · Set 1</span>
        </motion.div>

        {/* ── Body ── */}
        <div className="briefing-body">

          {/* Typewriter coach message */}
          <p className="briefing-message">
            {loading ? (
              <span className="briefing-message-loading" aria-label="Loading briefing…">
                <span className="briefing-shimmer-line" style={{ width: "92%" }} />
                <span className="briefing-shimmer-line" style={{ width: "76%" }} />
                <span className="briefing-shimmer-line" style={{ width: "55%" }} />
              </span>
            ) : (
              <>
                {displayText}
                {!isDone && <span className="cursor-blink" aria-hidden="true" />}
              </>
            )}
          </p>

          {/* Focus chips — stagger in after typewriter finishes */}
          <AnimatePresence>
            {isDone && !loading && chip && (
              <motion.div
                key="chips-section"
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <p className="briefing-chips-label">Focus area</p>
                <motion.div
                  className="briefing-chips"
                  variants={chipsContainerVariants}
                  initial="hidden"
                  animate="visible"
                  style={{ marginTop: "0.6rem" }}
                >
                  <motion.span className="briefing-chip" variants={chipVariants}>
                    <span className="briefing-chip-icon">
                      {React.createElement(chip.icon, { size: 14 })}
                    </span>
                    {chip.label}
                  </motion.span>

                  {chip.label !== "STAR Method" && (
                    <motion.span className="briefing-chip" variants={chipVariants}>
                      <span className="briefing-chip-icon">
                        <Star size={14} />
                      </span>
                      STAR Method
                    </motion.span>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* Skeleton chips while loading */}
            {loading && (
              <div className="briefing-chips" key="chips-skeleton">
                <div className="briefing-chip-skeleton" />
                <div className="briefing-chip-skeleton" style={{ width: 90 }} />
              </div>
            )}
          </AnimatePresence>

          {/* Divider */}
          {isDone && !loading && <hr className="briefing-divider" />}

          {/* Sub-message */}
          {isDone && !loading && (
            <motion.p
              className="briefing-sub"
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.08}
            >
              You'll receive feedback after every answer — use it to adjust before
              the next one.
            </motion.p>
          )}

          {/* CTA button */}
          {isDone && !loading && (
            <motion.button
              className="briefing-cta"
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.2}
              whileTap={{ scale: 0.975 }}
              onClick={onReady}
            >
              I'm Ready
              <span className="briefing-cta-arrow">→</span>
            </motion.button>
          )}

        </div>{/* /briefing-body */}



      </motion.div>
    </motion.div>
  );
}

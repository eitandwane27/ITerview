// frontend/src/pages/LandingPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ITerview Landing Page — Cool Color Spectrum Design System
// Royal Cobalt · Signal Sky Cyan · Deep Indigo · Cool Mint · Crisp White
// Primitives inspired by: shadcn/ui · Rare UI · Beautiful UI
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion as Motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import AuthModal from '../components/AuthModal';
import Reveal from '../components/motion/Reveal';
import CountUp from '../components/motion/CountUp';
import MentorMascot from '../components/MentorMascot';
import { EASE } from '../components/motion/motion';
const TryItLiveDemo = lazy(() => import('../components/TryItLiveDemo'));
import logoSrc from '../assets/logo';
import './LandingPage.css';
import {
  Sparkles,
  ShieldCheck,
  Layers,
  Check,
  Lock,
  Mic,
  AlignLeft,
  Gauge,
  Layers3,
  TrendingUp,
  Clock,
  Target,
  ArrowRight,
  CheckCircle2,
  Zap,
  Activity,
  CreditCard,
  Star,
  HeartHandshake,
  Trash2,
} from 'lucide-react';

/* Five whole-point ticks — one per point on the real 1–5 scale. The engine
   (`aiEvaluator.js`) clamps every dimension to an INTEGER, so a pip is either
   earned or it is not: there is no partial fill and no half-point. Only the
   colored fill transforms; reduced motion shows the final score immediately. */
const TICK_COUNT = 5;

/* Mirrors the backend clamp (aiEvaluator.js) so a decimal can never reach the
   page even if the sample data is edited carelessly. */
const clampScore = (n) => Math.min(5, Math.max(1, Math.round(n)));

const ScoreTicks = ({ score, color, delay = 0 }) => {
  const reduce = useReducedMotion();
  const value = clampScore(score);
  return (
    <div className="lp-bench-ticks" aria-hidden="true">
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const on = i < value;
        return (
          <span
            key={i}
            className={`lp-bench-tick${on ? ' lp-bench-tick--on' : ' lp-bench-tick--off'}`}
          >
            {on && (
              <Motion.span
                className="lp-bench-tick-fill"
                style={{ backgroundColor: color }}
                initial={reduce ? false : { scaleX: 0 }}
                whileInView={reduce ? undefined : { scaleX: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.26, ease: EASE, delay: delay + i * 0.035 }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};
/* ── The 3C Scoring Bench — sample data ──
   The three Cs are not three products; they are three lenses applied to ONE
   answer. So the section shows a single sampled spoken answer next to the
   rubric ledger that scored it, and each dimension's color traces the phrases
   in that answer which earned or cost it points.
   All criteria copy is the existing rubric wording; the sample answer is
   labelled as a sample so it can never read as real-user social proof.

   Scores are INTEGERS 1–5 because that is what `aiEvaluator.js` actually
   returns (parseInt + clamp). The old 4.2/4.5/4.0 composite was a scale the
   product cannot produce. `focus` replaces the composite: the engine's
   `primary_weakness` (here the lowest dimension) is what the next practice set
   auto-targets, so that is what the board reports at the bottom. */
const RUBRIC_ANSWER = {
  question: 'What makes a React component re-render?',
  duration: '0:28',
  focus: 'completeness',
};

/* Ordered segments of the spoken answer. `dim` links a phrase to the dimension
   it affected; `kind: 'earned' | 'missed'` marks whether the phrase earned or
   cost points, and `kind: 'missed'` segments carry a numbered flag so a reader
   can see at a glance WHICH of the three scores that phrase moved.
   `focus: true` marks the phrase the mentor should point at for that dimension.
   Untagged segments render as plain transcript.

   The three flaws are deliberately legible to a beginner:
     1 Clarity      → a side story ("React Native last semester") — a tangent.
     2 Correctness  → "re-renders the whole page" — flatly untrue.
     3 Completeness → nothing wrong in the text at all; the point was lost to
                      three ABSENCES, which the gap strip below names outright.
   That is why Completeness has no <mark>: an omission cannot be underlined. */
const RUBRIC_TRANSCRIPT = [
  { text: 'So, um, ' },
  { text: 'first', dim: 'clarity', kind: 'earned' },
  { text: ', a component re-renders when its ' },
  { text: 'state or props change', dim: 'correctness', kind: 'earned' },
  { text: '. ' },
  { text: 'Then', dim: 'clarity', kind: 'earned' },
  {
    text: ' React compares the new version with the old one and only updates the parts that changed. Oh, and ',
  },
  {
    text: 'I also picked up React Native last semester, which was fun',
    dim: 'clarity',
    kind: 'missed',
    focus: true,
  },
  { text: '. And it ' },
  {
    text: 're-renders the whole page every time',
    dim: 'correctness',
    kind: 'missed',
    focus: true,
  },
  { text: ', unless you use memo.' },
];

/* The three things the question also needed but the answer never reached.
   Rendered as the amber "Not covered" strip, and this is what makes the 3 in
   Completeness self-explanatory: core answer present, three pieces missing. */
const RUBRIC_GAPS = [
  'No example from a real project',
  'No edge case (like a parent re-render)',
  "No mention of how you'd test it",
];

/* `name` + `step` drive the visible label ("1. Clarity") so the coach notes can
   address a dimension by name without slicing the label string. `ask` and
   `criteria` are the untouched research rubric wording and stay screen-reader
   only; `plain`, `verdict`, `cost` and `fix` are the beginner-facing layer. */
const RUBRIC_DIMENSIONS = [
  {
    id: 'clarity',
    step: 1,
    name: 'Clarity',
    Icon: AlignLeft,
    color: 'var(--blue)',
    score: 4,
    summary: 'How easy your answer is to follow.',
    verdict: 'Good order — one side story about React Native cost a point.',
    cost: 'One side story cost a point.',
    fix: "Answer the question first, then add extras if there's time.",
    ask: 'How structured, professional, and articulate is your verbal delivery?',
    criteria: [
      'Logical structure & top-down framing',
      'Accurate use of standard IT terminology',
      'Elimination of filler words & tangents',
    ],
  },
  {
    id: 'correctness',
    step: 2,
    name: 'Correctness',
    Icon: ShieldCheck,
    color: 'var(--mint)',
    score: 4,
    summary: 'Whether what you said is actually true.',
    verdict: 'Right core idea — but "the whole page" is not how React works.',
    cost: 'One claim was wrong.',
    fix: 'Say what React compares, and what it skips.',
    ask: 'Is your technical reasoning sound and aligned with modern industry practices?',
    criteria: [
      'Technical accuracy of code & architecture',
      'Understanding of trade-offs & edge cases',
      'Practical alignment with production realities',
    ],
  },
  {
    id: 'completeness',
    step: 3,
    name: 'Completeness',
    Icon: Layers,
    color: 'var(--amber)',
    score: 3,
    summary: 'Whether you covered everything the question asked.',
    verdict: 'Core answer only — no example, no edge case, no testing.',
    cost: 'Three things the question needed were missing.',
    fix: 'End every answer with one example and one thing that could go wrong.',
    ask: 'Did you address the full prompt and substantiate your points with concrete examples?',
    criteria: [
      'Comprehensive answers to multi-part prompts',
      'Concrete project examples (Situation, Task, Action, Result)',
      'Explicit solutions for scale, error, & testing',
    ],
  },
];

/* The step number is what the numbered flag in the transcript shows, so a
   flagged phrase names the score it moved without spelling out the dimension. */
const dimensionStep = (id) => RUBRIC_DIMENSIONS.find((d) => d.id === id)?.step ?? '';

/* ── Rubric Bench ──
   Left: the sampled answer, with each rubric color tracing the phrases that
   earned or cost points, plus a numbered flag naming WHICH score a phrase moved.
   Right: the ledger — three hairline-separated rows (no nested card chrome)
   whose integer scores drive those annotations and each carry a one-line,
   plain-language verdict.

   The sample scores are whole numbers (4 / 4 / 3) because the engine clamps to
   integers. Completeness has no highlight in the transcript at all: it lost its
   point to three ABSENCES, which the "Not covered" strip names outright.

   At rest the transcript marks ONLY the phrases that cost points — one soft
   tinted highlight, one crisp baseline, one numbered flag each — so the answer
   reads as plain speech instead of a three-color rainbow. Hovering or pinning
   a score sweeps a bare tint across every phrase that fed it (earned ones
   included): the color trace appears on demand. Hover previews a dimension,
   click pins it (two separate states, so previewing never fights the pin).
   Rows are real buttons with aria-pressed. */
const RubricBench = () => {
  const sceneRef = useRef(null);
  const [pinned, setPinned] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [entered, setEntered] = useState(false);
  const activeDim = hovered ?? pinned;
  const activeRubric = RUBRIC_DIMENSIONS.find((dimension) => dimension.id === activeDim);
  // The engine's `primary_weakness`: the dimension the next practice set targets.
  const focusDim =
    RUBRIC_DIMENSIONS.find((dimension) => dimension.id === RUBRIC_ANSWER.focus) ??
    RUBRIC_DIMENSIONS[0];

  return (
    <Reveal
      as="div"
      className="lp-bench-scene"
      ref={sceneRef}
      y={18}
      duration={0.65}
      onViewportEnter={() => setEntered(true)}
      style={{ '--mentor-accent': activeRubric?.color || 'var(--blue)' }}
      data-active-dimension={activeDim || 'none'}
    >
      <MentorMascot
        layer="back"
        sceneRef={sceneRef}
        activeDimension={activeDim}
        entered={entered}
      />
      <div className="lp-bench">
        {/* ── Left: the answer being scored ── */}
        <div className="lp-bench-answer">
          <div className="lp-bench-answer-meta">
            <Mic size={13} strokeWidth={2.4} aria-hidden="true" />
            <span className="lp-bench-answer-tag">Sample answer</span>
            <span className="lp-bench-answer-sep" aria-hidden="true">
              ·
            </span>
            <span className="lp-bench-answer-note">transcribed</span>
            <span className="lp-bench-time">{RUBRIC_ANSWER.duration}</span>
          </div>

          <p className="lp-bench-question">&ldquo;{RUBRIC_ANSWER.question}&rdquo;</p>

          <p className="lp-bench-transcript">
            {RUBRIC_TRANSCRIPT.map((seg, i) =>
              seg.dim ? (
                <mark
                  key={i}
                  data-dimension={seg.dim}
                  data-mentor-target={seg.focus ? 'true' : undefined}
                  className={[
                    'lp-bench-mark',
                    `lp-bench-mark--${seg.dim}`,
                    seg.kind === 'missed' ? 'lp-bench-mark--missed' : '',
                    activeDim && activeDim !== seg.dim ? 'is-dimmed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {seg.text}
                  {/* The numbered flag names WHICH of the three scores this phrase
                      moved, so "3" is never a mystery. Decorative: the meaning is
                      already in the row the reader can select. */}
                  {seg.kind === 'missed' && (
                    <span className="lp-bench-flag" aria-hidden="true">
                      {dimensionStep(seg.dim)}
                    </span>
                  )}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </p>

          {/* Completeness lost its point to an ABSENCE, so it cannot be
              underlined in the transcript — the gaps are named here instead, and
              this strip is what the mentor points at for that dimension. */}
          <div
            className="lp-bench-gaps"
            data-dimension="completeness"
            data-mentor-target="true"
            data-active={activeDim === 'completeness' ? 'true' : 'false'}
          >
            <p className="lp-bench-gaps-head">
              <Layers size={15} strokeWidth={2.4} aria-hidden="true" />
              <span>Not covered — three things this question also needed</span>
            </p>
            <div className="lp-bench-gaps-list">
              {RUBRIC_GAPS.map((gap) => (
                <button
                  key={gap}
                  type="button"
                  className="lp-bench-gap-chip"
                  aria-pressed={pinned === 'completeness'}
                  aria-label={`Completeness gap: ${gap}. Select to see what shaped the score.`}
                  onClick={() =>
                    setPinned((cur) => (cur === 'completeness' ? null : 'completeness'))
                  }
                >
                  <span className="lp-bench-gap-chip-num" aria-hidden="true">
                    3
                  </span>
                  <span>{gap}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Decodes the two resting signals right where they appear: an
              underlined highlight means "points lost here", and the flag
              number names the score row it moved. */}
          <p className="lp-bench-hint">
            Underlined highlights show where points were lost — the number matches its score row.
          </p>
        </div>

        {/* ── Right: the rubric ledger ── */}
        <div className="lp-bench-ledger" role="group" aria-label="How the sample answer was scored">
          {RUBRIC_DIMENSIONS.map((d, i) => {
            const Icon = d.Icon;
            return (
              <Reveal
                as="button"
                key={d.id}
                type="button"
                className={`lp-bench-row${activeDim === d.id ? ' is-active' : ''}`}
                aria-pressed={pinned === d.id}
                aria-label={`${d.step}. ${d.name}, ${d.score} out of 5`}
                aria-describedby={`lp-rubric-${d.id}-description`}
                onClick={() => setPinned((cur) => (cur === d.id ? null : d.id))}
                onMouseEnter={() => setHovered(d.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(d.id)}
                onBlur={() => setHovered(null)}
                delay={0.12 + i * 0.1}
                y={14}
              >
                <span className="lp-bench-row-head">
                  <span className={`lp-bench-row-icon lp-bench-row-icon--${d.id}`}>
                    <Icon size={22} strokeWidth={2.2} color={d.color} aria-hidden="true" />
                  </span>
                  <span className="lp-bench-row-name">
                    {d.step}. {d.name}
                  </span>
                  <span className="lp-bench-row-score" style={{ color: d.color }}>
                    <CountUp to={d.score} duration={1} delay={0.3 + i * 0.1} />
                    <span className="lp-bench-row-of"> / 5</span>
                  </span>
                </span>
                <ScoreTicks score={d.score} color={d.color} delay={0.34 + i * 0.1} />
                <span className="lp-bench-row-ask">{d.summary}</span>
                {/* The plain verdict is the whole point of the rewrite: a beginner
                    should be able to read the score and its reason in one line. */}
                <span className="lp-bench-verdict">{d.verdict}</span>
                <span className="lp-sr-only" id={`lp-rubric-${d.id}-description`}>
                  {d.ask} {d.criteria.join('. ')}.
                </span>
              </Reveal>
            );
          })}

          {/* Not a composite: 4+4+3 cannot average to a whole number, and the
              product never shows a per-answer total anyway. What it DOES do is
              target the lowest dimension, so the board reports that instead. */}
          <div
            className={`lp-bench-composite lp-bench-composite--focus lp-bench-composite--${focusDim.id}`}
          >
            <span className="lp-bench-composite-icon" aria-hidden="true">
              <Target size={23} strokeWidth={2.3} color={focusDim.color} />
            </span>
            <span className="lp-bench-composite-text">
              <span className="lp-bench-composite-label">Lowest · targeted next</span>
              <span className="lp-bench-composite-sub">
                {focusDim.name} is your lowest score — your next practice set works on it.
              </span>
            </span>
            <span className="lp-bench-composite-val">
              <CountUp to={focusDim.score} duration={1.1} delay={0.5} />
              <span className="lp-bench-row-of"> / 5</span>
            </span>
          </div>
        </div>
      </div>
      <MentorMascot
        layer="front"
        sceneRef={sceneRef}
        activeDimension={activeDim}
        entered={entered}
      />
      <div className="lp-bench-coach-notes">
        <Sparkles
          size={17}
          aria-hidden="true"
          style={{ color: activeRubric?.color || 'var(--blue)' }}
        />
        <p>
          {activeRubric ? (
            <>
              <strong>
                {activeRubric.name} · {activeRubric.score}/5.
              </strong>{' '}
              {activeRubric.cost} → {activeRubric.fix}
            </>
          ) : (
            'Tap a score to explore it — your coach will follow along.'
          )}
        </p>
      </div>
    </Reveal>
  );
};

/* ── Standalone Atmospheric Light Sweep Component (Independent Geometry & Height) ── */
const HeroAtmosphere = () => {
  // The signature "horizon draws itself" effect. Gated behind reduced motion:
  // the atmosphere renders fully formed for users who prefer no motion, so the
  // horizon never appears missing. The blurred wide band fades in (cheap) while
  // the crisp highlight and streak draw along it (transform-free dash math).
  const reduce = useReducedMotion();
  return (
    <div className="lp-hero-atmosphere" aria-hidden="true">
      {/* Base Crisp Canvas Layer */}
      <div className="lp-atmo-base" />

      {/* Blue Radial Illuminations from Lower-Left, Lower-Right, and Bottom Center */}
      <div className="lp-atmo-glow-left" />
      <div className="lp-atmo-glow-right" />
      <div className="lp-atmo-glow-bottom" />

      {/* Luminous Curved Light Sweep / Crescent Horizon */}
      <svg
        className="lp-atmo-svg-sweep"
        viewBox="0 0 1440 820"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="atmo-blue-left" cx="0%" cy="100%" r="75%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#60A5FA" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#93C5FD" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="atmo-blue-right" cx="100%" cy="100%" r="75%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#60A5FA" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#93C5FD" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="atmo-sweep-grad-primary" x1="0%" y1="30%" x2="100%" y2="30%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="atmo-sweep-grad-secondary" x1="15%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
          </linearGradient>

          <filter id="atmo-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="atmo-wide-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* Atmospheric Mist Underneath Arc */}
        <rect x="0" y="0" width="1440" height="820" fill="url(#atmo-blue-left)" />
        <rect x="0" y="0" width="1440" height="820" fill="url(#atmo-blue-right)" />

        {/* Primary Luminous Light Arc / Horizon Line (wide soft band fades in) */}
        <Motion.path
          d="M -40 330 Q 720 620 1480 340"
          stroke="url(#atmo-sweep-grad-primary)"
          strokeWidth="28"
          strokeLinecap="round"
          filter="url(#atmo-wide-blur)"
          opacity="0.9"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 0.9 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
        />
        {/* Crisp highlight edge — the readable "light sweep" that draws itself */}
        <Motion.path
          d="M -40 330 Q 720 620 1480 340"
          stroke="url(#atmo-sweep-grad-primary)"
          pathLength={1}
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#atmo-glow-filter)"
          opacity="0.95"
          initial={reduce ? false : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 1.15, ease: EASE, delay: 0.45 }}
        />

        {/* Secondary Light Sweep Streak */}
        <Motion.path
          d="M 140 420 Q 760 655 1480 410"
          stroke="url(#atmo-sweep-grad-secondary)"
          pathLength={1}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.65"
          initial={reduce ? false : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 1.35, ease: EASE, delay: 0.6 }}
        />
      </svg>

      {/* Soft subtle breathing atmospheric shimmer */}
      <div className="lp-atmo-sweep-blur" />
    </div>
  );
};

/* ── Mobile Menu Component (animated height + staggered links) ── */
const MobileMenu = ({ open, onClose, onSignIn, onGetStarted }) => {
  const reduce = useReducedMotion();
  const links = [
    { href: '#rubric', label: 'The 3C rubric' },
    { href: '#journey', label: 'Learning pathway' },
    { href: '#how-it-works', label: 'How it works' },
  ];
  return (
    <AnimatePresence initial={false}>
      {open && (
        <Motion.div
          key="lp-mobile-menu"
          className="lp-mobile-menu"
          style={{ overflow: 'hidden' }}
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? undefined : { height: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <nav className="lp-mobile-nav" aria-label="Mobile navigation">
            {links.map((link, i) => (
              <Motion.a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="lp-mobile-nav-link"
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE, delay: 0.05 + i * 0.06 }}
              >
                {link.label}
              </Motion.a>
            ))}
            <Motion.div
              className="lp-mobile-nav-actions"
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE, delay: 0.05 + links.length * 0.06 }}
            >
              <button
                className="lp-btn-ghost lp-btn-full"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
              >
                Sign In
              </button>
              <button
                className="lp-btn-solid lp-btn-full"
                onClick={() => {
                  onClose();
                  onGetStarted();
                }}
              >
                Start practicing free
              </button>
            </Motion.div>
          </nav>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Nav Link with Shared-Layout Active Pill ──
   The pill is a layoutId element, so it physically slides between links when
   the active section changes instead of snapping background-color. Under
   reduced motion, MotionConfig collapses the layout animation to an instant
   hop — active state stays readable without the slide. */
const NavLink = ({ href, active, children }) => (
  <a href={href} className={`lp-nav-link${active ? ' lp-nav-link--active' : ''}`}>
    {children}
    {active && (
      <Motion.span
        layoutId="lp-nav-pill"
        className="lp-nav-link-pill"
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      />
    )}
  </a>
);

/* ── Main Landing Page Component ── */
const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  // Global user-preference flag so every animation degrades to its instant,
  // final state when reduced motion is requested.
  const reduce = useReducedMotion();

  /* Nav scroll shadow */
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* Scroll spy */
  useEffect(() => {
    // Document order matches nav + footer anchor targets, so the "first
    // visible" lookup below highlights the correct nav pill while scrolling.
    const sectionIds = ['rubric', 'journey', 'how-it-works', 'practice-scenarios', 'privacy'];
    const observers = [];
    const visible = new Set();

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visible.add(id);
          } else {
            visible.delete(id);
          }
          const first = sectionIds.find((s) => visible.has(s));
          setActiveSection(first || '');
        },
        { threshold: 0.2 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const openLoginModal = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthMode('register');
    setAuthModalOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp-root">
        {/* ── Sticky Header ── */}
        <header className={`lp-nav${navScrolled ? ' lp-nav--scrolled' : ''}`} role="banner">
          <div className="lp-nav-inner">
            <a href="/" className="lp-logo" aria-label="ITerview home">
              <img src={logoSrc} alt="ITerview" className="lp-logo-img" />
              <span className="lp-logo-text">ITerview</span>
            </a>

            <nav className="lp-nav-links" aria-label="Main navigation">
              <NavLink href="#rubric" active={activeSection === 'rubric'}>
                The 3C rubric
              </NavLink>
              <NavLink href="#journey" active={activeSection === 'journey'}>
                Learning pathway
              </NavLink>
              <NavLink href="#how-it-works" active={activeSection === 'how-it-works'}>
                How it works
              </NavLink>
              <NavLink href="#privacy" active={activeSection === 'privacy'}>
                Privacy
              </NavLink>
            </nav>

            <div className="lp-nav-spacer" />

            <div className="lp-nav-cta">
              <button className="lp-btn-ghost" onClick={openLoginModal}>
                Sign In
              </button>
              <button className="lp-btn-solid" onClick={openRegisterModal}>
                Start practicing free
              </button>
            </div>

            <button
              className="lp-hamburger"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={`lp-ham-bar${menuOpen ? ' lp-ham-bar--top' : ''}`} />
              <span className={`lp-ham-bar${menuOpen ? ' lp-ham-bar--mid' : ''}`} />
              <span className={`lp-ham-bar${menuOpen ? ' lp-ham-bar--bot' : ''}`} />
            </button>
          </div>

          <MobileMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onSignIn={openLoginModal}
            onGetStarted={openRegisterModal}
          />
        </header>

        {/* ── Hero Section (Ambient Light Sweep Atmosphere + Live Product Stage) ── */}
        <section className="lp-hero" aria-label="Hero section">
          {/* Dedicated Standalone Atmospheric Lighting Layer (Fixed Geometry, Independent of Demo Height) */}
          <HeroAtmosphere />

          <div className="lp-hero-container">
            <div className="lp-hero-intro">
              {/* Sentence-case static micro-promise (replaces pulsing generic AI badge) */}
              <Reveal delay={0.05} y={16}>
                <div className="lp-hero-pill-badge">
                  <span className="lp-hero-pill-icon" aria-hidden="true">
                    <Sparkles size={14} />
                  </span>
                  <span className="lp-hero-pill-text">Voice practice, scored on all three Cs</span>
                </div>
              </Reveal>

              <Reveal delay={0.15} y={20}>
                <h1 className="lp-hero-headline">
                  Master technical interviews <br className="lp-hero-br" />
                  <span className="lp-hero-accent">in one calm place.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.3}>
                <p className="lp-hero-subhead">
                  Practice out loud, get scored honestly on every answer, and walk into the real
                  room feeling ready.
                </p>
              </Reveal>

              <Reveal delay={0.42}>
                <div className="lp-hero-actions">
                  <button className="lp-btn-hero-primary" onClick={openRegisterModal}>
                    <span>Start practicing free</span>
                    <ArrowRight size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </Reveal>

              {/* ── Honest Capstone Platform Note (Substantiated, no template proof) ── */}
              <Reveal delay={0.52} y={12}>
                <div className="lp-hero-capstone-strip">
                  <span className="lp-hero-capstone-dot" aria-hidden="true" />
                  <span>
                    Built for software & IT candidates · Voice-first rehearsal with instant rubric
                    feedback
                  </span>
                </div>
              </Reveal>

              {/* ── Streamlined Benefit Strip (Replaces bulky stacked cards) ── */}
              <Reveal delay={0.6} y={12}>
                <div className="lp-hero-benefits-strip">
                  <div className="lp-hero-benefit-item">
                    <CreditCard size={14} className="lp-hero-benefit-icon" />
                    <span>No credit card</span>
                  </div>
                  <span className="lp-hero-benefit-sep" aria-hidden="true">
                    ·
                  </span>
                  <div className="lp-hero-benefit-item">
                    <Zap size={14} className="lp-hero-benefit-icon" />
                    <span>Zero typing required</span>
                  </div>
                  <span className="lp-hero-benefit-sep" aria-hidden="true">
                    ·
                  </span>
                  <div className="lp-hero-benefit-item">
                    <Target size={14} className="lp-hero-benefit-icon" />
                    <span>Instant 3C feedback</span>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Live Studio Showcase Stage (lazy — streams in after first paint).
              The Reveal element IS the stage, so its sizing rules (width:100%,
              max-width:1000px, margin:0 auto) stay identical to the pre-motion
              layout — an intermediate wrapper would collapse the flex width. */}
            <Reveal as="div" className="lp-hero-stage" delay={0.35} y={32} duration={0.8}>
              <Suspense fallback={<div className="lp-hero-stage-skeleton" aria-hidden="true" />}>
                <TryItLiveDemo onOpenAuth={openRegisterModal} />
              </Suspense>
            </Reveal>
          </div>
        </section>

        {/* ── Section 1: The 3C Rubric (Scoring Bench — one answer, three lenses) ── */}
        <section
          className="lp-section-wrap lp-section-wrap--alt lp-rubric-section"
          id="rubric"
          aria-labelledby="rubric-title"
        >
          <div className="lp-section-inner">
            <Reveal>
              <div className="lp-section-head lp-rubric-head">
                <div className="lp-section-badge lp-section-badge--blue">
                  <Gauge size={13} />
                  <span>Every score is 1 to 5</span>
                </div>
                <h2 className="lp-section-title" id="rubric-title">
                  Let&apos;s walk through your <span>answer.</span>
                </h2>
                <p className="lp-section-subtitle">
                  Every answer you speak gets three scores from 1 to 5. Here&apos;s a sample answer,
                  with the exact phrases that earned points and lost them.
                </p>
                {/* Plain translation of the real difficulty bands in
                    backend/config/evaluatorRubrics.js (1-2 Low, 3 Average,
                    4-5 High). Kept in neutral inks on purpose: dimension colors
                    are reserved for the 3Cs and must not be confused with a
                    red/amber/green score key. */}
                <ul className="lp-scale-legend">
                  <li className="lp-scale-legend-item">
                    <span className="lp-bench-caption">1–2</span>
                    <span className="lp-scale-legend-text">needs work</span>
                  </li>
                  <li className="lp-scale-legend-item">
                    <span className="lp-bench-caption">3</span>
                    <span className="lp-scale-legend-text">getting there</span>
                  </li>
                  <li className="lp-scale-legend-item">
                    <span className="lp-bench-caption">4–5</span>
                    <span className="lp-scale-legend-text">interview-ready</span>
                  </li>
                </ul>
              </div>
            </Reveal>

            <RubricBench />
          </div>
        </section>

        {/* ── Section 2: Learning Pathway & Growth Measurement ── */}
        <section className="lp-section-wrap" id="journey" aria-labelledby="journey-title">
          <div className="lp-section-inner">
            <Reveal>
              <div className="lp-section-head">
                <div className="lp-section-badge lp-section-badge--indigo">
                  <TrendingUp size={13} />
                  <span>Measurable improvement</span>
                </div>
                <h2 className="lp-section-title" id="journey-title">
                  From your first try to interview-ready
                </h2>
                <p className="lp-section-subtitle">
                  Practice is only useful when you can prove you got better. Our diagnostic workflow
                  measures your growth between your first attempt and your graduation test.
                </p>
              </div>
            </Reveal>

            <div className="lp-pathway-layout">
              {/* Left — Connected Diagnostic Timeline (replaces isolated cards) */}
              <div className="lp-pathway-timeline">
                <Reveal as="div" className="lp-path-step" delay={0} y={18}>
                  <div className="lp-path-step-num">1</div>
                  <div className="lp-path-step-content">
                    <h3 className="lp-path-step-title">Initial Baseline Assessment</h3>
                    <p className="lp-path-step-desc">
                      5 initial diagnostic questions establish your starting baseline across
                      Clarity, Correctness, and Completeness without gating any tracks.
                    </p>
                  </div>
                </Reveal>

                <Reveal as="div" className="lp-path-step" delay={0.1} y={18}>
                  <div className="lp-path-step-num">2</div>
                  <div className="lp-path-step-content">
                    <h3 className="lp-path-step-title">3-Round Mock Interview</h3>
                    <p className="lp-path-step-desc">
                      15 voice questions across Diagnostic, Role-Technical, and Behavioral
                      (Situation, Task, Action, Result) categories with real-time rubric feedback.
                    </p>
                  </div>
                </Reveal>

                <Reveal as="div" className="lp-path-step" delay={0.2} y={18}>
                  <div className="lp-path-step-num">3</div>
                  <div className="lp-path-step-content">
                    <h3 className="lp-path-step-title">Graduation Benchmark Assessment</h3>
                    <p className="lp-path-step-desc">
                      Re-test against identical benchmark questions to objectively verify and
                      celebrate your score growth.
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* Right — Visual Growth Proof Card (Beautiful UI Insight Card) */}
              <Reveal as="div" className="lp-growth-card" delay={0.1}>
                <div className="lp-growth-header">
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                      Sample Practice Journey
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
                      Frontend Track
                    </p>
                  </div>
                  <span className="lp-growth-badge">Measured Progress</span>
                </div>

                <div className="lp-growth-delta-row">
                  <div className="lp-growth-stat">
                    <span className="lp-growth-stat-label">Baseline Score</span>
                    <span className="lp-growth-stat-val">
                      <CountUp to={55} suffix="%" duration={1.0} delay={0.15} />
                    </span>
                  </div>
                  <div className="lp-growth-arrow" aria-hidden="true">
                    →
                  </div>
                  <div className="lp-growth-stat">
                    <span className="lp-growth-stat-label">Graduation Score</span>
                    <span className="lp-growth-stat-val">
                      <CountUp to={82} suffix="%" duration={1.1} delay={0.4} />
                    </span>
                  </div>
                  <Motion.div
                    className="lp-growth-jump"
                    initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                    whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 17, delay: 1.5 }}
                  >
                    <span>+27%</span>
                  </Motion.div>
                </div>

                <div className="lp-growth-facts">
                  <div className="lp-growth-fact-item">
                    <Target size={18} color="var(--blue)" style={{ margin: '0 auto' }} />
                    <span className="lp-growth-fact-strong">Targeted Prep</span>
                    <span className="lp-growth-fact-sub">Focus on weak spots</span>
                  </div>
                  <div className="lp-growth-fact-item">
                    <TrendingUp size={18} color="var(--mint)" style={{ margin: '0 auto' }} />
                    <span className="lp-growth-fact-strong">75%+ Unlock</span>
                    <span className="lp-growth-fact-sub">Unlocks harder tiers</span>
                  </div>
                  <div className="lp-growth-fact-item">
                    <Gauge size={18} color="var(--amber)" style={{ margin: '0 auto' }} />
                    <span className="lp-growth-fact-strong">Zero Guesswork</span>
                    <span className="lp-growth-fact-sub">Objective rubric</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Section 3: Bento Grid / How It Works (shadcn Badge System) ── */}
        <section
          className="lp-section-wrap lp-section-wrap--alt"
          id="how-it-works"
          aria-labelledby="how-it-works-title"
        >
          <div className="lp-section-inner">
            <Reveal>
              <div className="lp-section-head">
                <div className="lp-section-badge lp-section-badge--mint">
                  <Zap size={13} />
                  <span>How ITerview works</span>
                </div>
                <h2 className="lp-section-title" id="how-it-works-title">
                  Practice the questions real teams ask
                </h2>
                <p className="lp-section-subtitle">
                  From foundational software concepts to advanced system trade-offs, practice the
                  exact questions top tech employers ask.
                </p>
              </div>
            </Reveal>

            <div className="lp-bento-grid">
              {/* Card 1: Voice Engine */}
              <Reveal as="article" className="lp-bento-card" delay={0}>
                <div className="lp-bento-card-head">
                  <div className="lp-3c-icon-badge lp-3c-icon-badge--blue">
                    <Mic size={22} strokeWidth={2.2} />
                  </div>
                  <h3 className="lp-bento-title">
                    Speak your answers like it&rsquo;s the real thing
                  </h3>
                </div>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9375rem' }}>
                  Interviews are spoken, not typed. Our engine transcribes your spoken answers live
                  and provides sentence-by-sentence rubric scoring.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: 'auto',
                  }}
                >
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">1. Speak naturally</span>
                    <span className="lp-role-item-tags">No typing required</span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">2. Real-time speech-to-text</span>
                    <span className="lp-role-item-tags">Instant transcription</span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">3. Rubric Breakdown</span>
                    <span className="lp-role-item-tags">Clarity, Correctness, Completeness</span>
                  </div>
                </div>
              </Reveal>

              {/* Card 2: Role Tracks */}
              <Reveal as="article" className="lp-bento-card" delay={0.08}>
                <div className="lp-bento-card-head">
                  <div className="lp-3c-icon-badge lp-3c-icon-badge--blue">
                    <Layers3 size={22} strokeWidth={2.2} />
                  </div>
                  <h3 className="lp-bento-title">Practice for the exact role you want</h3>
                </div>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9375rem' }}>
                  Curated question banks designed around real job requirements and technical
                  frameworks.
                </p>
                <div className="lp-role-list" style={{ marginTop: 'auto' }}>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Frontend Developer</span>
                    <span className="lp-role-item-tags">React, Next.js, TypeScript, CSS</span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Backend Developer</span>
                    <span className="lp-role-item-tags">
                      Node.js, Python, PostgreSQL, REST/gRPC
                    </span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Fullstack Developer</span>
                    <span className="lp-role-item-tags">React, Node.js, PostgreSQL, REST APIs</span>
                  </div>
                </div>
              </Reveal>

              {/* Card 3: Mastery Progression */}
              <Reveal as="article" className="lp-bento-card" delay={0.16}>
                <div className="lp-bento-card-head">
                  <div className="lp-3c-icon-badge lp-3c-icon-badge--mint">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <h3 className="lp-bento-title">Move up only when you&rsquo;re ready</h3>
                </div>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9375rem' }}>
                  Earn your way forward. Advance through difficulty tiers by proving your competency
                  with an average score of 75%+.
                </p>
                <div className="lp-tier-list" style={{ marginTop: 'auto' }}>
                  <div className="lp-tier-item lp-tier-item--unlocked">
                    <div className="lp-tier-name-group">
                      <Check size={16} color="var(--mint)" />
                      <span>Easy Tier (Fundamentals)</span>
                    </div>
                    <span className="lp-tier-badge lp-tier-badge--unlocked">Unlocked</span>
                  </div>
                  <div className="lp-tier-item">
                    <div className="lp-tier-name-group">
                      <Lock size={16} color="var(--ink-faint)" />
                      <span>Medium Tier (Architecture)</span>
                    </div>
                    <span className="lp-tier-badge lp-tier-badge--locked">Requires 75%</span>
                  </div>
                  <div className="lp-tier-item">
                    <div className="lp-tier-name-group">
                      <Lock size={16} color="var(--ink-faint)" />
                      <span>Hard Tier (Distributed Systems)</span>
                    </div>
                    <span className="lp-tier-badge lp-tier-badge--locked">
                      Requires 75%+ on Med
                    </span>
                  </div>
                </div>
              </Reveal>

              {/* Card 4: 3-Round Mock Session */}
              <Reveal as="article" className="lp-bento-card" delay={0.24}>
                <div className="lp-bento-card-head">
                  <div className="lp-3c-icon-badge lp-3c-icon-badge--amber">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <h3 className="lp-bento-title">Train for the whole interview, not one round</h3>
                </div>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9375rem' }}>
                  Simulate a complete 360-degree interview experience that prepares you for both
                  technical deep-dives and behavioral rounds.
                </p>
                <div className="lp-role-list" style={{ marginTop: 'auto' }}>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Round 1: Diagnostic Weak Spots</span>
                    <span className="lp-role-item-tags">Targeted practice</span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Round 2: Technical Deep-Dive</span>
                    <span className="lp-role-item-tags">Code & system design</span>
                  </div>
                  <div className="lp-role-item">
                    <span className="lp-role-item-name">Round 3: Behavioral Communication</span>
                    <span className="lp-role-item-tags">Situation, Task, Action, Result</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Section 4: Real Technical Prep Scenarios (Replaces Wall of Love Template) ── */}
        <section
          className="lp-section-wrap"
          id="practice-scenarios"
          aria-labelledby="scenarios-title"
        >
          <div className="lp-section-inner">
            <Reveal>
              <div className="lp-section-head">
                <div className="lp-section-badge lp-section-badge--blue">
                  <Target size={13} />
                  <span>Real interview practice</span>
                </div>
                <h2 className="lp-section-title" id="scenarios-title">
                  Built for real technical hiring bars
                </h2>
                <p className="lp-section-subtitle">
                  Practice the verbal communication habits top engineering teams evaluate beyond raw
                  code.
                </p>
              </div>
            </Reveal>

            <div className="lp-scenarios-grid">
              <Reveal as="article" className="lp-scenario-card" id="scenario-frontend" delay={0}>
                <div className="lp-scenario-tag lp-scenario-tag--blue">Frontend Track</div>
                <h3 className="lp-scenario-title">Verbalizing Render Cycles & State Flow</h3>
                <p className="lp-scenario-desc">
                  Practice articulating React reconciliation, bundle splitting, and CSS layout
                  performance out loud under pressure without rambling or freezing.
                </p>
                <div className="lp-scenario-focus">
                  <span className="lp-scenario-focus-label">3C Focus</span>
                  <span className="lp-scenario-focus-val">Clarity & Structural Delivery</span>
                </div>
              </Reveal>

              <Reveal as="article" className="lp-scenario-card" id="scenario-backend" delay={0.09}>
                <div className="lp-scenario-tag lp-scenario-tag--mint">Backend Track</div>
                <h3 className="lp-scenario-title">Explaining System Trade-offs & Idempotency</h3>
                <p className="lp-scenario-desc">
                  Explain database indexing strategies, API rate limiting, and caching patterns
                  using concrete architectural terminology that senior interviewers respect.
                </p>
                <div className="lp-scenario-focus">
                  <span className="lp-scenario-focus-label">3C Focus</span>
                  <span className="lp-scenario-focus-val">Correctness & Edge-Case Coverage</span>
                </div>
              </Reveal>

              <Reveal
                as="article"
                className="lp-scenario-card"
                id="scenario-fullstack"
                delay={0.18}
              >
                <div className="lp-scenario-tag lp-scenario-tag--amber">Fullstack Track</div>
                <h3 className="lp-scenario-title">Structuring STAR Behavioral Answers</h3>
                <p className="lp-scenario-desc">
                  Frame technical conflict, cross-functional delivery, and production incident
                  recovery with concise Situation, Task, Action, and Result framing.
                </p>
                <div className="lp-scenario-focus">
                  <span className="lp-scenario-focus-label">3C Focus</span>
                  <span className="lp-scenario-focus-val">Completeness & STAR Impact</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Section 5: Your Voice, Your Data: Quiet Editorial Trust Band ── */}
        <section className="lp-trustvoice-section" id="privacy" aria-label="Your voice, your data">
          <div className="lp-trustvoice-inner">
            <Reveal y={0}>
              <div className="lp-trustvoice-head">
                <div className="lp-section-badge lp-section-badge--mint">
                  <ShieldCheck size={13} />
                  <span>Privacy & Data Architecture</span>
                </div>
                <h2 className="lp-trustvoice-title">Your voice, your data</h2>
                <p className="lp-trustvoice-sub">
                  Because ITerview records your answers through the microphone, here is our
                  transparent data and speech architecture commitment before you press record.
                </p>
              </div>
            </Reveal>

            <div className="lp-trustvoice-grid">
              <Reveal as="article" className="lp-trustvoice-card" y={0} delay={0}>
                <div className="lp-trustvoice-icon">
                  <Mic size={22} strokeWidth={2} />
                </div>
                <h3 className="lp-trustvoice-card-title">Recorded only when you choose to</h3>
                <p className="lp-trustvoice-card-desc">
                  The mic is active exclusively while you are recording an answer. No background
                  listening, no ambient surveillance, and no microphone use when idle.
                </p>
              </Reveal>

              <Reveal as="article" className="lp-trustvoice-card" y={0} delay={0.08}>
                <div className="lp-trustvoice-icon">
                  <ShieldCheck size={22} strokeWidth={2} />
                </div>
                <h3 className="lp-trustvoice-card-title">Live transcription, never sold</h3>
                <p className="lp-trustvoice-card-desc">
                  Audio streams directly over encrypted WebSocket to Deepgram for real-time
                  transcription and rubric evaluation. We never sell your voice or share data with
                  advertisers.
                </p>
              </Reveal>

              <Reveal as="article" className="lp-trustvoice-card" y={0} delay={0.16}>
                <div className="lp-trustvoice-icon">
                  <Trash2 size={22} strokeWidth={2} />
                </div>
                <h3 className="lp-trustvoice-card-title">You control what stays</h3>
                <p className="lp-trustvoice-card-desc">
                  Delete any recording, transcript, or entire session from your history at any time.
                  Your practice benchmarks and progress data are yours to keep or purge.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Section 6: Final CTA Section (Empowering Agency Framing) ── */}
        <section className="lp-cta-section" aria-label="Final Call to Action">
          <Reveal as="div" className="lp-cta-card" y={28} duration={0.8}>
            <div className="lp-section-badge lp-section-badge--blue">
              <Sparkles size={14} />
              <span>Start Today Free</span>
            </div>

            <h2 className="lp-cta-headline">
              Practice out loud. Build real interview confidence with objective 3C scores.
            </h2>

            <p className="lp-cta-sub">
              Rehearse technical and behavioral questions in a private, supportive simulator before
              your next interview.
            </p>

            <button className="lp-btn-hero-primary" onClick={openRegisterModal}>
              <span>Start practicing free</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                color: 'var(--ink-muted)',
              }}
            >
              <CheckCircle2 size={15} color="var(--blue)" />
              <span>Free to start · No credit card required</span>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer" role="contentinfo">
          <div className="lp-footer-inner">
            <div className="lp-footer-top">
              <div className="lp-footer-brand">
                <a href="/" className="lp-logo" aria-label="ITerview home">
                  <img src={logoSrc} alt="ITerview" className="lp-logo-img" />
                  <span className="lp-logo-text">ITerview</span>
                </a>
                <p className="lp-footer-tagline">
                  Practice IT technical interviews out loud. Get scored on the objective 3C rubric.
                </p>
              </div>

              <div className="lp-footer-links">
                <div className="lp-footer-link-group">
                  <span className="lp-footer-link-title">Product</span>
                  <a href="#rubric" className="lp-footer-link">
                    The 3C rubric
                  </a>
                  <a href="#journey" className="lp-footer-link">
                    Learning pathway
                  </a>
                  <a href="#how-it-works" className="lp-footer-link">
                    How it works
                  </a>
                  <a href="#privacy" className="lp-footer-link">
                    Privacy & Data
                  </a>
                </div>
                <div className="lp-footer-link-group">
                  <span className="lp-footer-link-title">Tracks</span>
                  <a href="#scenario-frontend" className="lp-footer-link">
                    Frontend Developer
                  </a>
                  <a href="#scenario-backend" className="lp-footer-link">
                    Backend Developer
                  </a>
                  <a href="#scenario-fullstack" className="lp-footer-link">
                    Fullstack Developer
                  </a>
                </div>
                <div className="lp-footer-link-group">
                  <span className="lp-footer-link-title">Account</span>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    className="lp-footer-link"
                    onClick={openLoginModal}
                  >
                    Sign In
                  </button>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    className="lp-footer-link"
                    onClick={openRegisterModal}
                  >
                    Start practicing free
                  </button>
                </div>
              </div>
            </div>

            <div className="lp-footer-bottom">
              <span>&copy; {new Date().getFullYear()} ITerview. All rights reserved.</span>
              <span>Objective voice-first interview preparation.</span>
            </div>
          </div>
        </footer>

        {/* ── Auth Modal ── */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authMode}
        />
      </div>
    </MotionConfig>
  );
};

export default LandingPage;

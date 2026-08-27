// frontend/src/pages/LandingPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ITerview Landing Page — Cool Color Spectrum Design System
// Royal Cobalt · Signal Sky Cyan · Deep Indigo · Cool Mint · Crisp White
// Primitives inspired by: shadcn/ui · Rare UI · Beautiful UI
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import AuthModal from "../components/AuthModal";
import TryItLiveDemo from "../components/TryItLiveDemo";
import logoSrc from "../assets/logo.png";
import "./LandingPage.css";
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
  Code2,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Zap,
  Terminal,
  Activity,
  CreditCard,
  Volume2,
  Star,
  Cloud,
  Compass,
  HeartHandshake,
  Trash2,
} from "lucide-react";

/* ── Metric Score Bar Helper ── */
const MetricBar = ({ score, color }) => {
  const pct = Math.round((score / 5) * 100);
  return (
    <div className="lp-3c-metric-box">
      <div className="lp-3c-metric-header">
        <span className="lp-3c-metric-label">Benchmark Score</span>
        <span className="lp-3c-metric-val" style={{ color }}>
          {score} <small style={{ fontSize: "0.8125rem", color: "var(--ink-faint)" }}>/ 5.0</small>
        </span>
      </div>
      <div className="lp-3c-metric-bar" aria-hidden="true">
        <div className="lp-3c-metric-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};


/* ── Standalone Atmospheric Light Sweep Component (Independent Geometry & Height) ── */
const HeroAtmosphere = () => (
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

      {/* Primary Luminous Light Arc / Horizon Line */}
      <path
        d="M -40 330 Q 720 620 1480 340"
        stroke="url(#atmo-sweep-grad-primary)"
        strokeWidth="28"
        strokeLinecap="round"
        filter="url(#atmo-wide-blur)"
        opacity="0.9"
      />
      <path
        d="M -40 330 Q 720 620 1480 340"
        stroke="url(#atmo-sweep-grad-primary)"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#atmo-glow-filter)"
        opacity="0.95"
      />

      {/* Secondary Light Sweep Streak */}
      <path
        d="M 140 420 Q 760 655 1480 410"
        stroke="url(#atmo-sweep-grad-secondary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>

    {/* Soft subtle breathing atmospheric shimmer */}
    <div className="lp-atmo-sweep-blur" />
  </div>
);

/* ── Mobile Menu Component ── */
const MobileMenu = ({ open, onClose, onSignIn, onGetStarted }) => (
  <div className={`lp-mobile-menu${open ? " lp-mobile-menu--open" : ""}`}>
    <nav className="lp-mobile-nav" aria-label="Mobile navigation">
      <a href="#rubric" onClick={onClose} className="lp-mobile-nav-link">The 3C rubric</a>
      <a href="#journey" onClick={onClose} className="lp-mobile-nav-link">Learning pathway</a>
      <a href="#how-it-works" onClick={onClose} className="lp-mobile-nav-link">How it works</a>
      <div className="lp-mobile-nav-actions">
        <button className="lp-btn-ghost lp-btn-full" onClick={() => { onClose(); onSignIn(); }}>Sign In</button>
        <button className="lp-btn-solid lp-btn-full" onClick={() => { onClose(); onGetStarted(); }}>Start practicing free</button>
      </div>
    </nav>
  </div>
);

/* ── Main Landing Page Component ── */
const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  /* Nav scroll shadow */
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Scroll spy */
  useEffect(() => {
    const sectionIds = ["rubric", "journey", "how-it-works"];
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
          setActiveSection(first || "");
        },
        { threshold: 0.2 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const openLoginModal = () => {
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthMode("register");
    setAuthModalOpen(true);
  };

  return (
    <div className="lp-root">
      {/* ── Sticky Header ── */}
      <header className={`lp-nav${navScrolled ? " lp-nav--scrolled" : ""}`} role="banner">
        <div className="lp-nav-inner">
          <a href="/" className="lp-logo" aria-label="ITerview home">
            <div className="lp-logo-container">
              <img src={logoSrc} alt="ITerview Logo" className="lp-logo-img" />
            </div>
            <span className="lp-logo-text">ITerview<span className="lp-logo-dot">.</span></span>
          </a>

          <nav className="lp-nav-links" aria-label="Main navigation">
            <a
              href="#rubric"
              className={`lp-nav-link${activeSection === "rubric" ? " lp-nav-link--active" : ""}`}
            >
              The 3C rubric
            </a>
            <a
              href="#journey"
              className={`lp-nav-link${activeSection === "journey" ? " lp-nav-link--active" : ""}`}
            >
              Learning pathway
            </a>
            <a
              href="#how-it-works"
              className={`lp-nav-link${activeSection === "how-it-works" ? " lp-nav-link--active" : ""}`}
            >
              How it works
            </a>
          </nav>

          <div className="lp-nav-spacer" />

          <div className="lp-nav-cta">
            <button className="lp-btn-ghost" onClick={openLoginModal}>Sign In</button>
            <button className="lp-btn-solid" onClick={openRegisterModal}>Start practicing</button>
          </div>

          <button
            className="lp-hamburger"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`lp-ham-bar${menuOpen ? " lp-ham-bar--top" : ""}`} />
            <span className={`lp-ham-bar${menuOpen ? " lp-ham-bar--mid" : ""}`} />
            <span className={`lp-ham-bar${menuOpen ? " lp-ham-bar--bot" : ""}`} />
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
            <div className="lp-hero-pill-badge">
              <span className="lp-hero-pill-dot" aria-hidden="true" />
              <span>iTerview · AI Interview Simulator</span>
            </div>

            <h1 className="lp-hero-headline">
              Master technical interviews <br className="hidden sm:inline" />
              <span className="lp-hero-accent">in one calm place.</span>
            </h1>

            <p className="lp-hero-subhead">
              Practice out loud, get scored honestly on every answer, and walk into the real room feeling ready.
            </p>

            <div className="lp-hero-actions">
              <button className="lp-btn-hero-primary" onClick={openRegisterModal}>
                <span>Start free</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Social Proof Strip ── */}
            <div className="lp-hero-proof">
              <div className="lp-hero-stars" aria-label="Rating: 4.8 out of 5 stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="lp-hero-star" fill="currentColor" />
                ))}
              </div>
              <span className="lp-hero-proof-text">
                <strong>4.8</strong> average rating · <strong>2,000+</strong> practice sessions tracked
              </span>
              <span className="lp-hero-template-tag">TEMPLATE</span>
            </div>

            {/* ── Three Benefit Pills (IMAGE 2) ── */}
            <div className="lp-hero-benefits-row">
              <div className="lp-hero-benefit-pill">
                <CreditCard size={15} className="lp-hero-benefit-icon" />
                <span>No credit card</span>
              </div>
              <div className="lp-hero-benefit-pill">
                <Zap size={15} className="lp-hero-benefit-icon" />
                <span>Zero typing required</span>
              </div>
              <div className="lp-hero-benefit-pill">
                <Target size={15} className="lp-hero-benefit-icon" />
                <span>Instant 3C feedback</span>
              </div>
            </div>
          </div>

          {/* Live Studio Showcase Stage */}
          <div className="lp-hero-stage">
            <TryItLiveDemo onOpenAuth={openRegisterModal} />
          </div>
        </div>
      </section>

      {/* ── Section 1: The 3C Rubric (Insight Cards) ── */}
      <section className="lp-section-wrap lp-section-wrap--alt" id="rubric" aria-labelledby="rubric-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge lp-section-badge--cyan">
              <Activity size={13} />
              <span>The 3C rubric</span>
            </div>
            <h2 className="lp-section-title" id="rubric-title">Know exactly how every answer is scored</h2>
            <p className="lp-section-subtitle">
              No more guessing what an interviewer wants. Every answer is evaluated across three core dimensions designed around real engineering hiring standards.
            </p>
          </div>

          <div className="lp-3c-grid">
            {/* Clarity */}
            <article className="lp-3c-card lp-3c-card--clarity">
              <div className="lp-3c-icon-badge lp-3c-icon-badge--blue">
                <AlignLeft size={24} strokeWidth={2.2} />
              </div>
              <div className="lp-3c-info">
                <h3 className="lp-3c-name">1. Clarity</h3>
                <p className="lp-3c-desc">
                  How structured, professional, and articulate is your verbal delivery?
                </p>
              </div>

              <ul className="lp-3c-checklist">
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--blue)" strokeWidth={2.5} />
                  <span>Logical structure & top-down framing</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--blue)" strokeWidth={2.5} />
                  <span>Accurate use of standard IT terminology</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--blue)" strokeWidth={2.5} />
                  <span>Elimination of filler words & tangents</span>
                </li>
              </ul>

              <MetricBar score={4.5} color="var(--blue)" />
            </article>

            {/* Correctness */}
            <article className="lp-3c-card lp-3c-card--correctness">
              <div className="lp-3c-icon-badge lp-3c-icon-badge--mint">
                <ShieldCheck size={24} strokeWidth={2.2} />
              </div>
              <div className="lp-3c-info">
                <h3 className="lp-3c-name">2. Correctness</h3>
                <p className="lp-3c-desc">
                  Is your technical reasoning sound and aligned with modern industry practices?
                </p>
              </div>

              <ul className="lp-3c-checklist">
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--mint)" strokeWidth={2.5} />
                  <span>Technical accuracy of code & architecture</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--mint)" strokeWidth={2.5} />
                  <span>Understanding of trade-offs & edge cases</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--mint)" strokeWidth={2.5} />
                  <span>Practical alignment with production realities</span>
                </li>
              </ul>

              <MetricBar score={4.2} color="var(--mint)" />
            </article>

            {/* Completeness */}
            <article className="lp-3c-card lp-3c-card--completeness">
              <div className="lp-3c-icon-badge lp-3c-icon-badge--amber">
                <Layers size={24} strokeWidth={2.2} />
              </div>
              <div className="lp-3c-info">
                <h3 className="lp-3c-name">3. Completeness</h3>
                <p className="lp-3c-desc">
                  Did you address the full prompt and substantiate your points with concrete examples?
                </p>
              </div>

              <ul className="lp-3c-checklist">
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--amber)" strokeWidth={2.5} />
                  <span>Comprehensive answers to multi-part prompts</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--amber)" strokeWidth={2.5} />
                  <span>Concrete STAR-method project examples</span>
                </li>
                <li className="lp-3c-check-item">
                  <Check size={15} color="var(--amber)" strokeWidth={2.5} />
                  <span>Explicit solutions for scale, error, & testing</span>
                </li>
              </ul>

              <MetricBar score={4.0} color="var(--amber)" />
            </article>
          </div>
        </div>
      </section>

      {/* ── Section 2: Learning Pathway & Growth Measurement ── */}
      <section className="lp-section-wrap" id="journey" aria-labelledby="journey-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge lp-section-badge--indigo">
              <TrendingUp size={13} />
              <span>Measurable improvement</span>
            </div>
            <h2 className="lp-section-title" id="journey-title">From your first try to interview-ready</h2>
            <p className="lp-section-subtitle">
              Practice is only useful when you can prove you got better. Our diagnostic workflow measures your growth between your first attempt and your graduation test.
            </p>
          </div>

          <div className="lp-pathway-layout">
            {/* Left — 3 Pathway Steps */}
            <div className="lp-pathway-steps">
              <div className="lp-path-step">
                <div className="lp-path-step-num">1</div>
                <div className="lp-path-step-content">
                  <h3 className="lp-path-step-title">Silent Baseline Pre-Test</h3>
                  <p className="lp-path-step-desc">
                    5 initial diagnostic questions establish your starting level without locking any interview tracks.
                  </p>
                </div>
              </div>

              <div className="lp-path-step">
                <div className="lp-path-step-num">2</div>
                <div className="lp-path-step-content">
                  <h3 className="lp-path-step-title">3-Round Scored Mock Interview</h3>
                  <p className="lp-path-step-desc">
                    15 voice questions across Diagnostic, Role-Technical, and STAR Behavioral categories with real-time feedback.
                  </p>
                </div>
              </div>

              <div className="lp-path-step">
                <div className="lp-path-step-num">3</div>
                <div className="lp-path-step-content">
                  <h3 className="lp-path-step-title">Graduation Benchmark Post-Test</h3>
                  <p className="lp-path-step-desc">
                    Re-test against identical benchmark questions to clearly verify and celebrate your score growth.
                  </p>
                </div>
              </div>
            </div>

            {/* Right — Visual Growth Proof Card (Beautiful UI Insight Card) */}
            <div className="lp-growth-card">
              <div className="lp-growth-header">
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 800 }}>Sample Practice Journey</h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--ink-faint)" }}>Frontend Engineer Track</p>
                </div>
                <span className="lp-growth-badge">PROVEN DELTA</span>
              </div>

              <div className="lp-growth-delta-row">
                <div className="lp-growth-stat">
                  <span className="lp-growth-stat-label">Baseline Score</span>
                  <span className="lp-growth-stat-val">55%</span>
                </div>
                <div className="lp-growth-arrow">→</div>
                <div className="lp-growth-stat">
                  <span className="lp-growth-stat-label">Graduation Score</span>
                  <span className="lp-growth-stat-val">82%</span>
                </div>
                <div className="lp-growth-jump">
                  <span>+27%</span>
                </div>
              </div>

              <div className="lp-growth-facts">
                <div className="lp-growth-fact-item">
                  <Target size={18} color="var(--blue)" style={{ margin: "0 auto" }} />
                  <span className="lp-growth-fact-strong">Targeted Prep</span>
                  <span className="lp-growth-fact-sub">Focus on weak spots</span>
                </div>
                <div className="lp-growth-fact-item">
                  <TrendingUp size={18} color="var(--mint)" style={{ margin: "0 auto" }} />
                  <span className="lp-growth-fact-strong">75%+ Unlock</span>
                  <span className="lp-growth-fact-sub">Unlocks harder tiers</span>
                </div>
                <div className="lp-growth-fact-item">
                  <Gauge size={18} color="var(--amber)" style={{ margin: "0 auto" }} />
                  <span className="lp-growth-fact-strong">Zero Guesswork</span>
                  <span className="lp-growth-fact-sub">Objective rubric</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Bento Grid / How It Works (shadcn Badge System) ── */}
      <section className="lp-section-wrap lp-section-wrap--alt" id="how-it-works" aria-labelledby="how-it-works-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge lp-section-badge--mint">
              <Zap size={13} />
              <span>How ITerview works</span>
            </div>
            <h2 className="lp-section-title" id="how-it-works-title">Practice the questions real teams ask</h2>
            <p className="lp-section-subtitle">
              From foundational software concepts to advanced system trade-offs, practice the exact questions top tech employers ask.
            </p>
          </div>

          <div className="lp-bento-grid">
            {/* Card 1: Voice Engine */}
            <article className="lp-bento-card">
              <div className="lp-bento-card-head">
                <div className="lp-3c-icon-badge lp-3c-icon-badge--blue">
                  <Mic size={22} strokeWidth={2.2} />
                </div>
                <h3 className="lp-bento-title">Speak your answers like it&rsquo;s the real thing</h3>
              </div>
              <p style={{ color: "var(--ink-secondary)", fontSize: "0.9375rem" }}>
                Interviews are spoken, not typed. Our engine transcribes your spoken answers live and provides sentence-by-sentence rubric scoring.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">1. Speak naturally</span>
                  <span className="lp-role-item-tags">No typing required</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">2. Real-time STT</span>
                  <span className="lp-role-item-tags">Instant transcription</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">3. Rubric Breakdown</span>
                  <span className="lp-role-item-tags">Clarity, Correctness, Completeness</span>
                </div>
              </div>
            </article>

            {/* Card 2: Role Tracks */}
            <article className="lp-bento-card">
              <div className="lp-bento-card-head">
                <div className="lp-3c-icon-badge lp-3c-icon-badge--blue">
                  <Layers3 size={22} strokeWidth={2.2} />
                </div>
                <h3 className="lp-bento-title">Practice for the exact role you want</h3>
              </div>
              <p style={{ color: "var(--ink-secondary)", fontSize: "0.9375rem" }}>
                Curated question banks designed around real job requirements and technical frameworks.
              </p>
              <div className="lp-role-list" style={{ marginTop: "auto" }}>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">Frontend Engineer</span>
                  <span className="lp-role-item-tags">React, Next.js, TypeScript, CSS</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">Backend Engineer</span>
                  <span className="lp-role-item-tags">Node.js, Python, PostgreSQL, REST/gRPC</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">DevOps & Cloud</span>
                  <span className="lp-role-item-tags">Docker, Kubernetes, AWS, CI/CD</span>
                </div>
              </div>
            </article>

            {/* Card 3: Mastery Progression */}
            <article className="lp-bento-card">
              <div className="lp-bento-card-head">
                <div className="lp-3c-icon-badge lp-3c-icon-badge--mint">
                  <TrendingUp size={22} strokeWidth={2.2} />
                </div>
                <h3 className="lp-bento-title">Move up only when you&rsquo;re ready</h3>
              </div>
              <p style={{ color: "var(--ink-secondary)", fontSize: "0.9375rem" }}>
                Earn your way forward. Advance through difficulty tiers by proving your competency with an average score of 75%+.
              </p>
              <div className="lp-tier-list" style={{ marginTop: "auto" }}>
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
                  <span className="lp-tier-badge lp-tier-badge--locked">Requires 75%+ on Med</span>
                </div>
              </div>
            </article>

            {/* Card 4: 3-Round Mock Session */}
            <article className="lp-bento-card">
              <div className="lp-bento-card-head">
                <div className="lp-3c-icon-badge lp-3c-icon-badge--amber">
                  <Clock size={22} strokeWidth={2.2} />
                </div>
                <h3 className="lp-bento-title">Train for the whole interview, not one round</h3>
              </div>
              <p style={{ color: "var(--ink-secondary)", fontSize: "0.9375rem" }}>
                Simulate a complete 360-degree interview experience that prepares you for both technical deep-dives and behavioral rounds.
              </p>
              <div className="lp-role-list" style={{ marginTop: "auto" }}>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">Round 1: Diagnostic Weak Spots</span>
                  <span className="lp-role-item-tags">Targeted practice</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">Round 2: Technical Deep-Dive</span>
                  <span className="lp-role-item-tags">Code & system design</span>
                </div>
                <div className="lp-role-item">
                  <span className="lp-role-item-name">Round 3: STAR Behavioral</span>
                  <span className="lp-role-item-tags">Leadership & conflict</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
{/* ── Wall of Love: Community Proof Template (ClassDojo §5) ── */}
      {/* ⚠️ TEMPLATE: Replace sample quotes/avatars with real user posts before launch */}
      <section className="lp-section-wrap" id="wall-of-love" aria-label="Community proof">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge lp-section-badge--cyan">
              <HeartHandshake size={13} />
              <span>Community proof</span>
            </div>
            <h2 className="lp-section-title">Real people, real progress</h2>
            <p className="lp-section-subtitle">
              Just like you, real candidates walked in nervous and left with the confidence they needed.
            </p>
          </div>

          <div className="lp-wall-grid">
            <article className="lp-wall-card">
              <p className="lp-wall-quote">The voice scoring was the single thing that made me realize I kept saying &ldquo;um&rdquo; too much. I fixed it before my real interview and got the offer.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--blue">JM</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Jordan M.</span>
                  <span className="lp-wall-handle">Frontend Engineer Track</span>
                </div>
              </div>
            </article>

            <article className="lp-wall-card">
              <p className="lp-wall-quote">I practiced five mocks before my Google interview. The 3C rubric showed me exactly where I was losing points &mdash; I wish I had found this earlier.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--cyan">AP</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Alex P.</span>
                  <span className="lp-wall-handle">Backend Engineer Track</span>
                </div>
              </div>
            </article>

            <article className="lp-wall-card">
              <p className="lp-wall-quote">As a career switcher, I had zero interview experience. This basically held my hand through the first few rounds and gave me honest feedback.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--mint">SK</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Sam K.</span>
                  <span className="lp-wall-handle">DevOps &amp; Cloud Track</span>
                </div>
              </div>
            </article>

            <article className="lp-wall-card">
              <p className="lp-wall-quote">The STAR method round was brutal but exactly what I needed. My final mock scored 78% &mdash; up from 54% when I started.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--indigo">TR</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Taylor R.</span>
                  <span className="lp-wall-handle">Full Stack Track</span>
                </div>
              </div>
            </article>

            <article className="lp-wall-card">
              <p className="lp-wall-quote">What makes this different is you actually speak your answers out loud. That alone changed how I prepare. Recording myself was uncomfortable at first, now it&rsquo;s a habit.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--amber">CN</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Casey N.</span>
                  <span className="lp-wall-handle">Software Engineering Track</span>
                </div>
              </div>
            </article>

            <article className="lp-wall-card">
              <p className="lp-wall-quote">The difficulty ladder keeps you honest. You cannot move to architecture questions until you prove you understand the fundamentals. That clarity builds real confidence.</p>
              <div className="lp-wall-person">
                <div className="lp-wall-avatar lp-wall-avatar--coral">ML</div>
                <div className="lp-wall-info">
                  <span className="lp-wall-name">Morgan L.</span>
                  <span className="lp-wall-handle">Systems &amp; Infrastructure Track</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Your Voice, Your Data: Trust Section — Right Before Final CTA (ClassDojo §1 §9) ── */}
      {/* ⚠️ TEMPLATE: Verify privacy claims match actual backend behavior before launch */}
      <section className="lp-trustvoice-section" aria-label="Your voice, your data">
        <div className="lp-trustvoice-inner">
          <div className="lp-trustvoice-head">
            <div className="lp-section-badge lp-section-badge--mint">
              <ShieldCheck size={13} />
              <span>Privacy first &mdash; always</span>
            </div>
            <h2 className="lp-trustvoice-title">Your voice, your data</h2>
            <p className="lp-trustvoice-sub">
              Because ITerview records your answers through the microphone, we want you to know exactly what happens with your data &mdash; before you press record.
            </p>
          </div>

          <div className="lp-trustvoice-grid">
            <article className="lp-trustvoice-card">
              <div className="lp-trustvoice-icon">
                <Mic size={22} strokeWidth={2} />
              </div>
              <h3 className="lp-trustvoice-card-title">Recorded only when you choose to</h3>
              <p className="lp-trustvoice-card-desc">
                The mic is never active unless you start a practice session. No background listening, no always-on monitoring.
              </p>
            </article>

            <article className="lp-trustvoice-card">
              <div className="lp-trustvoice-icon">
                <ShieldCheck size={22} strokeWidth={2} />
              </div>
              <h3 className="lp-trustvoice-card-title">Scored, never sold</h3>
              <p className="lp-trustvoice-card-desc">
                Your transcriptions are used solely to run the 3C rubric evaluation and provide your session feedback. We never share audio data with third parties.
              </p>
            </article>

            <article className="lp-trustvoice-card">
              <div className="lp-trustvoice-icon">
                <Trash2 size={22} strokeWidth={2} />
              </div>
              <h3 className="lp-trustvoice-card-title">You control what stays</h3>
              <p className="lp-trustvoice-card-desc">
                Delete any recording, transcript, or entire session from your history at any time. Your practice history is yours to keep or remove.
              </p>
            </article>
          </div>

          <p className="lp-trustvoice-note">
            TEMPLATE &mdash; Verify these claims match your actual backend privacy workflow before launch.
          </p>
        </div>
      </section>

      {/* ── Final CTA Section ── */}
      <section className="lp-cta-section" aria-label="Final Call to Action">
        <div className="lp-cta-card">
          <div className="lp-section-badge lp-section-badge--cyan">
            <Sparkles size={14} />
            <span>Start Today Free</span>
          </div>

          <h2 className="lp-cta-headline">
            Stop freezing in interviews. Start practicing with real scores.
          </h2>

          <p className="lp-cta-sub">
            Join candidates preparing for technical interviews across top engineering and IT roles.
          </p>

          <button className="lp-btn-hero-primary" onClick={openRegisterModal}>
            <span>Start practicing free</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem", color: "var(--ink-muted)" }}>
            <CheckCircle2 size={15} color="var(--cyan)" />
            <span>Free to start · No credit card required</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <a href="/" className="lp-logo" aria-label="ITerview home">
                <div className="lp-logo-container">
                  <img src={logoSrc} alt="ITerview Logo" className="lp-logo-img" />
                </div>
                <span className="lp-logo-text">ITerview<span className="lp-logo-dot">.</span></span>
              </a>
              <p className="lp-footer-tagline">
                Practice IT technical interviews out loud. Get scored on the objective 3C rubric.
              </p>
            </div>

            <div className="lp-footer-links">
              <div className="lp-footer-link-group">
                <span className="lp-footer-link-title">Product</span>
                <a href="#rubric" className="lp-footer-link">The 3C rubric</a>
                <a href="#journey" className="lp-footer-link">Learning pathway</a>
                <a href="#how-it-works" className="lp-footer-link">How it works</a>
              </div>
              <div className="lp-footer-link-group">
                <span className="lp-footer-link-title">Tracks</span>
                <a href="#how-it-works" className="lp-footer-link">Frontend Engineering</a>
                <a href="#how-it-works" className="lp-footer-link">Backend Engineering</a>
                <a href="#how-it-works" className="lp-footer-link">DevOps & Cloud</a>
              </div>
              <div className="lp-footer-link-group">
                <span className="lp-footer-link-title">Account</span>
                <button
                  style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                  className="lp-footer-link"
                  onClick={openLoginModal}
                >
                  Sign In
                </button>
                <button
                  style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                  className="lp-footer-link"
                  onClick={openRegisterModal}
                >
                  Start practicing
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
  );
};

export default LandingPage;

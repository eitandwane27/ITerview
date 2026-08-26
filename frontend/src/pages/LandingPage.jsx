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

/* ── Mobile Menu Component ── */
const MobileMenu = ({ open, onClose, onSignIn, onGetStarted }) => (
  <div className={`lp-mobile-menu${open ? " lp-mobile-menu--open" : ""}`}>
    <nav className="lp-mobile-nav" aria-label="Mobile navigation">
      <a href="#rubric" onClick={onClose} className="lp-mobile-nav-link">The 3C Rubric</a>
      <a href="#journey" onClick={onClose} className="lp-mobile-nav-link">Learning Pathway</a>
      <a href="#how-it-works" onClick={onClose} className="lp-mobile-nav-link">How It Works</a>
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
      {/* ── Sticky Header (shadcn Style) ── */}
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
              The 3C Rubric
            </a>
            <a
              href="#journey"
              className={`lp-nav-link${activeSection === "journey" ? " lp-nav-link--active" : ""}`}
            >
              Learning Pathway
            </a>
            <a
              href="#how-it-works"
              className={`lp-nav-link${activeSection === "how-it-works" ? " lp-nav-link--active" : ""}`}
            >
              How It Works
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

      {/* ── Hero Section (Horizon Gradient + Rare UI & Beautiful UI Sandboxes) ── */}
      <section className="lp-hero" aria-label="Hero section">
        <div className="lp-hero-inner">
          <div className="lp-hero-left">
            <div className="lp-hero-badge">
              <Sparkles size={15} strokeWidth={2.5} />
              <span>Voice-First AI Interview Simulator</span>
            </div>

            <h1 className="lp-hero-headline">
              Master tech interviews out loud.{" "}
              <span className="lp-hero-accent">Get scored objectively.</span>
            </h1>

            <p className="lp-hero-sub">
              Speak your answers naturally. Our AI engine transcribes in real time and grades you on the transparent 3C Rubric: <strong>Clarity</strong>, <strong>Correctness</strong>, and <strong>Completeness</strong>.
            </p>

            <div className="lp-hero-ctas">
              <button className="lp-btn-hero-primary" onClick={openRegisterModal}>
                <span>Start practicing free</span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <a href="#how-it-works" className="lp-btn-hero-ghost">
                Explore role tracks
              </a>
            </div>

            <div className="lp-hero-trust">
              <div className="lp-hero-trust-item">
                <CheckCircle2 size={16} className="lp-hero-trust-check" />
                <span>Zero typing required</span>
              </div>
              <div className="lp-hero-trust-item">
                <CheckCircle2 size={16} className="lp-hero-trust-check" />
                <span>Instant 3C feedback</span>
              </div>
              <div className="lp-hero-trust-item">
                <CheckCircle2 size={16} className="lp-hero-trust-check" />
                <span>Frontend, Backend & DevOps</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-right">
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
              <span>Objective Evaluation</span>
            </div>
            <h2 className="lp-section-title" id="rubric-title">The 3C Rubric: How Every Answer Is Scored</h2>
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
              <span>Measurable Improvement</span>
            </div>
            <h2 className="lp-section-title" id="journey-title">A Structured Pathway From Baseline to Mastery</h2>
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
              <span>Features & Tracks</span>
            </div>
            <h2 className="lp-section-title" id="how-it-works-title">Engineered for Technical Career Success</h2>
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
                <h3 className="lp-bento-title">Voice-First Practice Engine</h3>
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
                <h3 className="lp-bento-title">Dedicated IT Role Tracks</h3>
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
                <h3 className="lp-bento-title">Mastery-Based Difficulty</h3>
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
                <h3 className="lp-bento-title">Comprehensive 3-Round Format</h3>
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
                <a href="#rubric" className="lp-footer-link">The 3C Rubric</a>
                <a href="#journey" className="lp-footer-link">Learning Pathway</a>
                <a href="#how-it-works" className="lp-footer-link">How It Works</a>
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

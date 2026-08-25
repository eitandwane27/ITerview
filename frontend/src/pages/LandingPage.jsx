import React, { useState, useEffect, useRef } from "react";
import AuthModal from "../components/AuthModal";
import TryItLiveDemo from "../components/TryItLiveDemo";
import logoSrc from "../assets/logo.png";
import "./LandingPage.css";
import { Sparkles, ShieldCheck, Layers, Check, Lock, Mic, AlignLeft, Gauge, Layers3, TrendingUp, Clock, Target, Code2, MessageSquare, ArrowRight } from "lucide-react";


/* ─── Sub-components ─── */

const MetricBar = ({ score, color, bar }) => {
  const pct = Math.round((score / 5) * 100);
  return (
    <div className="lp-metric">
      <div className="lp-metric-head">
        <span className="lp-metric-label">Sample score</span>
        <span className="lp-metric-value" style={{ color }}>
          {score}
          <span className="lp-metric-max"> / 5</span>
        </span>
      </div>
      <div className="lp-metric-track" aria-hidden="true">
        <div className="lp-metric-fill" style={{ width: `${pct}%`, background: bar }} />
      </div>
    </div>
  );
};

const RoleChip = ({ color, name, desc }) => (
  <div className="lp-role-chip" style={{ backgroundColor: `${color}0C`, border: `1px solid ${color}40` }}>
    <div className="lp-role-accent" style={{ background: color }} />
    <div className="lp-role-dot" style={{ background: color }} />
    <div className="lp-role-text">
      <span className="lp-role-name">{name}</span>
      <span className="lp-role-desc">{desc}</span>
    </div>
  </div>
);

const TierRow = ({ unlocked, name, status, color }) => (
  <div
    className="lp-tier-row"
    style={{
      backgroundColor: unlocked ? `${color}12` : "#FFFFFF06",
      border: `1px solid ${unlocked ? `${color}50` : "#FFFFFF15"}`,
    }}
  >
      <div
        className="lp-tier-icon"
        style={{
          background: unlocked ? `${color}1A` : "#FFFFFF10",
        }}
      >
      {unlocked ? <Check size={16} strokeWidth={1.8} color="#fff" /> : <Lock size={16} strokeWidth={1.8} color="#9CA3AF" />}
    </div>
    <div className="lp-tier-text">
      <span className="lp-tier-name" style={{ color: unlocked ? "#fff" : "#6B6B80" }}>{name}</span>
      <span className="lp-tier-status" style={{ color: unlocked ? color : "#6B7280" }}>{status}</span>
    </div>
    {!unlocked && <div className="lp-lock-badge"><span>Locked</span></div>}
  </div>
);

const HowItStep = ({ num, title, desc, icon, showConnector }) => (
  <>
    <li className="lp-step-row">
      <div className="lp-step-num">{icon}</div>
      <div className="lp-step-content">
        <span className="lp-step-eyebrow">Step {num}</span>
        <span className="lp-step-title">{title}</span>
        <span className="lp-step-desc">{desc}</span>
      </div>
    </li>
    {showConnector && (
      <li aria-hidden="true" className="lp-step-connector">
        <div className="lp-step-line" />
      </li>
    )}
  </>
);

const MobileMenu = ({ open, onClose, onSignIn, onGetStarted }) => (
  <div className={`lp-mobile-menu${open ? " lp-mobile-menu--open" : ""}`}>
    <nav className="lp-mobile-nav" aria-label="Mobile navigation">
      <a href="#features" onClick={onClose} className="lp-mobile-nav-link">Features</a>
      <a href="#about" onClick={onClose} className="lp-mobile-nav-link">Objective</a>
      <a href="#how-it-works" onClick={onClose} className="lp-mobile-nav-link">How It Works</a>
      <div className="lp-mobile-nav-actions">
        <button className="lp-btn-ghost lp-btn-full" onClick={() => { onClose(); onSignIn(); }}>Sign In</button>
        <button className="lp-btn-solid lp-btn-full" onClick={() => { onClose(); onGetStarted(); }}>Start practicing</button>
      </div>
    </nav>
  </div>
);

/* ─── Hero headline split-word reveal ─── */
const HERO_WORDS = ["Practice", "IT", "interviews.", "Get", "scored", "objectively", "."];

const HeroWord = ({ index, children, accent }) => (
  <span className="lp-hero-word-mask" style={{ "--i": index }}>
    <span className={`lp-hero-word${accent ? " lp-hero-accent" : ""}`}>{children}</span>
  </span>
);

/* ─── Main Component ─── */
const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const heroSentinelRef = useRef(null);

  /* Scroll-aware nav backdrop via IntersectionObserver on a sentinel div in the hero */
  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setNavScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  /* Scroll-spy for active nav link via IntersectionObserver on sections */
  useEffect(() => {
    const sectionIds = ["features", "how-it-works", "about"];
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
          // The first visible section in DOM order wins
          const first = sectionIds.find((s) => visible.has(s));
          setActiveSection(first || "");
        },
        { threshold: 0.25 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* Reveal-on-scroll for bento cards + eval section (respects prefers-reduced-motion) */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelector(".lp-root")?.classList.add("lp-anim-ready");
    const targets = [
      ...Array.from(document.querySelectorAll(".lp-bento-card")),
      ...Array.from(document.querySelectorAll(".lp-reveal")),
    ];
    if (!targets.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.classList.contains("lp-bento-card")) {
              entry.target.classList.add("lp-bento-card--revealed");
            }
            entry.target.classList.add("lp-reveal--shown");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((target) => obs.observe(target));
    return () => obs.disconnect();
  }, []);

  /* Close the mobile menu on Escape (plain disclosure, keyboard affordance) */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      {/* Film grain overlay - fixed, pointer-events-none, subtle texture */}
      <div className="lp-grain" aria-hidden="true" />
      {/* ── Navbar ── */}
      <header className={`lp-nav${navScrolled ? " lp-nav--scrolled" : ""}`} role="banner">
        <div className="lp-nav-inner">
          <a href="/" className="lp-logo" aria-label="ITerview home">
            <div className="lp-logo-container">
              <img
                src={logoSrc}
                alt="ITerview Logo"
                className="lp-logo-img"
              />
            </div>
            <span className="lp-logo-text">ITerview</span>
          </a>

          <nav className="lp-nav-links" aria-label="Main navigation">
            <a href="#features" className={`lp-nav-link${activeSection === "features" ? " lp-nav-link--active" : ""}`} aria-current={activeSection === "features" ? "true" : undefined}>Features</a>
            <a href="#about" className={`lp-nav-link${activeSection === "about" ? " lp-nav-link--active" : ""}`} aria-current={activeSection === "about" ? "true" : undefined}>Objective</a>
            <a href="#how-it-works" className={`lp-nav-link${activeSection === "how-it-works" ? " lp-nav-link--active" : ""}`} aria-current={activeSection === "how-it-works" ? "true" : undefined}>How It Works</a>
          </nav>

          <div className="lp-nav-spacer" />

          <div className="lp-nav-cta">
            <button className="lp-btn-ghost" aria-label="Sign in" onClick={openLoginModal}>Sign In</button>
            <button className="lp-btn-solid" aria-label="Start practicing" onClick={openRegisterModal}>Start practicing</button>
          </div>

          <button
            className="lp-hamburger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
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
        {/* Scroll progress hairline - scroll-driven CSS, no JS listeners */}
        <div className="lp-nav-progress" aria-hidden="true" />
      </header>

      {/* ── Hero Section ── */}
      <section className="lp-hero" id="try-it-live" aria-label="Hero - Try It Live demo">
        {/* Sentinel for scroll-aware nav: becomes non-visible when scrolled past */}
        <div ref={heroSentinelRef} aria-hidden="true" style={{ position: "absolute", top: 0, height: "1px", width: "1px", pointerEvents: "none" }} />
        {/* Ambient depth - even chromatic bloom + blueprint grid (no cut-off orbs) */}
        <div className="lp-hero-ambient" aria-hidden="true" />
        <div className="lp-hero-grid" aria-hidden="true" />

        <div className="lp-hero-inner">
          <div className="lp-hero-left">
            <div className="lp-hero-badge">
              <Mic size={14} strokeWidth={2} />
              <span>Voice-first mock interviews</span>
            </div>
            <h1 className="lp-hero-headline">
              <span className="lp-sr-only">Practice IT interviews. Get scored objectively.</span>
              <span className="lp-hero-headline-visual" aria-hidden="true">
                {HERO_WORDS.map((word, i) => (
                  <HeroWord key={word + i} index={i} accent={word === "objectively"}>
                    {word === "objectively" || word === "." ? word : `${word}\u00A0`}
                  </HeroWord>
                ))}
              </span>
            </h1>
            <p className="lp-hero-sub">
              Speak your answer. The AI listens, transcribes, and scores you on the 3C rubric: Clarity, Correctness, Completeness.
            </p>
            <div className="lp-hero-ctas">
              <button className="lp-btn-hero-primary" aria-label="Start practicing" onClick={openRegisterModal}>
                <span>Start practicing</span>
                <ArrowRight size={16} strokeWidth={2.5} className="lp-btn-hero-arrow" />
              </button>
              <a className="lp-btn-hero-ghost" href="#how-it-works">
                See how it works
              </a>
            </div>
          </div>

          <div className="lp-hero-right">
            {/* Soft breathing halo behind the demo */}
            <div className="lp-demo-halo" aria-hidden="true" />
            {/* ── Try It Live Demo (interactive) ── */}
            <TryItLiveDemo onOpenAuth={openRegisterModal} />
          </div>
        </div>
      </section>

      <div className="lp-divider lp-divider--cyan" aria-hidden="true" />

      {/* ── 3C Framework (Arena) Section ── */}
      <section className="lp-arena" id="features" aria-labelledby="arena-heading">
        <div className="lp-section-label lp-section-label--amber">
          <div className="lp-label-dot lp-label-dot--amber" aria-hidden="true" />
          <h2 id="arena-heading">THE 3C RUBRIC</h2>
        </div>

        <p className="lp-section-subtitle">
          Every answer is graded on three dimensions - here's what the AI listens for.
        </p>

        <div className="lp-cards-3c">
          <article className="lp-card-3c lp-card-3c--clarity lp-reveal" aria-label="Clarity dimension">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--cyan">
                <Sparkles size={18} strokeWidth={1.8} />
              </div>
              <h3 className="lp-card-title">Clarity</h3>
            </div>
            <p className="lp-card-desc">
              How organized and professional is your delivery? Do you use clear structure and proper IT terminology?
            </p>
            <div className="lp-card-spacer" />
            <MetricBar score={4.2} color="#67E8F9" bar="linear-gradient(90deg, #06B6D4, #22D3EE)" />
          </article>

          <article className="lp-card-3c lp-card-3c--correctness lp-reveal" aria-label="Correctness dimension">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--green">
                <ShieldCheck size={18} strokeWidth={1.8} />
              </div>
              <h3 className="lp-card-title">Correctness</h3>
            </div>
            <p className="lp-card-desc">
              Is your answer technically accurate? Does it reflect real-world IT practices?
            </p>
            <div className="lp-card-spacer" />
            <MetricBar score={3.8} color="#6EE7B7" bar="linear-gradient(90deg, #10B981, #34D399)" />
          </article>

          <article className="lp-card-3c lp-card-3c--completeness lp-reveal" aria-label="Completeness dimension">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--amber">
                <Layers size={18} strokeWidth={1.8} />
              </div>
              <h3 className="lp-card-title">Completeness</h3>
            </div>
            <p className="lp-card-desc">
              Did you fully address the question? Do you back your answer up with specific examples?
            </p>
            <div className="lp-card-spacer" />
            <MetricBar score={3.5} color="#FDE68A" bar="linear-gradient(90deg, #FBBF24, #FACC15)" />
          </article>
        </div>

        <div className="lp-arena-foot">
          <p className="lp-score-note">
            Sample scores shown to illustrate the rubric.
          </p>
          <a href="#try-it-live" className="lp-section-cta">
            Hear how the AI scores your voice <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <div className="lp-divider lp-divider--purple" aria-hidden="true" />

      {/* ── Objective Evaluation Heading ── */}
      <section className="lp-eval-heading" id="about" aria-label="Objective evaluation">
        {/* Ambient background - blueprint grid + construction hairlines (decorative) */}
        <div className="lp-eval-bg" aria-hidden="true">
          <div className="lp-eval-line lp-eval-line--tr" />
          <div className="lp-eval-line lp-eval-line--bl" />
          <div className="lp-eval-grid" />
        </div>

        <div className="lp-eval-inner">
          <div className="lp-eval-left">
            <div className="lp-section-label lp-section-label--cyan">
              <div className="lp-label-dot lp-label-dot--cyan" aria-hidden="true" />
              <span>Objective evaluation</span>
            </div>
            <h2 className="lp-eval-headline lp-reveal">
              Who said tech interview prep has to be{" "}
              <span className="lp-eval-accent">subjective</span>?
            </h2>
            <p className="lp-eval-body lp-reveal">
              No more guessing what an interviewer wants to hear. A silent pre-test sets
              your baseline, and a scored post-test shows how far you've come.
            </p>
          </div>
          <div className="lp-eval-right">
            <div className="lp-eval-proof lp-reveal" aria-label="Sample evaluation journey">
              <div className="lp-live-header">
                <div className="lp-live-title-group">
                  <div className="lp-glow-dot lp-glow-dot--neutral" aria-hidden="true" />
                  <h3>One journey, measured at every step.</h3>
                </div>
                <div className="lp-live-badge" aria-label="Static illustration">
                  <div className="lp-live-dot" aria-hidden="true" />
                  <span>SAMPLE</span>
                </div>
              </div>

              <ol className="lp-eval-journey">
                <li className="lp-eval-journey-step">
                  <div className="lp-icon-tile lp-icon-tile--cyan">
                    <Gauge size={20} strokeWidth={1.8} />
                  </div>
                  <div className="lp-eval-journey-text">
                    <span className="lp-eval-journey-name">Silent pre-test</span>
                    <span className="lp-eval-journey-desc">
                      Five fixed questions that set your starting line. They never lock or unlock anything.
                    </span>
                  </div>
                </li>
                <li className="lp-eval-journey-step">
                  <div className="lp-icon-tile lp-icon-tile--purple">
                    <Mic size={20} strokeWidth={1.8} />
                  </div>
                  <div className="lp-eval-journey-text">
                    <span className="lp-eval-journey-name">Scored mock interview</span>
                    <span className="lp-eval-journey-desc">
                      Three rounds, fifteen answers, each scored on the 3C rubric as you go.
                    </span>
                  </div>
                </li>
                <li className="lp-eval-journey-step">
                  <div className="lp-icon-tile lp-icon-tile--green">
                    <TrendingUp size={20} strokeWidth={1.8} />
                  </div>
                  <div className="lp-eval-journey-text">
                    <span className="lp-eval-journey-name">Graduation post-test</span>
                    <span className="lp-eval-journey-desc">
                      The same five questions again. The gap between the two is your improvement.
                    </span>
                  </div>
                </li>
              </ol>

              <div className="lp-eval-delta">
                <span className="lp-eval-delta-baseline">Baseline 55%</span>
                <span className="lp-eval-delta-line" aria-hidden="true" />
                <span className="lp-eval-delta-growth">Graduation 80%</span>
                <span className="lp-eval-delta-chip">+25%</span>
              </div>

              <p className="lp-eval-proof-note">Sample figures from one practice journey.</p>
            </div>
          </div>
        </div>

        {/* Evidence strip — divider-separated fact wall under the proof */}
        <ul className="lp-eval-facts lp-reveal" aria-label="Evaluation highlights">
          <li className="lp-eval-fact">
            <span className="lp-eval-fact-icon lp-eval-fact-icon--cyan"><Target size={18} strokeWidth={1.8} /></span>
            <div className="lp-eval-fact-text">
              <strong>Silent baseline</strong>
              <span>The pre-test draws your starting line. It never gates difficulty.</span>
            </div>
          </li>
          <li className="lp-eval-fact">
            <span className="lp-eval-fact-icon lp-eval-fact-icon--green"><TrendingUp size={18} strokeWidth={1.8} /></span>
            <div className="lp-eval-fact-text">
              <strong>Deterministic unlock</strong>
              <span>Averaging 75%+ across the full mock interview opens the next tier.</span>
            </div>
          </li>
          <li className="lp-eval-fact">
            <span className="lp-eval-fact-icon lp-eval-fact-icon--purple"><Gauge size={18} strokeWidth={1.8} /></span>
            <div className="lp-eval-fact-text">
              <strong>Measured growth</strong>
              <span>The post-test replays your first five questions so the improvement shows.</span>
            </div>
          </li>
        </ul>
      </section>

      <div className="lp-divider lp-divider--cyan" aria-hidden="true" />

      {/* ── How It Works + Features Overview (Bento Grid) ── */}
      <section className="lp-bento" id="how-it-works" aria-labelledby="how-it-works-label">

        {/* Section header — the process is the spine of the overview */}
        <div className="lp-bento-head">
          <div className="lp-section-label lp-section-label--cyan">
            <div className="lp-label-dot lp-label-dot--cyan" aria-hidden="true" />
            <span id="how-it-works-label">How it works</span>
          </div>
          <h2 className="lp-bento-headline">From your first word to your 3C score.</h2>
          <p className="lp-bento-sub">
            Three steps between you and objective feedback - built on IT-specific role tracks, mastery tiers, and a three-round mock interview.
          </p>
        </div>

        <div className="lp-bento-grid">

          {/* Card 1 — Process spine (Speak → Transcribe → Score) */}
          <article className="lp-bento-card lp-bento-card--spine">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--cyan">
                <Mic size={20} strokeWidth={1.8} />
              </div>
              <h3>Speak, transcribe, get scored. No typing.</h3>
            </div>

            <ol className="lp-steps lp-steps--spine">
              <HowItStep num="1" title="Speak" desc="Answer interview questions naturally via voice - no typing required." icon={<Mic size={18} strokeWidth={1.8} />} showConnector />
              <HowItStep num="2" title="Transcribe" desc="Your answer is transcribed in real time, then checked against the 3C rubric." icon={<AlignLeft size={18} strokeWidth={1.8} />} showConnector />
              <HowItStep num="3" title="Get scored" desc="Clarity, Correctness, and Completeness - on the transparent 1.0-5.0 scale." icon={<Gauge size={18} strokeWidth={1.8} />} showConnector={false} />
            </ol>

            {/* Static transcript illustration — a voice-first moment the demo can't pause to show */}
            <div className="lp-live-strip" aria-hidden="true">
              <div className="lp-live-strip-row">
                <span className="lp-live-pill"><span className="lp-live-dot" />YOU</span>
                <p className="lp-live-quote">
                  &ldquo;I&apos;d use a cleanup function to clear the interval when the component unmounts.&rdquo;
                </p>
              </div>
              <div className="lp-live-strip-meta">
                <div className="lp-wave">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span key={i} className="lp-wave-bar" style={{ animationDelay: (i * 0.08) + "s" }} />
                  ))}
                </div>
                <span className="lp-live-status">Transcribing<span className="lp-caret" /></span>
              </div>
            </div>

            <div className="lp-how-foot">
              <a href="#try-it-live" className="lp-section-cta">
                Try the live demo <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>

          {/* Card 2 — Role Tracks */}
          <article className="lp-bento-card lp-bento-card--roles">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--purple">
                <Layers3 size={20} strokeWidth={1.8} />
              </div>
              <h3>IT Role Tracks</h3>
            </div>
            <div className="lp-role-list">
              <RoleChip color="#8B5CF6" name="Frontend" desc="React, Vue, Angular, CSS" />
              <RoleChip color="#8B5CF6" name="Backend" desc="Node.js, Python, Java, Go" />
              <RoleChip color="#8B5CF6" name="DevOps" desc="CI/CD, Docker, Kubernetes, AWS" />
            </div>
            <div className="lp-coming-soon">
              <div className="lp-cs-dot" />
              <span className="lp-cs-label">+ More Roles</span>
              <div className="lp-cs-badge">Coming Soon</div>
            </div>
          </article>

          {/* Card 3 — Mastery progression */}
          <article className="lp-bento-card lp-bento-card--mastery">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--green">
                <TrendingUp size={20} strokeWidth={1.8} />
              </div>
              <h3>Mastery-Based Difficulty Progression</h3>
            </div>

            <div className="lp-tier-ladder" aria-hidden="true">
              <div className="lp-tier-ladder-step lp-tier-ladder-step--done"><span>E</span><em>Easy</em></div>
              <div className="lp-tier-ladder-line" />
              <div className="lp-tier-ladder-step"><span>M</span><em>Medium</em></div>
              <div className="lp-tier-ladder-line" />
              <div className="lp-tier-ladder-step"><span>H</span><em>Hard</em></div>
            </div>

            <div className="lp-tier-list">
              <TierRow unlocked color="#10B981" name="Easy" status="Unlocked - Start here" />
              <TierRow unlocked={false} color="#6B7280" name="Medium" status="Requires a 75%+ average across a full mock interview" />
              <TierRow unlocked={false} color="#6B7280" name="Hard" status="Requires a 75%+ average on Medium" />
            </div>
          </article>

          {/* Card 4 — One session, three rounds */}
          <article className="lp-bento-card lp-bento-card--session">
            <div className="lp-card-head">
              <div className="lp-icon-tile lp-icon-tile--cyan">
                <Clock size={20} strokeWidth={1.8} />
              </div>
              <h3>One session, three rounds</h3>
            </div>

            <ol className="lp-sets-list">
              <li className="lp-set-row">
                <div className="lp-set-icon"><Target size={16} strokeWidth={1.8} /></div>
                <div className="lp-set-text">
                  <span className="lp-set-name">Personalized</span>
                  <span className="lp-set-desc">
                    Five questions aimed at the weak spots your pre-test diagnostic found.
                  </span>
                </div>
              </li>
              <li className="lp-set-row">
                <div className="lp-set-icon"><Code2 size={16} strokeWidth={1.8} /></div>
                <div className="lp-set-text">
                  <span className="lp-set-name">Technical</span>
                  <span className="lp-set-desc">
                    Role-based questions for Frontend, Backend, or DevOps - HTML/CSS/React for a frontend role.
                  </span>
                </div>
              </li>
              <li className="lp-set-row">
                <div className="lp-set-icon"><MessageSquare size={16} strokeWidth={1.8} /></div>
                <div className="lp-set-text">
                  <span className="lp-set-name">Behavioral</span>
                  <span className="lp-set-desc">
                    STAR-method questions about real conflicts, deadlines, and project risk.
                  </span>
                </div>
              </li>
            </ol>

            <p className="lp-session-note">
              <Check size={14} strokeWidth={1.8} color="#fff" />
              <span>Instant feedback after every answer.</span>
            </p>

            <div className="lp-unlock-line">
              Averaging <strong>75%+</strong> across all three rounds unlocks the next difficulty.
            </div>
          </article>

        </div>
      </section>

      {/* ── Final CTA Section ── */}
      <section className="lp-final-cta" aria-labelledby="cta-heading">
        {/* Single restrained brand-accent wash - mirrors the hero ambient, no purple */}
        <div className="lp-cta-glow-top" aria-hidden="true" />
        <h2 className="lp-cta-headline" id="cta-heading">
          Stop freezing in interviews. Start practicing with a{" "}
          <span className="lp-cta-accent">score</span>.
        </h2>
        <p className="lp-cta-sub">
          Answer real IT questions out loud and get instant 3C feedback after every answer.
        </p>
        <button className="lp-btn-cta-final" aria-label="Start practicing" onClick={openRegisterModal}>
          Start practicing
        </button>
        <div className="lp-cta-trust">
          <Check size={14} strokeWidth={2} color="#22D3EE" aria-hidden="true" />
          <span>Free to start. No credit card required.</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-divider" aria-hidden="true" />
        <div className="lp-footer-content">
          <div className="lp-footer-brand-block">
            <a href="/" className="lp-logo" aria-label="ITerview home">
              <div className="lp-logo-container">
                <img src={logoSrc} alt="ITerview Logo" className="lp-logo-img" />
              </div>
              <span className="lp-logo-text">ITerview</span>
            </a>
            <p className="lp-footer-tagline">
              Practice IT interviews out loud. Get scored on the 3C rubric.
            </p>
          </div>
          <nav className="lp-footer-links" aria-label="Footer navigation">
            <a href="#features" className="lp-footer-link">3C Rubric Guide</a>
            {/* FAQ / Privacy / Terms have no dedicated routes yet - keep placeholders until they ship */}
            <a href="#" className="lp-footer-link">FAQ</a>
            <a href="#" className="lp-footer-link">Privacy Policy</a>
            <a href="#" className="lp-footer-link">Terms</a>
          </nav>
        </div>
        <div className="lp-footer-bottom">
          <p className="lp-footer-copy">
            &copy; 2026 ITerview. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ── Auth Modal Overlay ── */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};

export default LandingPage;

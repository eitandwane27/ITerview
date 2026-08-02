import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut,
  BarChart2,
  Search,
  Lock,
  Zap,
  Mic,
  History,
  Gauge,
  Check,
  Briefcase,
  Sparkles,
  ChevronDown,
  Play,
  ArrowRight,
  TrendingUp,
  Sun,
  Moon,
  Flag,
  MessageSquare,
  Target,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

// ─── Data ────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "",           label: "Select a role..." },
  { value: "frontend",   label: "Frontend Developer" },
  { value: "backend",    label: "Backend Developer" },
  { value: "fullstack",  label: "Fullstack Developer" },
];

const FOCUS_OPTIONS = [
  { value: "auto",         label: "Auto-Detect (AI-Recommended)", desc: "AI targets your lowest scoring 3C metric from previous baseline diagnostic" },
  { value: "clarity",      label: "Clarity — Structure & Fluency", desc: "Focuses on speech pacing, clarity, and structural coherence" },
  { value: "correctness",  label: "Correctness — Technical Precision", desc: "Focuses on accuracy, concepts, and technical depth" },
  { value: "completeness", label: "Completeness — Depth & Thoroughness", desc: "Focuses on detailed answers and comprehensive coverage" },
  { value: "star",         label: "STAR Behavioral — Situation/Action/Result", desc: "Focuses on structured behavioral storytelling" },
];

const NAV_TABS = ["Interview Prep", "History", "Diagnostic Baseline"];

const TAB_ICONS = {
  "Interview Prep": Mic,
  History: History,
  "Diagnostic Baseline": Gauge,
};

const ROLE_SUMMARY = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
};

const FOCUS_SUMMARY = {
  auto: "AI Auto-Detect",
  clarity: "Clarity",
  correctness: "Correctness",
  completeness: "Completeness",
  star: "STAR Behavioral",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BaselineCard({
  baseline = 58,
  mastery = 72,
  growth,
  clarity = 5,
  correctness = 7,
  completeness = 8,
  lowest = "clarity",
  onViewDetails,
}) {
  const displayGrowth = growth !== undefined && growth !== null ? growth : (mastery - baseline);

  return (
    <section className="db-baseline-card">
      <div className="db-baseline-card__header">
        <div className="db-baseline-card__text">
          <h2 className="db-baseline-card__title">Your diagnostic baseline</h2>
          <p className="db-baseline-card__sub">
            <Lock size={12} className="db-baseline-card__lock" />
            Locked from your pre-test — every session builds on this start line.
          </p>
        </div>
        <button type="button" className="db-view-link db-view-link--pill" onClick={onViewDetails}>
          View details <ArrowRight size={14} />
        </button>
      </div>

      <div className="db-baseline-card__body">
        {/* Baseline → Mastery journey */}
        <div data-pencil-name="Progression" className="db-progression">
          <div data-pencil-name="Prog Label" className="db-progression__label">
            BASELINE → MASTERY
          </div>
          <div data-pencil-name="Score Row" className="db-progression__scores">
            <div data-pencil-name="Baseline Score" className="db-progression__baseline">
              {baseline}%
            </div>
            <svg
              data-pencil-name="Arrow"
              data-icon-name="arrow-right"
              data-icon-set="lucide"
              viewBox="0 0 13.99993896484375 14"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
              className="db-progression__arrow"
            >
              <path
                d="M6.90088 2.35156q-0.18115 0.02734-0.32129 0.16748-0.11279 0.11279-0.14697 0.28028-0.03418 0.16748 0.02051 0.32129 0.02734 0.08545 0.25976 0.3247 0.23242 0.23584 1.36377 1.37061 1.58252 1.58252 1.58252 1.59619 0 0.01367-3.45557 0.01367l-3.44531 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.53321 0.03418l3.01123 0q3.42822 0 3.42822 0.01367 0 0.01367-1.58252 1.59619-1.13135 1.13477-1.36377 1.37402-0.23242 0.23584-0.25976 0.3213-0.05469 0.15381-0.02051 0.32128 0.03418 0.16748 0.14697 0.28028 0.18115 0.18115 0.42041 0.18115l0.04102 0q0.11279 0 0.19824-0.05469 0.14014-0.09912 0.51611-0.46484l1.68164-1.67822q2.1123-2.10205 2.15332-2.18409 0.07178-0.12646 0.07178-0.28027 0-0.15381-0.07178-0.28027-0.04102-0.08203-2.1499-2.18067-2.10547-2.10205-2.17725-2.13623-0.06836-0.0376-0.23584-0.06494-0.04102 0-0.12646 0.01367z"
                fill="#7C6FCD"
              />
            </svg>
            <div data-pencil-name="Mastery Score" className="db-progression__mastery">
              {mastery}%
            </div>
          </div>
          <div data-pencil-name="Delta Pill" className="db-delta-pill">
            <svg
              data-pencil-name="Delta Icon"
              data-icon-name="trending-up"
              data-icon-set="lucide"
              viewBox="0 0 13.99993896484375 14"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
              className="db-delta-pill__icon"
            >
              <path
                d="M9.19775 3.51367q-0.14014 0.04102-0.25976 0.15381-0.11963 0.11279-0.16065 0.25293-0.05469 0.19482 0.02735 0.39307 0.08545 0.19482 0.25293 0.29394 0.09912 0.04102 0.30761 0.05469 0.21191 0.01367 1.00831 0.01367l1.04931 0-3.54101 3.54102-1.30225-1.28516q-1.28857-1.28857-1.38086-1.32959-0.08887-0.4443-0.21533-0.05127-0.12646-0.00684-0.21875 0.03076-0.08887 0.03418-0.37598 0.30762-0.28711 0.27002-1.72949 1.7124-1.97217 1.97559-2.0166 2.04395-0.08203 0.19482-0.04785 0.37939 0.03418 0.18115 0.16064 0.29395 0.15381 0.15381 0.36231 0.17431 0.21191 0.02051 0.37939-0.09228 0.07178-0.05469 1.76367-1.75l1.69531-1.70557 2.35157 2.33789q0.25293 0.23584 0.35205 0.29395 0.06836 0.04102 0.18115 0.04101l0.08203 0q0.09912 0 0.19824-0.05468 0.12646-0.8545 0.4751-0.43409l3.65381-3.64013 0.01367 2.23877 0.04102 0.09912q0.04443 0.08203 0.11279 0.16064 0.07178 0.0752 0.14014 0.1128 0.07178 0.03418 0.16748 0.04785 0.23926 0.04102 0.43408-0.09229 0.19824-0.1333 0.25293-0.36914 0.01367-0.11279 0-1.91748l0-1.82178-0.04102-0.09912q-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-1.86279-0.01367q-1.85937 0-1.93116 0.01367z"
                fill="#10B981"
              />
            </svg>
            <div data-pencil-name="Delta Text" className="db-delta-pill__text">
              {displayGrowth >= 0 ? "+" : ""}{displayGrowth}% growth
            </div>
          </div>
        </div>

        {/* 3C Grid */}
        <div className="db-3c-grid">
          <div className={`db-3c-cell db-3c-cell--clarity ${lowest === "clarity" ? "db-3c-cell--lowest" : ""}`}>
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <MessageSquare size={13} className="db-3c-cell__icon db-3c-cell__icon--clarity" />
                <span className="db-3c-cell__name db-3c-cell__name--clarity">Clarity</span>
              </span>
              {lowest === "clarity" && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--clarity">{clarity} / 10</div>
          </div>

          <div className={`db-3c-cell ${lowest === "correctness" ? "db-3c-cell--lowest" : ""}`}>
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <Target size={13} className="db-3c-cell__icon db-3c-cell__icon--correctness" />
                <span className="db-3c-cell__name">Correctness</span>
              </span>
              {lowest === "correctness" && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--correctness">{correctness} / 10</div>
          </div>

          <div className={`db-3c-cell ${lowest === "completeness" ? "db-3c-cell--lowest" : ""}`}>
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <PackageCheck size={13} className="db-3c-cell__icon db-3c-cell__icon--completeness" />
                <span className="db-3c-cell__name">Completeness</span>
              </span>
              {lowest === "completeness" && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--completeness">{completeness} / 10</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const clock = useClock();
  const [activeTab, setActiveTab] = useState("Interview Prep");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [selectedFocus, setSelectedFocus] = useState("auto");
  const [showAutoDetectInsight, setShowAutoDetectInsight] = useState(false);
  const [userName, setUserName] = useState("U");
  const [fullName, setFullName] = useState("Alex");
  const [unlockedDifficulty, setUnlockedDifficulty] = useState("easy");
  const [hasCompletedDiagnostic, setHasCompletedDiagnostic] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("iterview-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  // Fetch saved role + user display info + diagnostic summary on mount
  const fetchUserData = useCallback(async (user) => {
    if (!user) return;
    const initial = (user.displayName || user.email || "U")[0].toUpperCase();
    setUserName(initial);
    setFullName(user.displayName || "Alex");

    try {
      const [res, summaryRes, activeRes] = await Promise.all([
        fetch(`/api/users/${user.uid}`),
        fetch(`/api/users/results-summary?uid=${user.uid}`),
        fetch(`/api/users/active-practice-session?uid=${user.uid}`),
      ]);

      if (res.ok) {
        const data = await res.json();
        if (data.user?.role) setSelectedRole(data.user.role);
        if (data.user?.unlockedDifficulty) setUnlockedDifficulty(data.user.unlockedDifficulty);
        if (data.user?.focusArea) setSelectedFocus(data.user.focusArea);
        if (data.user?.displayName) setFullName(data.user.displayName);
        if (data.hasCompletedDiagnostic !== undefined) setHasCompletedDiagnostic(data.hasCompletedDiagnostic);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setDiagnosticData(summaryData);
      }

      if (activeRes && activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveSession(activeData);
      }
    } catch (err) {
      console.error("Error fetching user details or summary:", err);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchUserData(auth.currentUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserData(user);
      }
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate("/landing");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  }, [navigate]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("iterview-theme", next);
      } catch (err) {
        console.error("Error saving theme preference:", err);
      }
      return next;
    });
  }, []);

  const handleStartSession = useCallback(async () => {
    if (!selectedRole) {
      alert("Please select a role first!");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) { alert("Please log in first!"); return; }

      const res = await fetch("/api/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user.uid,
          role: selectedRole,
          difficulty: selectedDifficulty,
          focusArea: selectedFocus,
        }),
      });

      if (!res.ok) throw new Error("Failed to save role");
      console.log("Role & focus area saved to MongoDB.");

      if (hasCompletedDiagnostic) {
        let targetSet = activeSession?.hasActiveSession ? activeSession.activeSet : 1;
        try {
          const activeCheckRes = await fetch(`/api/users/active-practice-session?uid=${user.uid}`);
          if (activeCheckRes.ok) {
            const activeCheckData = await activeCheckRes.json();
            if (activeCheckData.hasActiveSession && activeCheckData.activeSet) {
              targetSet = activeCheckData.activeSet;
            }
          }
        } catch (e) {
          console.error("Active session check fallback error:", e);
        }

        navigate(`/interview?set=${targetSet}&mode=practice&focusArea=${selectedFocus}`);
      } else {
        navigate("/likert-pre");
      }
    } catch (err) {
      console.error("Error saving role & focus area:", err);
      alert("Failed to save target role. Please try again.");
    }
  }, [selectedRole, selectedDifficulty, selectedFocus, hasCompletedDiagnostic, activeSession, navigate]);

  const handleResumeSession = useCallback(() => {
    const targetSet = activeSession?.activeSet || 1;
    navigate(`/interview?set=${targetSet}&mode=practice&focusArea=${selectedFocus}`);
  }, [activeSession, selectedFocus, navigate]);

  const handleResetAndStartNew = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await fetch("/api/users/reset-practice-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firebaseUid: user.uid }),
        });
        setActiveSession({ hasActiveSession: false });
      }
    } catch (err) {
      console.error("Error resetting session:", err);
    }
  }, []);

  const isSessionActive = !!(activeSession?.hasActiveSession && hasCompletedDiagnostic);

  const difficultyChips = [
    { label: "Easy",   value: "easy",   locked: false },
    { label: "Medium", value: "medium", locked: unlockedDifficulty === "easy" },
    { label: "Hard",   value: "hard",   locked: unlockedDifficulty !== "hard" },
  ];

  // Derived display values (wireframe defaults when no data yet)
  const breakdown = diagnosticData?.threeCBreakdown || {};
  const clarity = breakdown.clarity ?? 5;
  const correctness = breakdown.correctness ?? 7;
  const completeness = breakdown.completeness ?? 8;
  const lowestMetric = breakdown.lowestMetric || "clarity";
  const baselineScore = diagnosticData?.preTestScore ?? 58;
  const masteryScore = diagnosticData?.masteryScore ?? 72;
  const growthDelta =
    diagnosticData?.improvementDelta !== null && diagnosticData?.improvementDelta !== undefined
      ? diagnosticData.improvementDelta
      : masteryScore - baselineScore;
  const avg3C =
    diagnosticData?.threeCBreakdown?.averagePercentage ??
    diagnosticData?.masteryScore ??
    67;
  const weakTopic = diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "Clarity";
  const sessionsCount = hasCompletedDiagnostic ? "3 / 3" : "0";

  const roleSummary = ROLE_SUMMARY[selectedRole] || "Select role";
  const focusSummary = FOCUS_SUMMARY[selectedFocus] || "Select focus";

  return (
    <div className="db-root" data-theme={theme}>

      {/* ── Top Nav ── */}
      <header className="db-topnav">
        {/* Logo Group */}
        <div className="db-topnav__logo-group">
          <div className="db-logo-mark">
            <Zap size={18} color="#FFFFFF" />
          </div>
          <span className="db-topnav__wordmark">ITerview</span>
        </div>

        {/* Tab Row */}
        <nav className="db-tab-row" role="tablist" aria-label="Dashboard sections">
          {NAV_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`tab-${tab.toLowerCase().replace(/ /g, "-")}`}
                aria-selected={activeTab === tab}
                className={`db-tab ${activeTab === tab ? "db-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={16} />
                <span>{tab}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Group */}
        <div className="db-topnav__right">
          <button
            type="button"
            className="db-theme-toggle"
            onClick={handleToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="db-user-avatar" title="Account" id="user-avatar-btn">
            {userName}
          </div>
          <button type="button" className="db-signout-btn" title="Sign Out" id="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span className="db-signout-label">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="db-content">

        {/* Page Header */}
        <div className="db-page-header">
          <div className="db-page-header__text">
            <h1 className="db-greeting">{getGreeting()}, {fullName}</h1>
            <p className="db-sub-greeting">Ready for your next mock interview?</p>
          </div>
          <time className="db-clock" aria-label="Current time">{clock}</time>
        </div>

        {/* Status Banner */}
        <div className={`db-status-banner ${hasCompletedDiagnostic ? "" : "db-status-banner--pending"}`}>
          <Check size={18} className="db-status-banner__icon" />
          <span className="db-status-banner__title">
            {hasCompletedDiagnostic
              ? "Diagnostic completed — practice mode active"
              : "Initial diagnostic pending — pre-test diagnostic required"}
          </span>
          {hasCompletedDiagnostic && (
            <button type="button" className="db-status-banner__link" onClick={() => navigate("/results")}>
              View results
            </button>
          )}
        </div>

        {/* ══ Interview Prep Tab ══ */}
        {activeTab === "Interview Prep" && (
          <>
            {/* ── Session Setup Card ── */}
            <section className="db-setup-card">
              <div className="db-setup-card__header">
                <div className="db-setup-card__text">
                  <h2 className="db-setup-card__title">Start a practice session</h2>
                  <p className="db-setup-card__sub">Set your parameters — you can change them anytime.</p>
                </div>
              </div>

              {/* In-Progress Session Resume Banner */}
              {isSessionActive && (
                <div className="db-resume-banner">
                  <div className="db-resume-banner__head">
                    <span className="db-resume-banner__title">
                      <Play size={14} className="db-resume-banner__title-icon" />
                      In-Progress Practice Session Detected
                    </span>
                    <span className="db-resume-banner__badge">
                      Set {activeSession.activeSet} · Q{activeSession.answersCount + 1}/5
                    </span>
                  </div>
                  <p className="db-resume-banner__desc">
                    You have an unfinished practice session saved in MongoDB. Resume your progress from Set{" "}
                    {activeSession.activeSet} or start a fresh session.
                  </p>
                  <div className="db-resume-banner__actions">
                    <button
                      type="button"
                      onClick={handleResumeSession}
                      className="db-btn-primary db-btn-primary--sm"
                    >
                      <Play size={15} /> Resume Session (Set {activeSession.activeSet})
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAndStartNew}
                      className="db-btn-secondary db-btn-secondary--sm"
                    >
                      <RotateCcw size={14} />
                      Start Fresh Session
                    </button>
                  </div>
                </div>
              )}

              {/* Select Row — Role + Focus */}
              <div className="db-select-row">
                {/* Target Role */}
                <div className="db-field">
                  <label htmlFor="role-select" className="db-field__label">
                    TARGET ROLE {isSessionActive && <span className="db-field__lock-hint">(Locked — Active Session)</span>}
                  </label>
                  <div className="db-select-wrap">
                    <Briefcase size={17} className="db-select-wrap__icon db-select-wrap__icon--violet" />
                    <select
                      id="role-select"
                      className="db-select"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      disabled={isSessionActive}
                      title={isSessionActive ? "Target Role is locked during active practice session. Click 'Start Fresh Session' to edit." : ""}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} disabled={o.value === ""}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={17} className="db-select-wrap__chevron" />
                  </div>
                </div>

                {/* 3C Focus Area */}
                <div className="db-field">
                  <label htmlFor="focus-select" className="db-field__label">
                    3C FOCUS AREA {isSessionActive && <span className="db-field__lock-hint">(Locked)</span>}
                  </label>
                  <div className="db-select-wrap db-select-wrap--focus">
                    <Sparkles size={17} className="db-select-wrap__icon db-select-wrap__icon--cyan" />
                    <select
                      id="focus-select"
                      className="db-select"
                      value={selectedFocus}
                      onChange={(e) => setSelectedFocus(e.target.value)}
                      disabled={isSessionActive}
                      title={isSessionActive ? "Focus Area is locked during active practice session. Click 'Start Fresh Session' to edit." : ""}
                    >
                      {FOCUS_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={17} className="db-select-wrap__chevron" />
                  </div>
                </div>
              </div>

              {isSessionActive && (
                <div className="db-lock-note">
                  <Lock size={14} />
                  <span>
                    Target Role & Focus Area are locked for your active session. Click <strong>"Start Fresh Session"</strong> in the banner above to reset & enable options.
                  </span>
                </div>
              )}

              {/* AI Insight */}
              {selectedFocus === "auto" && (
                <div className="db-insight-card">
                  <button
                    type="button"
                    className="db-insight-card__head"
                    onClick={() => setShowAutoDetectInsight((prev) => !prev)}
                    aria-expanded={showAutoDetectInsight}
                  >
                    <Sparkles size={16} className="db-insight-card__icon" />
                    <div className="db-insight-card__text">
                      <div className="db-insight-card__title">AI Auto-Detect</div>
                      <div className="db-insight-card__sub">
                        {hasCompletedDiagnostic
                          ? `Clarity is your lowest 3C metric at ${clarity}/10 — this session prioritizes it.`
                          : "Your baseline pre-test will generate an AI recommendation after completion."}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`db-insight-card__toggle ${showAutoDetectInsight ? "db-rotate-180" : ""}`}
                    />
                  </button>

                  {showAutoDetectInsight && (
                    <div className="db-insight-card__body">
                      {hasCompletedDiagnostic ? (
                        <>
                          <p className="db-insight-card__body-text">
                            Based on your baseline diagnostic results, your 3C scores are:
                          </p>
                          <div className="db-insight-3c">
                            <div className="db-insight-3c-row">
                              <MessageSquare size={14} className="db-insight-3c-icon db-insight-3c-icon--clarity" />
                              <span>Clarity: <strong>{breakdown.clarity ?? "—"}/10</strong></span>
                            </div>
                            <div className="db-insight-3c-row">
                              <Target size={14} className="db-insight-3c-icon db-insight-3c-icon--correctness" />
                              <span>Correctness: <strong>{breakdown.correctness ?? "—"}/10</strong></span>
                            </div>
                            <div className="db-insight-3c-row">
                              <PackageCheck size={14} className="db-insight-3c-icon db-insight-3c-icon--completeness" />
                              <span>Completeness: <strong>{breakdown.completeness ?? "—"}/10</strong></span>
                            </div>
                            <div className="db-insight-3c-row">
                              <BarChart2 size={14} className="db-insight-3c-icon db-insight-3c-icon--avg" />
                              <span>
                                3C Avg:{" "}
                                <strong className="db-insight-highlight">
                                  {breakdown.averageOutOf10
                                    ? `${breakdown.averageOutOf10}/10 (${breakdown.averagePercentage}%)`
                                    : "—"}
                                </strong>
                              </span>
                            </div>
                          </div>
                          <p className="db-insight-card__body-text">
                            ✅ <strong>Verification:</strong> Your lowest metric is{" "}
                            <strong className="db-insight-strong">
                              {breakdown.lowestMetric || diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "Clarity"}
                            </strong>
                            . AI Auto-Detect has targeted this dimension for your next practice set.
                          </p>
                        </>
                      ) : (
                        <p className="db-insight-card__body-text">
                          Your initial baseline pre-test will analyze your speech clarity, technical accuracy, and
                          answer completeness to generate an AI recommendation.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Options Row — Difficulty */}
              <div className="db-options-row">
                <div className="db-difficulty-group">
                  <div className="db-difficulty-group__label">DIFFICULTY</div>
                  <div className="db-chip-row">
                    {difficultyChips.map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        id={`chip-${chip.value}`}
                        className={[
                          "db-chip",
                          selectedDifficulty === chip.value ? "db-chip--active" : "",
                          chip.locked ? "db-chip--locked" : "",
                        ].join(" ")}
                        onClick={() => !chip.locked && setSelectedDifficulty(chip.value)}
                        disabled={chip.locked}
                      >
                        {chip.locked && <Lock size={13} className="db-chip__lock" />}
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA Row */}
              <div className="db-cta-row">
                <span className="db-summary">
                  {roleSummary} · {focusSummary} · 30 min
                </span>
                <button
                  type="button"
                  id="btn-start-pretest"
                  className="db-cta-btn"
                  onClick={handleStartSession}
                  disabled={!selectedRole}
                >
                  <Play size={17} />
                  {hasCompletedDiagnostic
                    ? (activeSession?.hasActiveSession
                        ? `Resume Set ${activeSession.activeSet} Practice`
                        : "Start Practice Session")
                    : "Start Pre-Test"}
                </button>
              </div>
            </section>

            {/* ── Stats Row ── */}
            <div className="db-stats-row">
              <div className="db-stat-card">
                <div className="db-stat-card__label">AVG 3C SCORE</div>
                <div className="db-stat-card__value-row">
                  <span className="db-stat-card__value">{avg3C}%</span>
                  <span className="db-stat-card__delta">+{growthDelta}% vs baseline</span>
                </div>
              </div>
              <div className="db-stat-card">
                <div className="db-stat-card__label">SESSIONS</div>
                <div className="db-stat-card__value-row">
                  <span className="db-stat-card__value">{sessionsCount}</span>
                  <span className="db-stat-card__meta">this week</span>
                </div>
              </div>
              <div className="db-stat-card">
                <div className="db-stat-card__label">WEAK TOPIC</div>
                <div className="db-stat-card__value-row">
                  <span className="db-stat-card__value db-stat-card__value--topic">{weakTopic}</span>
                  <span className="db-stat-card__delta db-stat-card__delta--orange">AI targeted</span>
                </div>
              </div>
            </div>

            {/* ── Baseline Card ── */}
            <BaselineCard
              baseline={baselineScore}
              mastery={masteryScore}
              growth={growthDelta}
              clarity={clarity}
              correctness={correctness}
              completeness={completeness}
              lowest={lowestMetric}
              onViewDetails={() => navigate("/results")}
            />
          </>
        )}

        {/* ══ History Tab ══ */}
        {activeTab === "History" && (
          <section className="db-setup-card db-history-card">
            <div className="db-setup-card__header">
              <div className="db-setup-card__text">
                <h2 className="db-setup-card__title">
                  <History size={17} className="db-setup-card__title-icon" />
                  Practice History & Session Logs
                </h2>
                <p className="db-setup-card__sub">
                  View your past practice performance, 3C metric breakdowns, and rolling attempt history.
                </p>
              </div>
              <span className="db-history-badge">Max 5 Rolling History</span>
            </div>

            {diagnosticData?.practiceHistory && diagnosticData.practiceHistory.length > 0 ? (
              <div className="db-history-list">
                {diagnosticData.practiceHistory.slice().reverse().map((attempt, idx) => (
                  <div key={attempt._id || idx} className="db-attempt-card">
                    <div className="db-attempt-card__left">
                      <span className="db-attempt-badge">
                        Attempt #{attempt.attemptNumber || (diagnosticData.practiceHistory.length - idx)}
                      </span>
                      <div>
                        <div className="db-attempt-card__title">
                          <span style={{ textTransform: "capitalize" }}>{attempt.role || "Developer"}</span>
                          {" · "}{attempt.difficulty || "Easy"}
                          <span className="db-badge db-badge--purple">
                            <Mic size={11} strokeWidth={2.2} />
                            Focus: {attempt.focusArea || "Auto"}
                          </span>
                        </div>
                        <div className="db-attempt-card__meta">
                          {attempt.completedAt
                            ? new Date(attempt.completedAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Recently"}
                        </div>
                      </div>
                    </div>
                    <div className="db-attempt-card__right">
                      {attempt.threeCBreakdown && (
                        <div className="db-3c-mini">
                          <span>Clarity: <strong>{attempt.threeCBreakdown.clarity ?? "—"}</strong></span>
                          <span>Correct: <strong>{attempt.threeCBreakdown.correctness ?? "—"}</strong></span>
                          <span>Complete: <strong>{attempt.threeCBreakdown.completeness ?? "—"}</strong></span>
                        </div>
                      )}
                      <span className="db-attempt-score">
                        {attempt.overallScorePercentage !== null && attempt.overallScorePercentage !== undefined
                          ? `${attempt.overallScorePercentage}%`
                          : attempt.threeCBreakdown?.averageOutOf10
                            ? `${(attempt.threeCBreakdown.averageOutOf10 * 10).toFixed(0)}%`
                            : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-empty">
                No practice attempts logged yet. Launch a practice session above to begin your rolling 5-session
                history!
              </div>
            )}
          </section>
        )}

        {/* ══ Diagnostic Baseline Tab ══ */}
        {activeTab === "Diagnostic Baseline" && (
          <BaselineCard
            baseline={baselineScore}
            mastery={masteryScore}
            growth={growthDelta}
            clarity={clarity}
            correctness={correctness}
            completeness={completeness}
            lowest={lowestMetric}
            onViewDetails={() => navigate("/results")}
          />
        )}

        {/* ── Footer Actions ── */}
        <div className="db-card-footer">
          <button type="button" className="db-btn-secondary" id="btn-browse-scenarios">
            <Search size={15} />
            Browse Scenarios
          </button>
          <button
            type="button"
            className="db-btn-secondary"
            id="btn-view-progress"
            onClick={() => navigate("/results")}
          >
            <BarChart2 size={15} />
            View Full Results
          </button>
        </div>

      </main>{/* /db-content */}
    </div>
  );
}
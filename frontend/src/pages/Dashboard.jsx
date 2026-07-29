import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut,
  BarChart2,
  ChevronRight,
  Bell,
  Settings,
  HelpCircle,
  Search,
  Lock,
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
  { value: "auto",         label: "🤖 Auto-Detect (AI-Recommended)", desc: "AI targets your lowest scoring 3C metric from previous baseline diagnostic" },
  { value: "clarity",      label: "🗣️ Clarity — Structure & Fluency", desc: "Focuses on speech pacing, clarity, and structural coherence" },
  { value: "correctness",  label: "🎯 Correctness — Technical Precision", desc: "Focuses on accuracy, concepts, and technical depth" },
  { value: "completeness", label: "📦 Completeness — Depth & Thoroughness", desc: "Focuses on detailed answers and comprehensive coverage" },
  { value: "star",         label: "🌟 STAR Behavioral — Situation/Action/Result", desc: "Focuses on structured behavioral storytelling" },
];

const COMPANY_CHIPS = ["Default", "NVIDIA", "Amazon", "Google", "Meta", "Custom"];
const DURATION_CHIPS = ["15m", "20m", "30m", "45m"];

const DIFFICULTY_CHIPS = [
  { label: "Easy",   value: "easy",   locked: false },
  { label: "Medium", value: "medium", locked: true  },
  { label: "Hard",   value: "hard",   locked: true  },
];

// Avatar chip color assignments — stable, never randomized
const PANEL_AVATARS = [
  { initial: "B", color: "red",    label: "Behavioral" },
  { initial: "T", color: "teal",   label: "Technical"  },
  { initial: "S", color: "blue",   label: "System"     },
  { initial: "A", color: "purple", label: "Algo"       },
  { initial: "C", color: "green",  label: "Culture"    },
];

const RECENT_SESSIONS = [
  { title: "Frontend Technical Round",   company: "Default",  duration: "20m", score: 78, diff: "Easy" },
  { title: "System Design — REST APIs",  company: "Amazon",   duration: "30m", score: 62, diff: "Easy" },
];

const QUICK_LAUNCH = [
  { tag: "green",  tagLabel: "START",  title: "Start Interview",      desc: "Jump into a live mock session"       },
  { tag: "blue",   tagLabel: "AI",     title: "AI Feedback Review",   desc: "Replay and analyse last session"     },
  { tag: "orange", tagLabel: "BROWSE", title: "Browse Scenarios",     desc: "Explore 200+ company question sets"  },
];

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarChip({ initial, color }) {
  return (
    <div className={`db-avatar db-avatar--${color}`} title={initial}>
      {initial}
    </div>
  );
}

function FilterChipRow({ chips, active, onSelect, lockedValues = [] }) {
  return (
    <div className="db-chip-row">
      {chips.map((chip) => {
        const val   = typeof chip === "string" ? chip : chip.value;
        const lbl   = typeof chip === "string" ? chip : chip.label;
        const isLocked = typeof chip === "object" && chip.locked;

        return (
          <button
            key={val}
            className={[
              "db-chip",
              active === val ? "db-chip--active" : "",
              isLocked      ? "db-chip--locked"  : "",
            ].join(" ")}
            onClick={() => !isLocked && onSelect(val)}
            disabled={isLocked}
            id={`chip-${val}`}
          >
            {isLocked && <Lock size={9} style={{ marginRight: 3, opacity: 0.6 }} />}
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function RecentItem({ session }) {
  return (
    <div className="db-recent-item">
      <span className="db-recent-item__title">{session.title}</span>
      <span className="db-recent-item__meta">
        <span>{session.company}</span>
        <span>·</span>
        <span>{session.duration}</span>
        <span>·</span>
        <span>{session.diff}</span>
        {session.score && (
          <>
            <span>·</span>
            <span style={{ fontWeight: 600, color: session.score >= 75 ? "#22C55E" : "#F97316" }}>
              {session.score}%
            </span>
          </>
        )}
      </span>
    </div>
  );
}

function QuickLaunchItem({ item }) {
  return (
    <div className="db-quick-item">
      <span className={`db-tag db-tag--${item.tag}`}>{item.tagLabel}</span>
      <div className="db-quick-item__text">
        <div className="db-quick-item__title">{item.title}</div>
        <div className="db-quick-item__desc">{item.desc}</div>
      </div>
      <ChevronRight size={14} className="db-quick-item__arrow" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate           = useNavigate();
  const clock              = useClock();
  const [activeTab,        setActiveTab]        = useState("Interview Prep");
  const [selectedRole,     setSelectedRole]     = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [selectedFocus,    setSelectedFocus]    = useState("auto");
  const [showAutoDetectInsight, setShowAutoDetectInsight] = useState(false);
  const [selectedCompany,  setSelectedCompany]  = useState("Default");
  const [selectedDuration, setSelectedDuration] = useState("20m");
  const [userName,         setUserName]         = useState("U");
  const [unlockedDifficulty, setUnlockedDifficulty] = useState("easy");
  const [hasCompletedDiagnostic, setHasCompletedDiagnostic] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  // Fetch saved role + user display info + diagnostic summary on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Derive a single-letter initial from email or displayName
        const initial = (user.displayName || user.email || "U")[0].toUpperCase();
        setUserName(initial);

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
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  }, [navigate]);

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
        navigate(`/interview?set=1&mode=practice&focusArea=${selectedFocus}`);
      } else {
        navigate("/likert-pre");
      }
    } catch (err) {
      console.error("Error saving role & focus area:", err);
      alert("Failed to save target role. Please try again.");
    }
  }, [selectedRole, selectedDifficulty, selectedFocus, hasCompletedDiagnostic, navigate]);

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
      handleStartSession();
    } catch (err) {
      console.error("Error resetting session:", err);
      handleStartSession();
    }
  }, [handleStartSession]);

  const difficultyChips = [
    { label: "Easy",   value: "easy",   locked: false },
    { label: "Medium", value: "medium", locked: unlockedDifficulty === "easy" },
    { label: "Hard",   value: "hard",   locked: unlockedDifficulty !== "hard" },
  ];

  return (
    <div className="db-root">

      {/* ── Top Navigation ── */}
      <header className="db-topnav">
        <div className="db-topnav__logo">
          <span className="db-topnav__wordmark">ITerview</span>
          <span className="db-topnav__ai-badge">
            <span className="db-topnav__ai-dot" />
            AI Online
          </span>
        </div>

        <div className="db-topnav__search">
          <input
            type="text"
            placeholder="Search scenarios, companies, topics…"
            id="dashboard-search"
            aria-label="Search"
          />
        </div>

        <div className="db-topnav__actions">
          <span className="db-sessions-chip">Sessions 0/3</span>

          <button className="db-icon-btn" title="Notifications" id="btn-notifications">
            <Bell size={13} />
          </button>
          <button className="db-icon-btn" title="Settings" id="btn-settings">
            <Settings size={13} />
          </button>
          <button className="db-icon-btn" title="Help" id="btn-help">
            <HelpCircle size={13} />
          </button>

          <div className="db-topnav__user-avatar" title="Account" id="user-avatar-btn">
            {userName}
          </div>

          <button className="db-icon-btn" title="Sign Out" id="btn-logout" onClick={handleLogout}>
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="db-body">

        {/* ── Main Column ── */}
        <main className="db-main">

          {/* Page header + clock */}
          <div className="db-page-header">
            <div>
              <h1 className="db-page-title">Your Dashboard</h1>
              <p className="db-page-subtitle">
                Configure your session, select your role, and launch when ready.
              </p>
            </div>
            <time className="db-clock" aria-label="Current time">{clock}</time>
          </div>

          {/* ── Main Card ── */}
          <div className="db-main-card">

            {/* Tab row */}
            <div className="db-tab-row" role="tablist" aria-label="Session mode">
              {["Interview Prep", "History", "Scenario"].map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  id={`tab-${tab.replace(" ", "-").toLowerCase()}`}
                  aria-selected={activeTab === tab}
                  className={`db-tab ${activeTab === tab ? "db-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Inner Card (lavender) ── */}
            <div className="db-inner-card">

              {/* Active Tab Content Switcher */}
              {activeTab === "History" ? (
                <div style={{ padding: "4px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-ink)", margin: "0 0 4px 0" }}>
                        ⏱️ Practice History & Session Logs
                      </h3>
                      <p style={{ fontSize: "12px", color: "var(--color-ink-muted)", margin: 0 }}>
                        View your past practice performance, 3C metric breakdowns, and rolling attempt history.
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", background: "var(--color-badge-purple-bg)", color: "var(--color-primary)", padding: "3px 10px", borderRadius: "12px" }}>
                      Max 5 Rolling History
                    </span>
                  </div>

                  {diagnosticData?.practiceHistory && diagnosticData.practiceHistory.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {diagnosticData.practiceHistory.slice().reverse().map((attempt, idx) => (
                        <div
                          key={attempt._id || idx}
                          className="db-attempt-card"
                          style={{
                            background: "var(--color-surface-card)",
                            border: "1px solid var(--color-border-card)",
                            borderRadius: "var(--lg-radius, 12px)",
                            padding: "14px 16px",
                            display: "flex",
                            justify: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "10px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span
                              style={{
                                background: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                                fontSize: "12px",
                                fontWeight: "700",
                                padding: "4px 10px",
                                borderRadius: "var(--pill-radius)",
                              }}
                            >
                              Attempt #{attempt.attemptNumber || (diagnosticData.practiceHistory.length - idx)}
                            </span>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-ink)", textTransform: "capitalize" }}>
                                  {attempt.role || "Developer"} · {attempt.difficulty || "Easy"}
                                </span>
                                <span className="db-badge db-badge--purple" style={{ fontSize: "10px" }}>
                                  🗣️ Focus: {attempt.focusArea || "Auto"}
                                </span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", marginTop: "2px" }}>
                                {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently"}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {attempt.threeCBreakdown && (
                              <div style={{ display: "flex", gap: "6px", fontSize: "11px" }}>
                                <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                                  Clarity: <strong>{attempt.threeCBreakdown.clarity ?? "—"}</strong>
                                </span>
                                <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                                  Correct: <strong>{attempt.threeCBreakdown.correctness ?? "—"}</strong>
                                </span>
                                <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                                  Complete: <strong>{attempt.threeCBreakdown.completeness ?? "—"}</strong>
                                </span>
                              </div>
                            )}

                            <div style={{ textAlign: "right", minWidth: "60px" }}>
                              <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-primary)" }}>
                                {attempt.overallScorePercentage !== null && attempt.overallScorePercentage !== undefined ? `${attempt.overallScorePercentage}%` : (attempt.threeCBreakdown?.averageOutOf10 ? `${(attempt.threeCBreakdown.averageOutOf10 * 10).toFixed(0)}%` : "—")}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1px dashed var(--color-border-soft)",
                        borderRadius: "var(--lg-radius, 12px)",
                        padding: "24px",
                        textAlign: "center",
                        color: "var(--color-ink-muted)",
                        fontSize: "13px",
                      }}
                    >
                      No practice attempts logged yet. Complete a practice session under the Interview Prep tab to record your first history session!
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Panelists */}
                  <div className="db-panelist-row">
                    <div className="db-avatar-chips">
                      {PANEL_AVATARS.map((a) => (
                        <AvatarChip key={a.initial} initial={a.initial} color={a.color} />
                      ))}
                    </div>
                    <span className="db-panelist-label">5 panelists ready</span>
                  </div>

                  {/* Session title */}
                  <h2 className="db-session-title">Mock Interview Session</h2>

                  {/* Meta row */}
                  <div className="db-session-meta">
                    <span className="db-badge db-badge--recommended">Recommended</span>
                    <span className="db-badge db-badge--easy">Easy</span>
                    <span className="db-badge db-badge--blue">AI Evaluator</span>
                    <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>· 20 min</span>
                  </div>

                  {/* User row */}
                  <div className="db-user-row">
                    <div className="db-user-avatar">{userName}</div>
                    <span className="db-user-name">You</span>
                    <div className="db-doc-chips">
                      <span className="db-doc-chip">📄 Resume</span>
                      <span className="db-doc-chip">📊 Deck</span>
                    </div>
                  </div>

                  {/* Dev Mode / Diagnostic Status Heads-Up */}
                  <div
                    className="db-diagnostic-status-banner"
                    style={{
                      marginTop: 12,
                      marginBottom: 12,
                      padding: "10px 14px",
                      borderRadius: "var(--md-radius, 8px)",
                      fontSize: 12,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: hasCompletedDiagnostic
                        ? "var(--color-badge-green-bg)"
                        : "var(--color-badge-purple-bg)",
                      color: hasCompletedDiagnostic
                        ? "#15803D"
                        : "var(--color-badge-purple)",
                      border: `1px solid ${hasCompletedDiagnostic ? "#BBF7D0" : "var(--color-primary-muted)"}`,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {hasCompletedDiagnostic ? "✅" : "📋"}
                    </span>
                    <span>
                      {hasCompletedDiagnostic
                        ? "Diagnostic Completed — Practice Mode Active (Direct Entry Unlocked)"
                        : "Initial Diagnostic Pending — Pre-Test Diagnostic Required"}
                    </span>
                  </div>

                  {/* In-Progress Session Resume Banner */}
                  {activeSession?.hasActiveSession && hasCompletedDiagnostic && (
                    <div
                      style={{
                        marginTop: 12,
                        marginBottom: 16,
                        padding: "14px 16px",
                        borderRadius: "var(--lg-radius, 12px)",
                        background: "linear-gradient(135deg, rgba(238,242,255,0.95) 0%, rgba(224,231,255,0.95) 100%)",
                        border: "1.5px solid var(--color-primary)",
                        boxShadow: "0 2px 8px rgba(79, 70, 229, 0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: "var(--color-primary)" }}>
                          <span>⏯️ In-Progress Practice Session Detected</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: "var(--color-primary-light)", color: "var(--color-primary)", padding: "2px 8px", borderRadius: "12px" }}>
                          Set {activeSession.activeSet} · Q{activeSession.answersCount + 1}/5
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--color-ink-secondary)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                        You have an unfinished practice session saved in MongoDB. Resume your progress from Set {activeSession.activeSet} or start a fresh session.
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={handleResumeSession}
                          className="db-btn-primary"
                          style={{ fontSize: 12, padding: "8px 16px", flex: 1, minWidth: "160px" }}
                        >
                          ▶ Resume Session (Set {activeSession.activeSet})
                        </button>
                        <button
                          onClick={handleResetAndStartNew}
                          className="db-btn-secondary"
                          style={{ fontSize: 12, padding: "8px 16px" }}
                        >
                          🔄 Start Fresh Session
                        </button>
                      </div>
                    </div>
                  )}

              {/* Role selector */}
              <label htmlFor="role-select" className="db-role-select-label">
                Target Role
              </label>
              <select
                id="role-select"
                className="db-role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === ""}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* 3C Focus Area Selector */}
              <div className="db-focus-section" style={{ marginTop: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label htmlFor="focus-select" className="db-role-select-label" style={{ margin: 0 }}>
                    Practice Focus Area
                  </label>
                  <span
                    className="db-3c-tooltip-trigger"
                    title="3C Framework: Clarity, Correctness, Completeness + STAR Behavioral model"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-ink-muted)", cursor: "pointer" }}
                  >
                    <span>What's this?</span>
                    <HelpCircle size={12} />
                  </span>
                </div>
                <select
                  id="focus-select"
                  className="db-role-select"
                  value={selectedFocus}
                  onChange={(e) => setSelectedFocus(e.target.value)}
                >
                  {FOCUS_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                {/* Auto-Detect Insight Box */}
                {selectedFocus === "auto" && (
                  <div className="db-auto-insight-card">
                    <div
                      className="db-auto-insight-header"
                      onClick={() => setShowAutoDetectInsight((prev) => !prev)}
                      style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span className="db-auto-insight-title" style={{ fontSize: 12, fontWeight: 600 }}>
                        <span>🧠 AI Recommendation: </span>
                        <span className="db-auto-insight-highlight" style={{ color: "var(--color-primary)" }}>
                          {hasCompletedDiagnostic
                            ? (diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "Clarity & Structure Target")
                            : "Baseline Diagnostic Pending"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="db-auto-insight-toggle"
                        style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 500, cursor: "pointer" }}
                      >
                        {showAutoDetectInsight ? "Hide Reasoning ▲" : "Show Reasoning ▼"}
                      </button>
                    </div>

                    {showAutoDetectInsight && (
                      <div className="db-auto-insight-body" style={{ marginTop: 8, fontSize: 12, lineHeight: "1.5", color: "var(--color-ink-muted)" }}>
                        {hasCompletedDiagnostic ? (
                          <>
                            <p style={{ margin: "0 0 6px 0" }}>
                              Based on your baseline diagnostic results, your 3C scores are:
                            </p>
                            <div style={{ display: "flex", gap: "12px", background: "var(--color-canvas)", padding: "8px 10px", borderRadius: "6px", fontSize: "11px", marginBottom: "6px" }}>
                              <div>🗣️ Clarity: <strong>{diagnosticData?.threeCBreakdown?.clarity ? `${diagnosticData.threeCBreakdown.clarity}/10` : "—"}</strong></div>
                              <div>🎯 Correctness: <strong>{diagnosticData?.threeCBreakdown?.correctness ? `${diagnosticData.threeCBreakdown.correctness}/10` : "—"}</strong></div>
                              <div>📦 Completeness: <strong>{diagnosticData?.threeCBreakdown?.completeness ? `${diagnosticData.threeCBreakdown.completeness}/10` : "—"}</strong></div>
                              <div>📊 3C Avg: <strong style={{ color: "var(--color-primary)" }}>{diagnosticData?.threeCBreakdown?.averageOutOf10 ? `${diagnosticData.threeCBreakdown.averageOutOf10}/10 (${diagnosticData.threeCBreakdown.averagePercentage}%)` : "—"}</strong></div>
                            </div>
                            <p style={{ margin: 0 }}>
                              ✅ <strong>Verification:</strong> Your lowest metric is{" "}
                              <strong style={{ color: "var(--color-ink)", textTransform: "capitalize" }}>
                                {diagnosticData?.threeCBreakdown?.lowestMetric || diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "Clarity"}
                              </strong>
                              . AI Auto-Detect has targeted this dimension for your next practice set.
                            </p>
                          </>
                        ) : (
                          <p style={{ margin: 0 }}>
                            Your initial baseline pre-test will analyze your speech clarity, technical accuracy, and answer completeness to generate an AI recommendation.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              <button
                id="btn-start-pretest"
                className="db-btn-primary"
                onClick={handleStartSession}
                disabled={!selectedRole}
              >
                {hasCompletedDiagnostic ? "Start Practice Session" : "Start Pre-Test"}
              </button>

              {/* Company filter */}
              <div className="db-filter-section">
                <span className="db-filter-label">Company Focus</span>
                <FilterChipRow
                  chips={COMPANY_CHIPS}
                  active={selectedCompany}
                  onSelect={setSelectedCompany}
                />

                <span className="db-filter-label" style={{ marginTop: 6 }}>Difficulty</span>
                <FilterChipRow
                  chips={difficultyChips}
                  active={selectedDifficulty}
                  onSelect={setSelectedDifficulty}
                />

                <span className="db-filter-label" style={{ marginTop: 6 }}>Duration</span>
                <FilterChipRow
                  chips={DURATION_CHIPS}
                  active={selectedDuration}
                  onSelect={setSelectedDuration}
                />
              </div>
            </>
          )}

        </div>{/* /inner-card */}

            {/* Footer actions */}
            <div className="db-card-footer">
              <button className="db-btn-secondary" id="btn-browse-scenarios">
                <Search size={13} />
                Browse Scenarios
              </button>
              <button
                className="db-btn-secondary"
                id="btn-view-progress"
                onClick={() => navigate("/results")}
              >
                <BarChart2 size={13} />
                View Full Results
              </button>
            </div>

          </div>{/* /main-card */}

          {/* ── First Run Diagnostic Results Card (Gold/Purple Hero) ── */}
          {hasCompletedDiagnostic && diagnosticData && (
            <div
              className="db-diagnostic-card db-first-run-hero"
              style={{
                background: "linear-gradient(135deg, rgba(254,243,199,0.3) 0%, rgba(238,242,255,0.6) 100%), var(--color-surface-card)",
                border: "1.5px solid #F59E0B",
                borderRadius: "var(--card-radius, 16px)",
                padding: "20px",
                marginTop: "20px",
                boxShadow: "0 4px 16px rgba(245, 158, 11, 0.12)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>🏆</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-ink)" }}>
                        Initial Diagnostic Baseline
                      </h3>
                      <span style={{ fontSize: "10px", fontWeight: "700", background: "#FEF3C7", color: "#B45309", padding: "2px 8px", borderRadius: "12px", border: "1px solid #FCD34D" }}>
                        🔒 LOCKED BASELINE
                      </span>
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--color-ink-secondary)", margin: 0 }}>
                      1st Run diagnostic benchmark (Pre-Test baseline, Post-Test graduation, and 3C initial score)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/results")}
                  className="db-btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 12px", gap: "4px" }}
                >
                  View Details <ChevronRight size={14} />
                </button>
              </div>

              {/* Primary Metric Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
                {/* Baseline Score */}
                <div style={{
                  background: "var(--color-surface-card)",
                  padding: "12px 14px",
                  borderRadius: "var(--lg-radius, 12px)",
                  border: "1px solid var(--color-border-soft)",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pre-Test Baseline</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-ink)", marginTop: "4px" }}>
                    {diagnosticData.preTestScore !== null ? `${diagnosticData.preTestScore}%` : "—"}
                  </div>
                </div>

                {/* Graduation Score */}
                <div style={{
                  background: "var(--color-badge-green-bg)",
                  padding: "12px 14px",
                  borderRadius: "var(--lg-radius, 12px)",
                  border: "1px solid #BBF7D0",
                }}>
                  <div style={{ fontSize: "11px", color: "#15803D", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>Post-Test Mastery</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#166534", marginTop: "4px" }}>
                    {diagnosticData.masteryScore !== null ? `${diagnosticData.masteryScore}%` : "—"}
                  </div>
                </div>

                {/* Improvement Delta */}
                <div style={{
                  background: "var(--color-badge-purple-bg)",
                  padding: "12px 14px",
                  borderRadius: "var(--lg-radius, 12px)",
                  border: "1px solid #DDD6FE",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--color-badge-purple)", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>Growth Delta</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-primary)", marginTop: "4px" }}>
                    {diagnosticData.improvementDelta !== null ? `${diagnosticData.improvementDelta >= 0 ? "+" : ""}${diagnosticData.improvementDelta}%` : "—"}
                  </div>
                </div>

                {/* Primary Focus / Weakness */}
                <div style={{
                  background: "var(--color-surface-card)",
                  padding: "12px 14px",
                  borderRadius: "var(--lg-radius, 12px)",
                  border: "1px solid var(--color-border-soft)",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>Weakness Focus</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-ink)", marginTop: "8px", textTransform: "capitalize" }}>
                    {diagnosticData.postWeaknessTag || diagnosticData.preWeaknessTag || "General Prep"}
                  </div>
                </div>
              </div>

              {/* 3C's Detailed Breakdown Section */}
              {diagnosticData?.threeCBreakdown && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.7)",
                    borderRadius: "var(--lg-radius, 12px)",
                    border: "1px solid var(--color-border-soft)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      📊 3C's Dimension Baseline
                    </div>
                    {diagnosticData.threeCBreakdown.averageOutOf10 !== null && (
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-primary)", background: "var(--color-badge-purple-bg)", padding: "2px 8px", borderRadius: "12px" }}>
                        3C Average: {diagnosticData.threeCBreakdown.averageOutOf10} / 10 ({diagnosticData.threeCBreakdown.averagePercentage}%)
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
                    {/* Clarity */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "var(--color-surface-card)",
                        border: diagnosticData.threeCBreakdown.lowestMetric === "clarity" ? "2px solid #EF4444" : "1px solid var(--color-border-card)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500" }}>🗣️ Clarity</div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-ink)", marginTop: "2px" }}>
                        {diagnosticData.threeCBreakdown.clarity !== null ? `${diagnosticData.threeCBreakdown.clarity} / 10` : "—"}
                      </div>
                      {diagnosticData.threeCBreakdown.lowestMetric === "clarity" && (
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "#EF4444", textTransform: "uppercase", display: "inline-block", marginTop: "2px" }}>
                          🚨 Lowest (Targeted)
                        </span>
                      )}
                    </div>

                    {/* Correctness */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "var(--color-surface-card)",
                        border: diagnosticData.threeCBreakdown.lowestMetric === "correctness" ? "2px solid #EF4444" : "1px solid var(--color-border-card)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500" }}>🎯 Correctness</div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-ink)", marginTop: "2px" }}>
                        {diagnosticData.threeCBreakdown.correctness !== null ? `${diagnosticData.threeCBreakdown.correctness} / 10` : "—"}
                      </div>
                      {diagnosticData.threeCBreakdown.lowestMetric === "correctness" && (
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "#EF4444", textTransform: "uppercase", display: "inline-block", marginTop: "2px" }}>
                          🚨 Lowest (Targeted)
                        </span>
                      )}
                    </div>

                    {/* Completeness */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "var(--color-surface-card)",
                        border: diagnosticData.threeCBreakdown.lowestMetric === "completeness" ? "2px solid #EF4444" : "1px solid var(--color-border-card)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500" }}>📦 Completeness</div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-ink)", marginTop: "2px" }}>
                        {diagnosticData.threeCBreakdown.completeness !== null ? `${diagnosticData.threeCBreakdown.completeness} / 10` : "—"}
                      </div>
                      {diagnosticData.threeCBreakdown.lowestMetric === "completeness" && (
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "#EF4444", textTransform: "uppercase", display: "inline-block", marginTop: "2px" }}>
                          🚨 Lowest (Targeted)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Recent Practice History (Rolling 5-Session Cap) ── */}
          {hasCompletedDiagnostic && (
            <div className="db-history-section" style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>⏱️</span>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--color-ink)" }}>
                    Recent Practice History (Last 5 Sessions)
                  </h3>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: "500" }}>
                  Rolling Cap: Max 5
                </span>
              </div>

              {diagnosticData?.practiceHistory && diagnosticData.practiceHistory.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {diagnosticData.practiceHistory.slice().reverse().map((attempt, idx) => (
                    <div
                      key={attempt._id || idx}
                      className="db-attempt-card"
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1px solid var(--color-border-card)",
                        borderRadius: "var(--lg-radius, 12px)",
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span
                          style={{
                            background: "var(--color-primary-light)",
                            color: "var(--color-primary)",
                            fontSize: "12px",
                            fontWeight: "700",
                            padding: "4px 10px",
                            borderRadius: "var(--pill-radius)",
                          }}
                        >
                          Practice Attempt #{attempt.attemptNumber || (diagnosticData.practiceHistory.length - idx)}
                        </span>

                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-ink)", textTransform: "capitalize" }}>
                              {attempt.role || "Developer"} · {attempt.difficulty || "Easy"}
                            </span>
                            <span className="db-badge db-badge--purple" style={{ fontSize: "10px" }}>
                              🗣️ Focus: {attempt.focusArea || "Auto"}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", marginTop: "2px" }}>
                            {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently"}
                          </div>
                        </div>
                      </div>

                      {/* Attempt Scores */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {attempt.threeCBreakdown && (
                          <div style={{ display: "flex", gap: "6px", fontSize: "11px" }}>
                            <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                              Clarity: <strong>{attempt.threeCBreakdown.clarity ?? "—"}</strong>
                            </span>
                            <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                              Correct: <strong>{attempt.threeCBreakdown.correctness ?? "—"}</strong>
                            </span>
                            <span style={{ background: "var(--color-surface-inner)", padding: "2px 6px", borderRadius: "4px" }}>
                              Complete: <strong>{attempt.threeCBreakdown.completeness ?? "—"}</strong>
                            </span>
                          </div>
                        )}

                        <div style={{ textAlign: "right", minWidth: "60px" }}>
                          <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-primary)" }}>
                            {attempt.overallScorePercentage !== null && attempt.overallScorePercentage !== undefined ? `${attempt.overallScorePercentage}%` : (attempt.threeCBreakdown?.averageOutOf10 ? `${(attempt.threeCBreakdown.averageOutOf10 * 10).toFixed(0)}%` : "—")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1px dashed var(--color-border-soft)",
                    borderRadius: "var(--lg-radius, 12px)",
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--color-ink-muted)",
                    fontSize: "13px",
                  }}
                >
                  No practice attempts logged yet. Launch a practice session above to begin your rolling 5-session history!
                </div>
              )}
            </div>
          )}

          {/* ── Analytics Stats Row ── */}
          <div className="db-stats-row">
            <div className="db-stat-card">
              <div className="db-stat-number">
                {diagnosticData?.masteryScore !== null && diagnosticData?.masteryScore !== undefined
                  ? `${diagnosticData.masteryScore}%`
                  : diagnosticData?.sessionAverages?.practiceSetsAverage?.scorePercentage
                    ? `${diagnosticData.sessionAverages.practiceSetsAverage.scorePercentage}%`
                    : "--"}
              </div>
              <div className="db-stat-label">Avg. 3C's Score</div>
            </div>
            <div className="db-stat-card">
              <div className="db-stat-number">
                {hasCompletedDiagnostic ? "3 / 3" : "0"}
              </div>
              <div className="db-stat-label">Sessions Completed</div>
            </div>
            <div className="db-stat-card">
              <div className="db-stat-number" style={{ fontSize: 16, textTransform: "capitalize" }}>
                {diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "--"}
              </div>
              <div className="db-stat-label">Weak Topic</div>
            </div>
          </div>

        </main>{/* /db-main */}

        {/* ── Right Sidebar ── */}
        <aside className="db-sidebar" aria-label="Sidebar">

          {/* Your Panel */}
          <section className="db-sidebar-section">
            <div className="db-sidebar-section__header">
              <span className="db-sidebar-label">Your Panel</span>
              <button className="db-text-link">Customize</button>
            </div>
            <div className="db-avatar-chips">
              {PANEL_AVATARS.map((a) => (
                <AvatarChip key={a.initial} initial={a.initial} color={a.color} />
              ))}
            </div>
          </section>

          {/* AI Engine */}
          <section className="db-sidebar-section">
            <span className="db-sidebar-label">AI Engine</span>
            <div className="db-ai-status">
              <span>AI Connected</span>
              <div className="db-ai-status__right">
                <span className="db-topnav__ai-dot" style={{ width: 6, height: 6 }} />
                Ready
              </div>
            </div>
          </section>

          {/* Recent Sessions */}
          <section className="db-sidebar-section">
            <div className="db-sidebar-section__header">
              <span className="db-sidebar-label">Recent</span>
              <button className="db-text-link">See all</button>
            </div>
            {RECENT_SESSIONS.length > 0
              ? RECENT_SESSIONS.map((s, i) => <RecentItem key={i} session={s} />)
              : <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>No sessions yet.</span>
            }
          </section>

          {/* Quick Launch */}
          <section className="db-sidebar-section">
            <span className="db-sidebar-label">Quick Launch</span>
            {QUICK_LAUNCH.map((item) => (
              <QuickLaunchItem key={item.title} item={item} />
            ))}
          </section>

          {/* Weekly Goal */}
          <section className="db-sidebar-section">
            <div className="db-sidebar-section__header">
              <span className="db-sidebar-label">Weekly Goal</span>
              <span className="db-goal-fraction">0 / 5</span>
            </div>
            <div className="db-progress-track">
              <div className="db-progress-fill" style={{ width: "0%" }} />
            </div>
            <div className="db-stat-mini-row">
              <div className="db-stat-mini">
                <span className="db-stat-mini__num">0</span>
                <span className="db-stat-mini__lbl">Sessions</span>
              </div>
              <div className="db-stat-mini">
                <span className="db-stat-mini__num">--</span>
                <span className="db-stat-mini__lbl">Avg Score</span>
              </div>
            </div>
          </section>

        </aside>

      </div>{/* /db-body */}
    </div>
  );
}

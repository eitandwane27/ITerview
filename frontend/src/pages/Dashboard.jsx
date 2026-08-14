import React, { useState, useEffect, useCallback, memo } from "react";
import {
  LogOut,
  BarChart2,
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
  MessageSquare,
  Target,
  PackageCheck,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
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

const NAV_TABS = ["Interview Prep", "History"];

const TAB_ICONS = {
  "Interview Prep": Mic,
  History: History,
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

// Display names for the 3C metric keys returned by the backend breakdown —
// used whenever copy must name the actual lowest metric (never hardcode it).
const METRIC_LABELS = {
  clarity: "Clarity",
  correctness: "Correctness",
  completeness: "Completeness",
};

// Session facts — mirror the backend set contract: every practice set is exactly
// 5 questions (generated upfront in set1/2/3Socket; the resume banner shows
// "Q{n}/5"). The rolling history cap is enforced server-side with $push + $slice: -20
// (backend/routes/userRoutes.js and backend/controllers/set3Socket.js).
const QUESTIONS_PER_SESSION = 5;
const PRACTICE_HISTORY_LIMIT = 20;

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

// Live clock, isolated behind memo so its 1s tick never re-renders the
// Dashboard tree — the interval's state lives in this component only.
const LiveClock = memo(function LiveClock() {
  const time = useClock();
  return (
    <time className="db-clock" aria-label="Current time">
      {time}
    </time>
  );
});

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const BaselineCard = memo(function BaselineCard({
  baseline,
  mastery,
  growth,
  clarity,
  correctness,
  completeness,
  lowest,
  onViewDetails,
}) {
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
        <div className="db-progression">
          <div className="db-progression__label">BASELINE → MASTERY</div>
          <div className="db-progression__scores">
            <div className="db-progression__baseline">{baseline != null ? `${baseline}%` : "—"}</div>
            <ArrowRight size={18} className="db-progression__arrow" aria-hidden="true" />
            <div className="db-progression__mastery">{mastery != null ? `${mastery}%` : "—"}</div>
          </div>
          {growth != null && (
            <div className="db-delta-pill">
              <TrendingUp size={12} className="db-delta-pill__icon" aria-hidden="true" />
              <div className="db-delta-pill__text">
                {growth >= 0 ? "+" : ""}{growth}% growth
              </div>
            </div>
          )}
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
            <div className="db-3c-cell__score db-3c-cell__score--clarity">{clarity != null ? `${clarity} / 10` : "—"}</div>
          </div>

          <div className={`db-3c-cell db-3c-cell--correctness ${lowest === "correctness" ? "db-3c-cell--lowest" : ""}`}>
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <Target size={13} className="db-3c-cell__icon db-3c-cell__icon--correctness" />
                <span className="db-3c-cell__name">Correctness</span>
              </span>
              {lowest === "correctness" && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--correctness">{correctness != null ? `${correctness} / 10` : "—"}</div>
          </div>

          <div className={`db-3c-cell db-3c-cell--completeness ${lowest === "completeness" ? "db-3c-cell--lowest" : ""}`}>
            <div className="db-3c-cell__head">
              <span className="db-3c-cell__name-wrap">
                <PackageCheck size={13} className="db-3c-cell__icon db-3c-cell__icon--completeness" />
                <span className="db-3c-cell__name">Completeness</span>
              </span>
              {lowest === "completeness" && <span className="db-3c-tag">Lowest · targeted</span>}
            </div>
            <div className="db-3c-cell__score db-3c-cell__score--completeness">{completeness != null ? `${completeness} / 10` : "—"}</div>
          </div>
        </div>
      </div>
    </section>
  );
});

// ─── Metrics state components (loading / empty / error) ────────

const MetricsStates = memo(function MetricsStates({ dataStatus, onRetry }) {
  if (dataStatus === "loading") {
    return (
      <div className="db-baseline-card db-baseline-card--loading" aria-hidden="true">
        <div className="db-skeleton db-skeleton--baseline-title" />
        <div className="db-skeleton db-skeleton--baseline-body" />
      </div>
    );
  }

  if (dataStatus === "error") {
    return (
      <div className="db-baseline-card db-metrics-card db-metrics-card--error" role="alert">
        <div className="db-metrics-card__icon">
          <AlertCircle size={20} />
        </div>
        <div className="db-metrics-card__text">
          <h2 className="db-metrics-card__title">Couldn't load your dashboard</h2>
          <p className="db-metrics-card__sub">
            We couldn't fetch your session data. Check your connection and try again.
          </p>
        </div>
        <button type="button" className="db-btn-secondary" onClick={onRetry}>
          <RotateCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="db-baseline-card db-metrics-card">
      <div className="db-metrics-card__icon">
        <Gauge size={20} />
      </div>
      <div className="db-metrics-card__text">
        <h2 className="db-metrics-card__title">Your diagnostic baseline</h2>
        <p className="db-metrics-card__sub">
          Complete your pre-test to unlock your 3C scores, baseline, and growth metrics.
        </p>
      </div>
    </div>
  );
});

// ─── History components ───────────────────────────────────────────────────────

// One row in the practice log — memoized so the list never re-renders when
// unrelated dashboard state changes (attempt objects keep stable references).
const AttemptCard = memo(function AttemptCard({ attempt }) {
  return (
    <div className="db-attempt-card">
      <div className="db-attempt-card__left">
        <span className="db-attempt-badge">
          {attempt.attemptNumber != null ? `Attempt #${attempt.attemptNumber}` : "Practice session"}
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
  );
});

// Practice history panel — memoized; re-renders only when its data changes.
const HistoryPanel = memo(function HistoryPanel({ dataStatus, practiceHistory }) {
  const history = practiceHistory || [];

  return (
    <section className="db-setup-card db-history-card">
      <div className="db-setup-card__header">
        <div className="db-setup-card__text">
          <h2 className="db-setup-card__title">
            <History size={17} className="db-setup-card__title-icon" />
            Practice History & Session Logs
          </h2>
          <p className="db-setup-card__sub">
            Your past practice sessions, 3C breakdowns, and rolling history.
          </p>
        </div>
        <span className="db-history-badge">Max {PRACTICE_HISTORY_LIMIT} Rolling History</span>
      </div>

      {dataStatus === "loading" ? (
        <div className="db-history-skeleton" aria-hidden="true">
          <div className="db-skeleton db-skeleton--history-row" />
          <div className="db-skeleton db-skeleton--history-row" />
        </div>
      ) : dataStatus === "error" ? (
        <div className="db-empty">
          Couldn't load your practice history. Check your connection and try again.
        </div>
      ) : history.length > 0 ? (
        <div className="db-history-list">
          {history.slice().reverse().map((attempt, idx) => (
            <AttemptCard key={attempt._id || idx} attempt={attempt} />
          ))}
        </div>
      ) : (
        <div className="db-empty">
          No practice attempts logged yet. Launch a practice session above to begin your rolling{" "}
          {PRACTICE_HISTORY_LIMIT}-session history!
        </div>
      )}
    </section>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
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
  const [dataStatus, setDataStatus] = useState("loading"); // "loading" | "ready" | "empty" | "error"
  const [formError, setFormError] = useState(null);

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editFocus, setEditFocus] = useState("auto");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
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
    setDataStatus("loading");
    const initial = (user.displayName || user.email || "U")[0].toUpperCase();
    setUserName(initial);
    setFullName(
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "User")
    );

    let userLoadOk = false;
    let summaryOk = false;
    let completedDiagnostic = false;
    let summaryData = null;

    try {
      const [res, summaryRes, activeRes] = await Promise.all([
        fetch(`/api/users/${user.uid}`),
        fetch(`/api/users/results-summary?uid=${user.uid}`),
        fetch(`/api/users/active-practice-session?uid=${user.uid}`),
      ]);

      if (res.ok) {
        userLoadOk = true;
        const data = await res.json();
        if (data.user?.role) setSelectedRole(data.user.role);
        if (data.user?.unlockedDifficulty) setUnlockedDifficulty(data.user.unlockedDifficulty);
        if (data.user?.focusArea) setSelectedFocus(data.user.focusArea);
        if (data.user?.displayName) setFullName(data.user.displayName);
        if (data.hasCompletedDiagnostic !== undefined) {
          completedDiagnostic = Boolean(data.hasCompletedDiagnostic);
          setHasCompletedDiagnostic(completedDiagnostic);
        }
      }

      if (summaryRes.ok) {
        summaryOk = true;
        summaryData = await summaryRes.json();
        setDiagnosticData(summaryData);
      }

      if (activeRes && activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveSession(activeData);
      }
    } catch (err) {
      console.error("Error fetching user details or summary:", err);
      setDataStatus("error");
      return;
    }

    if (!userLoadOk) {
      setDataStatus("error");
      return;
    }
    setDataStatus(completedDiagnostic ? (summaryOk && summaryData ? "ready" : "error") : "empty");
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

  const retryLoad = useCallback(() => {
    if (auth.currentUser) fetchUserData(auth.currentUser);
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

  // Stable navigation callback so memoized children (BaselineCard) skip re-renders.
  const handleViewResults = useCallback(() => navigate("/results"), [navigate]);

  // Open profile modal — seed edit fields from current state
  const handleOpenProfileModal = useCallback(() => {
    setEditName(fullName);
    setEditRole(selectedRole);
    setEditFocus(selectedFocus);
    setProfileError(null);
    setIsProfileModalOpen(true);
  }, [fullName, selectedRole, selectedFocus]);

  const handleCloseProfileModal = useCallback(() => {
    if (isSavingProfile) return; // prevent close during save
    setIsProfileModalOpen(false);
    setProfileError(null);
  }, [isSavingProfile]);

  // Save profile: update Firebase Auth displayName + MongoDB via PUT /api/users/role
  const handleSaveProfile = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const trimmedName = editName.trim();
    setIsSavingProfile(true);
    setProfileError(null);

    try {
      // 1. Update Firebase Auth profile (displayName field)
      await updateProfile(firebaseUser, { displayName: trimmedName || null });

      // 2. Persist displayName + role + focusArea to MongoDB in one atomic call
      const res = await fetch("/api/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          displayName: trimmedName,
          role: editRole || selectedRole,
          focusArea: editFocus || selectedFocus,
        }),
      });

      if (!res.ok) throw new Error("Failed to save profile");

      // 3. Update local state immediately for a snappy UX
      const displayedName = trimmedName ||
        (firebaseUser.email ? firebaseUser.email.split("@")[0] : "User");
      setFullName(displayedName);
      setUserName(displayedName[0].toUpperCase());
      if (editRole) setSelectedRole(editRole);
      if (editFocus) setSelectedFocus(editFocus);

      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Error saving profile:", err);
      setProfileError("Failed to save your profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }, [editName, editRole, editFocus, selectedRole, selectedFocus]);

  // WAI-ARIA tabs pattern: arrow-key navigation across the tablist
  const handleTabKeyDown = useCallback(
    (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const currentIdx = NAV_TABS.indexOf(activeTab);
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const nextTab = NAV_TABS[(currentIdx + dir + NAV_TABS.length) % NAV_TABS.length];
      setActiveTab(nextTab);
      document.getElementById(`tab-${nextTab.toLowerCase().replace(/ /g, "-")}`)?.focus();
    },
    [activeTab]
  );

  const handleStartSession = useCallback(async () => {
    if (!selectedRole) {
      setFormError("Select a target role to continue.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setFormError("Please log in first.");
      return;
    }
    setFormError(null);

    try {
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
      setFormError("Failed to save your target role. Please try again.");
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

  // Derived display values — real data only; null until a diagnostic exists
  const breakdown = diagnosticData?.threeCBreakdown || {};
  const clarity = breakdown.clarity ?? null;
  const correctness = breakdown.correctness ?? null;
  const completeness = breakdown.completeness ?? null;
  const lowestMetric = breakdown.lowestMetric || null;
  const lowestLabel = lowestMetric ? METRIC_LABELS[lowestMetric] || null : null;
  const lowestScore = lowestMetric != null ? (breakdown[lowestMetric] ?? null) : null;
  const baselineScore = diagnosticData?.preTestScore ?? null;
  const masteryScore = diagnosticData?.masteryScore ?? null;
  const growthDelta =
    diagnosticData?.improvementDelta != null
      ? diagnosticData.improvementDelta
      : baselineScore != null && masteryScore != null
        ? masteryScore - baselineScore
        : null;
  const avg3C = diagnosticData?.threeCBreakdown?.averagePercentage ?? diagnosticData?.masteryScore ?? null;
  const weakTopic = diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || null;
  const sessionsCount = diagnosticData?.practiceHistory?.length ?? 0;

  const roleSummary = ROLE_SUMMARY[selectedRole] || "Select role";
  const focusSummary = FOCUS_SUMMARY[selectedFocus] || "Select focus";

  return (
    <div className="db-root" data-theme={theme}>

      {/* ── Top Nav ── */}
      <header className="db-topnav">
        {/* Logo Group */}
        <div className="db-topnav__logo-group">
          <div className="db-logo-mark">
            <Zap size={18} />
          </div>
          <span className="db-topnav__wordmark">ITerview</span>
        </div>

        {/* Tab Row */}
        <nav
          className="db-tab-row"
          role="tablist"
          aria-label="Dashboard sections"
          onKeyDown={handleTabKeyDown}
        >
          {NAV_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const tabId = `tab-${tab.toLowerCase().replace(/ /g, "-")}`;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab.toLowerCase().replace(/ /g, "-")}`}
                tabIndex={activeTab === tab ? 0 : -1}
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
          <button
            type="button"
            className="db-user-avatar"
            onClick={handleOpenProfileModal}
            title="Edit profile"
            aria-label="Open profile settings"
            id="btn-profile-avatar"
          >
            {userName}
          </button>
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
          <div className="db-page-header__actions">
            {dataStatus !== "loading" &&
              (hasCompletedDiagnostic ? (
                <button
                  type="button"
                  className="db-status-chip db-status-chip--active"
                  onClick={handleViewResults}
                  title="View your diagnostic results"
                >
                  <span className="db-pulse-dot" aria-hidden="true" />
                  <span className="db-status-chip__label">Diagnostic active — practice mode</span>
                  <ArrowRight size={13} className="db-status-chip__arrow" aria-hidden="true" />
                </button>
              ) : (
                <span className="db-status-chip db-status-chip--pending" role="status">
                  <span className="db-pulse-dot" aria-hidden="true" />
                  <span className="db-status-chip__label">Pre-test pending</span>
                </span>
              ))}
            <LiveClock />
          </div>
        </div>

        {/* ══ Interview Prep Panel ══ */}
        <div
          role="tabpanel"
          id="tabpanel-interview-prep"
          aria-labelledby="tab-interview-prep"
          hidden={activeTab !== "Interview Prep"}
        >
          {activeTab === "Interview Prep" && (
            <div className="db-practice-grid">
            {/* ── Snapshot strip — full-width glance (real data only) ── */}
            {dataStatus === "ready" && (
              <div className="db-stats-row">
                <div className="db-stat-card">
                  <div className="db-stat-card__label">
                    <span className="db-stat-dot db-stat-dot--cyan" aria-hidden="true" />
                    AVG 3C SCORE
                  </div>
                  <div className="db-stat-card__value-row">
                    <span className="db-stat-card__value">{avg3C != null ? `${avg3C}%` : "—"}</span>
                    {growthDelta != null && (
                      <span className="db-stat-card__delta">
                        {growthDelta >= 0 ? "+" : ""}{growthDelta}% vs baseline
                      </span>
                    )}
                  </div>
                </div>
                <div className="db-stat-card">
                  <div className="db-stat-card__label">
                    <span className="db-stat-dot db-stat-dot--violet" aria-hidden="true" />
                    SESSIONS
                  </div>
                  <div className="db-stat-card__value-row">
                    <span className="db-stat-card__value">{sessionsCount}</span>
                    <span className="db-stat-card__meta">in history</span>
                  </div>
                </div>
                <div className="db-stat-card">
                  <div className="db-stat-card__label">
                    <span className="db-stat-dot db-stat-dot--amber" aria-hidden="true" />
                    WEAK TOPIC
                  </div>
                  <div className="db-stat-card__value-row">
                    <span className="db-stat-card__value db-stat-card__value--topic">{weakTopic || "—"}</span>
                    {weakTopic && <span className="db-stat-card__delta">AI targeted</span>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Session Console — configure & launch ── */}
            <section className="db-setup-card">
              <div className="db-setup-card__header">
                <div className="db-setup-card__text">
                  <h2 className="db-setup-card__title">Start a practice session</h2>
                  <p className="db-setup-card__sub">Set your parameters — change them anytime.</p>
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
                      onChange={(e) => {
                        setSelectedRole(e.target.value);
                        if (formError) setFormError(null);
                      }}
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
                  <div className="db-select-wrap">
                    <Sparkles size={17} className="db-select-wrap__icon db-select-wrap__icon--violet" />
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
                          ? lowestLabel
                            ? `${lowestLabel} is your lowest 3C metric at ${lowestScore != null ? `${lowestScore}/10` : "—"} — this session prioritizes it.`
                            : "Your baseline diagnostic will drive the AI recommendation for this session."
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
                          <p className="db-insight-card__body-text db-insight-card__body-text--verified">
                            <Check size={13} className="db-insight-verify-icon" aria-hidden="true" />
                            <span>
                              <strong>Verification:</strong> Your lowest metric is{" "}
                              <strong className="db-insight-strong">
                                {breakdown.lowestMetric || diagnosticData?.postWeaknessTag || diagnosticData?.preWeaknessTag || "—"}
                              </strong>{" "}
                              — AI Auto-Detect has targeted this dimension for your next practice set.
                            </span>
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
                  {roleSummary} · {focusSummary} · {QUESTIONS_PER_SESSION} questions
                </span>
                <button
                  type="button"
                  id="btn-start-pretest"
                  className="db-cta-btn"
                  onClick={handleStartSession}
                  disabled={!selectedRole || dataStatus === "loading"}
                >
                  <Play size={17} />
                  {dataStatus === "loading"
                    ? "Loading…"
                    : hasCompletedDiagnostic
                      ? (activeSession?.hasActiveSession
                          ? `Resume Set ${activeSession.activeSet} Practice`
                          : "Start Practice Session")
                      : "Start Pre-Test"}
                </button>
              </div>
              {dataStatus !== "loading" && !selectedRole && !formError && (
                <p className="db-cta-helper">Select a target role to continue.</p>
              )}
              {formError && (
                <p className="db-form-error" role="alert">
                  <AlertCircle size={15} />
                  {formError}
                </p>
              )}
            </section>

            {/* ── Signal Deck — baseline diagnostic (real data only) ── */}
            <div className="db-signal-deck">
              {dataStatus === "ready" ? (
                <BaselineCard
                  baseline={baselineScore}
                  mastery={masteryScore}
                  growth={growthDelta}
                  clarity={clarity}
                  correctness={correctness}
                  completeness={completeness}
                  lowest={lowestMetric}
                  onViewDetails={handleViewResults}
                />
              ) : (
                <MetricsStates dataStatus={dataStatus} onRetry={retryLoad} />
              )}
            </div>
            </div>
          )}
        </div>

        {/* ══ History Panel ══ */}
        <div role="tabpanel" id="tabpanel-history" aria-labelledby="tab-history" hidden={activeTab !== "History"}>
          {activeTab === "History" && (
            <HistoryPanel dataStatus={dataStatus} practiceHistory={diagnosticData?.practiceHistory} />
          )}
        </div>

      </main>{/* /db-content */}

      {/* ── Profile Settings Modal ── */}
      {isProfileModalOpen && (
        <div
          className="db-modal-backdrop"
          onClick={handleCloseProfileModal}
          role="dialog"
          aria-modal="true"
          aria-label="Profile settings"
        >
          <div
            className="db-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="db-modal__header">
              <div className="db-modal__header-text">
                <h2 className="db-modal__title">Profile Settings</h2>
                <p className="db-modal__sub">Update your display name, role, and focus area.</p>
              </div>
              <button
                type="button"
                className="db-modal__close"
                onClick={handleCloseProfileModal}
                aria-label="Close profile settings"
                disabled={isSavingProfile}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="db-modal__body">
              {/* Display Name */}
              <div className="db-modal__field">
                <label htmlFor="modal-display-name" className="db-modal__label">
                  DISPLAY NAME
                </label>
                <input
                  id="modal-display-name"
                  type="text"
                  className="db-modal__input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name (shown in greeting)"
                  maxLength={60}
                  disabled={isSavingProfile}
                  autoComplete="off"
                />
                <p className="db-modal__hint">
                  Shown as &ldquo;Good morning, {editName || "…"}&rdquo;
                </p>
              </div>

              {/* Target Role */}
              <div className="db-modal__field">
                <label htmlFor="modal-role" className="db-modal__label">
                  TARGET ROLE
                </label>
                <div className="db-select-wrap">
                  <Briefcase size={17} className="db-select-wrap__icon db-select-wrap__icon--violet" />
                  <select
                    id="modal-role"
                    className="db-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={isSavingProfile}
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

              {/* Focus Area */}
              <div className="db-modal__field">
                <label htmlFor="modal-focus" className="db-modal__label">
                  3C FOCUS AREA
                </label>
                <div className="db-select-wrap">
                  <Sparkles size={17} className="db-select-wrap__icon db-select-wrap__icon--violet" />
                  <select
                    id="modal-focus"
                    className="db-select"
                    value={editFocus}
                    onChange={(e) => setEditFocus(e.target.value)}
                    disabled={isSavingProfile}
                  >
                    {FOCUS_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={17} className="db-select-wrap__chevron" />
                </div>
              </div>

              {/* Error message */}
              {profileError && (
                <p className="db-form-error" role="alert">
                  <AlertCircle size={15} />
                  {profileError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="db-modal__footer">
              <button
                type="button"
                className="db-btn-secondary"
                onClick={handleCloseProfileModal}
                disabled={isSavingProfile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="db-cta-btn"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                id="btn-save-profile"
              >
                {isSavingProfile ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
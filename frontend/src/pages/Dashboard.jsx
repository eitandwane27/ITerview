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
  const [selectedCompany,  setSelectedCompany]  = useState("Default");
  const [selectedDuration, setSelectedDuration] = useState("20m");
  const [userName,         setUserName]         = useState("U");
  const [unlockedDifficulty, setUnlockedDifficulty] = useState("easy");

  // Fetch saved role + user display info on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Derive a single-letter initial from email or displayName
        const initial = (user.displayName || user.email || "U")[0].toUpperCase();
        setUserName(initial);

        try {
          const res = await fetch(`/api/users/${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.user?.role) setSelectedRole(data.user.role);
            if (data.user?.unlockedDifficulty) setUnlockedDifficulty(data.user.unlockedDifficulty);
          }
        } catch (err) {
          console.error("Error fetching user details:", err);
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

  const handleStartPreTest = useCallback(async () => {
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
        }),
      });

      if (!res.ok) throw new Error("Failed to save role");
      console.log("Role saved to MongoDB.");
      navigate("/likert-pre");
    } catch (err) {
      console.error("Error saving role:", err);
      alert("Failed to save target role. Please try again.");
    }
  }, [selectedRole, selectedDifficulty, navigate]);

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
              {["Interview Prep", "Pitch Mode", "Scenario"].map((tab) => (
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

              {/* Primary CTA */}
              <button
                id="btn-start-pretest"
                className="db-btn-primary"
                onClick={handleStartPreTest}
                disabled={!selectedRole}
              >
                Start Pre-Test
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

            </div>{/* /inner-card */}

            {/* Footer actions */}
            <div className="db-card-footer">
              <button className="db-btn-secondary" id="btn-browse-scenarios">
                <Search size={13} />
                Browse Scenarios
              </button>
              <button className="db-btn-secondary" id="btn-view-progress">
                <BarChart2 size={13} />
                View Progress
              </button>
            </div>

          </div>{/* /main-card */}

          {/* ── Analytics Stats Row ── */}
          <div className="db-stats-row">
            <div className="db-stat-card">
              <div className="db-stat-number">--</div>
              <div className="db-stat-label">Avg. 3C's Score</div>
            </div>
            <div className="db-stat-card">
              <div className="db-stat-number">0</div>
              <div className="db-stat-label">Sessions Completed</div>
            </div>
            <div className="db-stat-card">
              <div className="db-stat-number">--</div>
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

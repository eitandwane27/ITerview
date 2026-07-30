import React, { useState } from "react";
import "./LandingPage.css";

/* ─── SVG Icons ─── */
const SparklesIcon = () => (
  <svg viewBox="0 0 14 14" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.846 0.588q-0.28 0.041-0.547 0.226-0.294 0.208-0.407 0.574l-0.342 1.757-0.359 1.764-0.109 0.161-0.154 0.113-0.475 0.123-1.289 0.239-1.777 0.349q-0.239 0.072-0.444 0.27-0.202 0.195-0.294 0.441-0.089 0.243-0.062 0.502 0.027 0.256 0.167 0.496 0.099 0.167 0.273 0.308 0.174 0.14 0.359 0.198 0.096 0.027 1.764 0.349l1.285 0.253 0.506 0.109 0.154 0.113 0.099 0.167 0.109 0.506 0.239 1.244 0.349 1.764q0.154 0.465 0.588 0.673 0.267 0.14 0.52 0.14 0.253 0 0.52-0.14 0.434-0.208 0.588-0.673l0.342-1.747 0.342-1.723 0.126-0.208 0.212-0.144 1.733-0.342 1.75-0.342q0.465-0.154 0.673-0.588 0.267-0.52 0-1.039-0.099-0.208-0.28-0.362-0.181-0.154-0.393-0.226-0.096-0.027-1.777-0.349l-1.23-0.239-0.506-0.109-0.154-0.085-0.154-0.239-0.342-1.733-0.342-1.75q-0.14-0.465-0.605-0.687-0.14-0.072-0.314-0.099-0.174-0.027-0.342-0.014z" fill="#fff"/>
  </svg>
);

const ShieldCheckIcon = () => (
  <svg viewBox="0 0 14 14" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.846 0.602q-0.349 0.027-0.687 0.308-0.516 0.42-1.001 0.701-0.482 0.28-1.015 0.475-0.308 0.113-0.588 0.171-0.28 0.055-0.67 0.082-0.239 0.014-0.366 0.072-0.195 0.068-0.379 0.222-0.181 0.154-0.263 0.349l-0.014 0.031-0.085 0.222-0.027 0.602 0 1.781q0 2.252 0.014 2.461 0.14 1.654 1.107 2.885 0.14 0.167 0.434 0.461 0.294 0.294 0.489 0.448 0.923 0.742 2.283 1.275 0.461 0.181 0.656 0.239 0.239 0.055 0.434 0.014 0.167-0.027 0.533-0.154 1.357-0.52 2.28-1.203 0.379-0.267 0.714-0.605 1.374-1.371 1.542-3.374 0.014-0.236 0.014-2.461 0-2.229-0.027-2.355-0.072-0.321-0.318-0.564-0.243-0.246-0.55-0.318-0.099-0.027-0.379-0.041-0.489-0.027-0.964-0.181-0.813-0.267-1.555-0.773-0.267-0.181-0.643-0.489-0.42-0.335-0.967-0.28z" fill="#fff"/>
  </svg>
);

const LayersIcon = () => (
  <svg viewBox="0 0 14 14" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.846 0.602q-0.267 0.014-0.506 0.113-0.137 0.055-2.574 1.169-2.437 1.114-2.557 1.169-0.12 0.055-0.26 0.195-0.137 0.14-0.208 0.253-0.239 0.434-0.099 0.919 0.14 0.482 0.574 0.69 0.154 0.085 2.625 1.207 2.471 1.118 2.57 1.159 0.267 0.099 0.567 0.106 0.301 0.007 0.581-0.092l2.526-1.131 2.444-1.107 2.666-1.22q0.267-0.126 0.407-0.321 0.267-0.335 0.267-0.735 0-0.4-0.267-0.735-0.14-0.181-0.376-0.294l-2.55-1.176-2.574-1.162q-0.226-0.099-0.451-0.113l-0.167-0.014z M0.71 6.252l-0.267 0.185-0.126 0.168-0.041 0.42 0.027 0.209 0.103 0.366 0.159 0.307 0.232 0.228 0.311 0.222 2.669 1.213 2.484 1.125q0.547 0.185 1.097 0.014l2.519-1.131 2.451-1.107 2.687-1.234q0.311-0.14 0.485-0.42 0.174-0.28 0.174-0.615 0-0.14-0.041-0.253l-0.294-0.294-0.219-0.041-0.229 0.027-0.246 0.191-0.133 0.27v0.099l-2.505 1.135-2.563 1.148q-0.181 0.068-0.376 0-0.085-0.027-2.563-1.162l-2.478-1.121-0.027-0.113q-0.041-0.222-0.205-0.349-0.161-0.126-0.369-0.126-0.113 0-0.181 0.027z M0.806 9.15l-0.123 0.014-0.243 0.099-0.191 0.195-0.082 0.42 0.027 0.208 0.103 0.365 0.233 0.308 0.155 0.153 0.311 0.222 2.775 1.275 2.403 1.077q0.557 0.171 1.118-0.041l2.659-1.203 2.509-1.148 2.577-1.19q0.212-0.126 0.359-0.349 0.147-0.226 0.181-0.479 0.034-0.253-0.058-0.427-0.089-0.174-0.27-0.26-0.099-0.041-0.226-0.048-0.126-0.007-0.208 0.021-0.154 0.058-0.26 0.191-0.106 0.13-0.133 0.284l-0.014 0.085-2.492 1.135-2.492 1.135q-0.167 0.055-0.362-0.014l-2.577-1.162-2.478-1.135v-0.041q0-0.058-0.044-0.161-0.041-0.106-0.082-0.147-0.208-0.267-0.547-0.212z" fill="#fff"/>
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 14 14" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.522 1.764q-0.14 0.041-0.267 0.167-0.167 0.154-0.174 0.373-0.007 0.215 0.126 0.386 0.133 0.167 0.355 0.222 0.099 0.014 0.981 0.014l0.882 0 0 1.148-1.429 0q-1.104 0-1.449 0.014-0.342 0.014-0.496 0.055-0.434 0.126-0.749 0.42-0.314 0.294-0.455 0.714-0.072 0.198-0.085 0.4-0.014 0.202-0.014 0.96l0 0.937-0.349 0q-0.267 0.014-0.332 0.021-0.062 0.007-0.133 0.048-0.236 0.099-0.321 0.338-0.082 0.236 0.027 0.461 0.044 0.068 0.12 0.14 0.079 0.068 0.154 0.106 0.079 0.034 0.14 0.041 0.065 0.007 0.332 0.021l0.362 0 0 1.791q0.014 0.167 0.027 0.294 0.099 0.448 0.379 0.786 0.28 0.335 0.701 0.502 0.154 0.058 0.308 0.099 0.126 0.014 0.643 0.027l3.192 0 3.192 0q0.516-0.014 0.643-0.041 0.533-0.099 0.902-0.468 0.373-0.373 0.485-0.906 0.014-0.126 0.027-0.294l0-1.791 0.362 0q0.267-0.014 0.328-0.021 0.065-0.007 0.14-0.041 0.079-0.038 0.154-0.106 0.079-0.072 0.113-0.14 0.038-0.072 0.051-0.181 0.041-0.198-0.051-0.366-0.089-0.167-0.284-0.267-0.072-0.027-0.137-0.034-0.062-0.007-0.328-0.021l-0.349 0 0-0.937q0-0.759-0.014-0.96-0.014-0.202-0.085-0.4-0.14-0.42-0.455-0.714-0.314-0.294-0.749-0.42-0.154-0.041-0.499-0.055-0.342-0.014-1.446-0.014l-1.429 0 0-0.923q0-0.673 0-0.813 0-0.14-0.027-0.208-0.085-0.212-0.294-0.325l-0.099-0.041-1.289-0.014q-1.275 0-1.343 0.014z M3.678 5.305l0.099 0.041 0 4.648-0.055 0.085q-0.099 0.181-0.267 0.28l-0.085 0.041-7.335 0 0 0-7.335 0 0 0 0 0-0.085-0.041q-0.167-0.099-0.267-0.28l-0.055-0.085 0-4.635 0.027-0.403 0.167-0.232 0.119-0.133 0.239-0.133 3.681-0.014 3.613 0.014z M5.111 7.014q-0.126 0.027-0.239 0.133-0.109 0.106-0.167 0.232-0.027 0.068-0.027 0.181 0 0.113 0 0.629l0 0.728 0.041 0.085 0.126 0.154 0.161 0.126 0.246 0.041 0.243-0.041 0.161-0.126 0.13-0.154 0.041-0.085 0-0.728q0-0.516 0-0.629 0-0.113-0.027-0.181-0.085-0.198-0.273-0.301-0.188-0.106-0.414-0.065z M8.611 7.014q-0.126 0.027-0.239 0.133-0.109 0.106-0.167 0.232-0.027 0.068-0.027 0.181 0 0.113 0 0.629l0 0.728 0.041 0.085 0.126 0.154 0.161 0.126 0.246 0.041 0.243-0.041 0.161-0.126 0.13-0.154 0.041-0.085 0-0.728q0-0.516 0-0.629 0-0.113-0.027-0.181-0.085-0.198-0.273-0.301-0.188-0.106-0.414-0.065z" fill="#09090B"/>
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 14 14" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.9 0.588q-0.643 0.027-1.183 0.386-0.537 0.355-0.803 0.93-0.14 0.28-0.198 0.547-0.027 0.096-0.027 0.475l-0.014 4.409 0.041 0.167q0.198 0.786 0.759 1.261 0.434 0.366 1.022 0.52 0.109 0.027 0.191 0.034 0.085 0.007 0.311 0.007 0.28 0 0.434-0.027 0.154-0.027 0.379-0.113 0.461-0.167 0.824-0.523 0.366-0.359 0.547-0.834 0.041-0.126 0.085-0.294l0.055-0.171 0-4.156q0-0.489-0.027-0.687-0.014-0.126-0.072-0.294l-0.014-0.027q-0.236-0.701-0.803-1.135-0.567-0.434-1.309-0.475l-0.198 0z" fill="#9CA3AF"/>
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 14 14" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.976 2.953q-0.561 0.126-0.933 0.54-0.369 0.414-0.441 0.988-0.027 0.154-0.027 2.519 0 2.365 0.027 2.519 0.027 0.308 0.167 0.588 0.154 0.325 0.441 0.564 0.287 0.236 0.653 0.349l0.154 0.055 6.467 0 0.154-0.055q0.366-0.113 0.653-0.349 0.287-0.239 0.441-0.564 0.109-0.236 0.15-0.451 0.044-0.219 0.044-0.625l0-0.349 1.094 0.728q1.104 0.742 1.203 0.769 0.335 0.126 0.643 0 0.181-0.072 0.321-0.226 0.14-0.154 0.198-0.335 0.014-0.072 0.027-0.448l0-2.184 0-2.17q-0.014-0.379-0.027-0.461-0.085-0.308-0.366-0.489-0.28-0.185-0.602-0.126-0.126 0.014-0.232 0.062-0.103 0.048-1.183 0.68l-1.077 0.629 0-0.239q0-0.236-0.027-0.39-0.072-0.574-0.451-0.995-0.376-0.42-0.937-0.533-0.109-0.027-0.574-0.027l-2.7 0-2.673 0q-0.479 0.014-0.588 0.027z" fill="#9CA3AF"/>
  </svg>
);

const MessageIcon = () => (
  <svg viewBox="0 0 14 14" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.976 1.203q-0.393 0.085-0.718 0.338-0.321 0.25-0.502 0.615-0.126 0.28-0.167 0.588-0.014 0.167 0 5.011l0 4.173q0.014 0.684 0.027 0.755 0.113 0.335 0.373 0.533 0.26 0.195 0.581 0.195 0.236 0 0.461-0.113 0.099-0.041 0.222-0.161 0.126-0.12 0.66-0.636l0.827-0.786 0.082-0.041 8.094-0.014 0.167-0.041q0.253-0.072 0.441-0.181 0.188-0.113 0.369-0.294 0.185-0.185 0.294-0.373 0.113-0.188 0.185-0.441l0.041-0.167 0.014-6.299q-0.014-0.813-0.027-1.08-0.014-0.195-0.041-0.335-0.14-0.475-0.506-0.81-0.362-0.338-0.841-0.438" fill="#9CA3AF"/>
  </svg>
);

const HandIcon = () => (
  <svg viewBox="0 0 14 14" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.833 0.602q-0.506 0.041-0.919 0.373-0.41 0.328-0.564 0.79l-0.044 0.099-0.123-0.027q-0.434-0.14-0.885-0.041-0.448 0.096-0.79 0.396-0.342 0.301-0.482 0.721l-0.014 0.027-0.058 0.239-0.027 0.547 0 3.233-0.14-0.044q-0.267-0.082-0.588-0.068-0.643 0.027-1.121 0.475-0.475 0.448-0.547 1.094-0.068 0.643 0.325 1.189 0.055 0.082 1.005 1.049 0.954 0.967 1.306 1.289 0.656 0.615 1.292 0.94 0.639 0.321 1.507 0.458 0.222 0.044 0.496 0.058 0.273 0.014 0.875 0.014 0.827 0.014 1.21-0.014 0.386-0.027 0.766-0.113 0.855-0.195 1.589-0.643 0.735-0.448 1.295-1.107 1.09-1.302 1.203-3.025 0.027-0.25 0.027-2.068 0-1.822-0.027-1.962-0.058-0.547-0.393-0.937-0.335-0.393-0.834-0.547-0.496-0.157-1.012 0l-0.126 0.027-0.058-0.113q-0.14-0.434-0.482-0.728-0.342-0.294-0.793-0.39-0.448-0.099-0.882 0.041l-0.123 0.027-0.044-0.099q-0.14-0.461-0.561-0.79-0.417-0.332-0.882-0.373l-0.167-0.014z" fill="#9CA3AF"/>
  </svg>
);

const PhoneOffIcon = () => (
  <svg viewBox="0 0 14 14" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.157 0.602q-0.294 0.027-0.588 0.167-0.294 0.14-0.506 0.366-0.308 0.321-0.434 0.783-0.027 0.126-0.034 0.212-0.007 0.082-0.007 0.362 0 1.401 0.407 2.83 0.407 1.425 1.148 2.687 0.14 0.222 0.208 0.308 0.072 0.085 0.181 0.14 0.239 0.099 0.482-0.007 0.246-0.106 0.318-0.373 0.041-0.154 0.007-0.277-0.034-0.126-0.188-0.393-0.66-1.094-1.025-2.352-0.362-1.261-0.362-2.492l0-0.366 0.055-0.113q0.085-0.195 0.28-0.28l0.099-0.041 2.03 0 0.099 0.041 0.157 0.123 0.12 0.161 0.058 0.301 0 0.916 0 0.714-0.034 0.28-0.267 0.239-0.287 0.239-0.155 0.325-0.026 0.287 0.041 0.287 0.14 0.325 0.164 0.263 0.096 0.14 0.308 0.198 0.362-0.044 0.338-0.407 0.027-0.109 0.007-0.215-0.021-0.106-0.113-0.273-0.092-0.167-0.079-0.167 0.28-0.208 0.414-0.335 0.133-0.126 0.232-0.253 0.222-0.335 0.294-0.742 0.014-0.126 0.014-1.234l0-1.104-0.055-0.154q-0.113-0.366-0.352-0.646-0.236-0.28-0.561-0.448-0.294-0.14-0.629-0.167-0.167-0.027-1.029-0.027-0.861 0-1.042 0.027z M12.725 0.602q-0.096 0.014-0.181 0.058-0.085 0.041-5.971 5.937-5.886 5.893-5.913 5.961-0.14 0.267-0.017 0.533 0.126 0.267 0.42 0.321 0.198 0.027 0.379-0.072 0.068-0.027 1.432-1.391 1.367-1.364 1.381-1.364 0.014 0 0.212 0.167 1.425 1.244 3.288 1.945 1.863 0.701 3.767 0.714 0.267 0 0.349-0.007 0.085-0.007 0.212-0.034 0.253-0.072 0.441-0.181 0.188-0.113 0.369-0.294 0.185-0.185 0.294-0.373 0.113-0.188 0.185-0.441l0.041-0.167 0-1.008 0-0.926-0.051-0.468-0.116-0.355-0.188-0.365-0.506-0.615-0.728-0.338-0.294-0.027-0.923 0-1.046 0.014-0.383 0.072-0.492 0.253-0.417 0.444-0.14 0.171-0.113-0.044-0.68-0.403-0.663-0.479-0.126-0.113 3.292-3.288 3.333-3.36 0.082-0.181-0.055-0.379-0.246-0.369-0.441-0.092z" fill="#fff"/>
  </svg>
);

/* ─── Sub-components ─── */

const ScoreBar = ({ filled, empty, color, score }) => (
  <div className="lp-score-bar-row">
    <span className="lp-score-label">Score:</span>
    {Array.from({ length: filled }).map((_, i) => (
      <div key={`f-${i}`} className="lp-bar-seg" style={{ backgroundColor: color }} />
    ))}
    {Array.from({ length: empty }).map((_, i) => (
      <div key={`e-${i}`} className="lp-bar-seg lp-bar-empty" />
    ))}
    <span className="lp-score-val" style={{ color }}>{score}</span>
  </div>
);

const RubricRow = ({ color, label, fillPct, score }) => (
  <div className="lp-rubric-row">
    <div className="lp-rubric-dot" style={{ backgroundColor: color }} />
    <span className="lp-rubric-label">{label}</span>
    <div className="lp-rubric-track" style={{ backgroundColor: `${color}15` }}>
      <div
        className="lp-rubric-fill"
        style={{
          background: `linear-gradient(-90deg, ${color} 0%, ${color}CC 100%)`,
          boxShadow: `0 0 8px 1px ${color}60`,
          width: fillPct,
        }}
      />
    </div>
    <div className="lp-score-pill" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}50` }}>
      <span style={{ color }}>{score}</span>
    </div>
  </div>
);

const RoleChip = ({ color, name, desc }) => (
  <div className="lp-role-chip" style={{ backgroundColor: `${color}0C`, border: `1px solid ${color}40` }}>
    <div className="lp-role-accent" style={{ background: color, boxShadow: `0 0 4px ${color}50` }} />
    <div className="lp-role-dot" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />
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
        background: unlocked ? `radial-gradient(ellipse at 50% 50%, ${color} 0%, ${color} 100%)` : "#FFFFFF10",
        boxShadow: unlocked ? `0 0 8px ${color}50` : "none",
      }}
    >
      {unlocked ? <div className="lp-check-inner" /> : <div className="lp-lock-inner" />}
    </div>
    <div className="lp-tier-text">
      <span className="lp-tier-name" style={{ color: unlocked ? "#fff" : "#6B6B80" }}>{name}</span>
      <span className="lp-tier-status" style={{ color: unlocked ? color : "#6B7280" }}>{status}</span>
    </div>
    {!unlocked && <div className="lp-lock-badge"><span>Locked</span></div>}
  </div>
);

const HowItStep = ({ num, title, desc, showConnector }) => (
  <>
    <div className="lp-step-row">
      <div className="lp-step-num"><span>{num}</span></div>
      <div className="lp-step-content">
        <span className="lp-step-title">{title}</span>
        <span className="lp-step-desc">{desc}</span>
      </div>
    </div>
    {showConnector && (
      <div className="lp-step-connector">
        <div className="lp-step-line" />
      </div>
    )}
  </>
);

const MobileMenu = ({ open, onClose }) => (
  <div className={`lp-mobile-menu${open ? " lp-mobile-menu--open" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation menu">
    <nav className="lp-mobile-nav">
      <a href="#features" onClick={onClose} className="lp-mobile-nav-link">Features</a>
      <a href="#how-it-works" onClick={onClose} className="lp-mobile-nav-link">How It Works</a>
      <a href="#about" onClick={onClose} className="lp-mobile-nav-link">About</a>
      <div className="lp-mobile-nav-actions">
        <button className="lp-btn-ghost lp-btn-full">Sign In</button>
        <button className="lp-btn-cta lp-btn-full">Get Started</button>
      </div>
    </nav>
  </div>
);

/* ─── Main Component ─── */
const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="lp-root">
      {/* ── Navbar ── */}
      <header className="lp-nav" role="banner">
        <div className="lp-nav-inner">
          <span className="lp-logo">ITerview</span>

          <nav className="lp-nav-links" aria-label="Main navigation">
            <a href="#features" className="lp-nav-link">Features</a>
            <a href="#how-it-works" className="lp-nav-link">How It Works</a>
            <a href="#about" className="lp-nav-link">About</a>
          </nav>

          <div className="lp-nav-spacer" />

          <div className="lp-nav-cta">
            <button className="lp-btn-ghost" aria-label="Sign in">Sign In</button>
            <button className="lp-btn-cta" aria-label="Get started">Get Started</button>
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
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>

      {/* ── Hero Section ── */}
      <section className="lp-hero" aria-label="Hero">
        <div className="lp-glow lp-glow--top-center" aria-hidden="true" />
        <div className="lp-glow lp-glow--right" aria-hidden="true" />
        <div className="lp-glow lp-glow--left" aria-hidden="true" />
        <div className="lp-glow lp-glow--bottom" aria-hidden="true" />
        <div className="lp-deco-line-top" aria-hidden="true" />
        <div className="lp-deco-dot lp-deco-dot--1" aria-hidden="true" />
        <div className="lp-deco-dot lp-deco-dot--2" aria-hidden="true" />

        <div className="lp-badge" role="note">
          <div className="lp-badge-dot" aria-hidden="true" />
          <span>AI-Powered Mock Interviews</span>
        </div>

        <h1 className="lp-hero-headline">
          Master Tech Job Interviews with AI Voice Simulation &amp; 3C&apos;s Objective Evaluation
        </h1>

        <p className="lp-hero-sub">
          Conquer interview freeze with real-time AI mock sessions that listen, respond, and score
          your answers — just like a real interviewer would.
        </p>

        <div className="lp-hero-ctas">
          <button className="lp-btn-hero-primary" aria-label="Start mock session">
            Start Mock Session
          </button>
          <button className="lp-btn-hero-ghost" aria-label="Explore tracks">
            Explore Tracks
          </button>
        </div>

        <div className="lp-scroll-indicator" aria-hidden="true">
          <span className="lp-scroll-text">Scroll to explore</span>
          <div className="lp-scroll-line" />
        </div>
      </section>

      <div className="lp-divider lp-divider--cyan" aria-hidden="true" />

      {/* ── 3C Framework (Arena) Section ── */}
      <section className="lp-arena" id="features" aria-labelledby="arena-heading">
        <div className="lp-section-label lp-section-label--amber">
          <div className="lp-label-dot lp-label-dot--amber" aria-hidden="true" />
          <span id="arena-heading">THE AI GRADING FRAMEWORK</span>
        </div>

        <p className="lp-section-subtitle">
          Every answer is graded on three dimensions. Master all three to level up.
        </p>

        <div className="lp-cards-3c">
          <article className="lp-card-3c lp-card-3c--clarity" aria-label="Clarity dimension">
            <div className="lp-card-icon lp-card-icon--clarity">
              <SparklesIcon />
            </div>
            <h3 className="lp-card-title">Clarity</h3>
            <p className="lp-card-desc">
              How organized and professional is your delivery? Do you use clear structure and proper IT terminology?
            </p>
            <div className="lp-card-spacer" />
            <ScoreBar filled={4} empty={1} color="#8B5CF6" score="4/5" />
          </article>

          <article className="lp-card-3c lp-card-3c--correctness" aria-label="Correctness dimension">
            <div className="lp-card-icon lp-card-icon--correctness">
              <ShieldCheckIcon />
            </div>
            <h3 className="lp-card-title">Correctness</h3>
            <p className="lp-card-desc">
              Is your answer technically accurate? Does it reflect real-world IT practices?
            </p>
            <div className="lp-card-spacer" />
            <ScoreBar filled={4} empty={1} color="#10B981" score="4/5" />
          </article>

          <article className="lp-card-3c lp-card-3c--completeness" aria-label="Completeness dimension">
            <div className="lp-card-icon lp-card-icon--completeness">
              <LayersIcon />
            </div>
            <h3 className="lp-card-title">Completeness</h3>
            <p className="lp-card-desc">
              Did you fully address the question? Do you back your answer up with specific examples?
            </p>
            <div className="lp-card-spacer" />
            <ScoreBar filled={4} empty={1} color="#FDCB6E" score="4/5" />
          </article>
        </div>
      </section>

      <div className="lp-divider lp-divider--purple" aria-hidden="true" />

      {/* ── Objective Evaluation Heading ── */}
      <section className="lp-eval-heading" id="about" aria-labelledby="eval-heading">
        <div className="lp-eval-left">
          <span className="lp-eval-label">OBJECTIVE EVALUATION</span>
          <h2 className="lp-eval-headline" id="eval-heading">
            Who said tech interview prep has to be subjective?
          </h2>
        </div>
        <div className="lp-eval-right">
          <p className="lp-eval-body">
            Every response you give is scored against our proprietary 3C rubric — Clarity,
            Correctness, and Completeness — on a transparent 1.0 to 5.0 scale. No more guessing
            what the interviewer wants to hear. Get actionable feedback that pinpoints exactly
            where you need to improve, so every practice session moves you forward.
          </p>
        </div>
      </section>

      <div className="lp-divider lp-divider--cyan" aria-hidden="true" />

      {/* ── Bento Grid Section ── */}
      <section className="lp-bento" id="how-it-works" aria-label="Features overview">

        {/* Row 1 — 3C Rubric Card */}
        <div className="lp-bento-row lp-bento-row--1">
          <div className="lp-bento-card lp-bento-card--rubric">
            <div className="lp-bento-title-row">
              <div className="lp-glow-dot lp-glow-dot--cyan" aria-hidden="true" />
              <h3>The 3C&apos;s Evaluation Rubric</h3>
            </div>
            <RubricRow color="#06B6D4" label="Clarity" fillPct="84%" score="4.2" />
            <RubricRow color="#4F46E5" label="Correctness" fillPct="76%" score="3.8" />
            <RubricRow color="#F8961E" label="Completeness" fillPct="70%" score="3.5" />
            <div className="lp-rubric-scale">
              {["1.0", "2.0", "3.0", "4.0", "5.0"].map((s) => (
                <span key={s} className="lp-scale-tick">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 — Role Tracks, Mastery, How It Works */}
        <div className="lp-bento-row lp-bento-row--2">
          <div className="lp-bento-card lp-bento-card--roles">
            <div className="lp-bento-title-row">
              <div className="lp-glow-dot lp-glow-dot--purple" aria-hidden="true" />
              <h3>IT Role Tracks</h3>
            </div>
            <div className="lp-role-list">
              <RoleChip color="#06B6D4" name="Frontend" desc="React, Vue, Angular, CSS" />
              <RoleChip color="#4F46E5" name="Backend" desc="Node.js, Python, Java, Go" />
              <RoleChip color="#10B981" name="DevOps" desc="CI/CD, Docker, Kubernetes, AWS" />
            </div>
            <div className="lp-coming-soon">
              <div className="lp-cs-dot" />
              <span className="lp-cs-label">+ More Roles</span>
              <div className="lp-cs-badge">Coming Soon</div>
            </div>
          </div>

          <div className="lp-bento-card lp-bento-card--mastery">
            <div className="lp-bento-title-row">
              <div className="lp-glow-dot lp-glow-dot--amber" aria-hidden="true" />
              <h3>Mastery-Based Difficulty Progression</h3>
            </div>
            <div className="lp-tier-list">
              <TierRow unlocked color="#10B981" name="Easy" status="Unlocked — Start here" />
              <TierRow unlocked={false} color="#6B7280" name="Medium" status="Requires >= 75% avg. on Easy" />
              <TierRow unlocked={false} color="#6B7280" name="Hard" status="Requires >= 75% avg. on Medium" />
            </div>
          </div>

          <div className="lp-bento-card lp-bento-card--how">
            <div className="lp-bento-title-row">
              <div className="lp-glow-dot lp-glow-dot--cyan" aria-hidden="true" />
              <h3>How it Works</h3>
            </div>
            <div className="lp-steps">
              <HowItStep num="1" title="Speak" desc="Answer interview questions naturally via voice — no typing required." showConnector />
              <HowItStep num="2" title="Verify" desc="Your answer is transcribed and checked for clarity and completeness." showConnector />
              <HowItStep num="3" title="AI Scores" desc="The 3C rubric scores your answer on Clarity, Correctness, and Completeness." showConnector={false} />
            </div>
          </div>
        </div>

        {/* Row 3 — Live Interview Experience */}
        <div className="lp-bento-row lp-bento-row--3">
          <div className="lp-bento-card lp-bento-card--live">
            <div className="lp-live-header">
              <div className="lp-live-title-group">
                <div className="lp-glow-dot lp-glow-dot--cyan" aria-hidden="true" />
                <h3>Live Interview Experience</h3>
              </div>
              <div className="lp-live-badge" aria-label="Live demo indicator">
                <div className="lp-live-dot" aria-hidden="true" />
                <span>LIVE DEMO</span>
              </div>
            </div>

            <div className="lp-interview-area">
              <div className="lp-avatar" aria-label="AI interviewer avatar">
                <BotIcon />
              </div>
              <div className="lp-question-stack">
                <span className="lp-ai-label">AI Interviewer</span>
                <p className="lp-question-text">
                  How would you optimize a React app for performance? Walk me through your approach.
                </p>
              </div>
            </div>

            <div className="lp-transcript" aria-live="polite">
              <div className="lp-ticker-badge" aria-label="Transcribing indicator">
                <div className="lp-ticker-dot" aria-hidden="true" />
                <span>TRANSCRIBING</span>
              </div>
              <p className="lp-transcript-line">
                &quot;Well, I&apos;d start with code splitting using React.lazy and Suspense to reduce the initial bundle size...&quot;
              </p>
            </div>

            <div className="lp-controls" role="toolbar" aria-label="Interview controls">
              <button className="lp-ctrl-btn" aria-label="Toggle microphone">
                <MicIcon /><span>Mic</span>
              </button>
              <button className="lp-ctrl-btn" aria-label="Toggle camera">
                <VideoIcon /><span>Camera</span>
              </button>
              <button className="lp-ctrl-btn" aria-label="Open chat">
                <MessageIcon /><span>Chat</span>
              </button>
              <button className="lp-ctrl-btn" aria-label="Raise hand">
                <HandIcon /><span>Raise</span>
              </button>
              <div className="lp-ctrl-divider" aria-hidden="true" />
              <button className="lp-ctrl-btn lp-ctrl-btn--end" aria-label="End call">
                <PhoneOffIcon /><span>End</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA Section ── */}
      <section className="lp-final-cta" aria-labelledby="cta-heading">
        <div className="lp-cta-glow-top" aria-hidden="true" />
        <div className="lp-cta-glow-bottom" aria-hidden="true" />
        <h2 className="lp-cta-headline" id="cta-heading">
          Stop freezing in technical interviews. Start building objective mastery today.
        </h2>
        <p className="lp-cta-sub">
          Join thousands of engineers who transformed their interview performance with AI-powered
          voice simulation and deterministic 3C rubric scoring.
        </p>
        <button className="lp-btn-cta-final" aria-label="Start mock session now">
          Start Mock Session
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-divider" aria-hidden="true" />
        <div className="lp-footer-content">
          <div className="lp-footer-left">
            <span className="lp-footer-brand">ITerview</span>
            <div className="lp-footer-badge" role="note">
              100% Friction-Free &amp; Free Access — No Credit Card Required
            </div>
          </div>
          <nav className="lp-footer-links" aria-label="Footer navigation">
            <a href="#" className="lp-footer-link">3C Rubric Guide</a>
            <a href="#" className="lp-footer-link">FAQ</a>
            <a href="#" className="lp-footer-link">Privacy Policy</a>
            <a href="#" className="lp-footer-link">Terms</a>
          </nav>
        </div>
        <p className="lp-footer-copy">
          &copy; 2025 ITerview. All rights reserved. AI-powered interview preparation platform.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;

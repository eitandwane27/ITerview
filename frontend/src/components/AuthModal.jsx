import React, { useState, useEffect } from "react";
import { Mail, Lock, X, Eye, EyeOff } from "lucide-react";
import logoImg from "../assets/logo.png";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import "./AuthModal.css";

export default function AuthModal({
  isOpen = true,
  onClose,
  initialMode = "login",
  isPage = false,
}) {
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Sync mode when initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Handle ESC key press to close modal if in modal mode
  useEffect(() => {
    if (isPage || !isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPage, onClose]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isPage || !isOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isPage]);

  if (!isOpen && !isPage) return null;

  const handleTabChange = (newMode) => {
    if (mode === newMode) return;
    setMode(newMode);
    setError("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const { uid, email: userEmail } = userCredential.user;

        // Sync MongoDB (non-blocking)
        try {
          await fetch("http://localhost:5000/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebaseUid: uid, email: userEmail }),
          });
        } catch (syncErr) {
          console.warn("MongoDB sync failed (non-critical):", syncErr.message);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { uid, email: userEmail } = userCredential.user;

        // Sync MongoDB (non-blocking)
        try {
          await fetch("http://localhost:5000/api/users/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebaseUid: uid, email: userEmail }),
          });
        } catch (syncErr) {
          console.warn("MongoDB sync failed (non-critical):", syncErr.message);
        }
      }

      if (onClose) onClose();
      navigate("/dashboard");
    } catch (err) {
      console.error("Auth Error:", err);
      if (mode === "register") {
        if (err.code === "auth/email-already-in-use") {
          setError("This email is already in use.");
        } else if (err.code === "auth/weak-password") {
          setError("Password should be at least 6 characters.");
        } else {
          setError("Failed to create an account.");
        }
      } else {
        setError("Failed to log in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const cardContent = (
    <div
      className="am-card"
      role="dialog"
      aria-modal={!isPage}
      aria-label={mode === "login" ? "Sign in form" : "Register form"}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button for Modal mode */}
      {!isPage && onClose && (
        <button
          className="am-close-btn"
          onClick={onClose}
          aria-label="Close modal"
          type="button"
        >
          <X size={18} />
        </button>
      )}

      {/* Brand Hero: eyebrow → heading → subtitle, pure typography hierarchy */}
      <div className="am-brand-hero">
        {/* Eyebrow: micro brand label, L1 spacing to title */}
        <span className="am-brand-eyebrow">ITerview</span>
        <h2 className="am-title">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h2>
        <p className="am-subheading">
          {mode === "login"
            ? "Enter your credentials to continue"
            : "Start practicing mock interviews today"}
        </p>
      </div>

      <div className="am-sso-row" role="group" aria-label="Social sign in options">
        <button className="am-sso-btn" type="button" aria-label="Continue with Google">
          <span className="am-google-mark" aria-hidden="true">
            <svg viewBox="0 0 18 18" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          </span>
          <span className="am-sso-label">Google</span>
        </button>

        <button className="am-sso-btn" type="button" aria-label="Continue with GitHub">
          <svg viewBox="0 0 20 20" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="#fff" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 10 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
          </svg>
          <span className="am-sso-label">GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div className="am-divider" role="separator" aria-label="or continue with email">
        <div className="am-divider-line" aria-hidden="true" />
        <span className="am-divider-text">or</span>
        <div className="am-divider-line" aria-hidden="true" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="am-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Auth form */}
      <form onSubmit={handleSubmit} className="am-form" noValidate>
        {/* Email field */}
        <div className="am-field">
          <label htmlFor="am-email" className="am-label">
            Email address
          </label>
          <div className="am-input-wrap">
            <Mail size={18} color="#6B6B80" className="am-input-icon" aria-hidden="true" />
            <input
              id="am-email"
              type="email"
              className="am-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        {/* Password field */}
        <div className="am-field">
          <label htmlFor="am-password" className="am-label">
            Password
          </label>
          <div className="am-input-wrap">
            <Lock size={18} color="#6B6B80" className="am-input-icon" aria-hidden="true" />
            <input
              id="am-password"
              type={showPassword ? "text" : "password"}
              className="am-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            <button
              type="button"
              className="am-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} color="#9CA3AF" /> : <Eye size={16} color="#9CA3AF" />}
            </button>
          </div>
        </div>

        {/* Confirm Password field (Register mode only) */}
        {mode === "register" && (
          <div className="am-field am-field-fade-in">
            <label htmlFor="am-confirm-password" className="am-label">
              Confirm Password
            </label>
            <div className="am-input-wrap">
              <Lock size={18} color="#6B6B80" className="am-input-icon" aria-hidden="true" />
              <input
                id="am-confirm-password"
                type={showPassword ? "text" : "password"}
                className="am-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>
        )}

        {/* Forgot password row (Login mode only) */}
        {mode === "login" && (
          <div className="am-forgot-row">
            <button type="button" className="am-forgot-link">
              Forgot password?
            </button>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className="am-submit-btn"
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>

      <div className="am-spacer-lg" />

      {/* Footer prompt */}
      <div className="am-footer">
        <span className="am-footer-text">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}
        </span>
        <button
          type="button"
          className="am-toggle-link"
          onClick={() => handleTabChange(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Create one →" : "Sign in →"}
        </button>
      </div>
    </div>
  );

  // If rendered as standalone page route
  if (isPage) {
    return (
      <div className="am-page-root">
        <div className="am-bg-glow am-bg-glow--top" aria-hidden="true" />
        <div className="am-bg-glow am-bg-glow--bottom" aria-hidden="true" />

        <header className="am-topbar">
          <div className="am-topbar-inner">
            <div className="am-logo-group">
              <img src={logoImg} alt="ITerview" className="am-logo-img" />
              <span className="am-logo-text">ITerview</span>
            </div>
            <Link to="/landing" className="am-back-link">
              ← Back to Home
            </Link>
          </div>
        </header>

        <main className="am-page-centered">{cardContent}</main>
      </div>
    );
  }

  // Rendered as Modal overlay over LandingPage
  return (
    <div
      className="am-backdrop"
      onClick={onClose}
      role="presentation"
    >
      {cardContent}
    </div>
  );
}

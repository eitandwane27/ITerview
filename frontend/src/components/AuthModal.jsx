import React, { useState, useEffect, useRef } from "react";
import { Mail, Lock, X, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import logoImg from "../assets/logo.png";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import "./AuthModal.css";

// Helper for validating email format
const isValidEmail = (emailStr) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
};

// Map Firebase error codes to user-friendly messages
const getFriendlyErrorMessage = (errorCode, context = "auth") => {
  switch (errorCode) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by your browser. Please allow pop-ups for this site.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/cancelled-popup-request":
      return "Sign-in request was cancelled.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Access temporarily locked for security. Please try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    case "auth/operation-not-allowed":
      return "This sign-in provider is currently not enabled. Please contact support.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for OAuth sign-in. Check Firebase settings.";
    default:
      if (context === "forgot") {
        return "Unable to send password reset email. Please try again.";
      }
      if (context === "register") {
        return "Failed to create an account. Please try again.";
      }
      return "Failed to authenticate. Please check your details and try again.";
  }
};

// Safe helper to check if a popup window has closed without throwing COOP SecurityErrors
const isPopupClosed = (win) => {
  if (!win) return true;
  try {
    return win.closed;
  } catch (_) {
    return false;
  }
};

export default function AuthModal({
  isOpen = true,
  onClose,
  initialMode = "login",
  isPage = false,
}) {
  // Modes: "login" | "register" | "forgot" | "reset-success"
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null); // "google" | "github" | null
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState("");

  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const activePopupRef = useRef(null);
  const popupCheckIntervalRef = useRef(null);
  const cardRef = useRef(null);
  const emailInputRef = useRef(null);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    setError("");
  }, [initialMode]);

  // Clean up timers and open popups on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }
      if (activePopupRef.current && !isPopupClosed(activePopupRef.current)) {
        try {
          activePopupRef.current.close();
        } catch (_) {}
        activePopupRef.current = null;
      }
    };
  }, []);

  // Safe dismiss handler that closes any active SSO popup window and resets loading
  const handleClose = () => {
    if (popupCheckIntervalRef.current) {
      clearInterval(popupCheckIntervalRef.current);
      popupCheckIntervalRef.current = null;
    }
    if (activePopupRef.current && !isPopupClosed(activePopupRef.current)) {
      try {
        activePopupRef.current.close();
      } catch (_) {}
      activePopupRef.current = null;
    }
    if (isMountedRef.current) {
      setSsoLoading(null);
      setLoading(false);
    }
    if (onClose) onClose();
  };

  // Focus the email field when modal opens or mode changes
  useEffect(() => {
    if (!isOpen && !isPage) return;
    const timer = setTimeout(() => {
      if (emailInputRef.current && mode !== "reset-success") {
        emailInputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isPage, mode]);

  // Focus trap inside modal for keyboard accessibility
  useEffect(() => {
    if (isPage || !isOpen) return;

    const handleKeyDown = (e) => {
      // Escape key dismiss
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      // Tab trap
      if (e.key === "Tab" && cardRef.current) {
        const focusableElements = cardRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPage, onClose]);

  // Disable body scroll when modal is active
  useEffect(() => {
    if (isPage || !isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isPage]);

  if (!isOpen && !isPage) return null;

  // Mode switching helper
  const handleSwitchMode = (newMode) => {
    if (mode === newMode) return;
    if (popupCheckIntervalRef.current) {
      clearInterval(popupCheckIntervalRef.current);
      popupCheckIntervalRef.current = null;
    }
    if (activePopupRef.current && !isPopupClosed(activePopupRef.current)) {
      try {
        activePopupRef.current.close();
      } catch (_) {}
      activePopupRef.current = null;
    }
    setSsoLoading(null);
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  // Sync user with MongoDB backend (safe and non-blocking)
  const syncMongoUser = async (endpoint, uid, userEmail, displayName = "") => {
    try {
      await fetch(`/api/users/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUid: uid,
          email: userEmail,
          displayName: displayName || "",
        }),
      });
    } catch (syncErr) {
      console.warn("MongoDB sync failed (non-critical):", syncErr.message);
    }
  };

  // Handle OAuth Sign In (Google / GitHub)
  const handleSocialAuth = async (providerType) => {
    if (loading || ssoLoading) return;
    setError("");
    setSsoLoading(providerType);

    // Clear any active popup polling
    if (popupCheckIntervalRef.current) {
      clearInterval(popupCheckIntervalRef.current);
      popupCheckIntervalRef.current = null;
    }
    activePopupRef.current = null;

    let provider;
    if (providerType === "google") {
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
    } else if (providerType === "github") {
      provider = new GithubAuthProvider();
    }

    let popupWindow = null;
    const originalOpen = window.open;

    try {
      // Intercept window.open synchronously so we capture the popup reference from Firebase
      window.open = function (...args) {
        const win = originalOpen.apply(this, args);
        popupWindow = win;
        activePopupRef.current = win;
        return win;
      };

      const authPromise = signInWithPopup(auth, provider);

      // Restore window.open immediately after popup is opened
      window.open = originalOpen;

      // Handle window refocus: when user closes or exits popup, main window regains focus
      const onWindowFocus = () => {
        setTimeout(() => {
          if (isMountedRef.current && !auth.currentUser) {
            if (isPopupClosed(popupWindow)) {
              if (popupCheckIntervalRef.current) {
                clearInterval(popupCheckIntervalRef.current);
                popupCheckIntervalRef.current = null;
              }
              activePopupRef.current = null;
              setSsoLoading(null);
            }
          }
        }, 150);
      };
      window.addEventListener("focus", onWindowFocus);

      // Fast polling (100ms) with safe COOP wrapper
      if (popupWindow) {
        popupCheckIntervalRef.current = setInterval(() => {
          if (isPopupClosed(popupWindow)) {
            if (popupCheckIntervalRef.current) {
              clearInterval(popupCheckIntervalRef.current);
              popupCheckIntervalRef.current = null;
            }
            activePopupRef.current = null;
            window.removeEventListener("focus", onWindowFocus);
            // Short debounce to verify auth didn't just complete
            setTimeout(() => {
              if (isMountedRef.current && !auth.currentUser) {
                setSsoLoading(null);
              }
            }, 80);
          }
        }, 100);
      }

      const result = await authPromise;
      window.removeEventListener("focus", onWindowFocus);
      const { uid, email: userEmail, displayName } = result.user;

      // Sync user in MongoDB
      syncMongoUser("login", uid, userEmail, displayName);

      if (onClose) onClose();
      navigate("/dashboard");
    } catch (err) {
      if (window.open !== originalOpen) {
        window.open = originalOpen;
      }
      console.error("SSO Auth Error:", err);
      // Do not display error banner if user voluntarily closed or cancelled the popup
      if (
        err.code !== "auth/popup-closed-by-user" &&
        err.code !== "auth/cancelled-popup-request"
      ) {
        if (isMountedRef.current) {
          setError(getFriendlyErrorMessage(err.code, "sso"));
        }
      }
    } finally {
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }
      activePopupRef.current = null;
      if (isMountedRef.current) {
        setSsoLoading(null);
      }
    }
  };

  // Handle Email/Password Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();

    // Client-side email validation
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    // "forgot" password mode submission
    if (mode === "forgot") {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setResetEmailSent(trimmedEmail);
        setMode("reset-success");
      } catch (err) {
        console.error("Password reset error:", err);
        setError(getFriendlyErrorMessage(err.code, "forgot"));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Password validation for login & register
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const { uid, email: userEmail, displayName } = userCredential.user;

        await syncMongoUser("login", uid, userEmail, displayName);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const { uid, email: userEmail, displayName } = userCredential.user;

        await syncMongoUser("register", uid, userEmail, displayName);
      }

      if (onClose) onClose();
      navigate("/dashboard");
    } catch (err) {
      console.error("Auth Error:", err);
      setError(getFriendlyErrorMessage(err.code, mode));
    } finally {
      setLoading(false);
    }
  };

  const isAnyLoading = loading || !!ssoLoading;

  const cardContent = (
    <div
      ref={cardRef}
      className="am-card"
      role="dialog"
      aria-modal={!isPage}
      aria-labelledby="am-title"
      aria-describedby="am-subheading"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button for modal mode */}
      {!isPage && onClose && (
        <button
          className="am-close-btn"
          onClick={handleClose}
          aria-label="Close modal"
          type="button"
          disabled={loading}
        >
          <X size={18} />
        </button>
      )}

      {/* Mode: Reset Email Sent Successfully */}
      {mode === "reset-success" ? (
        <div className="am-success-view">
          <div className="am-success-icon-wrap" aria-hidden="true">
            <CheckCircle2 size={36} className="am-success-icon" />
          </div>

          <h2 id="am-title" className="am-title">
            Check your inbox
          </h2>
          <p id="am-subheading" className="am-subheading">
            We sent a password reset link to <span className="am-highlight-email">{resetEmailSent}</span>. Follow the instructions in the email to set a new password.
          </p>

          <div className="am-spacer-md" />

          <button
            type="button"
            className="am-submit-btn"
            onClick={() => handleSwitchMode("login")}
          >
            Return to sign in
          </button>

          <div className="am-spacer-sm" />

          <div className="am-footer">
            <span className="am-footer-text">Didn't get the email?</span>
            <button
              type="button"
              className="am-toggle-link"
              onClick={() => handleSwitchMode("forgot")}
            >
              Try again →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Brand Hero block */}
          <div className="am-brand-hero">
            {mode === "forgot" && (
              <div className="am-forgot-nav">
                <button
                  type="button"
                  className="am-back-btn"
                  onClick={() => handleSwitchMode("login")}
                  aria-label="Back to sign in"
                  disabled={isAnyLoading}
                >
                  <ArrowLeft size={14} />
                  <span>Back to sign in</span>
                </button>
              </div>
            )}

            <h2 id="am-title" className="am-title">
              {mode === "login"
                ? "Welcome back"
                : mode === "register"
                ? "Create an account"
                : "Reset your password"}
            </h2>

            <p id="am-subheading" className="am-subheading">
              {mode === "login"
                ? "Enter your credentials to continue"
                : mode === "register"
                ? "Start practicing mock interviews today"
                : "Enter your registered email and we'll send you a recovery link"}
            </p>
          </div>

          {/* Social OAuth buttons (Login & Register modes) */}
          {mode !== "forgot" && (
            <>
              <div className="am-sso-row" role="group" aria-label="Social sign-in options">
                <button
                  className="am-sso-btn"
                  type="button"
                  onClick={() => handleSocialAuth("google")}
                  disabled={isAnyLoading}
                  aria-label="Continue with Google"
                  aria-busy={ssoLoading === "google"}
                >
                  {ssoLoading === "google" ? (
                    <span className="am-spinner" aria-hidden="true" />
                  ) : (
                    <span className="am-google-mark" aria-hidden="true">
                      <svg viewBox="0 0 18 18" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                      </svg>
                    </span>
                  )}
                  <span className="am-sso-label">
                    {ssoLoading === "google" ? "Connecting…" : "Google"}
                  </span>
                </button>

                <button
                  className="am-sso-btn"
                  type="button"
                  onClick={() => handleSocialAuth("github")}
                  disabled={isAnyLoading}
                  aria-label="Continue with GitHub"
                  aria-busy={ssoLoading === "github"}
                >
                  {ssoLoading === "github" ? (
                    <span className="am-spinner" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 20 20" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="#fff" aria-hidden="true">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 10 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
                    </svg>
                  )}
                  <span className="am-sso-label">
                    {ssoLoading === "github" ? "Connecting…" : "GitHub"}
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="am-divider" role="separator" aria-label="or continue with email">
                <div className="am-divider-line" aria-hidden="true" />
                <span className="am-divider-text">or continue with email</span>
                <div className="am-divider-line" aria-hidden="true" />
              </div>
            </>
          )}

          {/* Error Alert Banner */}
          {error && (
            <div className="am-error" role="alert" aria-live="assertive">
              <AlertCircle size={16} className="am-error-icon" aria-hidden="true" />
              <span className="am-error-msg">{error}</span>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="am-form" noValidate>
            {/* Email field */}
            <div className="am-field">
              <label htmlFor="am-email" className="am-label">
                Email address
              </label>
              <div className="am-input-wrap">
                <Mail size={18} className="am-input-icon" aria-hidden="true" />
                <input
                  ref={emailInputRef}
                  id="am-email"
                  type="email"
                  className="am-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={isAnyLoading}
                />
              </div>
            </div>

            {/* Password fields (Login & Register modes) */}
            {mode !== "forgot" && (
              <div className="am-field">
                <label htmlFor="am-password" className="am-label">
                  Password
                </label>
                <div className="am-input-wrap">
                  <Lock size={18} className="am-input-icon" aria-hidden="true" />
                  <input
                    id="am-password"
                    type={showPassword ? "text" : "password"}
                    className="am-input"
                    placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    disabled={isAnyLoading}
                  />
                  <button
                    type="button"
                    className="am-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={isAnyLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password field (Register mode only) */}
            {mode === "register" && (
              <div className="am-field am-field-fade-in">
                <label htmlFor="am-confirm-password" className="am-label">
                  Confirm password
                </label>
                <div className="am-input-wrap">
                  <Lock size={18} className="am-input-icon" aria-hidden="true" />
                  <input
                    id="am-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="am-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={isAnyLoading}
                  />
                  <button
                    type="button"
                    className="am-eye-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    disabled={isAnyLoading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot password row (Login mode only) */}
            {mode === "login" && (
              <div className="am-forgot-row">
                <button
                  type="button"
                  className="am-forgot-link"
                  onClick={() => handleSwitchMode("forgot")}
                  disabled={isAnyLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="am-submit-btn"
              disabled={isAnyLoading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="am-btn-loading-content">
                  <span className="am-spinner am-spinner--dark" aria-hidden="true" />
                  <span>
                    {mode === "login"
                      ? "Signing in…"
                      : mode === "register"
                      ? "Creating account…"
                      : "Sending link…"}
                  </span>
                </span>
              ) : (
                <span>
                  {mode === "login"
                    ? "Sign in"
                    : mode === "register"
                    ? "Create account"
                    : "Send reset link"}
                </span>
              )}
            </button>
          </form>

          <div className="am-spacer-lg" />

          {/* Footer prompt */}
          <div className="am-footer">
            {mode === "forgot" ? (
              <button
                type="button"
                className="am-toggle-link"
                onClick={() => handleSwitchMode("login")}
                disabled={isAnyLoading}
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                <span className="am-footer-text">
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                </span>
                <button
                  type="button"
                  className="am-toggle-link"
                  onClick={() => handleSwitchMode(mode === "login" ? "register" : "login")}
                  disabled={isAnyLoading}
                >
                  {mode === "login" ? "Create one →" : "Sign in →"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Standalone page route wrapper
  if (isPage) {
    return (
      <div className="am-page-root">
        <div className="am-bg-glow am-bg-glow--top" aria-hidden="true" />

        <header className="am-topbar">
          <div className="am-topbar-inner">
            <div className="am-logo-group">
              <img src={logoImg} alt="ITerview" className="am-logo-img" />
              <span className="am-logo-text">ITerview</span>
            </div>
            <Link to="/landing" className="am-back-link" onClick={handleClose}>
              ← Back to Home
            </Link>
          </div>
        </header>

        <main className="am-page-centered">{cardContent}</main>
      </div>
    );
  }

  // Modal overlay mode
  return (
    <div
      className="am-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      {cardContent}
    </div>
  );
}

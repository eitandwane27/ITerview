import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  Lock,
  X,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import logoImg from '../assets/logo';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { auth } from '../firebase';
import './AuthModal.css';
import { ADMIN_AUTH_EMAIL, isSchoolEmail } from '../utils/schoolAccess';
import { sendSchoolVerification } from '../utils/emailVerification';
import { passwordResetWaitSeconds, requestPasswordReset } from '../utils/passwordReset';
import { useSchoolAuth } from '../auth/schoolAuth';
import { useSignInTransition } from '../auth/signInTransition';

// Helper for validating email format
const isValidEmail = (emailStr) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
};

// Map Firebase error codes to user-friendly messages
const getFriendlyErrorMessage = (errorCode, context = 'auth') => {
  switch (errorCode) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/user-disabled':
      return 'Sign-in is unavailable for this account. Please contact support.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/password-does-not-meet-requirements':
      return 'This password does not meet the account security requirements. Choose a stronger password and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/too-many-requests':
      if (context === 'forgot') {
        return 'Too many reset requests. Please wait a few minutes before trying again.';
      }
      return 'Too many failed attempts. Access temporarily locked for security. Please try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is currently not enabled. Please contact support.';
    default:
      if (context === 'forgot') {
        return 'Unable to send password reset email. Please try again.';
      }
      if (context === 'register') {
        return 'Failed to create an account. Please try again.';
      }
      return 'Failed to authenticate. Please check your details and try again.';
  }
};

export default function AuthModal({
  isOpen = true,
  onClose,
  initialMode = 'login',
  isPage = false,
}) {
  // Modes: "login" | "register" | "forgot" | "reset-success"
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetRequestedEmail, setResetRequestedEmail] = useState('');
  const [resetWaitSeconds, setResetWaitSeconds] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession, status: schoolStatus } = useSchoolAuth();
  const signInTransition = useSignInTransition();
  const cardRef = useRef(null);
  const emailInputRef = useRef(null);
  const termsInputRef = useRef(null);
  const resetHeadingRef = useRef(null);
  const submitPendingRef = useRef(false);

  useEffect(() => {
    if (mode !== 'forgot' || (!isOpen && !isPage)) return;
    const updateWait = () => setResetWaitSeconds(passwordResetWaitSeconds(email));
    updateWait();
    const timer = setInterval(updateWait, 1000);
    return () => clearInterval(timer);
  }, [email, mode, isOpen, isPage]);

  // Each new registration attempt starts with an explicit, unchecked agreement.
  useEffect(() => {
    setAcceptedTerms(false);
    setTermsError('');
    if (!isOpen && !isPage) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError('');
    }
  }, [isOpen, initialMode, isPage]);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [initialMode]);

  const handleClose = useCallback(() => {
    if (loading || submitPendingRef.current) return;
    if (onClose) onClose();
  }, [onClose, loading]);

  useEffect(() => {
    if (isPage || !isOpen) return;
    const trigger = document.activeElement;
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isPage, isOpen]);

  useEffect(() => {
    if (location.state?.schoolEmailRequired || schoolStatus === 'wrong-school') {
      setError('Please sign in with your @spcba.edu.ph school email.');
    }
  }, [location.state, schoolStatus]);

  // Focus the email field when modal opens or mode changes
  useEffect(() => {
    if (!isOpen && !isPage) return;
    const timer = setTimeout(() => {
      if (mode === 'reset-success') {
        resetHeadingRef.current?.focus({ preventScroll: true });
      } else if (emailInputRef.current) {
        emailInputRef.current.focus({ preventScroll: true });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isPage, mode]);

  // Focus trap inside modal for keyboard accessibility
  useEffect(() => {
    if (isPage || !isOpen) return;

    const handleKeyDown = (e) => {
      // Escape key dismiss
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Tab trap
      if (e.key === 'Tab' && cardRef.current) {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPage, handleClose]);

  // Disable body scroll when modal is active
  useEffect(() => {
    if (isPage || !isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isPage]);

  if ((!isOpen && !isPage) || signInTransition?.active) return null;

  // Mode switching helper
  const handleSwitchMode = (newMode) => {
    if (loading || submitPendingRef.current || mode === newMode) return;
    setMode(newMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAcceptedTerms(false);
    setTermsError('');
  };

  // Handle Email/Password Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || submitPendingRef.current) return;
    setError('');
    setTermsError('');

    const identifier = email.trim().toLowerCase();
    const isAdminLogin = mode === 'login' && identifier === 'admin';
    const trimmedEmail = isAdminLogin ? ADMIN_AUTH_EMAIL : identifier;

    // Client-side email validation
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isAdminLogin && !isSchoolEmail(trimmedEmail)) {
      setError('Please use your @spcba.edu.ph school email.');
      return;
    }

    // "forgot" password mode submission
    if (mode === 'forgot') {
      submitPendingRef.current = true;
      setLoading(true);
      try {
        const accepted = await requestPasswordReset(trimmedEmail);
        if (!accepted) {
          setResetWaitSeconds(passwordResetWaitSeconds(trimmedEmail));
          return;
        }
        setResetRequestedEmail(trimmedEmail);
        setMode('reset-success');
      } catch (err) {
        setError(getFriendlyErrorMessage(err.code, 'forgot'));
      } finally {
        submitPendingRef.current = false;
        setLoading(false);
      }
      return;
    }

    // Password validation for login & register
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (!password.trim()) {
        setError('Password cannot contain only spaces. Choose a password with visible characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (!confirmPassword) {
        setError('Please confirm your password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!acceptedTerms) {
        setTermsError('Please read and accept the Terms and Conditions to create an account.');
        termsInputRef.current?.focus();
        return;
      }
    }

    submitPendingRef.current = true;
    setLoading(true);

    const transitionTicket = mode === 'login' ? signInTransition?.begin() : null;
    try {
      const credential =
        mode === 'login'
          ? await signInWithEmailAndPassword(auth, trimmedEmail, password)
          : await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = credential.user;

      if (!isAdminLogin && !user.emailVerified) {
        signInTransition?.cancel();
        let emailSent = false;
        let verificationError = '';
        if (mode === 'register') {
          try {
            emailSent = await sendSchoolVerification(user);
          } catch {
            verificationError =
              'Your account was created, but the verification email could not be sent. Use Resend verification email to try again.';
          }
        }
        if (onClose) onClose();
        navigate('/verify-email', { replace: true, state: { emailSent, verificationError } });
        return;
      }

      const status = await refreshSession({ reloadUser: false });
      if (status === 'admin') {
        signInTransition?.cancel();
        if (onClose) onClose();
        navigate('/admin', { replace: true });
        return;
      }
      if (status !== 'ready') {
        signInTransition?.cancel();
        if (status === 'verify') {
          navigate('/verify-email', { replace: true });
        } else {
          setError(
            status === 'wrong-school'
              ? 'Please sign in with your @spcba.edu.ph school email.'
              : 'Your session changed before sign-in completed. Please sign in again.'
          );
        }
        return;
      }
      signInTransition?.openingDashboard(transitionTicket);
      if (onClose) onClose();
      navigate('/dashboard');
    } catch (err) {
      signInTransition?.cancel();
      setError(
        err.code
          ? getFriendlyErrorMessage(err.code, mode)
          : err.message || getFriendlyErrorMessage(undefined, mode)
      );
    } finally {
      submitPendingRef.current = false;
      setLoading(false);
    }
  };

  const isAnyLoading = loading;

  const cardContent = (
    <div
      ref={cardRef}
      className="am-card"
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : true}
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
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {/* Symmetrical back button for forgot password mode */}
      {mode === 'forgot' && (
        <button
          type="button"
          className="am-back-btn"
          onClick={() => handleSwitchMode('login')}
          aria-label="Back to sign in"
          disabled={isAnyLoading}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {/* Firebase accepts reset requests without confirming account existence. */}
      {mode === 'reset-success' ? (
        <div className="am-success-view">
          <div className="am-success-icon-wrap" aria-hidden="true">
            <Mail size={34} className="am-success-icon" strokeWidth={2.2} />
          </div>

          <h2 ref={resetHeadingRef} id="am-title" className="am-title" tabIndex={-1}>
            Check your email
          </h2>

          <p id="am-subheading" className="am-subheading">
            If an ITerview account exists for this address, you’ll receive a password reset link.
          </p>

          <div className="am-email-chip" title={resetRequestedEmail}>
            <Mail size={15} className="am-email-chip-icon" aria-hidden="true" />
            <span className="am-email-chip-address">{resetRequestedEmail}</span>
          </div>

          <p className="am-subtext-secondary">
            Check that the address matches the one you used to sign up, including any numbers. Check
            your spam folder too. Only an existing account can receive a reset link.
          </p>

          <button
            type="button"
            className="am-submit-btn am-submit-btn--return"
            onClick={() => handleSwitchMode('login')}
          >
            <span>Return to sign in</span>
            <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
          </button>

          <div className="am-footer">
            <span className="am-footer-text">Wrong address?</span>
            <button
              type="button"
              className="am-toggle-link"
              onClick={() => handleSwitchMode('forgot')}
            >
              Edit email address
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Brand Hero block */}
          <div className="am-brand-hero">
            <div className="am-logo-mark" aria-hidden="true">
              <img src={logoImg} alt="" className="am-logo-mark-img" />
            </div>

            <h2 id="am-title" className="am-title">
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'register'
                  ? 'Create an account'
                  : 'Reset your password'}
            </h2>

            <p id="am-subheading" className="am-subheading">
              {mode === 'login'
                ? 'Use your verified SPCBA school email or admin username.'
                : mode === 'register'
                  ? 'Use your SPCBA school email to get started.'
                  : 'Enter the SPCBA school email you used to create your ITerview account.'}
            </p>
          </div>

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
                {mode === 'login' ? 'School email address or admin username' : 'School email address'}
              </label>
              <div className="am-input-wrap">
                <Mail size={18} className="am-input-icon" aria-hidden="true" />
                <input
                  ref={emailInputRef}
                  id="am-email"
                  type={mode === 'login' ? 'text' : 'email'}
                  className="am-input"
                  placeholder={mode === 'login' ? 'School email or username' : 'you@spcba.edu.ph'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby={mode === 'forgot' ? 'am-reset-hint' : undefined}
                  required
                  disabled={isAnyLoading}
                />
              </div>
              {mode === 'forgot' && (
                <p id="am-reset-hint" className="am-reset-hint">
                  Double-check the spelling and numbers. A school email alone does not mean you have
                  an ITerview account.
                </p>
              )}
            </div>

            {/* Password fields (Login & Register modes) */}
            {mode !== 'forgot' && (
              <div className="am-field">
                <label htmlFor="am-password" className="am-label">
                  Password
                </label>
                <div className="am-input-wrap">
                  <Lock size={18} className="am-input-icon" aria-hidden="true" />
                  <input
                    id="am-password"
                    type={showPassword ? 'text' : 'password'}
                    className="am-input"
                    placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    disabled={isAnyLoading}
                  />
                  <button
                    type="button"
                    className="am-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    disabled={isAnyLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password field (Register mode only) */}
            {mode === 'register' && (
              <div className="am-field am-field-fade-in">
                <label htmlFor="am-confirm-password" className="am-label">
                  Confirm password
                </label>
                <div className="am-input-wrap">
                  <Lock size={18} className="am-input-icon" aria-hidden="true" />
                  <input
                    id="am-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
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
                    aria-label={
                      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                    }
                    aria-pressed={showConfirmPassword}
                    disabled={isAnyLoading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="am-agreement">
                <div className="am-agreement-label">
                  <input
                    ref={termsInputRef}
                    id="am-accept-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      setTermsError('');
                    }}
                    required
                    disabled={isAnyLoading}
                    aria-labelledby="am-agreement-copy am-terms-link"
                    aria-invalid={Boolean(termsError)}
                    aria-describedby={termsError ? 'am-terms-error' : undefined}
                  />
                  <span>
                    <label id="am-agreement-copy" htmlFor="am-accept-terms">
                      I have read and agree to the
                    </label>{' '}
                    <Link
                      id="am-terms-link"
                      className="am-terms-link"
                      to="/terms-and-conditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-describedby="am-terms-link-hint"
                      title="Opens in a new tab"
                    >
                      Terms and Conditions <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                    .
                    <span id="am-terms-link-hint" className="am-sr-only">
                      Opens in a new tab.
                    </span>
                  </span>
                </div>
                {termsError && (
                  <p id="am-terms-error" className="am-agreement-error" role="alert">
                    {termsError}
                  </p>
                )}
              </div>
            )}

            {/* Forgot password row (Login mode only) */}
            {mode === 'login' && (
              <div className="am-forgot-row">
                <button
                  type="button"
                  className="am-forgot-link"
                  onClick={() => handleSwitchMode('forgot')}
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
              disabled={isAnyLoading || (mode === 'forgot' && resetWaitSeconds > 0)}
              aria-busy={loading}
            >
              {loading ? (
                <span className="am-btn-loading-content">
                  <span className="am-spinner" aria-hidden="true" />
                  <span>
                    {mode === 'login'
                      ? 'Signing in…'
                      : mode === 'register'
                        ? 'Creating account…'
                        : 'Sending link…'}
                  </span>
                </span>
              ) : (
                <span className="am-btn-loading-content">
                  <span>
                    {mode === 'login'
                      ? 'Sign in'
                      : mode === 'register'
                        ? 'Create account'
                        : resetWaitSeconds > 0
                          ? `Try again in ${resetWaitSeconds}s`
                          : 'Send reset link'}
                  </span>
                  <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
                </span>
              )}
            </button>
          </form>

          <div className="am-spacer-lg" />

          {/* Footer prompt */}
          <div className="am-footer">
            {mode === 'forgot' ? (
              <button
                type="button"
                className="am-toggle-link"
                onClick={() => handleSwitchMode('login')}
                disabled={isAnyLoading}
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                <span className="am-footer-text">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                </span>
                <button
                  type="button"
                  className="am-toggle-link"
                  onClick={() => handleSwitchMode(mode === 'login' ? 'register' : 'login')}
                  disabled={isAnyLoading}
                >
                  {mode === 'login' ? 'Create one →' : 'Sign in →'}
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
        <div className="am-bg-glow am-bg-glow--bl" aria-hidden="true" />
        <div className="am-bg-glow am-bg-glow--br" aria-hidden="true" />

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
  return createPortal(
    <div className="am-backdrop" onClick={handleClose} role="presentation">
      {cardContent}
    </div>,
    document.body
  );
}

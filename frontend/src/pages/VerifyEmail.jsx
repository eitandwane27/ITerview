import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail } from 'lucide-react';
import { useSchoolAuth } from '../auth/schoolAuth';
import { sendSchoolVerification, verificationWaitSeconds } from '../utils/emailVerification';
import { REQUIRE_SCHOOL_EMAIL_VERIFICATION } from '../utils/schoolAccess';
import '../components/AuthModal.css';

export default function VerifyEmail() {
  const { user, status, error: sessionError, refreshSession, logout } = useSchoolAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(location.state?.verificationError || '');
  const [notice, setNotice] = useState(
    location.state?.emailSent ? 'Verification email sent. Check your inbox and spam folder.' : ''
  );
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!user) return;
    const update = () => setWaitSeconds(verificationWaitSeconds(user.uid));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [user]);

  async function resend() {
    if (pending.current || status === 'loading') return;
    pending.current = true;
    setBusy('resend');
    setError('');
    setNotice('');
    try {
      const sent = await sendSchoolVerification(user);
      setWaitSeconds(verificationWaitSeconds(user.uid));
      setNotice(
        sent
          ? 'Verification email sent. Check your inbox and spam folder.'
          : 'Please wait before requesting another email.'
      );
    } catch (err) {
      setError(
        err.code === 'auth/too-many-requests'
          ? 'Too many requests. Wait a few minutes, then try again.'
          : 'We couldn’t send the email. Check your connection and try again.'
      );
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  async function checkVerification() {
    if (pending.current || status === 'loading') return;
    pending.current = true;
    setBusy('check');
    setError('');
    setNotice('');
    try {
      const nextStatus = await refreshSession();
      if (nextStatus === 'ready') navigate('/dashboard', { replace: true });
      else if (nextStatus === 'verify')
        setError('Your email is still unverified. Open the link in your inbox, then try again.');
    } catch (err) {
      setError(err.message || 'We couldn’t check verification. Please try again.');
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  async function handleSignOut() {
    if (pending.current) return;
    pending.current = true;
    setBusy('logout');
    setError('');
    try {
      await logout();
    } catch {
      setError('We couldn’t sign you out. Please try again.');
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  if (status === 'admin') return <Navigate to="/admin" replace />;
  if (status === 'signed-out' || status === 'wrong-school') return <Navigate to="/login" replace />;
  if (status === 'ready' || !REQUIRE_SCHOOL_EMAIL_VERIFICATION)
    return <Navigate to="/dashboard" replace />;
  if (!user)
    return (
      <div className="am-page-root am-access-status" role="status">
        Checking your school account…
      </div>
    );

  return (
    <main className="am-page-root am-access-status">
      <section className="am-card am-verification-card" aria-labelledby="verification-title">
        <Mail size={32} className="am-verification-icon" aria-hidden="true" />
        <h1 id="verification-title" className="am-title">
          Verify your school email
        </h1>
        <p className="am-subheading">
          Open the verification link sent to your SPCBA school email to continue.
        </p>
        <div className="am-email-chip">
          <span className="am-email-chip-address">{user.email}</span>
        </div>
        <p className="am-subtext-secondary">
          Check your inbox and spam folder. After opening the link, return here to confirm.
        </p>
        {(error || sessionError) && (
          <div className="am-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error || sessionError}</span>
          </div>
        )}
        {notice && (
          <p className="am-verification-notice" role="status">
            {notice}
          </p>
        )}
        <button
          className="am-submit-btn"
          disabled={!!busy || status === 'loading'}
          onClick={checkVerification}
        >
          {busy === 'check' ? 'Checking verification…' : 'I’ve verified my email'}
        </button>
        <button
          className="am-toggle-link am-verification-secondary"
          disabled={!!busy || !!waitSeconds || status === 'loading'}
          onClick={resend}
        >
          {busy === 'resend'
            ? 'Sending email…'
            : waitSeconds
              ? `Resend email in ${waitSeconds}s`
              : 'Resend verification email'}
        </button>
        <button
          className="am-toggle-link am-verification-secondary"
          disabled={!!busy}
          onClick={handleSignOut}
        >
          {busy === 'logout' ? 'Signing out…' : 'Sign out to use another account'}
        </button>
        <Link className="am-toggle-link am-verification-secondary" to="/landing">
          Back to ITerview
        </Link>
      </section>
    </main>
  );
}

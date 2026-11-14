import { useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSchoolAuth } from './schoolAuth';
import '../components/AuthModal.css';
import SignInTransition from '../components/SignInTransition';
import { useSignInTransition } from './signInTransition';

export default function ProtectedRoute({ admin = false }) {
  const { status, error, refreshSession, logout, signOutRedirect } = useSchoolAuth();
  const transition = useSignInTransition();
  const signOutPending = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  async function handleSignOut() {
    if (signOutPending.current) return;
    signOutPending.current = true;
    setSigningOut(true);
    setSignOutError('');
    try {
      await logout();
    } catch {
      setSignOutError('We couldn’t sign you out. Please try again.');
    } finally {
      signOutPending.current = false;
      setSigningOut(false);
    }
  }
  if (status === 'loading') {
    return transition?.active ? null : <SignInTransition />;
  }
  if (status === 'error') {
    return (
      <div className="am-page-root am-access-status">
        <div className="am-card am-verification-card">
          <h1 className="am-title">We couldn’t check access</h1>
          <p role="alert" className="am-subheading">
            {signOutError || error}
          </p>
          <button
            className="am-submit-btn"
            disabled={signingOut}
            onClick={() => {
              setSignOutError('');
              refreshSession().catch(() => {});
            }}
          >
            Try again
          </button>
          <button className="am-toggle-link" disabled={signingOut} onClick={handleSignOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    );
  }
  if (status === 'verify') return <Navigate to="/verify-email" replace />;
  if (status !== 'ready' && status !== 'admin')
    return (
      <Navigate
        to={status === 'signed-out' ? signOutRedirect || '/login' : '/login'}
        replace
        state={{ schoolEmailRequired: status === 'wrong-school' }}
      />
    );
  if (admin && status !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!admin && status === 'admin') return <Navigate to="/admin" replace />;
  return <Outlet />;
}

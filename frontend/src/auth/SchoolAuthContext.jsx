import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { apiUrl } from '../utils/backendUrl';
import { schoolAccessStatus } from '../utils/schoolAccess';

import { SchoolAuthContext } from './schoolAuth';

export function SchoolAuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, status: 'loading', error: '' });
  const [signOutRedirect, setSignOutRedirect] = useState('/login');
  const revision = useRef(0);
  const sessionCheck = useRef(null);

  const refreshSession = useCallback(({ reloadUser = true } = {}) => {
    const user = auth.currentUser;
    const existing = sessionCheck.current;
    // Firebase's listener and the sign-in form both confirm the same session.
    // Share that work, including a successful result if the listener finished first.
    if (existing?.user === user && (!reloadUser || (existing.reloadUser && existing.pending))) {
      return existing.promise;
    }

    const currentRevision = ++revision.current;
    const check = { user, reloadUser, pending: true };
    sessionCheck.current = check;
    check.promise = (async () => {
      setSession({ user, status: 'loading', error: '' });
      try {
        // Explicit verification checks need a reload. Sign-in already supplied
        // current account details and a fresh token; restored sessions use the SDK cache.
        if (user && reloadUser) await user.reload();
        if (user !== auth.currentUser || currentRevision !== revision.current) return 'signed-out';
        const status = schoolAccessStatus(user);
        if (status === 'ready') {
          const token = await user.getIdToken(reloadUser);
          if (currentRevision !== revision.current || user !== auth.currentUser)
            return 'signed-out';
          // Keep this request bound to the account whose session is being checked.
          const response = await fetch(apiUrl('/api/users/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ displayName: user.displayName || '' }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'We could not confirm access. Please try again.');
          }
        }
        if (currentRevision !== revision.current || user !== auth.currentUser) return 'signed-out';
        setSession({ user, status, error: '' });
        return status;
      } catch (error) {
        if (sessionCheck.current === check) sessionCheck.current = null;
        if (currentRevision !== revision.current || user !== auth.currentUser) return 'signed-out';
        const sessionError =
          error.name === 'TimeoutError'
            ? new Error('The server is taking too long to confirm access. Please try again.')
            : error instanceof TypeError || error.code === 'auth/network-request-failed'
              ? new Error(
                  'We couldn’t confirm access. Check your internet connection and try again.'
                )
              : error;
        if (currentRevision === revision.current) {
          setSession({
            user,
            status: 'error',
            error: sessionError.message || 'Could not check your school account.',
          });
        }
        throw sessionError;
      } finally {
        check.pending = false;
      }
    })();
    return check.promise;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setSignOutRedirect('/login');
      refreshSession({ reloadUser: false }).catch(() => {});
    });
    return () => {
      unsubscribe();
      revision.current += 1;
      sessionCheck.current = null;
    };
  }, [refreshSession]);

  const logout = useCallback(async ({ redirectTo = '/login' } = {}) => {
    // The route guard and the caller must agree before auth listeners fire.
    setSignOutRedirect(redirectTo);
    try {
      await signOut(auth);
    } catch (error) {
      setSignOutRedirect('/login');
      throw error;
    }
  }, []);
  return (
    <SchoolAuthContext.Provider value={{ ...session, refreshSession, logout, signOutRedirect }}>
      {children}
    </SchoolAuthContext.Provider>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSchoolAuth } from '../../auth/schoolAuth';
import { useVoiceAgentSession } from './useVoiceAgentSession';
import { NikkiSessionContext, NikkiVoiceTimeContext } from './nikkiSessionContext';
import { NikkiOverlayContext, NikkiPageContext } from './nikkiPageContext';
import NikkiCompanion from './NikkiCompanion';
import { runInterviewPrep } from './nikkiInterviewPrep';
import { runPracticeAgain } from './nikkiPracticeAgain';
import { runSignOut } from './nikkiSignOut';
import { NIKKI_CURSOR_MOTION } from './nikkiNavigationMotion';

const PLAYGROUND = ['/voice-agent', '/dev/voice-agent'];
// Reuse one navigation flow; only these existing Dashboard tabs can be clicked.
const DASHBOARD_DESTINATIONS = {
  open_interview_prep: { tabId: 'tab-interview-prep', panelId: 'tabpanel-interview-prep', label: 'Interview Prep', opening: 'Nikki is opening Interview Prep', done: 'Interview Prep is open' },
  configure_interview_prep: { tabId: 'tab-interview-prep', panelId: 'tabpanel-interview-prep', label: 'Interview Prep', opening: 'Nikki is setting up Interview Prep', done: 'Your interview settings are ready' },
  open_practice_history: { tabId: 'tab-history', panelId: 'tabpanel-history', label: 'History', opening: 'Nikki is opening your history', done: 'Your practice history is open' },
  open_my_progress: { tabId: 'tab-my-progress', panelId: 'tabpanel-my-progress', label: 'My Progress', opening: 'Nikki is opening My Progress', done: 'My Progress is open' },
  open_practice_again: { tabId: 'tab-practice-again', panelId: 'tabpanel-practice-again', label: 'Practice Again', opening: 'Nikki is opening Practice Again', done: 'Practice Again is open' },
  operate_practice_again: { tabId: 'tab-practice-again', panelId: 'tabpanel-practice-again', label: 'Practice Again', opening: 'Nikki is helping with your saved questions', done: 'Your Practice Again request is complete' },
  open_ai_coach: { tabId: 'tab-ai-coach', panelId: 'tabpanel-ai-coach', label: 'AI Coach', opening: 'Nikki is opening AI Coach', done: 'AI Coach is open' },
  sign_out: { label: 'Sign Out', opening: 'Nikki is saying goodbye' },
};

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new DOMException('Stopped', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function waitFor(read, signal, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const value = read();
    if (value) return value;
    await pause(timeoutMs > 5000 ? 200 : 50, signal);
  }
  throw new Error('The destination is unavailable.');
}

// One owner survives route changes. Only its context consumers receive voice-level
// updates; the Dashboard and route tree are passed through as stable children.
export function NikkiSessionOwner({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [operation, setOperation] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [overlayHost, setOverlayHost] = useState(null);
  const controller = useRef(null);
  const cursorPosition = useRef(null);
  const handoff = useRef(null);
  const backgroundAllowed = useRef(false);
  const path = useRef(location.pathname);
  const navigation = useRef(navigate);
  const pageContext = useRef(null);
  const publishPageContext = useCallback(snapshot => {
    pageContext.current = snapshot;
    return () => { if (pageContext.current === snapshot) pageContext.current = null; };
  }, []);
  const readPageContext = useCallback(() => {
    const signOut = path.current === '/dashboard' && document.querySelector('.db-signout-modal[open]');
    if (signOut) return {
      page: 'sign_out', state: signOut.getAttribute('aria-busy') === 'true' ? 'pending'
        : signOut.querySelector('.db-signout-modal__error') ? 'error' : 'ready',
      errorMessage: signOut.querySelector('.db-signout-modal__error')?.textContent || '',
    };
    // Publishers may resolve display details at read time (e.g. responsive tips).
    const snapshot = typeof pageContext.current === 'function' ? pageContext.current() : pageContext.current;
    return snapshot?.route === path.current
      ? snapshot
      : { page: PLAYGROUND.includes(path.current) ? 'voice_agent_playground' : 'unavailable', state: 'unavailable' };
  }, []);
  const onPlayground = PLAYGROUND.includes(location.pathname);
  const onDashboard = location.pathname === '/dashboard';
  const session = useVoiceAgentSession({ readPageContext, watchQuota: onDashboard || onPlayground });
  const { uiAction, completeUiAction, stopSession, connectionStatus, isSpeechFinished } = session;

  useEffect(() => { navigation.current = navigate; }, [navigate]);

  const cancelOperation = useCallback(() => controller.current?.abort(), []);
  const endSession = useCallback(() => {
    cancelOperation();
    backgroundAllowed.current = false;
    setOperation(null);
    setCursor(null);
    stopSession();
  }, [cancelOperation, stopSession]);

  useLayoutEffect(() => {
    path.current = location.pathname;
    const allowed = PLAYGROUND.includes(location.pathname) ||
      (location.pathname === '/dashboard' && backgroundAllowed.current);
    if (!allowed) {
      const transfer = handoff.current;
      if (transfer && ['/interview', '/likert-pre', '/mic-test', '/pre-test', '/post-test', '/likert-post'].includes(location.pathname)) {
        completeUiAction(transfer.id, { ok: true, outcome: location.pathname === '/interview' ? 'interview_opened' : ['/likert-pre', '/mic-test'].includes(location.pathname) ? 'setup_opened' : 'assessment_opened' });
      }
      handoff.current = null;
      cancelOperation();
      backgroundAllowed.current = false;
      // Release audio before the next page's passive microphone effects run.
      stopSession();
    }
  }, [location.pathname, cancelOperation, stopSession, completeUiAction]);

  useEffect(() => {
    if (!uiAction || connectionStatus !== 'live') return;
    const abortController = new AbortController();
    controller.current = abortController;
    const { signal } = abortController;
    const returning = uiAction.name === 'return_to_playground';
    const destination = DASHBOARD_DESTINATIONS[uiAction.name];
    const prep = uiAction.name === 'configure_interview_prep';
    const practice = uiAction.name === 'operate_practice_again';
    const signingOut = uiAction.name === 'sign_out';
    const operating = prep || practice || signingOut;
    let signOutCommitted = false;
    let target;
    let finished = false;
    let activeTarget;
    let ownedPicker;
    const interrupt = (event) => {
      if (signOutCommitted) return;
      if (event.type === 'input' && !event.isTrusted) return;
      if (event.type === 'keydown' && event.key === 'Escape') { abortController.abort(); return; }
      if (event.type === 'keydown' && !practice && !['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(event.key)) return;
      if (event.target instanceof Element && event.target.closest('[data-nikki-controls]')) return;
      if (prep && (event.type === 'wheel' || event.type === 'pointerdown') &&
        event.target instanceof Element && event.target.closest('.sb-content') &&
        readPageContext().briefing?.state === 'preparing') return;
      abortController.abort();
    };
    const status = (detail, title = destination?.opening || 'Nikki is returning to your conversation') => {
      setOperation({ phase: 'opening', title, detail });
      setCursor(current => current ? { ...current, waiting: detail.startsWith('Waiting') } : current);
    };
    const moveCursor = value => { cursorPosition.current = value; setCursor(value); };
    async function click(element, value, beforeClick) {
      signal.throwIfAborted();
      if (!(element instanceof HTMLElement) || element.matches(':disabled, [aria-disabled="true"]')) throw new Error('The control is unavailable.');
      const modal = element.closest('dialog[open]');
      // Transformed native dialogs temporarily contain fixed children. Let the
      // opening animation finish before scrolling or measuring a modal target.
      if (modal) await waitFor(() => {
        const transform = getComputedStyle(modal).transform;
        return transform === 'none' || new DOMMatrixReadOnly(transform).isIdentity;
      }, signal);
      activeTarget?.removeAttribute('data-nikki-target');
      activeTarget = element;
      element.scrollIntoView({ block: modal ? 'nearest' : operating ? 'center' : 'nearest', inline: 'nearest', behavior: 'instant' });
      await pause(250, signal);
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) throw new Error('The control is unavailable.');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      element.setAttribute('data-nikki-target', 'true');
      if (!cursorPosition.current) moveCursor({ x: reduced ? x : Math.min(innerWidth - 90, innerWidth * .65), y: reduced ? y : Math.max(100, innerHeight - 220), pressed: false });
      else setCursor({ ...cursorPosition.current, x: Math.max(0, Math.min(innerWidth - 30, cursorPosition.current.x)), y: Math.max(0, Math.min(innerHeight - 40, cursorPosition.current.y)), pressed: false });
      await pause(reduced ? 0 : NIKKI_CURSOR_MOTION.leadInMs, signal);
      moveCursor({ x, y, pressed: false });
      await pause(reduced ? 150 : NIKKI_CURSOR_MOTION.travelMs + NIKKI_CURSOR_MOTION.settleMs, signal);
      const now = element.getBoundingClientRect();
      if (!element.isConnected || element.matches(':disabled, [aria-disabled="true"]') || path.current !== '/dashboard' || Math.abs(now.left - rect.left) > 4 || Math.abs(now.top - rect.top) > 4) throw new Error('The page moved.');
      const hit = document.elementFromPoint(x, y);
      if (!hit || !element.contains(hit)) throw new Error('Another control is covering the target.');
      signal.throwIfAborted();
      moveCursor({ x, y, pressed: true });
      if (element.getAttribute('role') === 'combobox') ownedPicker = element;
      beforeClick?.();
      element.click();
      if (value !== undefined) {
        const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLInputElement ? HTMLInputElement.prototype : null;
        if (!prototype) throw new Error('This control cannot accept a value.');
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (element.isConnected) element.focus({ preventScroll: true });
      await pause(180, signal);
      moveCursor({ x, y, pressed: false });
    }
    async function runNavigation() {
      await Promise.resolve();
      signal.throwIfAborted();
      if (signingOut) {
        setOperation({ phase: 'opening', title: destination.opening, detail: 'Finishing the goodbye before signing out…' });
        const result = await runSignOut({ isSpeechFinished, route: () => path.current, click, wait: waitFor, signal, status,
          openDashboard: () => {
            backgroundAllowed.current = true;
            if (path.current !== '/dashboard') navigation.current('/dashboard');
          },
          beforeConfirm: () => {
            signOutCommitted = true;
            setOperation({ phase: 'signing_out', title: 'Signing out', detail: 'Finishing your requested sign-out…' });
          },
        });
        finished = true;
        completeUiAction(uiAction.id, { ok: true, ...result });
        return;
      }
      if (returning && PLAYGROUND.includes(path.current)) {
        finished = true;
        completeUiAction(uiAction.id, { ok: true });
        setOperation(null);
        return;
      }
      setOperation(returning
        ? { phase: 'opening', destination: 'playground', title: 'Nikki is returning to your conversation', detail: 'Selecting Return to Nikki…' }
        : { phase: 'opening', title: destination.opening, detail: 'Going to your Dashboard…' });
      if (returning) {
        if (path.current !== '/dashboard' || !backgroundAllowed.current) throw new Error('The conversation cannot return from this page.');
        target = await waitFor(() => document.querySelector('[data-nikki-return]'), signal);
      } else {
        backgroundAllowed.current = true;
        if (path.current !== '/dashboard') navigation.current('/dashboard');
        target = await waitFor(() => path.current === '/dashboard' && document.getElementById(destination.tabId), signal);
      }
      // Leaving a non-destructive practice review must not aim through a native
      // modal's inert backdrop. Dismiss it visibly before visiting another tab.
      if (!returning && destination.tabId !== 'tab-practice-again') {
        const review = document.querySelector('.pa-dialog[open]');
        if (review) {
          status('Closing your practice tip…');
          await click(review.querySelector('.pa-dialog__header button'));
          await waitFor(() => !document.querySelector('.pa-dialog[open]'), signal);
        }
      }
      // Follow-up requests operate the open panel directly, including when a
      // briefing covers its tab. Only visit the sidebar when switching tabs.
      const alreadyOpen = !returning && target.getAttribute('aria-selected') === 'true' &&
        document.querySelector('#' + destination.panelId + ':not([hidden])');
      if (!alreadyOpen) {
        if (!returning) status('Selecting the ' + destination.label + ' tab…');
        await click(target);
      }
      await waitFor(() => returning
        ? PLAYGROUND.includes(path.current) && document.querySelector('.voice-agent-playground')
        : target.getAttribute('aria-selected') === 'true' && document.querySelector('#' + destination.panelId + ':not([hidden])'), signal);
      // Skipping the cursor animation must not acknowledge a freshly mounted
      // Prep screen before its visible setup and page context finish loading.
      if (uiAction.name === 'open_interview_prep') await waitFor(() => {
        const current = readPageContext();
        return current.page === 'interview_prep' && current.state !== 'loading' && current.rolesStatus !== 'loading';
      }, signal);
      let result = {};
      if (prep) result = await runInterviewPrep({ options: uiAction.options, read: readPageContext, click, wait: waitFor, signal, status,
        route: () => path.current, beforeHandoff: () => { handoff.current = { id: uiAction.id }; } });
      if (practice) result = await runPracticeAgain({ options: uiAction.options, read: readPageContext, click, wait: waitFor, signal, status,
        route: () => path.current, beforeHandoff: () => { handoff.current = { id: uiAction.id }; } });
      finished = true;
      if (!result.handoff) completeUiAction(uiAction.id, { ok: true, ...result });
      if (returning) {
        backgroundAllowed.current = false;
        setOperation(null);
      } else setOperation({ phase: 'done', title: destination.done, detail: 'Nikki is still here. Keep talking whenever you’re ready.' });
    }
    document.addEventListener('pointerdown', interrupt, true);
    document.addEventListener('keydown', interrupt, true);
    if (practice) document.addEventListener('input', interrupt, true);
    window.addEventListener('wheel', interrupt, { passive: true });
    const resize = () => { if (!signOutCommitted) cancelOperation(); };
    window.addEventListener('resize', resize);
    runNavigation().catch((error) => {
      if (controller.current && controller.current !== abortController) return;
      // Auth/route teardown closes this conversation on success. No late error
      // or duplicate tool acknowledgment should replace that completed handoff.
      if (signOutCommitted && (signal.aborted || path.current !== '/dashboard')) return;
      if (prep && !finished) window.dispatchEvent(new Event('nikki-prep-stop'));
      const cancelled = error.name === 'AbortError';
      completeUiAction(uiAction.id, { ok: false, cancelled, ...(operating ? { detail: error.message } : {}) });
      setOperation({ phase: cancelled ? 'stopped' : 'error', title: signingOut ? cancelled ? 'Sign-out stopped' : 'Sign-out needs your attention' : practice ? cancelled ? 'Practice Again action stopped' : 'Practice Again needs your attention' : prep ? cancelled ? 'Interview setup stopped' : 'Interview setup couldn’t be completed' : cancelled ? 'Navigation stopped' : returning ? 'The conversation screen couldn’t be opened' : `${destination.label} couldn’t be opened`, detail: cancelled ? 'You’re in control. Nikki is still listening.' : operating ? error.message : returning ? 'Use Return to Nikki or ask Nikki to try again.' : `You can open ${destination.label} yourself or ask Nikki to try again.` });
    }).finally(() => {
      if (controller.current && controller.current !== abortController) return;
      activeTarget?.removeAttribute('data-nikki-target');
      if (!finished && ownedPicker?.getAttribute('aria-expanded') === 'true') ownedPicker.click();
      handoff.current = null;
      setCursor(null);
    });
    return () => {
      abortController.abort();
      if (prep && !finished) window.dispatchEvent(new Event('nikki-prep-stop'));
      document.removeEventListener('pointerdown', interrupt, true);
      document.removeEventListener('keydown', interrupt, true);
      document.removeEventListener('input', interrupt, true);
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('resize', resize);
      if (controller.current === abortController) controller.current = null;
    };
  }, [uiAction, completeUiAction, connectionStatus, cancelOperation, readPageContext, isSpeechFinished]);

  const showCompanion = (session.isLive && ((onDashboard && Boolean(operation)) || (onPlayground && operation?.phase === 'opening')))
    || (session.quotaExhausted && onDashboard && backgroundAllowed.current);
  const companion = showCompanion && <NikkiCompanion session={session} operation={operation} cursor={cursor} onStop={cancelOperation} onEnd={endSession} onReturn={() => navigate('/voice-agent')} />;
  return (
    <NikkiSessionContext.Provider value={{ ...session, stopSession: endSession }}>
      <NikkiOverlayContext.Provider value={setOverlayHost}>
        <NikkiPageContext.Provider value={publishPageContext}>
          <NikkiVoiceTimeContext.Provider value={session.voiceTimeLabel}>{children}</NikkiVoiceTimeContext.Provider>
        </NikkiPageContext.Provider>
      </NikkiOverlayContext.Provider>
      {overlayHost?.isConnected ? createPortal(companion, overlayHost) : companion}
    </NikkiSessionContext.Provider>
  );
}

export default function NikkiSessionProvider({ children }) {
  const auth = useSchoolAuth();
  // Unmounting this owner also cleans up on sign-out, lost access or account change.
  if (auth?.status !== 'ready') return children;
  return <NikkiSessionOwner key={auth.user.uid}>{children}</NikkiSessionOwner>;
}

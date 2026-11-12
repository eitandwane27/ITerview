import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import VoiceAgentPlayground from '../../src/features/voice-agent/VoiceAgentPlayground';
import NikkiSessionProvider from '../../src/features/voice-agent/NikkiSessionProvider';
import { SchoolAuthContext } from '../../src/auth/schoolAuth';
import { useNikkiSession } from '../../src/features/voice-agent/nikkiSessionContext';
import '../../src/index.css';
import '../../src/App.css';

window.microphoneAudit = { opened: 0, stopped: 0 };
window.signOutAudit = { calls: 0 };
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
  enumerateDevices: async () => [], getSupportedConstraints: () => ({}),
  getUserMedia: async () => {
    window.microphoneAudit.opened += 1;
    if (new URLSearchParams(location.search).has('slowMic')) await new Promise(resolve => setTimeout(resolve, 900));
    const context = new AudioContext();
    const stream = context.createMediaStreamDestination().stream;
    const track = stream.getTracks()[0];
    const stop = track.stop.bind(track);
    track.stop = () => { window.microphoneAudit.stopped += 1; stop(); context.close(); };
    return stream;
  }, addEventListener() {}, removeEventListener() {},
} });

function TestControls() {
  const session = useNikkiSession();
  const navigate = useNavigate();
  return <div className="history-test-controls" style={{ position: 'fixed', bottom: 28, left: 0, zIndex: 80 }}>
    <button onClick={() => session.askNikki('Show me my practice history', { expectWorkspace: false })}>Test history request</button>
    <button onClick={() => navigate('/interview')}>Test interview handoff</button>
    <button onClick={() => session.askNikki('Show me my Set 2 feedback')}>Test workspace request</button>
  </div>;
}

function Fixture() {
  const [auth, setAuth] = useState({ status: 'ready', user: { uid: 'motion-preview' } });
  const logout = async () => {
    window.signOutAudit.calls += 1;
    if (window.signOutAudit.fail) throw new Error('Synthetic sign-out failure');
    // Leave the real Firebase-free auth handoff observable in browser tests.
    setAuth({ status: 'signed-out', user: null });
  };
  return <MemoryRouter initialEntries={['/voice-agent']}>
    <SchoolAuthContext.Provider value={{ ...auth, logout }}>
    <NikkiSessionProvider>
      {auth.status === 'ready' ? <Routes>
        <Route path="/voice-agent" element={<VoiceAgentPlayground />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/interview" element={<HandoffDestination label="Interview destination" />} />
        {['/likert-pre', '/mic-test', '/pre-test', '/post-test', '/likert-post'].map(path => <Route key={path} path={path} element={<HandoffDestination label="Setup destination" />} />)}
      </Routes> : <p>Signed out</p>}
      <RouteProbe />
      {auth.status === 'ready' && <TestControls />}
    </NikkiSessionProvider>
    <div className="history-auth-controls" style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 80 }}>
      <button onClick={() => setAuth({ status: 'signed-out', user: null })}>Test sign out</button>
      <button onClick={() => setAuth({ status: 'ready', user: { uid: 'different-account' } })}>Test account change</button>
    </div>
    </SchoolAuthContext.Provider>
  </MemoryRouter>;
}
function RouteProbe() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === '/dashboard') window.signOutAudit.dashboardAt = performance.now();
  }, [location.pathname]);
  return <span hidden data-testid="nikki-test-location">{location.pathname}</span>;
}
function HandoffDestination({ label }) {
  const location = useLocation();
  useEffect(() => { window.handoffAudit = { ...window.microphoneAudit, path: location.pathname, search: location.search }; }, [location]);
  return <p>{label}</p>;
}
createRoot(document.getElementById('root')).render(<Fixture />);

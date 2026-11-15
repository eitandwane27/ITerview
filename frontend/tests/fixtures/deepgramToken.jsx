import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
// App loads the shared dropdown through Dashboard before MicTest's styles.
import '../../src/components/DashboardRoleSelect.css';
import MicTest from '../../src/components/MicTest';
import FluxDebugger from '../../src/components/FluxDebugger';
import TestWorkspace from '../../src/components/TestWorkspace';

const debuggerView = new URLSearchParams(location.search).has('debugger');
const handoffView = new URLSearchParams(location.search).has('handoff');

function InterviewBriefing() {
  const { state } = useLocation();
  return <>
    <TestWorkspace variant="pre" showBriefing enterFromSetup={state?.fromMicSetup} />
    <output data-testid="selected-voice" hidden>{state?.voice}</output>
  </>;
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/mic-test']}>
    {debuggerView ? <FluxDebugger /> : handoffView ? <Routes>
      <Route path="/mic-test" element={<MicTest />} />
      <Route path="/pre-test" element={<InterviewBriefing />} />
    </Routes> : <MicTest />}
  </MemoryRouter>
);

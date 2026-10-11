import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MainSets from '../../src/pages/MainSets';
import AiAnalysisLoader from '../../src/components/AiAnalysisLoader';
import SetBriefingOverlay from '../../src/components/SetBriefingOverlay';
import Set2TransitionOverlay from '../../src/components/Set2TransitionOverlay';
import '../../src/index.css';
import '../../src/App.css';

const query = new URLSearchParams(window.location.search);
const view = query.get('view') || 'main';
const role = query.get('role') || 'qa-test';
const confirmed = () => { document.documentElement.dataset.confirmed = 'true'; };
const diagnosticData = { threeCBreakdown: { clarity: 3, correctness: 4, completeness: 4, lowestMetric: 'clarity' } };

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[`/interview?set=${query.get('set') || 1}&mode=practice&autostart=true`]}>
      {view === 'main' && <MainSets />}
      {view === 'loader' && <AiAnalysisLoader role={role} setNumber={2} timeoutMs={60000} />}
      {view === 'transition' && <Set2TransitionOverlay role={role} onReady={confirmed} />}
      {view === 'briefing' && <SetBriefingOverlay role={role} difficulty="hard" diagnosticData={diagnosticData} onConfirm={confirmed} />}
    </MemoryRouter>
  </React.StrictMode>
);

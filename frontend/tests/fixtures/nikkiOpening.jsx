import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import VoiceAgentPlayground from '../../src/features/voice-agent/VoiceAgentPlayground';
import NikkiOpeningProvider from '../../src/features/voice-agent/NikkiOpeningProvider';
import NikkiOpening from '../../src/features/voice-agent/NikkiOpening';
import '../../src/index.css';
import '../../src/App.css';

const params = new URLSearchParams(window.location.search);
const delay = params.has('slow') ? 3000 : params.has('timeout') ? 15_000 : 0;
const Destination = lazy(() => new Promise(resolve => {
  setTimeout(() => resolve({ default: VoiceAgentPlayground }), delay);
}));
const specimen = params.get('specimen');

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/dashboard']}>
    {specimen ? <><div inert><Dashboard /></div><NikkiOpening phase={specimen} onCancel={() => { window.location.search = ''; }} /></> : <NikkiOpeningProvider>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/voice-agent" element={<Suspense fallback={null}><Destination /></Suspense>} />
      </Routes>
    </NikkiOpeningProvider>}
  </MemoryRouter>
);

// Static visual specimen of the real companion, alongside synthetic Dashboard
// data supplied by dashboardMotionServer. No microphone or paid provider calls.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import NikkiCompanion from '../../src/features/voice-agent/NikkiCompanion';
import '../../src/index.css';
import '../../src/App.css';

function Specimen() {
  const [visible, setVisible] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  useEffect(() => { document.getElementById('tab-history')?.click(); }, []);
  return <><Dashboard />{visible && <NikkiCompanion
    session={{ micEnabled, audioEnabled, agentState: 'listening', toggleMic: () => setMicEnabled(value => !value), toggleAudio: () => setAudioEnabled(value => !value) }}
    operation={{ phase: 'done', detail: 'Nikki is still here. Keep talking whenever you’re ready.' }}
    onStop={() => {}} onEnd={() => setVisible(false)} onReturn={() => setVisible(false)}
  />}</>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter><Specimen /></MemoryRouter>);

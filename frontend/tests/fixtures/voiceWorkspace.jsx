import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VoiceAgentPlayground from '../../src/features/voice-agent/VoiceAgentPlayground';
import '../../src/index.css';

document.body.style.margin = '0';

// Synthetic microphone stream for the local preview; never requests a device.
Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: {
    enumerateDevices: async () => [
      {
        kind: 'audioinput',
        deviceId: 'preview',
        label: 'Simulated microphone — Microphone Array (Realtek(R) Audio)',
      },
    ],
    getSupportedConstraints: () => ({}),
    getUserMedia: async () => {
      const context = new AudioContext();
      const stream = context.createMediaStreamDestination().stream;
      const track = stream.getTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => {
        stop();
        context.close();
      };
      return stream;
    },
    addEventListener() {},
    removeEventListener() {},
  },
});

export function Destination() {
  const location = useLocation();
  return (
    <p data-testid="practice-destination">
      {location.pathname}
      {location.search}
    </p>
  );
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/voice-agent']}>
    <Routes>
      <Route path="/voice-agent" element={<VoiceAgentPlayground />} />
      <Route path="*" element={<Destination />} />
    </Routes>
    <div
      style={{
        padding: '4px 12px',
        zIndex: 100,
        font: '10px system-ui',
        color: '#536581',
        pointerEvents: 'none',
      }}
    >
      Prototype preview · sample scores · voice simulated
    </div>
  </MemoryRouter>
);

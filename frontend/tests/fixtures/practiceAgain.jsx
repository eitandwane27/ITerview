import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import MainSets from '../../src/pages/MainSets';
import '../../src/index.css';
import '../../src/App.css';

function LocationProbe() {
  const location = useLocation();
  return <span hidden data-testid="test-location">{location.pathname}{location.search}</span>;
}
const start = new URLSearchParams(window.location.search).get('start') || '/dashboard?tab=practice-again';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/interview" element={<MainSets />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  </React.StrictMode>
);

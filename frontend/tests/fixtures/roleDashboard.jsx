import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import '../../src/index.css';
import '../../src/App.css';

export function LocationProbe() {
  const location = useLocation();
  return <span hidden data-testid="test-location">{location.pathname}{location.search}</span>;
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Dashboard />
    <LocationProbe />
  </MemoryRouter>
);

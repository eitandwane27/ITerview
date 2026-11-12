import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Results from '../../src/pages/Results';
import '../../src/index.css';

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[`/results${window.location.search}`]}>
    <Results />
  </MemoryRouter>
);

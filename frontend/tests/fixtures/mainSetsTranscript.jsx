import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MainSets from '../../src/pages/MainSets';
import '../../src/index.css';
import '../../src/App.css';

const query = new URLSearchParams(window.location.search);
const start = `/interview?set=${query.get('set') || 1}&autostart=true${query.has('preview') ? '&preview=true' : ''}`;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[start]}><MainSets /></MemoryRouter>
  </React.StrictMode>,
);

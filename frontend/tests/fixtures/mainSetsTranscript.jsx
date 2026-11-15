import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MainSets from '../../src/pages/MainSets';
import PreTest from '../../src/pages/PreTest';
import PostTest from '../../src/pages/PostTest';
import MicTest from '../../src/components/MicTest';
import '../../src/index.css';
import '../../src/App.css';

const query = new URLSearchParams(window.location.search);
const start = query.get('stage') || `/interview?set=${query.get('set') || 1}&autostart=true${query.has('preview') ? '&preview=true' : ''}`;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/interview" element={<MainSets />} />
        <Route path="/pre-test" element={<PreTest />} />
        <Route path="/post-test" element={<PostTest />} />
        <Route path="/mic-test" element={<MicTest />} />
      </Routes>
    </MemoryRouter>
  </React.StrictMode>,
);

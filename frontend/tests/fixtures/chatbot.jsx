import React from 'react';
import { createRoot } from 'react-dom/client';
import RecommendationChatbot from '../../src/components/RecommendationChatbot';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RecommendationChatbot onStart={() => { document.documentElement.dataset.started = 'true'; }} />
  </React.StrictMode>
);

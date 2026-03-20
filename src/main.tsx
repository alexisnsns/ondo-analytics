import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from './App';
import './style.css';

const rootEl = document.getElementById('app');
if (!rootEl) throw new Error('#app missing');

createRoot(rootEl).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);

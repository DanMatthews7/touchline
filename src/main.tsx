import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';

// Vite removes this development-only branch from an ordinary production build.
// Demo scenarios never enter the real-data application or its repositories.
const App = lazy(() => import.meta.env.DEV && import.meta.env.MODE === 'season-demo'
  ? import('./development/DemoApp')
  : import('./App'));

const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');
createRoot(root).render(<StrictMode><Suspense fallback={<main style={{ padding: 32, color: 'var(--ink)' }} role="status">Opening Touchline…</main>}><App /></Suspense></StrictMode>);

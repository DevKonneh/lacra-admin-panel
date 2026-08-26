import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Without periodic polling, an already-open/backgrounded tab only checks
// for a new deployed build on the next full page navigation - on an admin
// dashboard that's often left open for hours, that meant users could see
// stale data/UI long after a real fix had already shipped. Checking every
// 30 minutes (and immediately applying any found update, since
// registerType: 'autoUpdate' + workbox.skipWaiting/clientsClaim are set in
// vite.config.ts) means an open tab self-heals on its own well within a
// single work session instead of requiring a manual hard refresh.
const intervalMs = 30 * 60 * 1000;
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update();
    }, intervalMs);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

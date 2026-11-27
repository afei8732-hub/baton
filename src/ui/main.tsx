/**
 * Entry point. `?preview=1` switches to the local, offline preview harness,
 * which is how the screenshots and the demo video are produced.
 */
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const params = new URLSearchParams(window.location.search);
if (params.has('preview')) {
  (window as unknown as { __BATON_PREVIEW__: boolean }).__BATON_PREVIEW__ = true;
  document.documentElement.dataset.preview = 'true';
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

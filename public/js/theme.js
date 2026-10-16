// Dark (onyx + champagne, the default) or light (ivory + bronze) theme. The inline script in <head> sets
// data-theme before the first paint; here: the toggle button, the saved choice and the colours for canvas plans.
const KEY = 'fsp3d.theme';
const listeners = new Set();
const root = document.documentElement;

export const getTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
export function onThemeChange(fn) { listeners.add(fn); }

export function setTheme(theme) {
  root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, root.dataset.theme); } catch { /* storage unavailable */ }
  cache = null;
  syncButtons();
  listeners.forEach(fn => fn(getTheme()));
}

function syncButtons() {
  for (const b of document.querySelectorAll('[data-theme-toggle]')) {
    const light = getTheme() === 'light';
    b.setAttribute('aria-pressed', String(light));
    b.dataset.state = light ? 'light' : 'dark';
  }
}

export function initTheme() {
  if (!root.dataset.theme) root.dataset.theme = 'dark';
  for (const b of document.querySelectorAll('[data-theme-toggle]')) {
    b.addEventListener('click', () => setTheme(getTheme() === 'light' ? 'dark' : 'light'));
  }
  syncButtons();
}

// CSS custom properties for canvas drawing (--plan-*, --st-* …), read once per theme.
let cache = null;
export function cssVar(name) {
  cache ??= getComputedStyle(root);
  return cache.getPropertyValue(name).trim();
}

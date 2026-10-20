// Dark (onyx + champagne, the default) or light (ivory + bronze) theme. The inline script in <head> sets
// data-theme before the first paint; here: the toggle button, the saved choice and the colours for canvas plans.
const KEY = 'fsp3d.theme';
const listeners = new Set();
const root = typeof document === 'undefined' ? null : document.documentElement;   // null in node tests

export const getTheme = () => (root?.dataset.theme === 'light' ? 'light' : 'dark');
export function onThemeChange(fn) { listeners.add(fn); }

function applyTheme(theme) {
  root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, root.dataset.theme); } catch { /* storage unavailable */ }
  cache = null;
  syncButtons();
  listeners.forEach(fn => fn(getTheme()));
}

// from — the element the switch starts at: the new theme opens as a circle growing from it (View Transitions);
// without them (or with reduced motion) the colours cross-fade.
export function setTheme(theme, from = null) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { applyTheme(theme); return; }
  // a live WebGL scene makes the page snapshot slow: there the colours cross-fade at once instead
  if (!document.startViewTransition || !from || webglOnScreen()) {
    root.classList.add('theme-fade');
    applyTheme(theme);
    clearTimeout(setTheme.t);
    setTheme.t = setTimeout(() => root.classList.remove('theme-fade'), 600);
    return;
  }
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  // the listeners redraw their canvases synchronously. No waiting for a frame here: rendering is paused while
  // the callback runs, so requestAnimationFrame would only fire at the browser's 4 s timeout.
  const vt = document.startViewTransition(() => applyTheme(theme));
  vt.ready.then(() => root.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
    { duration: 750, easing: 'cubic-bezier(.65, 0, .25, 1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
}

function webglOnScreen() {
  return [...document.querySelectorAll('canvas[data-engine]')].some(c => {
    const r = c.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  });
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
    b.addEventListener('click', () => setTheme(getTheme() === 'light' ? 'dark' : 'light', b));
  }
  syncButtons();
}

// CSS custom properties for canvas drawing (--plan-*, --st-* …), read once per theme.
let cache = null;
export function cssVar(name, fallback = '') {
  if (!root) return fallback;
  cache ??= getComputedStyle(root);
  return cache.getPropertyValue(name).trim() || fallback;
}

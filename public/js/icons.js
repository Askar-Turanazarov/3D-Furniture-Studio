// Thin line icons (24 × 24, stroke 1.5, currentColor). A button whose text starts with one of the old glyphs
// (🔒 Конструктив, ☀, ⛶ …) gets the matching SVG instead: the texts in i18n and in the code stay as they are, and
// anything rendered later is decorated by a MutationObserver.
const P = {
  close: 'M6 6l12 12M18 6L6 18',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  bulb: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z',
  square: 'M5 19V5l14 14zM9 15v-3.5l3.5 3.5z',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  upload: 'M12 20V9M7.5 13.5L12 9l4.5 4.5M5 4h14',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  sunset: 'M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 5v3M5.8 9.3l1.6 1.6M18.2 9.3l-1.6 1.6M7 20.5h10',
  moon: 'M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z',
  walk: 'M13 3.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM9.5 21l2.2-6.2 2.8 2.7V21M8.5 12.5l2.3-4.3 3 .9 2.2 3.1M11.7 14.8l-.9-4',
  swap: 'M5 8h13l-3-3M19 16H6l3 3',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  mail: 'M3.5 5.5h17v13h-17zM3.5 6.5l8.5 6 8.5-6',
  print: 'M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z',
  building: 'M4.5 21V5.5L12 3v18M12 7.5h7.5V21M2.5 21h19M7.5 8h1.5M7.5 12h1.5M7.5 16h1.5M15 11h1.5M15 15h1.5',
  camera: 'M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 9.8a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z',
  gear: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2.5v2.6M12 18.9v2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M2.5 12h2.6M18.9 12h2.6M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8M12 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z',
  rotate: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15',
  rotateL: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9',
  grid: 'M4 4h16v16H4zM4 10h16M10 10v10',
  plan: 'M4 4h16v16H4zM4 10h7M11 4v9M15 14h5M15 14v6',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  split: 'M4 4h16v16H4zM4 11h16M9 4v7',
  edit: 'M4.5 19.5l1-4L16 5l3 3L8.5 18.5zM14 7l3 3',
  dup: 'M9 9h11v11H9zM15 9V4H4v11h5',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.1-1-1.4-1-2.4s.8-2.1 2-2.1H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M9.5 7.5h.01M14.5 7.5h.01',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  trash: 'M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9 7V4h6v3',
  target: 'M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5',
  alignL: 'M4 4v16M20 12H8M11.5 8.5L8 12l3.5 3.5',
  alignR: 'M20 4v16M4 12h12M12.5 8.5L16 12l-3.5 3.5',
  alignT: 'M4 4h16M12 20V8M8.5 11.5L12 8l3.5 3.5',
  alignB: 'M4 20h16M12 4v12M8.5 12.5L12 16l3.5-3.5',
  alignCx: 'M3 12h18M6.5 8.5L3 12l3.5 3.5M17.5 8.5L21 12l-3.5 3.5',
  alignCy: 'M12 3v18M8.5 6.5L12 3l3.5 3.5M8.5 17.5L12 21l3.5-3.5',
  distX: 'M5 12h.01M12 12h.01M19 12h.01',
  distY: 'M12 5v.01M12 12v.01M12 19v.01',
  variants: 'M8.5 3.5h9l3 3v11h-12zM15.5 20.5h-12v-12',
  ruler: 'M3 16.5L16.5 3 21 7.5 7.5 21zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2',
  backspace: 'M9 5h11.5v14H9l-6-7zM12 9l5 6M17 9l-5 6',
  move: 'M12 3v18M3 12h18M9 5.5L12 3l3 2.5M9 18.5l3 2.5 3-2.5M5.5 9L3 12l2.5 3M18.5 9l2.5 3-2.5 3',
  undo: 'M9 13.5L4 8.5l5-5M4 8.5h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 13.5l5-5-5-5M20 8.5H10a6 6 0 0 0 0 12h3',
  share: 'M12 15V3.5M8 7.5l4-4 4 4M5 12v7.5h14V12',
  home: 'M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-6h4v6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  warn: 'M12 3.5l9.5 17h-19zM12 10v4.5M12 17.5v.01',
  door: 'M6.5 21V3h11v18M3.5 21h17M14.5 12v.01',
  chandelier: 'M12 2.5V7M5 11.5a7 3 0 0 0 14 0M5 11.5h14M7 11.5v3M12 11.5v4M17 11.5v3M7 16a1 1 0 1 0 0 .01M12 17a1 1 0 1 0 0 .01M17 16a1 1 0 1 0 0 .01',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5'
};

// The old glyph → icon. Only decorative glyphs at the start of a button / link text are replaced.
const GLYPHS = {
  '✕': 'close', '🔒': 'lock', '🔓': 'unlock', '💡': 'bulb', '📐': 'square', '⬇': 'download', '⬆': 'upload',
  '☀': 'sun', '🌇': 'sunset', '🌙': 'moon', '🚶': 'walk', '⇄': 'swap', '🎲': 'dice', '✉': 'mail', '🖨': 'print',
  '🏢': 'building', '📷': 'camera', '⚙': 'gear', '⟳': 'rotate', '↺': 'rotateL', '▦': 'grid', '✎': 'edit', '⧉': 'dup',
  '⛶': 'expand', '🎨': 'palette', '📁': 'folder', '🗑': 'trash', '⌖': 'target', '⇤': 'alignL', '⇥': 'alignR',
  '⤒': 'alignT', '⤓': 'alignB', '↔': 'alignCx', '↕': 'alignCy', '⋯': 'distX', '⋮': 'distY', '⎘': 'variants',
  '📏': 'ruler', '⌫': 'backspace', '✥': 'move', '↶': 'undo', '↷': 'redo', '⤴': 'share', '🏠': 'home',
  '▲': 'up', '▼': 'down', '⚠': 'warn', '🚪': 'door'
};

export const ICONS = Object.keys(P);

export function icon(name, cls = 'ic') {
  if (!P[name]) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.icon = name;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', P[name]);
  svg.append(path);
  return svg;
}

const CLICKABLE = 'button, a, summary, [role="button"], .lock-btn';
const LEAD = new RegExp(`^\\s*(${Object.keys(GLYPHS).map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?\\s?`, 'u');

function decorate(text) {
  const host = text.parentElement;
  if (!host || !host.closest(CLICKABLE) || host.closest('svg')) return;
  const m = text.data.match(LEAD);
  if (!m) return;
  const svg = icon(GLYPHS[m[1]]);
  text.data = text.data.slice(m[0].length);
  host.insertBefore(svg, text);
  host.classList.toggle('icon-only', !host.textContent.trim());
}

function scan(root) {
  if (root.nodeType === 3) { decorate(root); return; }
  if (root.nodeType !== 1) return;
  for (const el of root.querySelectorAll('[data-icon]:not(svg)')) {
    if (el.firstElementChild?.matches('svg.ic')) continue;
    const svg = icon(el.dataset.icon);
    if (svg) el.prepend(svg);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.forEach(decorate);
}

export function initIcons(root = document.body) {
  scan(root);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') decorate(m.target);
      else m.addedNodes.forEach(scan);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}

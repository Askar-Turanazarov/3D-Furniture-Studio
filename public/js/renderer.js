// Canvas 2D top view: auto scale, grid, walls, plinth, furniture.
import { state, itemName } from './state.js';
import { rectOf, rayGaps } from './geometry.js';
import { t } from './i18n.js';

const COLORS = {
  floor: '#fbfaf7',
  wall: '#2b3044',
  gridMinor: '#eef0f4',
  gridMajor: '#dde1ea',
  plinth: '#f08c00',
  dim: '#6b7280',
  selected: '#3b5bdb',
  toItem: '#9c36b5',
  bad: '#e03131',
  badFill: 'rgba(224, 49, 49, .28)',
  found: '#2f9e44',
  foundFill: 'rgba(64, 192, 87, .35)'
};
const MARGIN = 44;   // px around the room for wall + dimension labels
const WALL_PX = 8;

let canvas, ctx, wrap;
export const view = { scale: 1, ox: 0, oy: 0 };
let errors = new Map();
let pending = false;

export function initRenderer(canvasEl, wrapEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  wrap = wrapEl;
  new ResizeObserver(() => requestDraw()).observe(wrap);
}

export function setErrors(map) { errors = map; }

export function requestDraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

export const toScreen = (x, y) => [view.ox + x * view.scale, view.oy + y * view.scale];
export const toWorld = (px, py) => [(px - view.ox) / view.scale, (py - view.oy) / view.scale];

// Scale factor so the room fits into the container with margins.
function computeView(cw, ch) {
  const { L, W } = state.room;
  const scale = Math.max(0.05, Math.min((cw - 2 * MARGIN) / L, (ch - 2 * MARGIN) / W));
  view.scale = scale;
  view.ox = Math.round((cw - L * scale) / 2);
  view.oy = Math.round((ch - W * scale) / 2);
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  computeView(cw, ch);

  drawRoom();
  drawGrid();
  drawPlinth();
  drawDimensions();
  const now = performance.now();
  const sel = state.items.find(i => i.id === state.selectedId);
  for (const it of state.items) if (it !== sel) drawItem(it, now);
  if (sel) { drawItem(sel, now); drawClearances(sel); }

  if (state.found && now < state.found.until) {
    setTimeout(requestDraw, state.found.until - now + 20);
  }
}

function drawRoom() {
  const { L, W } = state.room;
  const [x, y] = toScreen(0, 0);
  const w = L * view.scale, h = W * view.scale;
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(x - WALL_PX, y - WALL_PX, w + 2 * WALL_PX, h + 2 * WALL_PX);
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(x, y, w, h);
}

function drawGrid() {
  const { L, W } = state.room;
  const minor = state.settings.grid;
  const major = minor >= 50 ? 100 : 50;
  // Skip minor lines when they get too dense.
  const minorVisible = minor * view.scale >= 4;
  ctx.save();
  const [x0, y0] = toScreen(0, 0);
  ctx.beginPath();
  ctx.rect(x0, y0, L * view.scale, W * view.scale);
  ctx.clip();
  ctx.lineWidth = 1;
  for (const [step, color, show] of [[minor, COLORS.gridMinor, minorVisible], [major, COLORS.gridMajor, true]]) {
    if (!show) continue;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let gx = step; gx < L; gx += step) {
      const sx = Math.round(view.ox + gx * view.scale) + 0.5;
      ctx.moveTo(sx, y0); ctx.lineTo(sx, y0 + W * view.scale);
    }
    for (let gy = step; gy < W; gy += step) {
      const sy = Math.round(view.oy + gy * view.scale) + 0.5;
      ctx.moveTo(x0, sy); ctx.lineTo(x0 + L * view.scale, sy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlinth() {
  const { L, W, plinth: p } = state.room;
  if (p <= 0) return;
  const [x, y] = toScreen(p, p);
  ctx.save();
  ctx.strokeStyle = COLORS.plinth;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, (L - 2 * p) * view.scale, (W - 2 * p) * view.scale);
  ctx.restore();
}

function drawDimensions() {
  const { L, W } = state.room;
  const [x, y] = toScreen(0, 0);
  const w = L * view.scale, h = W * view.scale;
  ctx.save();
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${L} ${t('unit.cm')}`, x + w / 2, y - WALL_PX - 6);
  ctx.translate(x - WALL_PX - 8, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${W} ${t('unit.cm')}`, 0, 0);
  ctx.restore();
}

function drawItem(it, now) {
  const r = rectOf(it);
  const [x, y] = toScreen(r.x, r.y);
  const w = r.w * view.scale, h = r.h * view.scale;
  const isSel = it.id === state.selectedId;
  const isBad = (errors.get(it.id) || []).length > 0;
  const isFound = state.found && state.found.id === it.id && now < state.found.until;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = it.color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  if (isBad) { ctx.fillStyle = COLORS.badFill; ctx.fillRect(x, y, w, h); }
  else if (isFound) { ctx.fillStyle = COLORS.foundFill; ctx.fillRect(x, y, w, h); }

  ctx.lineWidth = isSel ? 3 : 1.5;
  ctx.strokeStyle = isBad ? COLORS.bad : isFound ? COLORS.found : isSel ? COLORS.selected : 'rgba(0,0,0,.45)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  drawFront(it, x, y, w, h);
  drawLabel(it, x, y, w, h);
  ctx.restore();
}

// Front side marker: rot 0 → front faces south (down), rotating clockwise.
function drawFront(it, x, y, w, h) {
  const t = Math.max(3, Math.min(6, Math.min(w, h) * 0.12));
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  let edge, tri;
  switch (it.rot) {
    case 0:   edge = [x, y + h - t, w, t]; tri = [[x + w / 2, y + h - t - 7], [x + w / 2 - 6, y + h - t - 1], [x + w / 2 + 6, y + h - t - 1]]; break;
    case 90:  edge = [x, y, t, h];         tri = [[x + t + 1, y + h / 2], [x + t + 7, y + h / 2 - 6], [x + t + 7, y + h / 2 + 6]]; break;
    case 180: edge = [x, y, w, t];         tri = [[x + w / 2, y + t + 1], [x + w / 2 - 6, y + t + 7], [x + w / 2 + 6, y + t + 7]]; break;
    default:  edge = [x + w - t, y, t, h]; tri = [[x + w - t - 1, y + h / 2], [x + w - t - 7, y + h / 2 - 6], [x + w - t - 7, y + h / 2 + 6]];
  }
  ctx.fillRect(...edge);
  if (Math.min(w, h) > 24) {
    ctx.beginPath();
    ctx.moveTo(...tri[0]); ctx.lineTo(...tri[1]); ctx.lineTo(...tri[2]);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLabel(it, x, y, w, h) {
  const name = itemName(it);
  const dims = `${it.w}×${it.d}×${it.h}`;
  const size = Math.max(9, Math.min(14, Math.min(w, h) / 4));
  if (w < 30 || h < 18) return;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 2;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const twoLines = h > size * 3;
  ctx.fillText(fit(name, w - 6), x + w / 2, y + h / 2 - (twoLines ? size * 0.6 : 0));
  if (twoLines) {
    ctx.font = `500 ${size * 0.85}px system-ui, sans-serif`;
    ctx.fillText(fit(dims, w - 6), x + w / 2, y + h / 2 + size * 0.7);
  }
  ctx.shadowBlur = 0;
}

function fit(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

// Distances (cm) from the selected item to the walls (inner faces) and to neighbours in between.
function drawClearances(it) {
  const others = state.items.filter(o => o !== it).map(o => rectOf(o));
  const lines = rayGaps(rectOf(it), others, state.room);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { x1, y1, x2, y2, d, kind } of lines) {
    if (d <= 0) continue;
    const color = kind === 'item' ? COLORS.toItem : COLORS.selected;
    const [sx1, sy1] = toScreen(x1, y1);
    const [sx2, sy2] = toScreen(x2, y2);
    if (Math.hypot(sx2 - sx1, sy2 - sy1) < 22) continue;
    ctx.strokeStyle = color;
    ctx.setLineDash(kind === 'item' ? [5, 3] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
    const label = String(Math.round(d * 10) / 10);
    const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
    const tw = ctx.measureText(label).width + 6;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
    ctx.fillStyle = color;
    ctx.fillText(label, mx, my);
  }
  ctx.restore();
}

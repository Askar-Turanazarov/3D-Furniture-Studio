// Canvas 2D top view: auto scale, grid, walls, plinth, furniture.
import { state, itemName, isSelected } from './state.js';
import { rectOf, rayGaps, obstacleRects, zOverlaps } from './geometry.js';
import { openSpec, openZoneRect, frontFace } from './zones.js';
import { wallLen } from './openings.js';
import { t } from './i18n.js';
import { ruler, measure } from './ruler.js';
import { CONFIG, sectionCount } from './config.js';

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
  foundFill: 'rgba(64, 192, 87, .35)',
  glass: '#a5d8ff',
  glassLine: '#1971c2',
  door: '#8d6e63',
  swing: 'rgba(141, 110, 99, .10)'
};
const MARGIN = 44;   // px around the room for wall + dimension labels
const WALL_PX = 8;

let canvas, ctx, wrap;
// zoom / pan are applied on top of the "fit the room" scale; they are view-only (not saved).
export const view = { scale: 1, ox: 0, oy: 0, zoom: 1, panX: 0, panY: 0 };
const ZOOM_MIN = 0.5, ZOOM_MAX = 8;
let lastW = 0, lastH = 0;
const zoomListeners = new Set();
export function onZoom(fn) { zoomListeners.add(fn); }
export const overlay = { marquee: null, niche: null };   // box selection rect; niche fill ghost (item-like)
let errors = new Map();
let pending = false;

export function initRenderer(canvasEl, wrapEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  wrap = wrapEl;
  new ResizeObserver(() => requestDraw()).observe(wrap);
}

export function setErrors(map) { errors = map; }
let obWarnings = new Map();
export function setObWarnings(map) { obWarnings = map; }
let passages = [];
export function setPassages(list) { passages = list; }
// A passage clicked in the notes flashes for 3 s even when the bands are hidden.
export const flash = { passage: null, until: 0 };

// Synchronous draw for snapshots: { dpr } overrides the pixel ratio, { clean } skips the ruler and the box selection.
let drawOpts = {};
export function drawNow(opts = {}) {
  drawOpts = opts;
  try { draw(); } finally { drawOpts = {}; }
  return canvas;
}

// Draw a room into any canvas: project previews, version comparison, the order drawing.
// opts: { doc — roomDoc (default: the current room), errors — Map, dpr, scale — px per cm (default: fit),
//         drawing — white sheet, no grid/zones; walls — every item's distances to the walls; numbers — Map id → №; pad }
// Nothing of the live plan (selection, zoom, errors) is changed. → { scale, ox, oy } of the drawn plan.
const DOC_KEYS = ['room', 'items', 'openings', 'obstacles', 'settings', 'style',
  'selectedId', 'selectedIds', 'selectedOpening', 'selectedObstacle', 'found'];
export function drawPlanTo(target, w, h, opts = {}) {
  const saved = { canvas, ctx, lastW, lastH, view: { ...view }, errors, obWarnings, passages };
  const savedState = Object.fromEntries(DOC_KEYS.map(k => [k, state[k]]));
  try {
    const d = opts.doc;
    if (d) Object.assign(state, {
      room: d.room, items: d.items || [], openings: d.openings || [], obstacles: d.obstacles || [],
      settings: { ...state.settings, ...d.settings }, style: d.style
    });
    Object.assign(state, { selectedId: null, selectedIds: new Set(), selectedOpening: null, selectedObstacle: null, found: null });
    canvas = target;
    ctx = target.getContext('2d');
    Object.assign(view, { zoom: 1, panX: 0, panY: 0 });
    errors = opts.errors || new Map();
    obWarnings = new Map();
    passages = [];
    drawOpts = { clean: true, dpr: opts.dpr || 1, size: [w, h], scale: opts.scale, pad: opts.pad,
      drawing: opts.drawing, walls: opts.walls, numbers: opts.numbers };
    draw();
    return { scale: view.scale, ox: view.ox, oy: view.oy };
  } finally {
    drawOpts = {};
    ({ canvas, ctx, lastW, lastH, errors, obWarnings, passages } = saved);
    Object.assign(view, saved.view);
    Object.assign(state, savedState);
  }
}

export function requestDraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

export const toScreen = (x, y) => [view.ox + x * view.scale, view.oy + y * view.scale];
export const toWorld = (px, py) => [(px - view.ox) / view.scale, (py - view.oy) / view.scale];

// Scale factor so the room fits into the container with margins, times the user zoom, plus pan.
function computeView(cw, ch) {
  const { L, W } = state.room;
  lastW = cw; lastH = ch;
  const m = drawOpts.pad ?? MARGIN;
  const fit = Math.max(0.05, Math.min((cw - 2 * m) / L, (ch - 2 * m) / W));
  const scale = drawOpts.scale || fit * view.zoom;
  view.scale = scale;
  view.ox = Math.round((cw - L * scale) / 2) + view.panX;
  view.oy = Math.round((ch - W * scale) / 2) + view.panY;
}

// Zoom keeping the point (px, py) of the canvas under the cursor in place.
export function zoomAt(px, py, factor) {
  const [wx, wy] = toWorld(px, py);
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor));
  if (z === view.zoom) return;
  view.zoom = z;
  computeView(lastW, lastH);
  const [nx, ny] = toScreen(wx, wy);
  view.panX += px - nx;
  view.panY += py - ny;
  changed();
}

export function zoomStep(factor) { zoomAt(lastW / 2, lastH / 2, factor); }

export function panBy(dx, dy) {
  view.panX += dx;
  view.panY += dy;
  changed();
}

export function resetView() {
  Object.assign(view, { zoom: 1, panX: 0, panY: 0 });
  changed();
}

function changed() {
  computeView(lastW, lastH);
  requestDraw();
  zoomListeners.forEach(fn => fn(view.zoom));
}

function draw() {
  const dpr = drawOpts.dpr || window.devicePixelRatio || 1;
  const [cw, ch] = drawOpts.size || [wrap.clientWidth, wrap.clientHeight];
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  computeView(cw, ch);
  const sheet = drawOpts.drawing;
  if (sheet) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }

  drawRoom();
  if (!sheet) drawGrid();
  drawPlinth();
  drawDimensions();
  drawObstacles(false);   // floor-standing structure under the furniture
  const now = performance.now();
  const sel = state.items.find(i => i.id === state.selectedId);
  for (const it of state.items) if (it !== sel && !(it.elev > 0)) drawItem(it, now);
  for (const it of state.items) if (it !== sel && it.elev > 0) drawItem(it, now);   // wall-mounted over the floor ones
  if (sel) drawItem(sel, now);
  drawObstacles(true);    // ceiling ducts and other high structure over the furniture
  if (!sheet) { drawZones(sel); drawPassages(); }
  drawOpenings();   // over the furniture: a blocked door swing stays visible
  if (sel && state.selectedIds.size === 0) drawClearances(sel);
  if (drawOpts.walls) for (const it of state.items) drawClearances(it, true);
  if (!drawOpts.clean) {
    if (overlay.marquee) drawMarquee(overlay.marquee);
    if (overlay.niche) drawNicheGhost(overlay.niche);
    drawRuler();
  }

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

function drawPassages() {
  const now = performance.now();
  const list = state.settings.showPassages === false ? [] : [...passages];
  const f = flash.passage && now < flash.until ? flash.passage : null;
  if (f && !list.some(p => same(p, f))) list.push(f);
  for (const p of list) {
    const hot = f && same(p, f);
    const [x, y] = toScreen(p.x, p.y);
    const w = p.w * view.scale, h = p.h * view.scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = hot ? 'rgba(250, 176, 5, .45)' : 'rgba(255, 212, 59, .28)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(230, 119, 0, .55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = -h; s < w; s += 8) { ctx.moveTo(x + s, y); ctx.lineTo(x + s + h, y + h); }
    ctx.stroke();
    ctx.restore();
    const label = `${p.n} ${t('unit.cm')}`;
    ctx.save();
    ctx.font = '700 11px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 8;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = '#e67700';
    ctx.fillRect(cx - tw / 2, cy - 8, tw, 16);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }
  if (f) requestDraw();   // keep animating until the flash ends
}
const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// Opening zones (dashed light blue; red when blocked). Mode: selected | all | none.
// Hidden zones still validate; a selected item with a zone error shows its zone in any mode.
const zoneErr = it => (errors.get(it.id) || []).some(e => e.key.startsWith('err.openZone'));

function drawZones(sel) {
  const mode = state.settings.showZones || 'selected';
  const list = mode === 'all' ? state.items
    : state.items.filter(it => isSelected(it.id) && (mode === 'selected' || zoneErr(it)));
  for (const it of list) drawZone(it);
}

function drawZone(it) {
  const spec = openSpec(it, state.catalog);
  const z = openZoneRect(it, spec);
  if (!z) return;
  const bad = zoneErr(it);
  ctx.save();
  ctx.strokeStyle = bad ? COLORS.bad : '#339af0';
  ctx.fillStyle = bad ? 'rgba(224, 49, 49, .08)' : 'rgba(77, 171, 247, .1)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  if (spec.kind === 'swing') {
    // One quarter arc per leaf; hinges on the outer sides.
    const f = frontFace(it);
    const dw = f.len / spec.doors, rad = Math.min(spec.depth, dw);
    for (let i = 0; i < spec.doors; i++) {
      const left = i < spec.doors / 2;
      const s = left ? i * dw : (i + 1) * dw;
      const hx = f.p[0] + f.u[0] * s, hy = f.p[1] + f.u[1] * s;
      const sign = left ? 1 : -1;
      const [cx, cy] = toScreen(hx, hy);
      const a0 = Math.atan2(f.u[1] * sign, f.u[0] * sign), a1 = Math.atan2(f.n[1], f.n[0]);
      const ccw = (f.u[0] * sign) * f.n[1] - (f.u[1] * sign) * f.n[0] < 0;
      const R = rad * view.scale;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1, ccw);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const [x, y] = toScreen(z.x, z.y);
    ctx.fillRect(x, y, z.w * view.scale, z.h * view.scale);
    ctx.strokeRect(x + 0.5, y + 0.5, z.w * view.scale - 1, z.h * view.scale - 1);
  }
  ctx.restore();
}

// Structure: grey hatching, height label; high parts (ceiling ducts) are light with a dashed outline and "↑240".
const HIGH = 150;   // bottom above this — the obstacle hangs over the furniture

function drawObstacles(high) {
  for (const o of state.obstacles || []) {
    if ((o.elev >= HIGH) !== high) continue;
    const [x, y] = toScreen(o.x, o.y);
    const w = o.w * view.scale, h = o.d * view.scale;
    const sel = o.id === state.selectedObstacle;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = high ? 'rgba(134, 142, 150, .14)' : 'rgba(134, 142, 150, .38)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = high ? 'rgba(73, 80, 87, .3)' : 'rgba(73, 80, 87, .6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = -h; s < w; s += 7) { ctx.moveTo(x + s, y + h); ctx.lineTo(x + s + h, y); }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const warn = obWarnings.has(o.id);
    ctx.strokeStyle = sel ? COLORS.selected : warn ? '#f08c00' : '#495057';
    ctx.lineWidth = sel || warn ? 2.5 : 1.2;
    if (high) ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const label = high ? `↑${o.elev}` : o.elev > 0 ? `${o.h} ↑${o.elev}` : `${o.h}`;
    const name = t('ob.' + o.kind);
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = w > ctx.measureText(name).width + 8 && h > 26;
    if (w > ctx.measureText(label).width + 6 && h > 12) {
      const cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, .85)';
      const bw = Math.max(ctx.measureText(label).width, big ? ctx.measureText(name).width : 0) + 6;
      const bh = big ? 26 : 13;
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.fillStyle = '#343a40';
      if (big) {
        ctx.fillText(name, cx, cy - 6);
        ctx.fillText(label, cx, cy + 6);
      } else ctx.fillText(label, cx, cy);
    }
    ctx.restore();
  }
}

// Opening on the plan in screen px: a = start along the wall, b = end; wall band is WALL_PX thick outside the floor.
function openingGeom(o) {
  const { L, W } = state.room;
  const s = view.scale;
  const [x0, y0] = toScreen(0, 0);
  const a = o.offset * s, b = (o.offset + o.width) * s;
  switch (o.wall) {
    // p(u, v): u along the wall from its start, v into the room from the inner face.
    case 'north': return { band: [x0 + a, y0 - WALL_PX, b - a, WALL_PX], p: (u, v) => [x0 + u, y0 + v], a, b, horiz: true };
    case 'south': return { band: [x0 + a, y0 + W * s, b - a, WALL_PX], p: (u, v) => [x0 + u, y0 + W * s - v], a, b, horiz: true };
    case 'west':  return { band: [x0 - WALL_PX, y0 + a, WALL_PX, b - a], p: (u, v) => [x0 + v, y0 + u], a, b, horiz: false };
    default:      return { band: [x0 + L * s, y0 + a, WALL_PX, b - a], p: (u, v) => [x0 + L * s - v, y0 + u], a, b, horiz: false };
  }
}

// Windows: glass in the wall with the classic 3-line symbol. Doors: gap, leaf and dashed swing arc.
function drawOpenings() {
  for (const o of state.openings || []) {
    const g = openingGeom(o);
    const [bx, by, bw, bh] = g.band;
    const isSel = o.id === state.selectedOpening;
    ctx.save();
    if (o.kind === 'window') {
      ctx.fillStyle = COLORS.glass;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = COLORS.glassLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const k of [0, 0.5, 1]) {
        if (g.horiz) { const y = by + k * bh; ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); }
        else { const x = bx + k * bw; ctx.moveTo(x, by); ctx.lineTo(x, by + bh); }
      }
      ctx.stroke();
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    } else {
      const r = g.b - g.a;
      const hingeU = o.hinge === 'end' ? g.b : g.a, freeU = o.hinge === 'end' ? g.a : g.b;
      ctx.fillStyle = COLORS.floor;
      ctx.fillRect(bx, by, bw, bh);
      // Swing sector.
      const [hx, hy] = g.p(hingeU, 0);
      const [lx, ly] = g.p(hingeU, r);
      const [fx, fy] = g.p(freeU, 0);
      const a0 = Math.atan2(ly - hy, lx - hx), a1 = Math.atan2(fy - hy, fx - hx);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      ctx.fillStyle = COLORS.swing;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, r, a0, a0 + da, da < 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COLORS.door;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx, hy, r, a0, a0 + da, da < 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke();
    }
    if (isSel) {
      ctx.strokeStyle = COLORS.selected;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
      drawOpeningDims(o, g);
    }
    ctx.restore();
  }
}

// Distances from the selected opening to both corners of its wall, drawn just inside the room.
function drawOpeningDims(o, g) {
  const len = wallLen(o.wall, state.room);
  const s = view.scale;
  const segs = [[0, g.a, o.offset], [g.b, len * s, len - o.offset - o.width]];
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [u0, u1, d] of segs) {
    if (d <= 0 || u1 - u0 < 24) continue;
    const [x1, y1] = g.p(u0, 16), [x2, y2] = g.p(u1, 16);
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const label = String(Math.round(d));
    const tw = ctx.measureText(label).width + 6;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
    ctx.fillStyle = COLORS.selected;
    ctx.fillText(label, mx, my);
  }
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
  const isSel = isSelected(it.id);
  const isPrimary = it.id === state.selectedId;
  const isBad = (errors.get(it.id) || []).length > 0;
  const isFound = state.found && state.found.id === it.id && now < state.found.until;

  const high = it.elev > 0;
  ctx.save();
  ctx.globalAlpha = high ? 0.55 : 0.9;
  ctx.fillStyle = it.color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  if (high) ctx.setLineDash([6, 4]);
  if (isBad) { ctx.fillStyle = COLORS.badFill; ctx.fillRect(x, y, w, h); }
  else if (isFound) { ctx.fillStyle = COLORS.foundFill; ctx.fillRect(x, y, w, h); }

  ctx.lineWidth = isPrimary ? 3 : isSel ? 2 : 1.5;
  ctx.strokeStyle = isBad ? COLORS.bad : isFound ? COLORS.found : isSel ? COLORS.selected : 'rgba(0,0,0,.45)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (isSel && isBad) {
    // A selected problem item keeps its red outline plus a blue selection frame.
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = isPrimary ? 2 : 1.5;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  }

  ctx.setLineDash([]);
  drawSections(it, x, y, w, h);
  drawFront(it, x, y, w, h);
  drawLabel(it, x, y, w, h);
  if (high) drawElevTag(it, x, y, w, h);
  const no = drawOpts.numbers?.get(it.id);
  if (no) drawNumber(no, x + w, y);
  ctx.restore();
}

// Specification number in a circle at the top-right corner of the item (order drawing).
function drawNumber(no, x, y) {
  const r = 11;
  ctx.fillStyle = '#212529';
  ctx.beginPath();
  ctx.arc(x - r - 2, y + r + 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(no), x - r - 2, y + r + 2);
}

// "↑140" badge in the corner of a wall-mounted item.
function drawElevTag(it, x, y, w, h) {
  const text = `↑${it.elev}`;
  ctx.font = '700 10px system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 6;
  if (w < tw || h < 6) return;
  const bh = Math.min(13, h);
  ctx.fillStyle = 'rgba(33, 37, 41, .78)';
  ctx.fillRect(x + 1, y + 1, tw, bh);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 4, y + 1 + bh / 2);
}

const RULER = '#0b7285';

// "Fill a niche" proposal: dashed green outline, front edge and the size.
function drawNicheGhost(it) {
  const r = rectOf(it);
  const [x, y] = toScreen(r.x, r.y);
  const w = r.w * view.scale, h = r.h * view.scale;
  ctx.save();
  ctx.fillStyle = 'rgba(47, 158, 68, .22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.setLineDash([]);
  drawFront(it, x, y, w, h);
  const text = `${it.w}×${it.d}×${it.h}`;
  ctx.font = '700 12px system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 10;
  ctx.fillStyle = '#2f9e44';
  ctx.fillRect(x + w / 2 - tw / 2, y + h / 2 - 9, tw, 18);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawRuler() {
  for (const m of ruler.measures) drawMeasure(m.a, m.b, false);
  if (!ruler.active) return;
  const h = ruler.hover;
  if (ruler.a && h) drawMeasure(ruler.a, h, true);
  else if (ruler.a) drawRulerPoint(ruler.a, true);
  if (h) drawRulerPoint(h, h.snapX || h.snapY);
}

function drawRulerPoint(p, snapped) {
  const [x, y] = toScreen(p.x, p.y);
  ctx.save();
  ctx.strokeStyle = RULER;
  ctx.fillStyle = snapped ? RULER : '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Line with end ticks and a label "237 см" (+ Δx / Δy for a diagonal).
function drawMeasure(a, b, preview) {
  const [x0, y0] = toScreen(a.x, a.y);
  const [x1, y1] = toScreen(b.x, b.y);
  const { len, dx, dy } = measure(a, b);
  const pl = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / pl * 6, ny = (x1 - x0) / pl * 6;
  ctx.save();
  ctx.strokeStyle = RULER;
  ctx.lineWidth = 1.5;
  if (preview) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x0 - nx, y0 - ny); ctx.lineTo(x0 + nx, y0 + ny);
  ctx.moveTo(x1 - nx, y1 - ny); ctx.lineTo(x1 + nx, y1 + ny);
  ctx.stroke();
  if (len >= 1) {
    const cm = t('unit.cm');
    const lines = [`${Math.round(len)} ${cm}`];
    if (dx >= 1 && dy >= 1) lines.push(`Δx ${Math.round(dx)} · Δy ${Math.round(dy)}`);
    ctx.font = '700 12px system-ui, sans-serif';
    const tw = Math.max(...lines.map(s => ctx.measureText(s).width)) + 10;
    const th = lines.length * 15 + 4;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.strokeStyle = RULER;
    ctx.lineWidth = 1;
    ctx.fillRect(mx - tw / 2, my - th / 2, tw, th);
    ctx.strokeRect(mx - tw / 2 + 0.5, my - th / 2 + 0.5, tw - 1, th - 1);
    ctx.fillStyle = RULER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((s, i) => {
      if (i) ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(s, mx, my - th / 2 + 10 + i * 15);
    });
  }
  ctx.restore();
}

function drawMarquee(m) {
  const [x0, y0] = toScreen(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1));
  const [x1, y1] = toScreen(Math.max(m.x0, m.x1), Math.max(m.y0, m.y1));
  ctx.save();
  ctx.fillStyle = 'rgba(59, 91, 219, .08)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.selected;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
  ctx.restore();
}

// Front side marker: rot 0 → front faces south (down), rotating clockwise.
// Section partitions of a configurable wardrobe / kitchen: thin lines across the depth.
function drawSections(it, x, y, w, h) {
  if (!CONFIG[it.type]?.sections) return;
  const n = sectionCount(it), along = it.rot % 180 === 0;
  if (n < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (let k = 1; k < n; k++) {
    if (along) { const sx = Math.round(x + w * k / n) + 0.5; ctx.moveTo(sx, y + 2); ctx.lineTo(sx, y + h - 2); }
    else { const sy = Math.round(y + h * k / n) + 0.5; ctx.moveTo(x + 2, sy); ctx.lineTo(x + w - 2, sy); }
  }
  ctx.stroke();
  ctx.restore();
}

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
// wallsOnly: the order drawing shows every item's distances to the walls.
function drawClearances(it, wallsOnly = false) {
  // Only neighbours at the same height: a shelf above the desk does not "close" the desk.
  const others = state.items.filter(o => o !== it && zOverlaps(o, it)).map(o => rectOf(o))
    .concat(obstacleRects(state.obstacles, it));
  const lines = rayGaps(rectOf(it), others, state.room);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { x1, y1, x2, y2, d, kind } of lines) {
    if (d <= 0 || (wallsOnly && kind !== 'wall')) continue;
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

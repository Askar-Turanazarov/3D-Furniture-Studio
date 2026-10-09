// Pointer (mouse + touch) drag with snap, multi-select, keyboard rotate / delete / nudge.
import { state, emit, select, selected, rotateItem, removeItems, moveItems, snapValue,
  selectOpening, selectedOpening, removeOpening, updateOpening,
  isSelected, selectedItems, toggleSelect, selectMany,
  selectObstacle, selectedOb, updateObstacle, removeObstacle } from './state.js';
import { obRect } from './obstacles.js';
import { rectOf, footprint, overlaps } from './geometry.js';
import { nearestWall, wallLen } from './openings.js';
import { toWorld, view, overlay, requestDraw, zoomAt, zoomStep, panBy, resetView, onZoom } from './renderer.js';
import { history } from './history.js';
import { duplicate, toast } from './ui.js';
import { ruler, snapLines, snapPoint, lockAxis } from './ruler.js';
import { t } from './i18n.js';

const MAGNET_PX = 8;   // edges stick to walls / neighbours within this screen distance
const OPENING_PX = 14; // an opening is grabbed within this screen distance from its wall
const PAN_PX = 4;      // a press on the empty floor becomes panning after this movement
// { item, offX, offY, group: [{ it, dx, dy }], pointerId } | { opening, grab, pointerId } | { marquee, pointerId }
// | { pan, sx, sy, moved, pointerId }
let drag = null;
let space = false;            // Space held: drag pans the plan
const touches = new Map();    // active touch pointers → [x, y] (pinch zoom)
let pinch = null;             // { d, mx, my }

export function initInteraction(canvas) {
  initZoom(canvas);
  initRuler(canvas);
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, local(canvas, e));
      if (touches.size === 2) return startPinch();
      if (touches.size > 2) return;
    }
    // Middle button or Space+drag: pan anywhere.
    if (e.button === 1 || space) {
      drag = { pan: true, sx: e.clientX, sy: e.clientY, moved: true, pointerId: e.pointerId };
      capture(canvas, e);
      e.preventDefault();
      return;
    }
    const [wx, wy] = toWorld(...local(canvas, e));
    if (ruler.active) {
      if (e.button === 0) rulerClick(wx, wy, e.shiftKey);
      return;
    }
    const hit = hitTest(wx, wy);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (hit?.opening) {
      const o = hit.opening;
      drag = { opening: o, grab: nearestWall(wx, wy, state.room).along - o.offset, pointerId: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      history.begin();
      if (state.selectedOpening !== o.id) selectOpening(o.id);
      return;
    }
    if (hit?.obstacle) {
      const o = hit.obstacle;
      drag = { obstacle: o, offX: wx - o.x, offY: wy - o.y, pointerId: e.pointerId };
      capture(canvas, e);
      history.begin();
      if (state.selectedObstacle !== o.id) selectObstacle(o.id);
      return;
    }
    if (!hit) {
      if (e.shiftKey) {
        // Rubber band selection.
        drag = { marquee: true, pointerId: e.pointerId };
        overlay.marquee = { x0: wx, y0: wy, x1: wx, y1: wy };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      // Empty floor: a click deselects, a drag pans the plan.
      drag = { pan: true, sx: e.clientX, sy: e.clientY, moved: false, pointerId: e.pointerId };
      capture(canvas, e);
      return;
    }
    if (additive) return toggleSelect(hit.id);
    // Dragging an item of a multi-selection moves the whole group.
    const group = isSelected(hit.id) ? selectedItems().filter(it => it !== hit) : [];
    if (!isSelected(hit.id)) select(hit.id);
    drag = {
      item: hit, offX: wx - hit.x, offY: wy - hit.y, pointerId: e.pointerId,
      group: group.map(it => ({ it, dx: it.x - hit.x, dy: it.y - hit.y }))
    };
    canvas.setPointerCapture(e.pointerId);
    history.begin();
  });

  canvas.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, local(canvas, e));
      if (pinch) return movePinch();
    }
    const [wx, wy] = toWorld(...local(canvas, e));
    if (drag?.pan && e.pointerId === drag.pointerId) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < PAN_PX) return;
      drag.moved = true;
      drag.sx = e.clientX; drag.sy = e.clientY;
      canvas.style.cursor = 'grabbing';
      return panBy(dx, dy);
    }
    if (!drag && ruler.active) {
      ruler.hover = rulerPoint(wx, wy, e.shiftKey);
      canvas.style.cursor = 'crosshair';
      return requestDraw();
    }
    if (!drag) {
      canvas.style.cursor = hitTest(wx, wy) ? 'grab' : 'default';
      return;
    }
    if (e.pointerId !== drag.pointerId) return;
    if (drag.marquee) {
      Object.assign(overlay.marquee, { x1: wx, y1: wy });
      return requestDraw();
    }
    canvas.style.cursor = 'grabbing';
    if (drag.opening) return dragOpening(wx, wy);
    if (drag.obstacle) return dragObstacle(wx, wy);
    const it = drag.item;
    const f = footprint(it);
    const { L, W } = state.room;
    const skip = new Set([it, ...drag.group.map(g => g.it)]);
    // Keep at least half of the item inside the room so it can't get lost.
    const rawX = clamp(wx - drag.offX, -f.w / 2, L - f.w / 2);
    const rawY = clamp(wy - drag.offY, -f.h / 2, W - f.h / 2);
    const nx = magnet(rawX, f.w, 'x', skip) ?? snapValue(rawX);
    const ny = magnet(rawY, f.h, 'y', skip) ?? snapValue(rawY);
    if (nx !== it.x || ny !== it.y) {
      it.x = nx; it.y = ny;
      for (const g of drag.group) { g.it.x = nx + g.dx; g.it.y = ny + g.dy; }
      emit();
    }
  });

  const end = e => {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.pan) {
      const click = !drag.moved;
      drag = null;
      canvas.style.cursor = space ? 'grab' : 'default';
      if (click) {
        if (state.selectedId !== null || state.selectedIds.size) select(null);
        else if (state.selectedOpening !== null) selectOpening(null);
        else if (state.selectedObstacle !== null) selectObstacle(null);
      }
      return;
    }
    if (drag.marquee) {
      const m = overlay.marquee;
      overlay.marquee = null;
      drag = null;
      const box = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
      const ids = state.items.filter(it => overlaps(rectOf(it), box)).map(it => it.id);
      const keep = selectedItems().map(it => it.id).filter(id => !ids.includes(id));
      if (box.w > 1 || box.h > 1) selectMany([...keep, ...ids]);
      return requestDraw();
    }
    drag = null;
    canvas.style.cursor = 'grab';
    history.end();   // the whole drag is one undo step
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
    if (!document.getElementById('view3d').hidden) return;   // keys belong to the 3D view
    const mod = e.ctrlKey || e.metaKey;
    if (!mod && e.code === 'KeyM') { toggleRuler(); return e.preventDefault(); }
    if (ruler.active && e.key === 'Escape') {
      // Esc first drops an unfinished measurement, then leaves the ruler mode.
      if (ruler.a) { ruler.a = null; requestDraw(); } else toggleRuler(false);
      return e.preventDefault();
    }
    if (mod && e.code === 'KeyA') {
      selectMany(state.items.map(i => i.id));
      return e.preventDefault();
    }
    if (selectedOpening()) return openingKey(e);
    if (selectedOb()) return obstacleKey(e);
    const items = selectedItems();
    if (!items.length) return;
    if (mod && e.code === 'KeyD') { duplicate(); return e.preventDefault(); }
    if (mod) return;
    const step = state.settings.snap * (e.shiftKey ? 10 : 1);
    switch (e.key) {
      case 'r': case 'R': case 'к': case 'К': if (items.length === 1) rotateItem(items[0]); break;
      case 'Delete': case 'Backspace': removeItems(items.map(i => i.id)); break;
      case 'Escape': select(null); break;
      case 'ArrowLeft': moveItems(items, -step, 0); break;
      case 'ArrowRight': moveItems(items, step, 0); break;
      case 'ArrowUp': moveItems(items, 0, -step); break;
      case 'ArrowDown': moveItems(items, 0, step); break;
      default: return;
    }
    e.preventDefault();
  });
}

// --- Ruler ---
let rulerCanvas = null;

function initRuler(canvas) {
  rulerCanvas = canvas;
  document.getElementById('rulerBtn').addEventListener('click', () => toggleRuler());
  document.getElementById('rulerClearBtn').addEventListener('click', () => {
    ruler.measures = [];
    ruler.a = null;
    syncRuler();
  });
  canvas.addEventListener('pointerleave', () => { if (ruler.hover) { ruler.hover = null; requestDraw(); } });
}

export function toggleRuler(on = !ruler.active) {
  if (on === ruler.active) return;
  ruler.active = on;
  ruler.a = ruler.hover = null;
  rulerCanvas.style.cursor = on ? 'crosshair' : 'default';
  if (on) toast(t('ruler.on'));
  syncRuler();
}

// Another room: measurements of the previous one make no sense.
export function resetRuler() {
  ruler.measures = [];
  ruler.a = ruler.hover = null;
  if (ruler.active) toggleRuler(false);
  else syncRuler();
}

function syncRuler() {
  document.getElementById('rulerBtn').classList.toggle('active', ruler.active);
  document.getElementById('rulerClearBtn').hidden = !ruler.measures.length;
  requestDraw();
}

function rulerPoint(wx, wy, shift) {
  const lines = snapLines(state.room, [...state.items.map(it => rectOf(it)), ...(state.obstacles || []).map(obRect)]);
  const p = snapPoint(wx, wy, lines, MAGNET_PX / view.scale);
  return shift && ruler.a ? lockAxis(ruler.a, p) : p;
}

function rulerClick(wx, wy, shift) {
  const p = rulerPoint(wx, wy, shift);
  if (!ruler.a) ruler.a = { x: p.x, y: p.y };
  else {
    if (p.x !== ruler.a.x || p.y !== ruler.a.y) ruler.measures.push({ a: ruler.a, b: { x: p.x, y: p.y } });
    ruler.a = null;
  }
  ruler.hover = p;
  syncRuler();
}

function capture(canvas, e) {
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
}

// Wheel zoom around the cursor, +/−/fit buttons, Space for panning, two-finger pinch.
function initZoom(canvas) {
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = local(canvas, e);
    zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  }, { passive: false });
  canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomStep(1.25));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomStep(0.8));
  document.getElementById('zoomFitBtn').addEventListener('click', resetView);
  onZoom(z => { document.getElementById('zoomFitBtn').textContent = Math.round(z * 100) + '%'; });
  const typing = e => e.target instanceof Element && e.target.closest('input, textarea, select');
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !typing(e) && document.getElementById('view3d').hidden) {
      if (!space) canvas.style.cursor = 'grab';
      space = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { space = false; canvas.style.cursor = 'default'; } });
  window.addEventListener('blur', () => { space = false; });
}

function startPinch() {
  // The second finger cancels a drag of the first one.
  if (drag && !drag.pan && !drag.marquee) history.end();
  drag = null;
  const [a, b] = [...touches.values()];
  pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
}

function movePinch() {
  const [a, b] = [...touches.values()];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  panBy(mx - pinch.mx, my - pinch.my);
  if (pinch.d > 10) zoomAt(mx, my, d / pinch.d);
  Object.assign(pinch, { d, mx, my });
}

function local(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

// On the wall band an opening wins; on the floor furniture wins, then an opening near its wall.
// Locked openings are never hit, so clicks go through to the furniture.
function hitTest(x, y) {
  const { L, W } = state.room;
  const onFloor = x >= 0 && x <= L && y >= 0 && y <= W;
  const op = state.openingsLocked ? null : openingAt(x, y);
  if (op && !onFloor) return { opening: op };
  const order = [...state.items].reverse();
  const sel = selected();
  if (sel) order.unshift(sel);
  const item = order.find(it => {
    const r = rectOf(it);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }) || null;
  if (item) return item;
  const ob = state.openingsLocked ? null : obstacleAt(x, y);
  if (ob) return { obstacle: ob };
  return op ? { opening: op } : null;
}

function obstacleAt(x, y) {
  const list = [...(state.obstacles || [])].reverse();
  const sel = selectedOb();
  if (sel) list.unshift(sel);
  return list.find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.d) || null;
}

// Obstacles snap to the grid from the wall and stick to walls and other obstacles.
function dragObstacle(wx, wy) {
  const o = drag.obstacle;
  const { L, W } = state.room;
  const snap = Math.max(1, state.settings.snap);
  const rawX = clamp(wx - drag.offX, 0, L - o.w);
  const rawY = clamp(wy - drag.offY, 0, W - o.d);
  const nx = obMagnet(rawX, o.w, 'x', o) ?? Math.round(rawX / snap) * snap;
  const ny = obMagnet(rawY, o.d, 'y', o) ?? Math.round(rawY / snap) * snap;
  if (nx !== o.x || ny !== o.y) updateObstacle(o, { x: nx, y: ny });
}

function obMagnet(raw, size, axis, self) {
  const tol = MAGNET_PX / view.scale;
  const max = axis === 'x' ? state.room.L : state.room.W;
  const cands = [0, max - size];
  for (const o of state.obstacles) {
    if (o === self) continue;
    const [s, len] = axis === 'x' ? [o.x, o.w] : [o.y, o.d];
    cands.push(s + len, s - size, s, s + len - size);
  }
  let best = null, bestD = tol;
  for (const c of cands) {
    const d = Math.abs(raw - c);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function obstacleKey(e) {
  const o = selectedOb();
  const step = state.settings.snap * (e.shiftKey ? 10 : 1);
  switch (e.key) {
    case 'Delete': case 'Backspace': removeObstacle(o.id); break;
    case 'Escape': selectObstacle(null); break;
    case 'ArrowLeft': updateObstacle(o, { x: o.x - step }); break;
    case 'ArrowRight': updateObstacle(o, { x: o.x + step }); break;
    case 'ArrowUp': updateObstacle(o, { y: o.y - step }); break;
    case 'ArrowDown': updateObstacle(o, { y: o.y + step }); break;
    default: return;
  }
  e.preventDefault();
}

function openingAt(x, y) {
  const tol = OPENING_PX / view.scale;
  const { wall, along, dist } = nearestWall(x, y, state.room);
  if (dist > tol) return null;
  return (state.openings || []).find(o => o.wall === wall && along >= o.offset - tol && along <= o.offset + o.width + tol) || null;
}

// Slide along the wall with snap; dragging towards another wall moves the opening there.
function dragOpening(wx, wy) {
  const o = drag.opening;
  const nw = nearestWall(wx, wy, state.room);
  let grab = drag.grab;
  if (nw.wall !== o.wall) grab = drag.grab = o.width / 2;
  const snap = Math.max(1, state.settings.snap);
  const offset = Math.round((nw.along - grab) / snap) * snap;
  const max = wallLen(nw.wall, state.room) - o.width;
  const next = Math.max(0, Math.min(max, offset));
  if (nw.wall !== o.wall || next !== o.offset) updateOpening(o, { wall: nw.wall, offset: next });
}

function openingKey(e) {
  const o = selectedOpening();
  const step = state.settings.snap * (e.shiftKey ? 10 : 1);
  const back = o.wall === 'north' || o.wall === 'south' ? 'ArrowLeft' : 'ArrowUp';
  const fwd = o.wall === 'north' || o.wall === 'south' ? 'ArrowRight' : 'ArrowDown';
  switch (e.key) {
    case 'Delete': case 'Backspace': removeOpening(o.id); break;
    case 'Escape': selectOpening(null); break;
    case back: updateOpening(o, { offset: o.offset - step }); break;
    case fwd: updateOpening(o, { offset: o.offset + step }); break;
    default: return;
  }
  e.preventDefault();
}

// Snap the item edge to the plinth line or to a neighbour edge (+gap); items in `skip` move together.
function magnet(raw, size, axis, skip) {
  const tol = MAGNET_PX / view.scale;
  const { plinth: p } = state.room;
  const max = axis === 'x' ? state.room.L : state.room.W;
  const gap = state.settings.gap;
  const cands = [p, max - p - size];
  for (const o of state.items) {
    if (skip.has(o)) continue;
    const r = rectOf(o);
    const [s, len] = axis === 'x' ? [r.x, r.w] : [r.y, r.h];
    cands.push(s + len + gap, s - gap - size, s, s + len - size);
  }
  let best = null, bestD = tol;
  for (const c of cands) {
    const d = Math.abs(raw - c);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

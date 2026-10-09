// Pointer (mouse + touch) drag with snap, keyboard rotate / delete / nudge.
import { state, emit, select, selected, rotateItem, removeItem, snapValue,
  selectOpening, selectedOpening, removeOpening, updateOpening } from './state.js';
import { rectOf, footprint } from './geometry.js';
import { nearestWall, wallLen } from './openings.js';
import { toWorld, view } from './renderer.js';
import { history } from './history.js';

const MAGNET_PX = 8;   // edges stick to walls / neighbours within this screen distance
const OPENING_PX = 14; // an opening is grabbed within this screen distance from its wall
let drag = null;       // { item, offX, offY, pointerId } | { opening, grab, pointerId }

export function initInteraction(canvas) {
  canvas.addEventListener('pointerdown', e => {
    const [wx, wy] = toWorld(...local(canvas, e));
    const hit = hitTest(wx, wy);
    if (hit?.opening) {
      const o = hit.opening;
      drag = { opening: o, grab: nearestWall(wx, wy, state.room).along - o.offset, pointerId: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      history.begin();
      if (state.selectedOpening !== o.id) selectOpening(o.id);
      return;
    }
    if (!hit) {
      if (state.selectedId !== null) select(null);
      else if (state.selectedOpening !== null) selectOpening(null);
      return;
    }
    drag = { item: hit, offX: wx - hit.x, offY: wy - hit.y, pointerId: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    history.begin();
    if (state.selectedId !== hit.id) select(hit.id);
  });

  canvas.addEventListener('pointermove', e => {
    const [wx, wy] = toWorld(...local(canvas, e));
    if (!drag) {
      canvas.style.cursor = hitTest(wx, wy) ? 'grab' : 'default';
      return;
    }
    if (e.pointerId !== drag.pointerId) return;
    canvas.style.cursor = 'grabbing';
    if (drag.opening) return dragOpening(wx, wy);
    const it = drag.item;
    const f = footprint(it);
    const { L, W } = state.room;
    // Keep at least half of the item inside the room so it can't get lost.
    const rawX = clamp(wx - drag.offX, -f.w / 2, L - f.w / 2);
    const rawY = clamp(wy - drag.offY, -f.h / 2, W - f.h / 2);
    const nx = magnet(rawX, f.w, 'x', it) ?? snapValue(rawX);
    const ny = magnet(rawY, f.h, 'y', it) ?? snapValue(rawY);
    if (nx !== it.x || ny !== it.y) {
      it.x = nx; it.y = ny;
      emit();
    }
  });

  const end = e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    canvas.style.cursor = 'grab';
    history.end();   // the whole drag is one undo step
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
    if (!document.getElementById('view3d').hidden) return;   // keys belong to the 3D view
    if (selectedOpening()) return openingKey(e);
    const it = selected();
    if (!it) return;
    const step = state.settings.snap * (e.shiftKey ? 10 : 1);
    switch (e.key) {
      case 'r': case 'R': case 'к': case 'К': rotateItem(it); break;
      case 'Delete': case 'Backspace': removeItem(it.id); break;
      case 'Escape': select(null); break;
      case 'ArrowLeft': it.x -= step; emit(); break;
      case 'ArrowRight': it.x += step; emit(); break;
      case 'ArrowUp': it.y -= step; emit(); break;
      case 'ArrowDown': it.y += step; emit(); break;
      default: return;
    }
    e.preventDefault();
  });
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
  return item || (op ? { opening: op } : null);
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

// Snap the item edge to the plinth line or to a neighbour edge (+gap).
function magnet(raw, size, axis, self) {
  const tol = MAGNET_PX / view.scale;
  const { plinth: p } = state.room;
  const max = axis === 'x' ? state.room.L : state.room.W;
  const gap = state.settings.gap;
  const cands = [p, max - p - size];
  for (const o of state.items) {
    if (o === self) continue;
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

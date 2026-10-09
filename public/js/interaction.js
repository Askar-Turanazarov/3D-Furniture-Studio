// Pointer (mouse + touch) drag with snap, multi-select, keyboard rotate / delete / nudge.
import { state, emit, select, selected, rotateItem, removeItems, moveItems, snapValue,
  selectOpening, selectedOpening, removeOpening, updateOpening,
  isSelected, selectedItems, toggleSelect, selectMany } from './state.js';
import { rectOf, footprint, overlaps } from './geometry.js';
import { nearestWall, wallLen } from './openings.js';
import { toWorld, view, overlay, requestDraw } from './renderer.js';
import { history } from './history.js';
import { duplicate } from './ui.js';

const MAGNET_PX = 8;   // edges stick to walls / neighbours within this screen distance
const OPENING_PX = 14; // an opening is grabbed within this screen distance from its wall
// { item, offX, offY, group: [{ it, dx, dy }], pointerId } | { opening, grab, pointerId } | { marquee, pointerId }
let drag = null;

export function initInteraction(canvas) {
  canvas.addEventListener('pointerdown', e => {
    const [wx, wy] = toWorld(...local(canvas, e));
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
    if (!hit) {
      if (e.shiftKey) {
        // Rubber band selection.
        drag = { marquee: true, pointerId: e.pointerId };
        overlay.marquee = { x0: wx, y0: wy, x1: wx, y1: wy };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (state.selectedId !== null || state.selectedIds.size) select(null);
      else if (state.selectedOpening !== null) selectOpening(null);
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
    const [wx, wy] = toWorld(...local(canvas, e));
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
    if (!drag || e.pointerId !== drag.pointerId) return;
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
    if (mod && e.code === 'KeyA') {
      selectMany(state.items.map(i => i.id));
      return e.preventDefault();
    }
    if (selectedOpening()) return openingKey(e);
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

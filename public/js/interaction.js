// Pointer (mouse + touch) drag with snap, keyboard rotate / delete / nudge.
import { state, emit, select, selected, rotateItem, removeItem, snapValue } from './state.js';
import { rectOf, footprint } from './geometry.js';
import { toWorld, view } from './renderer.js';

const MAGNET_PX = 8;   // edges stick to walls / neighbours within this screen distance
let drag = null;       // { item, offX, offY, pointerId, moved }

export function initInteraction(canvas) {
  canvas.addEventListener('pointerdown', e => {
    const [wx, wy] = toWorld(...local(canvas, e));
    const hit = hitTest(wx, wy);
    if (!hit) { if (state.selectedId !== null) select(null); return; }
    drag = { item: hit, offX: wx - hit.x, offY: wy - hit.y, pointerId: e.pointerId, moved: false };
    canvas.setPointerCapture(e.pointerId);
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
      drag.moved = true;
      emit();
    }
  });

  const end = e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
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

// Topmost item under the point (selected first, then reverse draw order).
function hitTest(x, y) {
  const order = [...state.items].reverse();
  const sel = selected();
  if (sel) order.unshift(sel);
  return order.find(it => {
    const r = rectOf(it);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }) || null;
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

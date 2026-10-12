// Order dialog → POST /api/order (saved to order.json on the server).
// Sends the whole apartment: every room with its place on the plan (pos).
import { t, getLang } from './i18n.js';
import { state, itemName, roomView } from './state.js';
import { validateAll, hasErrors } from './validate.js';
import { currentProject, currentRoom, persist } from './projects.js';
import { toast } from './ui.js';
import { estimate, roomEstimate } from './pricing.js';
import { configurable, sectionCount, drawerCount } from './config.js';
import { priceCatalog } from './pricePanel.js';
import { renderDrawing, printData, renderOverview, printOverview } from './drawing.js';

const $ = id => document.getElementById(id);

// Room document → what the manager needs (no ids, names in the client's language).
function roomPayload(r) {
  const cat = priceCatalog();
  return {
    name: r.name,
    purpose: r.purpose || '',
    pos: { x: r.pos?.x || 0, y: r.pos?.y || 0 },
    room: { ...r.room },
    openings: (r.openings || []).map(({ id, ...o }) => o),
    obstacles: (r.obstacles || []).map(({ id, ...o }) => o),
    items: r.items.map(i => ({
      type: i.type, name: itemName(i), w: i.w, d: i.d, h: i.h, x: i.x, y: i.y, rot: i.rot,
      elev: i.elev, open: i.open, materials: i.materials, color: i.color,
      ...(configurable(i) ? { sections: sectionCount(i), drawers: drawerCount(i) } : {}),
      price: estimate(i, cat)?.total ?? null
    })),
    estimate: roomEstimate(r.items, cat).total
  };
}

// The rooms to send, or a message why the order can't be sent.
function check() {
  persist();
  const rooms = currentProject().rooms;
  if (!rooms.some(r => r.items.length)) return { error: t('order.empty') };
  const bad = rooms.find(r => r.items.length && hasErrors(validateAll(roomView(r.id))));
  if (bad) return { error: rooms.length > 1 ? t('order.roomErrors', { name: bad.name }) : t('order.hasErrors') };
  return { rooms };
}

// Drawing for the manager (PNG dataURL): the apartment overview, or the room drawing for a single room;
// with the 3D view open, a 3D picture (JPEG).
async function pictures() {
  const p = currentProject();
  const sheet = p.rooms.length > 1 ? renderOverview(p) : renderDrawing(p.rooms[0]);
  const out = { drawing: sheet.canvas.toDataURL('image/png') };
  if (document.querySelector('.stage.is3d')) {
    try {
      const { snapshotCanvas } = await import('./3d/scene3d.js');
      const src = snapshotCanvas(), k = Math.min(1, 1600 / src.width);
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * k);
      c.height = Math.round(src.height * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      out.snapshot3d = c.toDataURL('image/jpeg', 0.85);
    } catch { /* the drawing is enough */ }
  }
  return out;
}

// The last sent order: its number goes into the stamp while the rooms stay unchanged.
let lastSent = null;
const roomsKey = rooms => JSON.stringify(rooms.map(roomPayload));

function openPrint() {
  persist();
  const rooms = currentProject().rooms;
  const orderId = lastSent?.key === roomsKey(rooms) ? lastSent.id : null;
  const pages = rooms.map(r => printData(r, { orderId }));
  if (rooms.length > 1) pages.unshift(printOverview(currentProject(), { orderId }));
  window.__printData = { lang: getLang(), pages };
  // sessionStorage is copied to the new tab and survives a same-tab open; the opener is the fallback.
  try { sessionStorage.setItem('fsp3d.print', JSON.stringify(window.__printData)); } catch { /* too big: opener only */ }
  const w = window.open('/print.html' + (orderId ? '?order=' + orderId : ''), '_blank');
  if (!w) toast(t('drw.blocked'), true);
}

function summary() {
  const { L, W, H } = state.room;
  const p = currentProject();
  const head = `${p.name} · ${currentRoom().name}. `;
  $('orderSummary').textContent = p.rooms.length > 1
    ? `${p.name}. ` + t('order.summaryAll', { r: p.rooms.length, n: p.rooms.reduce((s, r) => s + r.items.length, 0) })
    : head + t('order.summary', { L, W, H, n: state.items.length });
}

export function initOrder() {
  const dlg = $('orderDlg');
  const form = $('orderForm');

  $('orderBtn').addEventListener('click', () => {
    const { error } = check();
    if (error) return toast(error, true);
    summary();
    dlg.showModal();
  });
  $('orderPrint').addEventListener('click', openPrint);
  $('orderCancel').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { rooms, error } = check();
    if (error) return toast(error, true);
    const f = form.elements;
    const body = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      comment: f.comment.value.trim(),
      website: f.website.value,
      lang: getLang(),
      project: { name: currentProject().name },
      rooms: rooms.map(roomPayload),
      estimate: rooms.reduce((s, r) => s + roomEstimate(r.items, priceCatalog()).total, 0),
      ...(await pictures())
    };
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) return toast(t('order.tooMany'), true);
      if (res.status === 400) return toast(t('order.invalid', { field: data.field || '?' }), true);
      if (!res.ok || !data.ok) throw new Error(data.error);
      lastSent = { id: data.id, key: roomsKey(rooms) };
      dlg.close();
      form.reset();
      toast(t('order.ok', { id: data.id }));
    } catch {
      toast(t('order.fail'), true);
    }
  });
}

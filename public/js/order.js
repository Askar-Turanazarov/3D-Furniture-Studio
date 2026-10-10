// Order dialog → POST /api/order (saved to order.json on the server).
// Sends the current room or, with the checkbox, every room of the project.
import { t, getLang } from './i18n.js';
import { state, itemName } from './state.js';
import { validateAll, hasErrors } from './validate.js';
import { currentProject, currentRoom, persist } from './projects.js';
import { toast } from './ui.js';
import { estimate, roomEstimate } from './pricing.js';
import { configurable, sectionCount, drawerCount } from './config.js';
import { priceCatalog } from './pricePanel.js';
import { renderDrawing, printData } from './drawing.js';

const $ = id => document.getElementById(id);

// Room document → what the manager needs (no ids, names in the client's language).
function roomPayload(r) {
  const cat = priceCatalog();
  return {
    name: r.name,
    purpose: r.purpose || '',
    room: { ...r.room },
    openings: (r.openings || []).map(({ id, ...o }) => o),
    items: r.items.map(i => ({
      type: i.type, name: itemName(i), w: i.w, d: i.d, h: i.h, x: i.x, y: i.y, rot: i.rot,
      elev: i.elev, open: i.open, materials: i.materials, color: i.color,
      ...(configurable(i) ? { sections: sectionCount(i), drawers: drawerCount(i) } : {}),
      price: estimate(i, cat)?.total ?? null
    })),
    estimate: roomEstimate(r.items, cat).total
  };
}

const allRooms = () => $('orderAll').checked && currentProject().rooms.length > 1;

// The rooms to send, or a message why the order can't be sent.
function check() {
  persist();
  const rooms = allRooms() ? currentProject().rooms : [currentRoom()];
  if (!rooms.some(r => r.items.length)) return { error: t('order.empty') };
  const bad = rooms.find(r => r.items.length && hasErrors(validateAll(r)));
  if (bad) return { error: rooms.length > 1 ? t('order.roomErrors', { name: bad.name }) : t('order.hasErrors') };
  return { rooms };
}

// Drawing of the current room for the manager (PNG dataURL) and, with the 3D view open, a 3D picture (JPEG).
async function pictures() {
  const out = { drawing: renderDrawing(currentRoom()).canvas.toDataURL('image/png') };
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
  const rooms = allRooms() ? currentProject().rooms : [currentRoom()];
  const orderId = lastSent?.key === roomsKey(rooms) ? lastSent.id : null;
  window.__printData = { lang: getLang(), pages: rooms.map(r => printData(r, { orderId })) };
  // sessionStorage is copied to the new tab and survives a same-tab open; the opener is the fallback.
  try { sessionStorage.setItem('fsp3d.print', JSON.stringify(window.__printData)); } catch { /* too big: opener only */ }
  const w = window.open('/print.html' + (orderId ? '?order=' + orderId : ''), '_blank');
  if (!w) toast(t('drw.blocked'), true);
}

function summary() {
  const { L, W, H } = state.room;
  const p = currentProject();
  const head = `${p.name} · ${currentRoom().name}. `;
  $('orderSummary').textContent = allRooms()
    ? `${p.name}. ` + t('order.summaryAll', { r: p.rooms.length, n: p.rooms.reduce((s, r) => s + r.items.length, 0) })
    : head + t('order.summary', { L, W, H, n: state.items.length });
}

export function initOrder() {
  const dlg = $('orderDlg');
  const form = $('orderForm');

  $('orderBtn').addEventListener('click', () => {
    const many = currentProject().rooms.length > 1;
    $('orderAllRow').hidden = !many;
    if (!many) $('orderAll').checked = false;
    $('orderAllCount').textContent = currentProject().rooms.length;
    const { error } = check();
    // With several rooms the choice is made in the dialog, so problems are reported on send.
    if (error && !many) return toast(error, true);
    summary();
    dlg.showModal();
  });
  $('orderAll').addEventListener('change', summary);
  $('orderPrint').addEventListener('click', openPrint);
  $('orderCancel').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { rooms, error } = check();
    if (error) return toast(error, true);
    const f = form.elements;
    const cur = roomPayload(currentRoom());
    const body = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      comment: f.comment.value.trim(),
      lang: getLang(),
      project: { name: currentProject().name },
      roomName: cur.name,
      purpose: cur.purpose,
      room: cur.room,
      openings: cur.openings,
      items: cur.items,
      estimate: rooms.reduce((s, r) => s + roomEstimate(r.items, priceCatalog()).total, 0),
      ...(rooms.length > 1 ? { rooms: rooms.map(roomPayload) } : {}),
      ...(await pictures())
    };
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
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

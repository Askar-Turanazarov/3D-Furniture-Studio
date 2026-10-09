// Order dialog → POST /api/order (saved to order.json on the server).
// Sends the current room or, with the checkbox, every room of the project.
import { t, getLang } from './i18n.js';
import { state, itemName } from './state.js';
import { validateAll, hasErrors } from './validate.js';
import { currentProject, currentRoom, persist } from './projects.js';
import { toast } from './ui.js';

const $ = id => document.getElementById(id);

// Room document → what the manager needs (no ids, names in the client's language).
function roomPayload(r) {
  return {
    name: r.name,
    purpose: r.purpose || '',
    room: { ...r.room },
    openings: (r.openings || []).map(({ id, ...o }) => o),
    items: r.items.map(i => ({
      type: i.type, name: itemName(i), w: i.w, d: i.d, h: i.h, x: i.x, y: i.y, rot: i.rot
    }))
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
      ...(rooms.length > 1 ? { rooms: rooms.map(roomPayload) } : {})
    };
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      dlg.close();
      form.reset();
      toast(t('order.ok', { id: data.id }));
    } catch {
      toast(t('order.fail'), true);
    }
  });
}

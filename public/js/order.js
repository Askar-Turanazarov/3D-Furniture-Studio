// Order dialog → POST /api/order (saved to order.json on the server).
import { t, getLang } from './i18n.js';
import { state, itemName } from './state.js';
import { validateAll, hasErrors } from './validate.js';
import { toast } from './ui.js';

export function initOrder() {
  const dlg = document.getElementById('orderDlg');
  const form = document.getElementById('orderForm');

  document.getElementById('orderBtn').addEventListener('click', () => {
    if (!state.items.length) return toast(t('order.empty'), true);
    if (hasErrors(validateAll(state))) return toast(t('order.hasErrors'), true);
    const { L, W, H } = state.room;
    document.getElementById('orderSummary').textContent =
      t('order.summary', { L, W, H, n: state.items.length });
    dlg.showModal();
  });
  document.getElementById('orderCancel').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const body = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      comment: f.comment.value.trim(),
      lang: getLang(),
      room: { ...state.room },
      openings: (state.openings || []).map(({ id, ...o }) => o),
      items: state.items.map(i => ({
        type: i.type, name: itemName(i), w: i.w, d: i.d, h: i.h, x: i.x, y: i.y, rot: i.rot
      }))
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

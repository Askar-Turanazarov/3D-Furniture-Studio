// Snapshot of the 3D scene or the 2D plan with a summary plate in the bottom-right corner → PNG.
import { state } from './state.js';
import { t, getLang } from './i18n.js';
import { currentProject, currentRoom } from './projects.js';
import { toast } from './ui.js';
import { drawNow, liveRooms } from './renderer.js';
import { apartmentArea } from './apartment.js';
import { roomEstimate } from './pricing.js';
import { priceCatalog, fmtSum } from './pricePanel.js';

const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };
// Extra plate lines from other modules (e.g. the price estimate): () => string | null
export const plateExtras = [];

// scope 'room' — the active room (3D view); 'apartment' — the whole plan (2D, more than one room).
export function summaryLines(scope = 'room') {
  const loc = LOCALE[getLang()] || 'en-GB';
  const rooms = liveRooms();
  if (scope === 'apartment' && rooms.length > 1) {
    const sum = rooms.reduce((s, r) => s + roomEstimate(r.items, priceCatalog()).total, 0);
    return [
      { text: currentProject()?.name || '', kind: 'title' },
      { text: `${t('apt.rooms', { n: rooms.length })} · ${apartmentArea(rooms).toFixed(1)} ${t('unit.m2')}` },
      { text: t('snap.items', { n: rooms.reduce((s, r) => s + r.items.length, 0) }) },
      sum > 0 && { text: t('price.from', { sum: fmtSum(sum) }) },
      { text: new Date().toLocaleDateString(loc), kind: 'muted' },
      { text: t('snap.brand'), kind: 'brand' }
    ].filter(Boolean);
  }
  const f1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
  const p = currentProject(), r = currentRoom();
  const { L, W, H } = state.room;
  const m = v => f1.format(v / 100);
  return [
    { text: [p?.name, r?.name].filter(Boolean).join(' — '), kind: 'title' },
    r?.purpose && { text: t('purpose.' + r.purpose) },
    { text: `${m(L)} × ${m(W)} × ${m(H)} ${t('unit.m')} · ${f.format(L * W / 10000)} ${t('unit.m2')}` },
    { text: t('snap.items', { n: state.items.length }) },
    ...plateExtras.map(fn => fn()).filter(Boolean).map(text => ({ text })),
    { text: new Date().toLocaleDateString(loc), kind: 'muted' },
    { text: t('snap.brand'), kind: 'brand' }
  ].filter(Boolean);
}

const FONT = { title: 700, brand: 700 };
const font = (l, px) => `${FONT[l.kind] || 400} ${l.kind === 'title' ? Math.round(px * 1.15) : px}px system-ui, -apple-system, "Segoe UI", sans-serif`;

// Semi-transparent rounded plate, sized relative to the picture.
export function drawPlate(g, w, h, lines) {
  const u = Math.max(1, Math.min(w, h) / 560);
  const px = Math.round(14 * u), pad = Math.round(12 * u), lh = Math.round(px * 1.45), m = Math.round(16 * u);
  const width = Math.max(...lines.map(l => { g.font = font(l, px); return g.measureText(l.text).width; }));
  const bw = Math.ceil(width + pad * 2), bh = lines.length * lh + pad * 2 - Math.round(px * 0.3);
  const x = w - m - bw, y = h - m - bh;
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, .25)';
  g.shadowBlur = 12 * u;
  g.fillStyle = 'rgba(255, 255, 255, .86)';
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, bw, bh, 10 * u); else g.rect(x, y, bw, bh);
  g.fill();
  g.restore();
  g.textBaseline = 'top';
  lines.forEach((l, i) => {
    g.font = font(l, px);
    g.fillStyle = l.kind === 'brand' ? '#3b5bdb' : l.kind === 'muted' ? '#6b7280' : '#1e2235';
    g.fillText(l.text, x + pad, y + pad + i * lh);
  });
}

export function compose(src, scope = 'room') {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  drawPlate(g, c.width, c.height, summaryLines(scope));
  return c;
}

export function fileName(date = new Date(), scope = 'room') {
  const clean = s => String(s || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  const d2 = n => String(n).padStart(2, '0');
  const ymd = `${date.getFullYear()}${d2(date.getMonth() + 1)}${d2(date.getDate())}`;
  const room = scope === 'apartment' && liveRooms().length > 1 ? '' : clean(currentRoom()?.name);
  return [clean(currentProject()?.name), room, ymd].filter(Boolean).join('-') + '.png';
}

export function canShareFiles() {
  try { return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
}

// Download the picture, or hand it to the system share sheet (phones).
export async function savePicture(canvas, share = false, scope = 'room') {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) return toast(t('snap.fail'), true);
  const name = fileName(new Date(), scope);
  if (share) {
    try { await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: name }); }
    catch (e) { if (e.name !== 'AbortError') toast(t('snap.fail'), true); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(t('snap.saved', { name }));
}

// 2D plan (the whole apartment) without selection, ruler and other UI, at 2× resolution.
export function planCanvas() {
  const keep = {
    selectedId: state.selectedId, selectedIds: state.selectedIds,
    selectedOpening: state.selectedOpening, selectedObstacle: state.selectedObstacle
  };
  Object.assign(state, { selectedId: null, selectedIds: new Set(), selectedOpening: null, selectedObstacle: null });
  try {
    const src = drawNow({ dpr: 2, clean: true });
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  } finally {
    Object.assign(state, keep);
    drawNow();
  }
}

export function initSnapshot() {
  const b2 = document.getElementById('snap2dBtn');
  b2.addEventListener('click', () => savePicture(compose(planCanvas(), 'apartment'), false, 'apartment'));
}

// Order drawing: the room plan at a fixed scale 1:N on a white A4-landscape sheet (2400 px) with a stamp,
// plus the specification table (№, name, size, height above the floor, material/configuration, price).
import { state, itemName } from './state.js';
import { t, getLang } from './i18n.js';
import { currentProject } from './projects.js';
import { drawPlanTo } from './renderer.js';
import { validateAll } from './validate.js';
import { estimate, roomEstimate } from './pricing.js';
import { configurable, sectionCount, drawerCount } from './config.js';
import { priceCatalog, fmtSum } from './pricePanel.js';
import { itemLook } from './materials.js';
import { openSpec } from './zones.js';

const SHEET = [1200, 848];               // css px; ×2 → 2400×1696 (297×210 mm)
const PAPER_CM = SHEET[0] / 29.7;         // css px per paper centimetre
const SCALES = [10, 20, 25, 50, 75, 100, 150, 200];
const M = 28, STAMP = [440, 132], PAD = 44;
const LOCALE = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };

// Smallest standard scale 1:N at which the room with its dimension lines fits into w×h.
export function pickScale(L, W, w, h) {
  return SCALES.find(n => L * PAPER_CM / n <= w - 2 * PAD && W * PAPER_CM / n <= h - 2 * PAD) || SCALES.at(-1);
}

const matName = m => m && (m.name[getLang()] || m.name.ru);

// Specification rows of a room document, numbered in plan order.
export function specRows(doc) {
  const cat = priceCatalog();
  return doc.items.map((it, i) => {
    const { body, facade } = itemLook(it, state.materials);
    const conf = [];
    const mats = [matName(body), facade && facade !== body ? matName(facade) : null].filter(Boolean);
    if (mats.length) conf.push(mats.join(' / '));
    if (configurable(it)) {
      conf.push(`${t('cfg.sections')}: ${sectionCount(it)}`);
      if (drawerCount(it)) conf.push(`${t('cfg.drawers')}: ${drawerCount(it)}`);
    }
    const o = openSpec(it, state.catalog);
    if (o.kind !== 'none') conf.push(`${t('open.' + o.kind)}${o.doors ? ` ×${o.doors}` : ''}`);
    const e = estimate(it, cat);
    return {
      no: i + 1, id: it.id, name: itemName(it),
      size: `${it.w}×${it.d}×${it.h}`, elev: it.elev || 0,
      conf: conf.join(', '), price: e ? e.total : null
    };
  });
}

// → { canvas (2400 px), scale N, rows, total }
export function renderDrawing(doc, { orderId = null, date = new Date() } = {}) {
  const [sw, sh] = SHEET, dpr = 2;
  const c = document.createElement('canvas');
  c.width = sw * dpr;
  c.height = sh * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, sw, sh);

  const pw = sw - 2 * M, ph = sh - 2 * M - STAMP[1] - 8;
  const n = pickScale(doc.room.L, doc.room.W, pw, ph);
  const rows = specRows(doc);
  const plan = document.createElement('canvas');
  drawPlanTo(plan, pw, ph, {
    doc, dpr, scale: PAPER_CM / n, drawing: true, walls: true,
    errors: validateAll({ ...doc, catalog: state.catalog }),
    numbers: new Map(rows.map(r => [r.id, r.no]))
  });
  g.drawImage(plan, M, M, pw, ph);

  // Frame
  g.strokeStyle = '#212529';
  g.lineWidth = 1.5;
  g.strokeRect(M / 2, M / 2, sw - M, sh - M);

  const total = roomEstimate(doc.items, priceCatalog()).total;
  stamp(g, sw - M / 2 - STAMP[0], sh - M / 2 - STAMP[1], doc, n, orderId, date, total);
  return { canvas: c, scale: n, rows, total };
}

function stamp(g, x, y, doc, n, orderId, date, total) {
  const [w, h] = STAMP;
  const p = currentProject(), { L, W, H } = doc.room;
  const loc = LOCALE[getLang()] || 'en-GB';
  const cells = [
    [t('drw.project'), p?.name || ''],
    [t('drw.room'), [doc.name, doc.purpose && t('purpose.' + doc.purpose)].filter(Boolean).join(' · ')],
    [t('drw.size'), `${L}×${W}×${H} ${t('unit.cm')} · ${(L * W / 10000).toFixed(1)} ${t('unit.m2')}`],
    [t('drw.scale'), `1:${n}` + (total ? ` · ${t('price.from', { sum: fmtSum(total) })}` : '')],
    [t('drw.order'), (orderId ? `№${orderId} · ` : '') + date.toLocaleDateString(loc)]
  ];
  g.fillStyle = '#fff';
  g.fillRect(x, y, w, h);
  g.strokeStyle = '#212529';
  g.lineWidth = 1.5;
  g.strokeRect(x, y, w, h);
  const head = 24, lh = (h - head) / cells.length, col = 104;
  g.fillStyle = '#212529';
  g.font = '700 13px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(t('snap.brand') + ' — ' + t('drw.title'), x + 8, y + head / 2);
  g.lineWidth = 0.75;
  g.beginPath();
  for (let i = 0; i < cells.length; i++) {
    const ry = y + head + i * lh;
    g.moveTo(x, ry); g.lineTo(x + w, ry);
  }
  g.moveTo(x + col, y + head); g.lineTo(x + col, y + h);
  g.stroke();
  cells.forEach(([k, v], i) => {
    const cy = y + head + i * lh + lh / 2;
    g.font = '400 11px system-ui, sans-serif';
    g.fillStyle = '#6b7280';
    g.fillText(k, x + 8, cy);
    g.font = '600 12px system-ui, sans-serif';
    g.fillStyle = '#212529';
    g.fillText(fit(g, v, w - col - 14), x + col + 7, cy);
  });
}

function fit(g, s, max) {
  if (g.measureText(s).width <= max) return s;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

// Everything the print page needs, already translated.
export function printData(doc, opts = {}) {
  const { canvas, scale, rows, total } = renderDrawing(doc, opts);
  return {
    lang: getLang(),
    title: `${currentProject()?.name || ''} — ${doc.name}`,
    png: canvas.toDataURL('image/png'),
    scale,
    head: [t('drw.no'), t('drw.name'), t('drw.dims'), t('drw.elev'), t('drw.conf'), t('drw.price')],
    rows: rows.map(r => [r.no, r.name, r.size, r.elev ? `↑${r.elev}` : '—', r.conf || '—', r.price ? fmtSum(r.price) : t('drw.noPrice')]),
    total: total ? t('price.total', { sum: fmtSum(total) }) : '',
    note: t('price.note'),
    print: t('drw.print'), close: t('drw.close')
  };
}

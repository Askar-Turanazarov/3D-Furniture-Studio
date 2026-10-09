// Room templates (templates.json): loading, a room document from a template, a mini plan for the cards.
import { normalizeDoc } from './storage.js';
import { rectOf } from './geometry.js';

let cache = null;
export function loadTemplates() {
  cache ??= fetch('/api/templates')
    .then(r => { if (!r.ok) throw new Error('templates ' + r.status); return r.json(); })
    .catch(e => { cache = null; throw e; });
  return cache;
}

export const localName = (o, lang) => o.name[lang] || o.name.ru;

// Template → room document with fresh ids (the template itself is never mutated).
export function templateDoc(t, { plinth = 2, settings } = {}) {
  const ids = list => list.map((x, i) => ({ ...structuredClone(x), id: i + 1 }));
  return normalizeDoc({
    room: { ...t.room, plinth }, settings,
    items: ids(t.items), openings: ids(t.openings), obstacles: ids(t.obstacles)
  });
}

// "12 м² · 4×3 м" — area and size in metres, decimal comma where the language uses it.
export function sizeLabel(room, lang, m2, m) {
  const f = new Intl.NumberFormat({ ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' }[lang] || 'en-GB', { maximumFractionDigits: 1 });
  return `${f.format(room.L * room.W / 10000)} ${m2} · ${f.format(room.L / 100)}×${f.format(room.W / 100)} ${m}`;
}

// Small read-only plan: walls, windows, doors, structure, furniture (wall-mounted ones dashed).
export function drawMiniPlan(canvas, t) {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || 160, ch = canvas.clientHeight || 110;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { L, W } = t.room, pad = 8;
  const s = Math.min((cw - 2 * pad) / L, (ch - 2 * pad) / W);
  const ox = (cw - L * s) / 2, oy = (ch - W * s) / 2;
  const X = x => ox + x * s, Y = y => oy + y * s;

  g.fillStyle = '#fff';
  g.fillRect(X(0), Y(0), L * s, W * s);
  g.fillStyle = '#adb5bd';
  for (const o of t.obstacles) g.fillRect(X(o.x), Y(o.y), o.w * s, o.d * s);
  for (const it of [...t.items].sort((a, b) => (a.elev || 0) - (b.elev || 0))) {
    const r = rectOf(it);
    g.save();
    if (it.elev > 0) {
      g.setLineDash([3, 2]);
      g.strokeStyle = it.color || '#868e96';
    } else {
      g.fillStyle = it.color || '#90a4ae';
      g.globalAlpha = 0.8;
      g.fillRect(X(r.x), Y(r.y), r.w * s, r.h * s);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,.35)';
    }
    g.lineWidth = 1;
    g.strokeRect(X(r.x) + 0.5, Y(r.y) + 0.5, Math.max(1, r.w * s - 1), Math.max(1, r.h * s - 1));
    g.restore();
  }
  g.strokeStyle = '#343a40';
  g.lineWidth = 2;
  g.strokeRect(X(0), Y(0), L * s, W * s);
  for (const o of t.openings) {
    const a = o.offset, b = o.offset + o.width;
    const seg = { north: [a, 0, b, 0], south: [a, W, b, W], west: [0, a, 0, b], east: [L, a, L, b] }[o.wall];
    g.beginPath();
    g.moveTo(X(seg[0]), Y(seg[1]));
    g.lineTo(X(seg[2]), Y(seg[3]));
    g.strokeStyle = o.kind === 'window' ? '#4dabf7' : '#fff';
    g.lineWidth = o.kind === 'window' ? 3 : 2.5;
    g.stroke();
  }
}

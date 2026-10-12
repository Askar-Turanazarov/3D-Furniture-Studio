// 2D plan symbols of furniture: pillows on a bed, a bowl in a bath, burners on a hob...
// Drawn in the item's own frame: x along the width, y from the back (wall side) to the front.
// The front of a rotated item follows the plan rule (rot 0 → +Y, 90 → −X, 180 → −Y, 270 → +X).

const LINE = 'rgba(255,255,255,.75)';
const DARK = 'rgba(0,0,0,.28)';

// Light items (white plumbing, appliances) get dark lines and labels.
export function isLight(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.78;
}

// ctx — 2D context; sx, sy, sw, sh — the item's screen rect; scale — px per cm.
export function drawGlyph(ctx, it, sx, sy, sw, sh, scale) {
  const fn = GLYPHS[it.type];
  if (!fn || Math.min(sw, sh) < 14) return;
  const w = it.w * scale, d = it.d * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  ctx.translate(sx + sw / 2, sy + sh / 2);
  ctx.rotate((it.rot || 0) * Math.PI / 180);
  ctx.translate(-w / 2, -d / 2);
  ctx.lineWidth = Math.max(1, Math.min(2, scale * 1.2));
  const light = isLight(it.color);
  ctx.strokeStyle = light ? 'rgba(55,65,80,.55)' : LINE;
  ctx.fillStyle = light ? 'rgba(90,110,130,.12)' : 'rgba(255,255,255,.22)';
  fn(ctx, w, d, scale, it);
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2)));
}
const ellipse = (ctx, cx, cy, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); };
const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

function bed(ctx, w, d, s) {
  const m = 4 * s, pw = w > 120 * s ? (w - 3 * m) / 2 : w - 2 * m;
  for (let k = 0; k < (w > 120 * s ? 2 : 1); k++) { rr(ctx, m + k * (pw + m), m, pw, 22 * s, 6 * s); ctx.fill(); ctx.stroke(); }
  line(ctx, m, d * 0.36, w - m, d * 0.36);          // duvet fold
  ctx.setLineDash([4, 3]); line(ctx, m, d * 0.36 + 8 * s, w - m, d * 0.36 + 8 * s); ctx.setLineDash([]);
}

function sofa(ctx, w, d, s) {
  const back = Math.min(22 * s, d * 0.3), arm = Math.min(18 * s, w * 0.12);
  ctx.strokeRect(0, 0, w, back);
  ctx.strokeRect(0, back, arm, d - back);
  ctx.strokeRect(w - arm, back, arm, d - back);
  const n = Math.max(1, Math.round((w - 2 * arm) / (65 * s)));
  for (let k = 1; k < n; k++) { const x = arm + (w - 2 * arm) * k / n; line(ctx, x, back, x, d - 3 * s); }
}

function cornerSofa(ctx, w, d, s) {
  const back = 22 * s, arm = 16 * s, seat = 95 * s;
  ctx.strokeRect(0, 0, w, back);                      // back along the wall
  ctx.strokeRect(0, back, back, d - back);            // back of the chaise side
  ctx.beginPath();
  ctx.moveTo(back, back + seat); ctx.lineTo(w - arm, back + seat); ctx.lineTo(w - arm, back); ctx.stroke();
  ctx.strokeRect(w - arm, back, arm, seat);
  line(ctx, back, d - arm, back + seat * 0.9, d - arm);
  line(ctx, back + seat * 0.9, back + seat, back + seat * 0.9, d);
}

function armchair(ctx, w, d, s) {
  const back = Math.min(18 * s, d * 0.3), arm = Math.min(14 * s, w * 0.2);
  ctx.strokeRect(0, 0, w, back);
  ctx.strokeRect(0, back, arm, d - back);
  ctx.strokeRect(w - arm, back, arm, d - back);
}

function bath(ctx, w, d, s) {
  const m = 7 * s;
  rr(ctx, m, m, w - 2 * m, d - 2 * m, Math.min(d, w) * 0.35);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = DARK;
  ellipse(ctx, m + 14 * s, d / 2, 2.5 * s, 2.5 * s); ctx.stroke();
}

function toilet(ctx, w, d, s) {
  const tank = Math.min(18 * s, d * 0.3);
  rr(ctx, 1 * s, 0, w - 2 * s, tank, 3 * s); ctx.stroke();
  ellipse(ctx, w / 2, tank + (d - tank) / 2, w * 0.42, (d - tank) * 0.48); ctx.fill(); ctx.stroke();
}

function basin(ctx, w, d, s) {
  ellipse(ctx, w / 2, d * 0.55, Math.min(w * 0.36, 25 * s), d * 0.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = DARK; line(ctx, w / 2, 4 * s, w / 2, d * 0.3);
}

function sink(ctx, w, d, s) {
  rr(ctx, w * 0.2, d * 0.2, w * 0.55, d * 0.6, 5 * s); ctx.fill(); ctx.stroke();
}

function hob(ctx, w, d, s) {
  const r1 = Math.min(w, d) * 0.15;
  for (const [fx, fy, k] of [[0.3, 0.3, 1], [0.7, 0.3, 0.8], [0.3, 0.7, 0.8], [0.7, 0.7, 1]]) {
    ellipse(ctx, w * fx, d * fy, r1 * k, r1 * k); ctx.stroke();
  }
}

function washer(ctx, w, d, s) {
  ellipse(ctx, w / 2, d / 2, Math.min(w, d) * 0.3, Math.min(w, d) * 0.3); ctx.stroke();
}

function shower(ctx, w, d) {
  ctx.setLineDash([3, 3]);
  line(ctx, 0, 0, w, d); line(ctx, w, 0, 0, d);
  ctx.setLineDash([]);
  ellipse(ctx, w / 2, d / 2, 3, 3); ctx.stroke();
}

function roundTable(ctx, w, d) {
  ellipse(ctx, w / 2, d / 2, w / 2 - 1, d / 2 - 1); ctx.fill(); ctx.stroke();
}

function plant(ctx, w, d) {
  const r = Math.min(w, d) / 2;
  ctx.fillStyle = 'rgba(30,90,40,.35)';
  for (let k = 0; k < 7; k++) {
    const a = k * Math.PI * 2 / 7;
    ellipse(ctx, w / 2 + Math.cos(a) * r * 0.45, d / 2 + Math.sin(a) * r * 0.45, r * 0.4, r * 0.4);
    ctx.fill();
  }
  ellipse(ctx, w / 2, d / 2, r * 0.35, r * 0.35); ctx.stroke();
}

function rug(ctx, w, d, s) {
  const m = 6 * s;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(m, m, w - 2 * m, d - 2 * m);
  ctx.setLineDash([]);
  ctx.strokeRect(2 * m, 2 * m, w - 4 * m, d - 4 * m);
}

function curtains(ctx, w, d) {
  ctx.beginPath();
  const n = Math.max(4, Math.round(w / 12));
  for (let k = 0; k <= n; k++) { const x = w * k / n; ctx.lineTo(x, k % 2 ? d * 0.8 : d * 0.2); }
  ctx.stroke();
}

function bunk(ctx, w, d, s) {
  bed(ctx, w, d, s);
  ctx.setLineDash([2, 3]); ctx.strokeRect(2 * s, 2 * s, w - 4 * s, d - 4 * s); ctx.setLineDash([]);
}

function cot(ctx, w, d, s) {
  for (let x = 6 * s; x < w - 3 * s; x += 8 * s) { line(ctx, x, 2 * s, x, 6 * s); line(ctx, x, d - 6 * s, x, d - 2 * s); }
}

function fridge(ctx, w, d, s) {
  line(ctx, 3 * s, d - 6 * s, w - 3 * s, d - 6 * s);
  ctx.strokeStyle = DARK; line(ctx, w - 8 * s, d - 4 * s, w - 8 * s, d - 1 * s);
}

function island(ctx, w, d, s) {
  ctx.setLineDash([4, 3]); ctx.strokeRect(3 * s, 3 * s, w - 6 * s, d - 6 * s); ctx.setLineDash([]);
}

const GLYPHS = {
  bed, bed1: bed, bunkbed: bunk, cot,
  sofa, cornersofa: cornerSofa, armchair,
  bathtub: bath, toilet, basin, shower, washer,
  sinkunit: sink, stove: hob, fridge, island,
  roundtable: roundTable, barstool: roundTable, pouf: roundTable,
  plant, rug, curtains
};

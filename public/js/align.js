// Align / distribute plan rects (footprints). Pure: → [{ dx, dy }] in the order of the input.
// Modes: left, right, top, bottom, cx, cy (centres), distX, distY (equal gaps, ends stay).
export const ALIGN_MODES = ['left', 'cx', 'right', 'top', 'cy', 'bottom', 'distX', 'distY'];

export function alignDeltas(rects, mode) {
  const out = rects.map(() => ({ dx: 0, dy: 0 }));
  if (rects.length < 2) return out;
  const x0 = Math.min(...rects.map(r => r.x)), x1 = Math.max(...rects.map(r => r.x + r.w));
  const y0 = Math.min(...rects.map(r => r.y)), y1 = Math.max(...rects.map(r => r.y + r.h));
  rects.forEach((r, i) => {
    switch (mode) {
      case 'left': out[i].dx = x0 - r.x; break;
      case 'right': out[i].dx = x1 - (r.x + r.w); break;
      case 'cx': out[i].dx = Math.round((x0 + x1) / 2 - (r.x + r.w / 2)); break;
      case 'top': out[i].dy = y0 - r.y; break;
      case 'bottom': out[i].dy = y1 - (r.y + r.h); break;
      case 'cy': out[i].dy = Math.round((y0 + y1) / 2 - (r.y + r.h / 2)); break;
    }
  });
  if (mode === 'distX' || mode === 'distY') {
    const X = mode === 'distX';
    const pos = r => (X ? r.x : r.y), size = r => (X ? r.w : r.h);
    const order = rects.map((r, i) => i).sort((a, b) => pos(rects[a]) - pos(rects[b]));
    if (order.length < 3) return out;
    const first = rects[order[0]], last = rects[order[order.length - 1]];
    const span = pos(last) + size(last) - pos(first);
    const gap = (span - order.reduce((s, i) => s + size(rects[i]), 0)) / (order.length - 1);
    let cur = pos(first);
    for (const i of order) {
      const d = Math.round(cur) - pos(rects[i]);
      if (X) out[i].dx = d; else out[i].dy = d;
      cur += size(rects[i]) + gap;
    }
  }
  return out;
}

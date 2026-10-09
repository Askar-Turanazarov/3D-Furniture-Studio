// Configuration of made-to-order furniture: sections (vertical modules) and drawers. Pure, cm.
// item.sections / item.drawers override the defaults below; doors and their type live in item.open (zones.js).
export const CONFIG = {
  wardrobe: { sections: [1, 6], drawers: [0, 4] },
  kitchen: { sections: [1, 8] },
  dresser: { drawers: [1, 8] },
  shoerack: { drawers: [1, 8] },
  nightstand: { drawers: [1, 4] }
};

const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(v)));
export const configurable = item => !!CONFIG[item.type];

export function sectionCount(item) {
  const c = CONFIG[item.type]?.sections;
  if (!c) return 1;
  return clamp(item.sections || Math.max(1, Math.round(item.w / 60)), c);
}

// Default drawer count of each type, as the 3D models draw them.
function autoDrawers(item) {
  const h = item.h;
  switch (item.type) {
    case 'wardrobe': return 0;
    case 'nightstand': return h - Math.min(8, h * 0.15) > 40 ? 2 : 1;
    case 'shoerack': return Math.max(2, Math.round(h / 35));
    case 'dresser': return Math.max(1, Math.round((h - Math.min(8, h * 0.1)) / 20));
    case 'tvstand': return 4;
    case 'desk': return 3;
    default: return 0;
  }
}

export function drawerCount(item) {
  const c = CONFIG[item.type]?.drawers;
  if (!c) return autoDrawers(item);
  return clamp(item.drawers ?? autoDrawers(item), c);
}

// Sliding wardrobe: 2–3 doors.
export const slideDoors = item => Math.max(2, Math.min(3, Math.round(item.open?.doors || (item.w > 200 ? 3 : 2))));

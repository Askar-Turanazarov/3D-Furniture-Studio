// Room finish panel: wall material and colour, accent wall, floor (roomDoc.style, saved and undoable).
import { resetToStyle } from './materials.js';
import { toast } from './ui.js';
import { state, emit, onChange } from './state.js';
import { t, onLangChange } from './i18n.js';
import { styleOf, WALL_MATS, FLOORS, WALLS, BRICK_COLOR, COLLECTIONS, FINISHES } from './style.js';

const $ = id => document.getElementById(id);

// Furniture styles grouped by collection (the base ones and the luxe ones).
export const furnStyleOptions = () => COLLECTIONS.map(c => {
  const g = document.createElement('optgroup');
  g.label = t('style.col.' + c.id);
  g.append(...c.styles.map(v => new Option(t('style.f.' + v), v)));
  return g;
});

function fillSelects() {
  const f = $('styleForm').elements;
  const opts = (sel, list, prefix) => sel.replaceChildren(...list.map(v => new Option(t(prefix + v), v)));
  opts(f.wallMat, WALL_MATS, 'style.wall.');
  opts(f.floor, FLOORS, 'style.floor.');
  f.furniture.replaceChildren(...furnStyleOptions());
  opts(f.finish, FINISHES, 'style.finish.');
  f.accentWall.replaceChildren(new Option(t('style.noAccent'), ''), ...WALLS.map(w => new Option(t('style.w.' + w), w)));
  syncStylePanel();
}

export function initStylePanel() {
  const form = $('styleForm');
  fillSelects();
  onLangChange(fillSelects);
  onChange(syncStylePanel);      // the 3D HUD and the texture library change the style too
  // 'change', not 'input': dragging in the colour picker would make a history step per pixel.
  form.addEventListener('change', e => {
    const f = form.elements, s = styleOf(state.style);
    let wallColor = f.wallColor.value;
    // Bricks on a white wall would look painted over: start them in brick red.
    if (e.target === f.wallMat && f.wallMat.value === 'brick' && wallColor === '#ffffff') wallColor = BRICK_COLOR;
    state.style = {
      ...s,
      wall: { material: f.wallMat.value, color: wallColor },
      accentWall: f.accentWall.value || null,
      accentColor: f.accentColor.value,
      floor: f.floor.value,
      furniture: f.furniture.value,
      finish: f.finish.value
    };
    const tex = { ...s.tex };
    if (e.target === f.floor) delete tex.floor;
    if (e.target === f.wallMat) delete tex.wall;
    if (s.tex) state.style.tex = tex;
    // A new furniture style: the materials and colours of the room's furniture come from it (one undo step).
    if (e.target === f.furniture && resetToStyle(state.items)) toast(t('style.reset'));
    syncStylePanel();
    emit();
  });
}

export function syncStylePanel() {
  const f = $('styleForm').elements, s = styleOf(state.style);
  f.wallMat.value = s.wall.material;
  f.wallColor.value = s.wall.color;
  f.accentWall.value = s.accentWall || '';
  f.accentColor.value = s.accentColor;
  f.accentColor.disabled = !s.accentWall;
  f.floor.value = s.floor;
  f.furniture.value = s.furniture;
  f.finish.value = s.finish;
  // Colours and finishes are hidden under rough / pre-finish walls: show it by disabling them.
  const bare = s.finish !== 'finished';
  for (const n of ['wallMat', 'wallColor', 'accentWall', 'floor']) f[n].disabled = bare;
  if (bare) f.accentColor.disabled = true;
  document.querySelectorAll('[data-finish]').forEach(b => b.classList.toggle('active', b.dataset.finish === s.finish));
}

// Room finish panel: wall material and colour, accent wall, floor (roomDoc.style, saved and undoable).
import { state, emit } from './state.js';
import { t, onLangChange } from './i18n.js';
import { styleOf, WALL_MATS, FLOORS, WALLS, BRICK_COLOR, FURN_STYLES } from './style.js';

const $ = id => document.getElementById(id);

function fillSelects() {
  const f = $('styleForm').elements;
  const opts = (sel, list, prefix) => sel.replaceChildren(...list.map(v => new Option(t(prefix + v), v)));
  opts(f.wallMat, WALL_MATS, 'style.wall.');
  opts(f.floor, FLOORS, 'style.floor.');
  opts(f.furniture, FURN_STYLES, 'style.f.');
  f.accentWall.replaceChildren(new Option(t('style.noAccent'), ''), ...WALLS.map(w => new Option(t('style.w.' + w), w)));
  syncStylePanel();
}

export function initStylePanel() {
  const form = $('styleForm');
  fillSelects();
  onLangChange(fillSelects);
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
      furniture: f.furniture.value
    };
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
}

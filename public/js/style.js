// Room finish and furniture style (roomDoc.style). Pure: used by the state, storage, 3D and tests.
// style = { wall: { material, color }, accentWall: null | 'north'|'east'|'south'|'west', accentColor,
//           floor, furniture: 'modern'|'classic'|'loft' }; item.style overrides the furniture style.
export const WALL_MATS = ['paint', 'wallpaper', 'brick', 'panels'];
export const FLOORS = ['parquet', 'laminate', 'tile', 'carpet'];
export const WALLS = ['north', 'east', 'south', 'west'];
export const FURN_STYLES = ['modern', 'classic', 'loft'];
export const BRICK_COLOR = '#b5654a';

export const DEFAULT_STYLE = {
  wall: { material: 'paint', color: '#ffffff' },
  accentWall: null,
  accentColor: '#8fa3b8',
  floor: 'parquet',
  furniture: 'modern'
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (v, list, def) => list.includes(v) ? v : def;

// Any saved / imported style → a complete valid one.
export function styleOf(s = {}) {
  const d = DEFAULT_STYLE, w = s?.wall || {};
  return {
    wall: { material: pick(w.material, WALL_MATS, d.wall.material), color: HEX.test(w.color) ? w.color : d.wall.color },
    accentWall: WALLS.includes(s?.accentWall) ? s.accentWall : null,
    accentColor: HEX.test(s?.accentColor) ? s.accentColor : d.accentColor,
    floor: pick(s?.floor, FLOORS, d.floor),
    furniture: pick(s?.furniture, FURN_STYLES, d.furniture)
  };
}

// Furniture style of one item: its own override or the room style.
export const itemStyle = (item, style) => FURN_STYLES.includes(item.style) ? item.style : styleOf(style).furniture;

// Room finish and furniture style (roomDoc.style). Pure: used by the state, storage, 3D and tests.
// style = { wall: { material, color }, accentWall: null | 'north'|'east'|'south'|'west', accentColor,
//           floor, furniture: 'modern'|'classic'|'loft', finish: 'finished'|'prefinish'|'rough',
//           tex?: { floor, wall, roughFloor, roughWall, preWall } — library set ids chosen in the texture panel };
// item.style overrides the furniture style.
export const WALL_MATS = ['paint', 'wallpaper', 'brick', 'panels', 'plaster', 'concrete', 'tileBath'];
export const FLOORS = ['parquet', 'laminate', 'tile', 'carpet', 'herringbone', 'parquetDark', 'marble'];
export const WALLS = ['north', 'east', 'south', 'west'];
export const FURN_STYLES = ['modern', 'classic', 'loft'];
// Finish level: rough (screed, bare blocks), pre-finish ("white box": screed, putty), finished (the chosen style).
export const FINISHES = ['finished', 'prefinish', 'rough'];
export const BRICK_COLOR = '#b5654a';

export const DEFAULT_STYLE = {
  wall: { material: 'paint', color: '#ffffff' },
  accentWall: null,
  accentColor: '#8fa3b8',
  floor: 'parquet',
  furniture: 'modern',
  finish: 'finished'
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (v, list, def) => list.includes(v) ? v : def;
// Library slots a texture set can take over (Photo quality); the style value stays the procedural fallback.
export const TEX_SLOTS = ['floor', 'wall', 'roughFloor', 'roughWall', 'preWall'];
const SET_ID = /^[a-zA-Z0-9]{1,40}$/;

function texOf(t) {
  const out = {};
  for (const k of TEX_SLOTS) if (SET_ID.test(t?.[k] || '')) out[k] = t[k];
  return out;
}

// Any saved / imported style → a complete valid one.
export function styleOf(s = {}) {
  const d = DEFAULT_STYLE, w = s?.wall || {};
  return {
    wall: { material: pick(w.material, WALL_MATS, d.wall.material), color: HEX.test(w.color) ? w.color : d.wall.color },
    accentWall: WALLS.includes(s?.accentWall) ? s.accentWall : null,
    accentColor: HEX.test(s?.accentColor) ? s.accentColor : d.accentColor,
    floor: pick(s?.floor, FLOORS, d.floor),
    furniture: pick(s?.furniture, FURN_STYLES, d.furniture),
    finish: pick(s?.finish, FINISHES, d.finish),
    ...(Object.keys(texOf(s?.tex)).length ? { tex: texOf(s.tex) } : {})
  };
}

// Furniture style of one item: its own override or the room style.
export const itemStyle = (item, style) => FURN_STYLES.includes(item.style) ? item.style : styleOf(style).furniture;

// Photo-library set (public/textures/library.json) of each finish; parquet and paint use the base sets.
const FLOOR_SET = { parquet: null, laminate: 'laminate', tile: 'tileStone', carpet: 'carpet', herringbone: 'herringbone', parquetDark: 'parquetDark', marble: 'marble' };
const WALL_SET = { paint: null, wallpaper: null, panels: null, brick: 'brick', plaster: 'plaster', concrete: 'concrete', tileBath: 'tileBath' };

/**
 * What the 3D shell is made of for a style:
 * { floor, wall, accent: bool, wallColor, floorSet, wallSet, ceiling: 'white'|'concrete', plinth, doorLeaves }.
 * floor / wall — style values (procedural look); floorSet / wallSet — library ids for Photo quality (null = base set).
 */
export function surfacesOf(style) {
  const s = styleOf(style), tex = s.tex || {};
  if (s.finish === 'rough') {
    return { floor: 'screed', wall: 'blocks', accent: false, wallColor: '#b9b4ad',
      floorSet: tex.roughFloor || 'screed', wallSet: tex.roughWall || 'blocks',
      ceiling: 'concrete', plinth: false, doorLeaves: false };
  }
  if (s.finish === 'prefinish') {
    return { floor: 'screed', wall: 'putty', accent: false, wallColor: '#f4f2ee',
      floorSet: tex.roughFloor || 'screed', wallSet: tex.preWall || 'putty',
      ceiling: 'white', plinth: false, doorLeaves: true };
  }
  return { floor: s.floor, wall: s.wall.material, accent: !!s.accentWall, wallColor: s.wall.color,
    floorSet: tex.floor || FLOOR_SET[s.floor], wallSet: tex.wall || WALL_SET[s.wall.material],
    ceiling: 'white', plinth: true, doorLeaves: true };
}

/** The wall painted in the accent colour, or null: rough and pre-finish walls have no accent. */
export function accentWallOf(style) {
  return surfacesOf(style).accent ? styleOf(style).accentWall : null;
}

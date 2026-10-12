// Room lighting settings (pure: used by the 3D scene, storage and tests).
// lighting = { scene: 'day'|'evening'|'night', ceiling: 'chandelier'|'spots'|'panel'|'none', lampsOn?: boolean }
// lampsOn: the 💡 switch; absent / null = the scene decides (day off, evening and night on).
export const SCENES = ['day', 'evening', 'night'];
export const CEILINGS = ['chandelier', 'spots', 'panel', 'none'];
export const DEFAULT_LIGHTING = { scene: 'day', ceiling: 'chandelier' };
export const TWEEN_SEC = 1.2;

// Per scene: ambient, reflections, sky colour behind the window, sun (height in m above the ceiling; < 0 = set), lamps.
export const PRESETS = {
  day:     { hemi: 1.4,  env: 0.35, sky: '#bfe3ff', sun: { color: '#fff4e0', power: 2.2, height: 2.5 }, lamps: false },
  evening: { hemi: 0.45, env: 0.15, sky: '#f0a46e', sun: { color: '#ff9a4d', power: 1.3, height: 0.6 }, lamps: true },   // ≈ 2700 K, low sun
  night:   { hemi: 0.12, env: 0.05, sky: '#0b1426', sun: { color: '#3d4a6b', power: 0, height: -1.5 }, lamps: true }
};

export const lightingOf = l => ({
  scene: SCENES.includes(l?.scene) ? l.scene : DEFAULT_LIGHTING.scene,
  ceiling: CEILINGS.includes(l?.ceiling) ? l.ceiling : DEFAULT_LIGHTING.ceiling,
  lampsOn: typeof l?.lampsOn === 'boolean' ? l.lampsOn : null
});

// Are the lamps on: the 💡 override or the scene default.
export function lampsOn(l) {
  const s = lightingOf(l);
  return s.lampsOn ?? PRESETS[s.scene].lamps;
}

/**
 * Light levels the scene moves to: numbers and '#rrggbb' colours only, so they can be interpolated.
 * ceil / fix — multipliers of the ceiling fixture and of floor lamps / sconces; shade — glow of lamp shades.
 * Lamps switched off keep a faint glow by day so the fixture stays readable.
 */
export function targetsFor(l) {
  const s = lightingOf(l), p = PRESETS[s.scene], on = lampsOn(s);
  return {
    hemi: p.hemi, env: p.env, sky: p.sky,
    sunColor: p.sun.color, sunPower: p.sun.power, sunHeight: p.sun.height,
    ceil: on ? 1 : s.scene === 'day' ? 0.15 : 0.02,
    fix: on ? 1 : 0.05,
    shade: on ? 2 : 0.25
  };
}

export const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// Room lighting settings (pure: used by the 3D scene, storage and tests).
// lighting = { scene: 'day'|'evening'|'night', ceiling: 'chandelier'|'spots'|'panel'|'none', lampsOn?: boolean }
// lampsOn: the 💡 switch; absent / null = the scene decides (day off, evening and night on).
export const SCENES = ['day', 'evening', 'night'];
export const CEILINGS = ['chandelier', 'spots', 'panel', 'none'];
export const DEFAULT_LIGHTING = { scene: 'day', ceiling: 'chandelier' };
export const TWEEN_SEC = 1.2;
// Sky light plus the lamps' bounce reaches at least this with the lamps on (night is dark only outside).
export const BOUNCE = 0.85;

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
 * ceil / fix — multipliers of the ceiling fixture and of floor lamps / sconces; shade — glow of lamp shades;
 * bounce — the lamps' light reflected by the walls and the ceiling (added to the sky light; no GI in the scene).
 * Lamps switched off keep a faint glow by day so the fixture stays readable.
 */
export function targetsFor(l) {
  const s = lightingOf(l), p = PRESETS[s.scene], on = lampsOn(s);
  return {
    hemi: p.hemi, env: p.env, sky: p.sky,
    sunColor: p.sun.color, sunPower: p.sun.power, sunHeight: p.sun.height,
    ceil: on ? 1 : s.scene === 'day' ? 0.15 : 0.02,
    fix: on ? 1 : 0.05,
    shade: on ? 2 : 0.25,
    bounce: on ? Math.max(0, BOUNCE - p.hemi) : 0
  };
}

export const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// ---------- ceiling fixtures ----------
// Floor illuminance under a fixture with the lamps on (the scale of the 3D lights: candela / m²). The old lights
// gave 5–11 here and washed the room out; ≈ 1.6 keeps the walls in their colour at the ACES exposure of the scene.
export const FLOOR_LUX = 1.6;
const SPOT = { angle: 0.55, penumbra: 0.55 };         // ≈ 31° half-angle (a 60° downlight): pools, not a flood
const PANEL_MAX = { w: 1.2, d: 0.6 };

/**
 * The light sources of a room's ceiling fixture, sizes in metres, the room from (0, 0) to (L, W), ceiling at H.
 * spot / point: { type, x, y, z, power (cd), distance (m, 0 = no cut-off) [, angle, penumbra] };
 * area: { type: 'area', x, y, z, w, d, power (nits) }. discs: where the spot housings are.
 * merged: the grid of spots as one wide down-light with the same light output (the lamp budget is spent).
 */
export function fixtureSpec(ceiling, L, W, H, { merged = false } = {}) {
  const c = lightingOf({ ceiling }).ceiling;
  const reach = Math.hypot(L, W) / 2 + H;               // the light fades out just past the far corner
  if (c === 'chandelier') {
    const y = H - 0.5, h = y;
    return { lights: [{ type: 'point', x: L / 2, y, z: W / 2, power: FLOOR_LUX * h * h, distance: reach * 1.2 }], discs: [] };
  }
  if (c === 'spots') {
    const nx = L > 4.2 ? 3 : 2, nz = W > 3.6 ? 3 : 2, y = H - 0.02, h = y;
    const discs = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) discs.push({ x: L * (i + 0.5) / nx, z: W * (j + 0.5) / nz });
    const one = FLOOR_LUX * h * h * 0.85;                // the pools overlap a little: a touch less each
    const distance = h / Math.cos(SPOT.angle) * 1.6;    // fades out below the floor; the narrow cone stays in the room
    if (merged) {
      // Same light output: n · I · 2π(1 − cos a) = I₁ · 2π(1 − cos A).
      const A = 1.1, power = discs.length * one * (1 - Math.cos(SPOT.angle)) / (1 - Math.cos(A));
      return { lights: [{ type: 'spot', x: L / 2, y, z: W / 2, power, angle: A, penumbra: 1, distance: h / Math.cos(A) * 1.1 }], discs };
    }
    return { lights: discs.map(d => ({ type: 'spot', x: d.x, y, z: d.z, power: one, ...SPOT, distance })), discs };
  }
  if (c === 'panel') {
    const w = Math.min(PANEL_MAX.w, L * 0.4), d = Math.min(PANEL_MAX.d, W * 0.3), y = H - 0.025, h = y;
    // A small panel straight above: E ≈ L·A / h².
    return { lights: [{ type: 'area', x: L / 2, y, z: W / 2, w, d, power: FLOOR_LUX * h * h / (w * d) }], discs: [] };
  }
  return { lights: [], discs: [] };
}

/** Floor illuminance at (x, z) from a fixture spec (inverse square, cosine, spot cone, distance cut-off). */
export function floorLux(spec, x, z) {
  let e = 0;
  for (const l of spec.lights) {
    const dx = x - l.x, dz = z - l.z, h = l.y, d2 = dx * dx + dz * dz + h * h, d = Math.sqrt(d2), cos = h / d;
    let k = 1;
    if (l.type === 'spot') {
      const a = Math.acos(cos), inner = l.angle * (1 - l.penumbra);
      k = a >= l.angle ? 0 : a <= inner ? 1 : (l.angle - a) / (l.angle - inner);
    }
    if (l.distance) k *= Math.max(0, 1 - (d / l.distance) ** 4) ** 2;
    const I = l.type === 'area' ? l.power * l.w * l.d * cos : l.power;
    e += I * cos / d2 * k;
  }
  return e;
}

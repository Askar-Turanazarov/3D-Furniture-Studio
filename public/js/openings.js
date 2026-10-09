// Windows and doors in the walls. Pure helpers, all values in cm.
// opening = { id, kind: 'window' | 'door', wall, offset, width, height, sill?, hinge? }
// offset — from the wall start: x = 0 for north/south walls, y = 0 for west/east walls.
// hinge — 'start' | 'end': door hinges at the smaller / larger offset; doors always swing inward.

export const WALLS = ['north', 'east', 'south', 'west'];
const WINDOW_ZONE = 10;   // furniture closer than this to a window wall blocks the window

export const wallLen = (wall, room) => (wall === 'north' || wall === 'south' ? room.L : room.W);

export function defaultOpenings(room) {
  const ww = Math.round(Math.min(140, room.L * 0.45));
  const door = { kind: 'door', wall: 'south', width: 80, height: Math.min(200, room.H - 10), hinge: 'end' };
  door.offset = Math.max(15, room.L - 60 - door.width / 2);
  return [
    { id: 1, kind: 'window', wall: 'north', offset: Math.round(room.L / 2 - ww / 2), width: ww,
      sill: 85, height: Math.max(50, Math.min(145, room.H - 110)) },
    { id: 2, ...door }
  ].map(o => clampOpening(o, room));
}

export function newOpening(kind, id, room) {
  const o = kind === 'window'
    ? { id, kind, wall: 'north', width: 120, height: Math.max(50, Math.min(140, room.H - 110)), sill: 85 }
    : { id, kind, wall: 'south', width: 80, height: Math.min(200, room.H - 10), hinge: 'start' };
  o.offset = Math.round(wallLen(o.wall, room) / 2 - o.width / 2);
  return clampOpening(o, room);
}

// Keep the opening on its wall and below the ceiling (after room resize or edits).
export function clampOpening(o, room) {
  const len = wallLen(o.wall, room);
  o.width = Math.max(30, Math.min(o.width, len));
  o.offset = Math.max(0, Math.min(o.offset, len - o.width));
  if (o.kind === 'window') {
    o.sill = Math.max(0, Math.min(o.sill, room.H - 30));
    o.height = Math.max(20, Math.min(o.height, room.H - o.sill - 5));
  } else {
    o.height = Math.max(150, Math.min(o.height, room.H));
  }
  return o;
}

// Plan rect of the floor area a door sweeps (width × width at the wall).
export function doorSwingRect(o, room) {
  const s = o.width;
  switch (o.wall) {
    case 'north': return { x: o.offset, y: 0, w: s, h: s };
    case 'south': return { x: o.offset, y: room.W - s, w: s, h: s };
    case 'west':  return { x: 0, y: o.offset, w: s, h: s };
    default:      return { x: room.L - s, y: o.offset, w: s, h: s };
  }
}

// Thin strip in front of a window: tall furniture standing there covers the window.
export function windowZoneRect(o, room) {
  const z = WINDOW_ZONE + room.plinth;
  switch (o.wall) {
    case 'north': return { x: o.offset, y: 0, w: o.width, h: z };
    case 'south': return { x: o.offset, y: room.W - z, w: o.width, h: z };
    case 'west':  return { x: 0, y: o.offset, w: z, h: o.width };
    default:      return { x: room.L - z, y: o.offset, w: z, h: o.width };
  }
}

// Nearest wall to a plan point and the coordinate along it.
export function nearestWall(x, y, room) {
  const d = { north: Math.abs(y), south: Math.abs(room.W - y), west: Math.abs(x), east: Math.abs(room.L - x) };
  const wall = WALLS.reduce((a, b) => (d[a] <= d[b] ? a : b));
  return { wall, along: wall === 'north' || wall === 'south' ? x : y, dist: d[wall] };
}

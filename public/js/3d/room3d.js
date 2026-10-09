// Room shell: floor, ceiling, 4 walls with window / door openings from the plan, plinths.
// Interior: x ∈ [0, L], z ∈ [0, W], y ∈ [0, H] in metres.
import * as THREE from 'three';
import { getMats } from './textures3d.js';

const T = 0.1;          // wall thickness, m
const PLINTH_H = 0.08;  // plinth height, m

// Scale UVs so 1 texture tile = 1 metre.
export function scaleUV(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geom;
}

function mesh(geom, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Wall as an extruded shape (x along the wall, y up) with optional rectangular holes.
function wallMesh(x0, x1, H, holes, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(x0, 0); shape.lineTo(x1, 0); shape.lineTo(x1, H); shape.lineTo(x0, H); shape.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x, h.y); p.lineTo(h.x + h.w, h.y); p.lineTo(h.x + h.w, h.y + h.h); p.lineTo(h.x, h.y + h.h); p.closePath();
    shape.holes.push(p);
  }
  // Shape UVs are already in metres (x, y), so 1 tile = 1 m.
  return mesh(new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false }), mat);
}

const box = (w, h, d, mat, opts) => mesh(new THREE.BoxGeometry(w, h, d), mat, opts);

// Local frame of a wall: x along the wall, y up, z into the room (inner face at z = 0).
// north/east keep the plan direction; south/west are rotated by 180°/90°, so x runs backwards.
function wallFrame(wall, L, W) {
  switch (wall) {
    case 'north': return { len: L, rotY: 0, pos: [0, 0, 0], flip: false };
    case 'south': return { len: L, rotY: Math.PI, pos: [L, 0, W], flip: true };
    case 'west':  return { len: W, rotY: Math.PI / 2, pos: [0, 0, W], flip: true };
    default:      return { len: W, rotY: -Math.PI / 2, pos: [L, 0, 0], flip: false };
  }
}

// Opening (cm, plan) → metres in the wall's own frame: x0 from the wall start, width, bottom, height.
function localOpening(o, L, W) {
  const f = wallFrame(o.wall, L, W);
  const w = o.width / 100, off = o.offset / 100;
  return { f, x: f.flip ? f.len - off - w : off, w, y: o.kind === 'window' ? o.sill / 100 : 0, h: o.height / 100 };
}

/**
 * @param room { L, W, H, plinth } in cm; openings — windows / doors (see openings.js)
 * @returns { group, walls: { north, south, west, east }, ceiling, windows: [{ cx, cz, nx, nz }] }
 */
export function buildRoom(room, openings = []) {
  const M = getMats();
  const L = room.L / 100, W = room.W / 100, H = room.H / 100;
  const p = Math.max(room.plinth, 1) / 100;
  const group = new THREE.Group();
  group.name = 'room';

  // Floor + ceiling.
  const floor = mesh(scaleUV(new THREE.PlaneGeometry(L, W), L, W), M.floor, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(L / 2, 0, W / 2);
  group.add(floor);

  const ceiling = mesh(new THREE.PlaneGeometry(L, W), M.ceiling, { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(L / 2, H, W / 2);
  group.add(ceiling);

  const walls = {
    north: new THREE.Group(), south: new THREE.Group(), west: new THREE.Group(), east: new THREE.Group()
  };
  // Holes per wall in the coordinates of each wall mesh (north/south: world x; west/east: world z).
  const holes = { north: [], south: [], west: [], east: [] };
  const windows = [];
  for (const o of openings) {
    const lo = localOpening(o, L, W);
    const worldStart = o.offset / 100;
    holes[o.wall].push({ x: worldStart, y: lo.y, w: lo.w, h: Math.min(lo.h, H - lo.y - 0.01) });
    const g = new THREE.Group();
    g.rotation.y = lo.f.rotY;
    g.position.set(...lo.f.pos);
    if (o.kind === 'window') {
      g.add(...windowParts(lo, M));
      windows.push(windowInfo(o, L, W));
    } else {
      // Hinge side in the wall's own frame (the frame runs backwards on south / west walls).
      const hingeAtStart = (o.hinge !== 'end') !== lo.f.flip;
      g.add(...doorParts(lo, hingeAtStart, M));
    }
    walls[o.wall].add(g);
  }
  // North (z = 0, extruded to -T).
  const north = wallMesh(-T, L + T, H, holes.north, M.wall);
  north.position.z = -T;
  walls.north.add(north);
  // South (z = W, extruded to W + T).
  const south = wallMesh(-T, L + T, H, holes.south, M.wall);
  south.position.z = W;
  walls.south.add(south);
  // West / east: local X → world Z, extrusion → world −X.
  const west = wallMesh(0, W, H, holes.west, M.wall);
  west.rotation.y = -Math.PI / 2;
  walls.west.add(west);
  const east = wallMesh(0, W, H, holes.east, M.wall);
  east.rotation.y = -Math.PI / 2;
  east.position.x = L + T;
  walls.east.add(east);

  // Plinths along the inner faces (thickness = room plinth).
  walls.north.add(at(box(L, PLINTH_H, p, M.plinth), L / 2, PLINTH_H / 2, p / 2));
  walls.south.add(at(box(L, PLINTH_H, p, M.plinth), L / 2, PLINTH_H / 2, W - p / 2));
  walls.west.add(at(box(p, PLINTH_H, W, M.plinth), p / 2, PLINTH_H / 2, W / 2));
  walls.east.add(at(box(p, PLINTH_H, W, M.plinth), L - p / 2, PLINTH_H / 2, W / 2));

  Object.values(walls).forEach(g => group.add(g));
  return { group, walls, ceiling, windows, size: { L, W, H } };
}

// Window centre on the inner wall face and the outward normal (for the sun direction).
function windowInfo(o, L, W) {
  const c = (o.offset + o.width / 2) / 100;
  switch (o.wall) {
    case 'north': return { cx: c, cz: 0, nx: 0, nz: -1 };
    case 'south': return { cx: c, cz: W, nx: 0, nz: 1 };
    case 'west':  return { cx: 0, cz: c, nx: -1, nz: 0 };
    default:      return { cx: L, cz: c, nx: 1, nz: 0 };
  }
}

function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

// Window in the wall frame (z = 0 inner face, wall body at z ∈ [-T, 0]).
function windowParts(win, M) {
  const parts = [];
  const f = 0.05;                     // frame profile
  const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
  // Frame: 4 sides + mullion, inside the wall opening.
  parts.push(at(box(win.w, f, T, M.frame), cx, win.y + f / 2, -T / 2));
  parts.push(at(box(win.w, f, T, M.frame), cx, win.y + win.h - f / 2, -T / 2));
  parts.push(at(box(f, win.h, T, M.frame), win.x + f / 2, cy, -T / 2));
  parts.push(at(box(f, win.h, T, M.frame), win.x + win.w - f / 2, cy, -T / 2));
  parts.push(at(box(f * 0.8, win.h, T * 0.6, M.frame), cx, cy, -T / 2));
  // Glass (no shadows so the sun passes through) + sky backdrop outside.
  parts.push(at(box(win.w, win.h, 0.01, M.glass, { cast: false, receive: false }), cx, cy, -T / 2));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(win.w * 3, win.h * 3), M.sky);
  parts.push(at(sky, cx, cy, -1.2));
  // Window sill on the inside.
  parts.push(at(box(win.w + 0.1, 0.03, 0.2, M.frame), cx, win.y - 0.015, 0.05));
  return parts;
}

// Closed door in the wall frame: leaf inside the opening, casing on the inner face, handle opposite the hinges.
function doorParts(d, hingeAtStart, M) {
  const dw = d.w, dh = d.h - 0.01, dx = d.x + dw / 2;
  const parts = [];
  parts.push(at(box(dw, dh, 0.04, M.door), dx, dh / 2, -T / 2));
  // Casing.
  parts.push(at(box(0.07, dh + 0.07, 0.02, M.frame), dx - dw / 2 - 0.035, (dh + 0.07) / 2, 0.01));
  parts.push(at(box(0.07, dh + 0.07, 0.02, M.frame), dx + dw / 2 + 0.035, (dh + 0.07) / 2, 0.01));
  parts.push(at(box(dw + 0.14, 0.07, 0.02, M.frame), dx, dh + 0.035, 0.01));
  // Handle.
  const hx = hingeAtStart ? dx + dw / 2 - 0.12 : dx - dw / 2 + 0.12;
  parts.push(at(box(0.12, 0.02, 0.04, M.metal), hx, Math.min(1.0, dh * 0.5), -T / 2 + 0.04));
  return parts;
}

export function disposeGroup(group) {
  group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  group.removeFromParent();
}

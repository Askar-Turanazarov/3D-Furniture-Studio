// Room shell: floor, ceiling, 4 walls (north with a window), plinths, a door.
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

/**
 * @param room { L, W, H, plinth } in cm
 * @returns { group, walls: { north, south, west, east }, ceiling, window }
 */
export function buildRoom(room) {
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

  // Window in the north wall.
  const ww = Math.min(1.4, L * 0.45), wh = Math.min(1.45, H - 1.1), sill = 0.85;
  const win = { x: L / 2 - ww / 2, y: sill, w: ww, h: Math.max(0.5, wh) };

  const walls = {
    north: new THREE.Group(), south: new THREE.Group(), west: new THREE.Group(), east: new THREE.Group()
  };
  // North (z = 0, extruded to -T), window hole.
  const north = wallMesh(-T, L + T, H, [win], M.wall);
  north.position.z = -T;
  walls.north.add(north, ...windowParts(win, M));
  // South (z = W, extruded to W + T).
  const south = wallMesh(-T, L + T, H, [], M.wall);
  south.position.z = W;
  walls.south.add(south, ...doorParts(L, W, H, M));
  // West / east: local X → world Z, extrusion → world −X.
  const west = wallMesh(0, W, H, [], M.wall);
  west.rotation.y = -Math.PI / 2;
  walls.west.add(west);
  const east = wallMesh(0, W, H, [], M.wall);
  east.rotation.y = -Math.PI / 2;
  east.position.x = L + T;
  walls.east.add(east);

  // Plinths along the inner faces (thickness = room plinth).
  walls.north.add(at(box(L, PLINTH_H, p, M.plinth), L / 2, PLINTH_H / 2, p / 2));
  walls.south.add(at(box(L, PLINTH_H, p, M.plinth), L / 2, PLINTH_H / 2, W - p / 2));
  walls.west.add(at(box(p, PLINTH_H, W, M.plinth), p / 2, PLINTH_H / 2, W / 2));
  walls.east.add(at(box(p, PLINTH_H, W, M.plinth), L - p / 2, PLINTH_H / 2, W / 2));

  Object.values(walls).forEach(g => group.add(g));
  return { group, walls, ceiling, window: win, size: { L, W, H } };
}

function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

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

function doorParts(L, W, H, M) {
  const dw = 0.8, dh = Math.min(2.0, H - 0.1);
  const dx = Math.max(dw / 2 + 0.15, L - 0.6);       // near the east corner
  const parts = [];
  parts.push(at(box(dw, dh, 0.04, M.door), dx, dh / 2, W - 0.02));
  // Casing.
  parts.push(at(box(0.07, dh + 0.07, 0.02, M.frame), dx - dw / 2 - 0.035, (dh + 0.07) / 2, W - 0.01));
  parts.push(at(box(0.07, dh + 0.07, 0.02, M.frame), dx + dw / 2 + 0.035, (dh + 0.07) / 2, W - 0.01));
  parts.push(at(box(dw + 0.14, 0.07, 0.02, M.frame), dx, dh + 0.035, W - 0.01));
  // Handle.
  parts.push(at(box(0.12, 0.02, 0.04, M.metal), dx - dw / 2 + 0.12, 1.0, W - 0.06));
  return parts;
}

export function disposeGroup(group) {
  group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  group.removeFromParent();
}

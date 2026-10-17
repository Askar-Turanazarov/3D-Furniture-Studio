// Soft shadows: patches only under floor-standing items, corner shade stops at doorways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { footprints, contactShadows, cornerShade, shadeStrips } from '../public/js/3d/softShadows.js';

const boxAt = (x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5));
  m.position.set(x, y, z);
  return m;
};

test('contact shadows only under items standing on the floor', () => {
  const g = new THREE.Group();
  g.add(boxAt(1, 0.25, 1), boxAt(2, 1.6, 0.3));   // a chest of drawers and a wall cabinet
  const f = footprints(g);
  assert.equal(f.length, 1);
  assert.ok(Math.abs(f[0].x0 - 0.5) < 1e-6 && Math.abs(f[0].z1 - 1.25) < 1e-6);
  assert.equal(contactShadows([]), null);
  const m = contactShadows(f);
  assert.ok(m.geometry.attributes.position.array.every((v, i) => i % 3 !== 1 || v < 0.01), 'flat on the floor');
  assert.equal(m.raycast(), undefined);
});

test('corner shade: no floor strip across a doorway, no corner strip where an opening reaches the corner', () => {
  const quads = m => (m.geometry.index.count + m.children[0].geometry.index.count) / 6;
  const plain = cornerShade(4, 3, 2.7);
  const door = cornerShade(4, 3, 2.7, [{ wall: 'north', offset: 150, width: 90, height: 210 }]);
  assert.equal(quads(door), quads(plain) + 1, 'the north floor strip is split in two');
  const window0 = cornerShade(4, 3, 2.7, [{ wall: 'west', offset: 0, width: 120, kind: 'window', sill: 90, height: 140 }]);
  assert.equal(quads(window0), quads(plain) - 1, 'the west strip of the north-west corner is left out');
  assert.equal(plain.children[0].name, 'cornerShadeUpper', 'wall and ceiling strips apart: the overview hides them');
});

test('shade strips: one quad per strip, dark on the line, clear at the far edge', () => {
  assert.equal(shadeStrips([]), null);
  const m = shadeStrips([{ p0: [0, 0, 0], p1: [1, 0, 0], n: [0, -0.5, 0], a: 0.3 }, { p0: [0, 1, 0], p1: [0, 2, 0], n: [0, 0, 0.2], a: 0.4 }]);
  assert.equal(m.geometry.attributes.position.count, 8);
  assert.equal(m.geometry.index.count, 12);
  const c = m.geometry.attributes.color;
  assert.deepEqual([c.getW(0), c.getW(1), c.getW(2), c.getW(3)].map(v => Math.round(v * 10) / 10), [0.3, 0.3, 0, 0]);
  assert.ok(Math.abs(m.geometry.attributes.position.getY(2) + 0.5) < 1e-6);
});

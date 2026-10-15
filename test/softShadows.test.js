// Soft shadows: patches only under floor-standing items, corner shade stops at doorways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { footprints, contactShadows, cornerShade } from '../public/js/3d/softShadows.js';

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
  const quads = m => m.geometry.index.count / 6;
  const plain = cornerShade(4, 3, 2.7);
  const door = cornerShade(4, 3, 2.7, [{ wall: 'north', offset: 150, width: 90, height: 210 }]);
  assert.equal(quads(door), quads(plain) + 1, 'the north floor strip is split in two');
  const window0 = cornerShade(4, 3, 2.7, [{ wall: 'west', offset: 0, width: 120, kind: 'window', sill: 90, height: 140 }]);
  assert.equal(quads(window0), quads(plain) - 1, 'the west strip of the north-west corner is left out');
});

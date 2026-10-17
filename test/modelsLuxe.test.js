// Luxe collection models: every type × style builds, stays inside the item box and keeps the triangle budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Procedural textures draw on a canvas: a no-op 2D context is enough to build the meshes in node.
const ctx = new Proxy({}, {
  get: (_, k) => k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4 * 1024 * 1024) })
    : k.startsWith?.('create') ? () => ({ addColorStop() {} }) : () => {},
  set: () => true
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };

const THREE = await import('three');
const { buildItem } = await import('../public/js/3d/models3d.js');
const { LUXE_BUILDERS } = await import('../public/js/3d/modelsLuxe.js');
const { LUXE_STYLES } = await import('../public/js/style.js');
const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url))).items;

function triangles(obj) {
  let n = 0;
  obj.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}

test('luxe models: inside the item box, ≤ 12k triangles, a catalog type for each builder', () => {
  for (const type of Object.keys(LUXE_BUILDERS)) {
    const c = catalog.find(x => x.type === type);
    assert.ok(c, type);
    for (const style of LUXE_STYLES) {
      const item = { id: 1, type, w: c.w, d: c.d, h: c.h, x: 0, y: 0, rot: 0, color: c.color, style };
      const obj = buildItem(item, 'ok', [], { furniture: 'modern' }, catalog);
      obj.position.set(0, 0, 0);
      obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(obj), tol = 0.012;
      const where = `${style} ${type}`;
      assert.ok(b.min.x >= -c.w / 200 - tol && b.max.x <= c.w / 200 + tol, `${where} x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}`);
      assert.ok(b.min.z >= -c.d / 200 - tol && b.max.z <= c.d / 200 + tol, `${where} z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`);
      assert.ok(b.min.y >= -tol && b.max.y <= c.h / 100 + tol, `${where} y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}`);
      assert.ok(b.max.y > c.h / 100 * 0.8, `${where} too low`);
      const tri = triangles(obj);
      assert.ok(tri <= 12000, `${where}: ${tri} triangles`);
    }
  }
});

test('luxe drawers still open (movers), the base style keeps the base model', () => {
  const c = catalog.find(x => x.type === 'nightstand');
  for (const style of LUXE_STYLES) {
    const obj = buildItem({ id: 2, type: 'nightstand', w: c.w, d: c.d, h: c.h, x: 0, y: 0, rot: 0, style, drawers: 2 }, 'ok', [], {}, catalog);
    assert.equal(obj.userData.movers.length, 2, style);
  }
  const a = buildItem({ id: 3, type: 'sofa', w: 200, d: 90, h: 85, x: 0, y: 0, rot: 0, style: 'modern' }, 'ok', [], {}, catalog);
  const b = buildItem({ id: 3, type: 'sofa', w: 200, d: 90, h: 85, x: 0, y: 0, rot: 0, style: 'couture' }, 'ok', [], {}, catalog);
  assert.notEqual(triangles(a), triangles(b));
});

test('cabinets, kitchens and lamps in luxe collections: hardware and facades stay inside the box', () => {
  const types = ['wardrobe', 'drawers', 'dresser', 'kitchen', 'bookshelf', 'tvstand', 'wallcabinet', 'floorlamp', 'sconce', 'mirror']
    .filter(t => catalog.some(x => x.type === t));
  assert.ok(types.length >= 6);
  for (const type of types) {
    const c = catalog.find(x => x.type === type);
    for (const style of LUXE_STYLES) {
      const obj = buildItem({ id: 4, type, w: c.w, d: c.d, h: c.h, x: 0, y: 0, rot: 0, color: c.color, style }, 'ok', [], {}, catalog);
      obj.position.set(0, 0, 0);
      obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(obj), tol = 0.03, where = `${style} ${type}`;
      assert.ok(b.min.x >= -c.w / 200 - tol && b.max.x <= c.w / 200 + tol, `${where} x`);
      assert.ok(b.max.z <= c.d / 200 + tol, `${where} z ${b.max.z.toFixed(3)}`);
      assert.ok(triangles(obj) <= 12000, `${where}: ${triangles(obj)} triangles`);
    }
  }
});

test('every catalog item builds in every style, the base ones too', async () => {
  const { FURN_STYLES } = await import('../public/js/style.js');
  for (const c of catalog) {
    for (const furniture of FURN_STYLES) {
      const item = { id: 1, type: c.type, w: c.w, d: c.d, h: c.h, x: 0, y: 0, rot: 0, color: c.color };
      assert.doesNotThrow(() => buildItem(item, 'ok', [], { furniture }, catalog), `${furniture} ${c.type}`);
    }
  }
});

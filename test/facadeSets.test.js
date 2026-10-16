// The facade and site photo sets are bundled in the project (Vercel has no disk to download them to), with their maps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'public/js/bld3d/facadeTex.js'), 'utf8');
const ids = [...src.match(/FACADE_SETS = \{([^}]*)\}/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
const siteIds = [...src.match(/SITE_SETS = \{([^}]*)\}/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
const lib = JSON.parse(fs.readFileSync(path.join(root, 'public/textures/library.json'), 'utf8'));

test('facade and site sets are bundled library sets with all their maps', () => {
  assert.deepStrictEqual(ids, ['travertine', 'marbleBlack', 'concreteFloor', 'woodPanels']);
  assert.deepStrictEqual(siteIds, ['lawnGrass', 'asphaltRoad', 'paversWave', 'leaves', 'bark']);
  for (const id of [...ids, ...siteIds]) {
    const e = lib.find(x => x.id === id);
    assert.ok(e?.bundled, id + ' bundled');
    assert.ok(e.tile > 0, id + ' tile');
    for (const m of e.maps || ['color', 'normal', 'roughness']) {
      assert.ok(fs.existsSync(path.join(root, 'public/textures/sets', id, m + '.jpg')), `${id}/${m}.jpg`);
    }
  }
});

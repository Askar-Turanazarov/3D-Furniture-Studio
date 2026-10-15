// The facade photo sets: in the library, downloadable from ambientCG, the same list for the button and the CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { downloadable } = createRequire(import.meta.url)('../server/textureFetch.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'public/js/bld3d/facadeTex.js'), 'utf8');
const ids = [...src.match(/FACADE_SETS = \{([^}]*)\}/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
const siteIds = [...src.match(/SITE_SETS = \{([^}]*)\}/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);

test('facade and site sets are whitelisted library sets', async () => {
  assert.deepStrictEqual(ids, ['travertine', 'marbleBlack', 'concreteFloor', 'woodPanels']);
  assert.deepStrictEqual(siteIds, ['lawnGrass', 'asphaltRoad', 'paversWave', 'leaves', 'bark']);
  for (const id of [...ids, ...siteIds]) {
    const e = await downloadable(id);
    assert.ok(e, id + ' downloadable');
    assert.ok(e.tile > 0 && e.mb > 0, id + ' tile and size');
  }
});

test('npm run textures -- --facade fetches the same sets', () => {
  const cli = fs.readFileSync(path.join(root, 'scripts/fetch-textures.js'), 'utf8');
  const list = [...cli.match(/const FACADE = \[([^\]]*)\]/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(list, [...ids, ...siteIds]);
});

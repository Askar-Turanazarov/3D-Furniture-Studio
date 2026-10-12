import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDoc, makeRoom, makeProject, listProjects, loadProject, saveProjectNow, deleteProject,
  migrateV1, openLastProject, activeRoom, onSaveError, makeVariant, variantsOf, migrateV2,
  cloneProject, exportProject, importProject, importProjects
} from '../public/js/storage.js';
import { state, item } from './helpers.js';

function fakeStorage(limit = Infinity) {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const size = [...m].reduce((s, [key, val]) => s + (key === k ? 0 : val.length), 0) + String(v).length;
      if (size > limit) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      m.set(k, String(v));
    },
    removeItem: k => m.delete(k),
    keys: () => [...m.keys()]
  };
}

beforeEach(() => { globalThis.localStorage = fakeStorage(); });

const v1 = () => {
  const s = state({ items: [item({ id: 4 }), item({ id: 7, x: 200 })] });
  return { room: s.room, settings: s.settings, items: s.items, seq: 2, openings: [{ id: 5, kind: 'door' }], openingsLocked: true };
};

test('migrates the v1 plan into a project and keeps the v1 key', () => {
  localStorage.setItem('fsp3d.plan.v1', JSON.stringify(v1()));
  const p = migrateV1('My project', 'Room 1');
  assert.equal(p.name, 'My project');
  assert.equal(p.rooms.length, 1);
  const r = activeRoom(p);
  assert.equal(r.name, 'Room 1');
  assert.equal(r.items.length, 2);
  assert.equal(r.seq, 8, 'seq repaired from item ids');
  assert.equal(r.opSeq, 6);
  assert.equal(r.openingsLocked, true);
  assert.ok(localStorage.getItem('fsp3d.plan.v1'));
  assert.equal(listProjects().length, 1);
  assert.equal(migrateV1('x', 'y'), null, 'migrates only once');
});

test('no v1 plan → nothing to migrate', () => {
  assert.equal(migrateV1('a', 'b'), null);
  assert.equal(openLastProject(), null);
});

test('save and load round trip, last project is reopened', () => {
  const a = makeProject('A', [makeRoom('R1', v1()), makeRoom('R2', {})]);
  const b = makeProject('B', [makeRoom('R', {})]);
  a.activeRoomId = a.rooms[1].id;
  saveProjectNow(a);
  saveProjectNow(b);
  assert.deepEqual(listProjects().map(e => e.name), ['B', 'A']);
  assert.deepEqual(loadProject(a.id), JSON.parse(JSON.stringify(a)));
  assert.equal(openLastProject().id, b.id);
  saveProjectNow(a);
  assert.equal(openLastProject().id, a.id);
  assert.equal(activeRoom(openLastProject()).name, 'R2');
});

test('delete removes the project and its index entry', () => {
  const a = makeProject('A', [makeRoom('R', {})]);
  saveProjectNow(a);
  deleteProject(a.id);
  assert.equal(loadProject(a.id), null);
  assert.deepEqual(listProjects(), []);
  assert.equal(openLastProject(), null);
});

test('normalizeDoc fills defaults and is stable', () => {
  const d = normalizeDoc({ room: { L: 500 } });
  assert.deepEqual(d.room, { L: 500, W: 300, H: 270, plinth: 2 });
  assert.equal(d.settings.snap, 5);
  assert.equal(d.openings, null);
  assert.deepEqual(normalizeDoc(d), d);
});

test('storage full is reported, not thrown', () => {
  globalThis.localStorage = fakeStorage(100);
  let err = null;
  onSaveError(e => { err = e; });
  const ok = saveProjectNow(makeProject('Big', [makeRoom('R', v1())]));
  assert.equal(ok, false);
  assert.equal(err.name, 'QuotaExceededError');
  onSaveError(() => {});
});

// An old v2 project: rooms as tabs with their own lighting / settings, a bedroom with a version.
function v2Project() {
  const bed = { id: 'b1', name: 'Bedroom', purpose: 'bedroom', versionOf: null, variant: 1, ...v1(), room: { L: 400, W: 300, H: 270, plinth: 2 } };
  const ver = { ...structuredClone(bed), id: 'b2', name: 'Bedroom — B', versionOf: 'b1', variant: 2, items: [] };
  const kit = { id: 'k1', name: 'Kitchen', purpose: 'kitchen', versionOf: null, room: { L: 300, W: 250, H: 270, plinth: 2 },
    items: [], lighting: { scene: 'night', ceiling: 'spots' }, settings: { snap: 3 } };
  return { id: 'p1', name: 'Flat', createdAt: 1, updatedAt: 2, activeRoomId: 'k1', rooms: [bed, ver, kit] };
}

test('v2 → v3: rooms in a row, versions become variant projects', () => {
  const [p, ...variants] = migrateV2(v2Project());
  assert.equal(p.version, 3);
  assert.deepEqual(p.rooms.map(r => r.name), ['Bedroom', 'Kitchen']);
  assert.deepEqual(p.rooms.map(r => r.pos), [{ x: 0, y: 0 }, { x: 420, y: 0 }], 'a row with a 20 cm gap');
  assert.deepEqual(p.lighting, { scene: 'night', ceiling: 'spots' }, 'lighting of the room that was open');
  assert.equal(p.settings.snap, 3);
  assert.ok(p.rooms.every(r => !('lighting' in r) && !('settings' in r) && !('versionOf' in r)));
  assert.equal(p.activeRoomId, 'k1');
  assert.equal(variants.length, 1);
  const v = variants[0];
  assert.equal(v.variantOf, 'p1');
  assert.equal(v.name, 'Flat — Bedroom — B');
  assert.deepEqual(v.rooms.map(r => r.name), ['Bedroom — B', 'Kitchen']);
  assert.deepEqual(v.rooms[0].pos, p.rooms[0].pos, 'the version takes the place of its original');
  assert.equal(v.rooms[0].items.length, 0);
  assert.equal(activeRoom(v).name, 'Bedroom — B');
  assert.ok(v.rooms.every(r => !p.rooms.some(x => x.id === r.id)), 'own room ids');
});

test('loading a v2 project migrates it once and saves the variants', () => {
  localStorage.setItem('fsp3d.project.p1', JSON.stringify(v2Project()));
  localStorage.setItem('fsp3d.projects.v2', JSON.stringify([{ id: 'p1', name: 'Flat', updatedAt: 2, rooms: 3 }]));
  const p = loadProject('p1');
  assert.equal(p.rooms.length, 2);
  assert.equal(JSON.parse(localStorage.getItem('fsp3d.project.p1')).version, 3);
  const group = variantsOf('p1');
  assert.equal(group.length, 2);
  assert.equal(group.filter(e => e.variantOf === 'p1').length, 1);
  assert.deepEqual(loadProject('p1'), p, 'second load is the same v3 project');
  assert.equal(listProjects().length, 2);
});

test('variant: exact copy of the apartment linked to the original', () => {
  const p = makeProject('P', [makeRoom('A', v1()), makeRoom('K', {})]);
  const v = makeVariant(p, 'P — B');
  assert.equal(v.variantOf, p.id);
  assert.notEqual(v.id, p.id);
  assert.deepEqual(v.rooms.map(r => r.pos), p.rooms.map(r => r.pos));
  assert.ok(v.rooms.every((r, i) => r.id !== p.rooms[i].id));
  assert.equal(makeVariant(v, 'P — C').variantOf, p.id, 'a variant of a variant belongs to the original');
  v.rooms[0].items[0].x = 999;
  assert.notEqual(p.rooms[0].items[0].x, 999, 'deep copy');
  const c = cloneProject(v, 'copy');
  assert.equal(c.variantOf, undefined, 'a duplicate is a project of its own');
});

test('v2 file import brings its variants, v3 file round-trips pos', () => {
  const [p, ...vs] = importProjects({ format: 'fsp3d-project', version: 2, project: v2Project() });
  assert.notEqual(p.id, 'p1');
  assert.equal(vs.length, 1);
  assert.equal(vs[0].variantOf, p.id);
  const q = importProject(JSON.parse(JSON.stringify(exportProject(p))));
  assert.deepEqual(q.rooms.map(r => r.pos), p.rooms.map(r => r.pos));
  assert.deepEqual(q.lighting, p.lighting);
});

test('export → import round trip, bad files are rejected', () => {
  const p = makeProject('P', [makeRoom('A', v1())]);
  const file = JSON.parse(JSON.stringify(exportProject(p)));
  const q = importProject(file);
  assert.notEqual(q.id, p.id);
  assert.equal(q.rooms[0].items.length, 2);
  assert.equal(q.rooms[0].name, 'A');
  assert.throws(() => importProject({ format: 'other', project: p }));
  assert.throws(() => importProject(null));
  const bad = structuredClone(file);
  bad.project.rooms[0].room.L = 'big';
  assert.throws(() => importProject(bad));
  const bad2 = structuredClone(file);
  bad2.project.rooms[0].items[0].x = null;
  assert.throws(() => importProject(bad2));
});

test('normalizeDoc keeps lighting and fills its defaults (old room docs)', () => {
  assert.deepEqual(normalizeDoc({}).lighting, { scene: 'day', ceiling: 'chandelier' });
  assert.deepEqual(normalizeDoc({ lighting: { scene: 'night' } }).lighting, { scene: 'night', ceiling: 'chandelier' });
});

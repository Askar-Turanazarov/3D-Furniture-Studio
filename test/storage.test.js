import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDoc, makeRoom, makeProject, listProjects, loadProject, saveProjectNow, deleteProject,
  migrateV1, openLastProject, activeRoom, onSaveError, makeVersion, versionGroup,
  cloneProject, exportProject, importProject
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

test('versions: next free letter, placed after the group, copy of the source', () => {
  const a = makeRoom('Bedroom', v1());
  const other = makeRoom('Kitchen', {});
  const p = makeProject('P', [a, other]);
  const name = (n, i) => `${n} — v${i}`;
  const b = makeVersion(p, a.id, name);
  const c = makeVersion(p, b.id, name);   // a version of a version still belongs to the original
  assert.deepEqual(p.rooms.map(r => r.name), ['Bedroom', 'Bedroom — v2', 'Bedroom — v3', 'Kitchen']);
  assert.equal(a.variant, 1);
  assert.equal(c.versionOf, a.id);
  assert.equal(b.items.length, 2);
  assert.notEqual(b.items, a.items, 'deep copy');
  p.rooms.splice(1, 1);   // delete v2 → the next copy reuses the letter
  assert.equal(makeVersion(p, a.id, name).variant, 2);
  assert.equal(versionGroup(p, other).length, 1);
  saveProjectNow(p);
  assert.deepEqual(loadProject(p.id).rooms.map(r => r.variant), [1, 3, 2, undefined], 'variants survive save/load');
});

test('clone gets new ids and keeps version links inside the copy', () => {
  const a = makeRoom('A', v1());
  const p = makeProject('P', [a, makeRoom('K', {})]);
  makeVersion(p, a.id, (n, i) => `${n} ${i}`);
  const c = cloneProject(p, 'P (copy)');
  assert.equal(c.name, 'P (copy)');
  assert.notEqual(c.id, p.id);
  assert.ok(c.rooms.every((r, i) => r.id !== p.rooms[i].id));
  assert.equal(c.rooms[1].versionOf, c.rooms[0].id);
  assert.equal(c.activeRoomId, c.rooms[0].id);
  c.rooms[0].items[0].x = 999;
  assert.notEqual(p.rooms[0].items[0].x, 999);
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

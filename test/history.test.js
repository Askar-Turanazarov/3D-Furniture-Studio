import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../public/js/history.js';

test('undo / redo walk through recorded snapshots', () => {
  const h = createHistory();
  h.reset('a');
  h.record('b');
  h.record('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b');
  assert.equal(h.redo(), 'c');
  assert.equal(h.redo(), null);
});

test('the same snapshot is not recorded twice', () => {
  const h = createHistory();
  h.reset('a');
  h.record('a');
  assert.equal(h.canUndo(), false);
});

test('a new action after undo drops the redo stack', () => {
  const h = createHistory();
  h.reset('a');
  h.record('b');
  h.undo();
  h.record('x');
  assert.equal(h.canRedo(), false);
  assert.equal(h.undo(), 'a');
});

test('a gesture becomes one step', () => {
  const h = createHistory();
  let doc = 'a';
  h.setSource(() => doc);
  h.reset('a');
  h.begin();
  for (const s of ['a1', 'a2', 'a3']) { doc = s; h.record(s); }
  h.end();
  assert.equal(h.undo(), 'a');
  assert.equal(h.canUndo(), false);
  assert.equal(h.redo(), 'a3');
});

test('history is capped', () => {
  const h = createHistory(3);
  h.reset('0');
  for (let i = 1; i <= 10; i++) h.record(String(i));
  let n = 0;
  while (h.undo() !== null) n++;
  assert.equal(n, 3);
});

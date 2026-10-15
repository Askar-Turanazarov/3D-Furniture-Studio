import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, tierFor, governor, SETTINGS, TIERS } from '../public/js/3d/perf.js';

test('device tier from cores, memory, touch and GPU name', () => {
  assert.equal(tierOf({ cores: 12, memory: 16, gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' }), 'high');
  assert.equal(tierOf({ cores: 8, memory: 8, gpu: 'Apple M2' }), 'high');
  assert.equal(tierOf({ cores: 8, memory: 8, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)' }), 'low');
  assert.equal(tierOf({ cores: 8, memory: 8, gpu: 'Google SwiftShader' }), 'low');
  assert.equal(tierOf({ cores: 16, memory: 32, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8) Direct3D11)' }), 'mid');
  assert.equal(tierOf({ cores: 4, memory: 8, gpu: 'Intel(R) HD Graphics 4000' }), 'low');
  assert.equal(tierOf({ cores: 8, memory: 8, gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)' }), 'mid');
  assert.equal(tierOf({ cores: 2, memory: 8, gpu: 'NVIDIA GeForce GTX 1050' }), 'low');
  assert.equal(tierOf({ cores: 8, memory: 2 }), 'low');
  assert.equal(tierOf({ cores: 8, memory: 8, touch: true, gpu: 'Adreno (TM) 730' }), 'mid');
  assert.equal(tierOf({ cores: 8, memory: 4, touch: true, gpu: 'Mali-G57' }), 'low');
  assert.equal(tierOf({ cores: 4, memory: 4, gpu: '' }), 'mid');
  assert.equal(tierOf(), 'mid');
});

test('viewer choice overrides detection', () => {
  assert.equal(tierFor('high', () => 'low'), 'high');
  assert.equal(tierFor('low', () => 'high'), 'low');
  assert.equal(tierFor('auto', () => 'mid'), 'mid');
});

test('every tier has its settings, better tiers are not worse', () => {
  for (const n of TIERS) assert.ok(SETTINGS[n].pixelRatio >= 1);
  assert.ok(SETTINGS.low.pixelRatio <= SETTINGS.mid.pixelRatio && SETTINGS.mid.pixelRatio <= SETTINGS.high.pixelRatio);
  assert.ok(SETTINGS.low.shadowMap <= SETTINGS.high.shadowMap);
  assert.equal(SETTINGS.low.lampShadows, false);
});

test('governor steps down after 3 slow seconds and up after 10 fast ones, never above the start', () => {
  const log = [];
  const g = governor('high', (tier, dir) => log.push([tier, dir]));
  for (let i = 0; i < 3 * 20; i++) g.frame(1 / 20);          // 20 fps
  assert.deepEqual(log, [['mid', -1]]);
  for (let i = 0; i < 9 * 60; i++) g.frame(1 / 60);          // 9 s fast: not yet
  assert.equal(g.tier, 'mid');
  for (let i = 0; i < 2 * 60; i++) g.frame(1 / 60);
  assert.equal(g.tier, 'high');
  for (let i = 0; i < 30 * 60; i++) g.frame(1 / 60);         // never above the start
  assert.equal(g.tier, 'high');
  assert.equal(log.length, 2);
});

test('governor ignores pauses and stops at low', () => {
  const log = [];
  const g = governor('low', t => log.push(t));
  g.frame(3);                                                  // a long pause is not a slow frame
  for (let i = 0; i < 10 * 10; i++) g.frame(1 / 10);
  assert.equal(g.tier, 'low');
  assert.deepEqual(log, []);
});

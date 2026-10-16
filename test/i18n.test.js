// RU / UZ / EN dictionaries: the same keys everywhere and no empty strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict } from '../public/js/i18n.js';

const LANGS = ['ru', 'uz', 'en'];

test('i18n: every language has exactly the keys of the others', () => {
  const all = new Set(LANGS.flatMap(l => Object.keys(dict[l])));
  for (const l of LANGS) {
    const missing = [...all].filter(k => !(k in dict[l]));
    assert.deepEqual(missing, [], `${l} has no translation for: ${missing.join(', ')}`);
  }
});

test('i18n: no empty strings', () => {
  for (const l of LANGS) {
    const empty = Object.entries(dict[l]).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
    assert.deepEqual(empty, [], `${l}: empty values for ${empty.join(', ')}`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/js/icons.js', import.meta.url), 'utf8');
const paths = new Set([...src.match(/const P = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1]));
const glyphs = [...src.match(/const GLYPHS = \{([\s\S]*?)\n\};/)[1].matchAll(/'[^']+':\s*'(\w+)'/g)].map(m => m[1]);

test('every glyph maps to a drawn icon', () => {
  assert.ok(glyphs.length > 30);
  for (const g of glyphs) assert.ok(paths.has(g), g);
});

test('every data-icon in the pages has a path', () => {
  for (const f of ['index.html', 'building.html', 'admin.html']) {
    const html = readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
    for (const m of html.matchAll(/data-icon="(\w+)"/g)) assert.ok(paths.has(m[1]), `${f}: ${m[1]}`);
  }
});

test('pages set the theme before the first paint and have the toggle', () => {
  for (const f of ['index.html', 'building.html', 'admin.html']) {
    const html = readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /dataset\.theme=localStorage\.getItem\('fsp3d\.theme'\)/, f);
    assert.ok(head.indexOf('dataset.theme') < head.indexOf('css/style.css'), f);
    assert.match(html, /data-theme-toggle/, f);
  }
});

test('both themes define the plan palette', () => {
  const css = readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  const block = sel => css.slice(css.indexOf(sel + ' {'), css.indexOf('}', css.indexOf(sel + ' {')));
  for (const v of ['--plan-floor', '--plan-wall', '--plan-sel', '--st-free', '--bg', '--text', '--gold'])
    for (const sel of [':root', ':root[data-theme="light"]']) assert.ok(block(sel).includes(v + ':'), `${sel} ${v}`);
});

// Pages with the language in the address (/ru, /uz, /en, …/building): <html lang>, title and the Open Graph block.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'fsp3d-'));
const app = require('../server.js');
const pages = require('../server/pages.js');
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}`;
const og = (html, key) => html.match(new RegExp(`<meta property="${key}" content="([^"]*)">`))?.[1];

test('/ru, /uz/, /en, /en/building: the page in that language with its preview', async () => {
  const cases = [['/ru', 'ru', 'planner', ''], ['/uz/', 'uz', 'planner', ''], ['/en', 'en', 'planner', ''],
    ['/en/building', 'en', 'building', '/building'], ['/uz/building/', 'uz', 'building', '/building']];
  for (const [url, lang, page, p] of cases) {
    const res = await fetch(base() + url);
    assert.equal(res.status, 200, url);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, new RegExp(`<html lang="${lang}">`), url);
    assert.equal(og(html, 'og:title'), pages.TEXT[page][lang][0].replace(/"/g, '&quot;'), url);
    assert.equal(og(html, 'og:url'), `${base()}/${lang}${p}`, url);
    assert.equal(og(html, 'og:image'), `${base()}/og/${page}-${lang}.png`, url);
    assert.equal(og(html, 'og:locale'), { ru: 'ru_RU', uz: 'uz_UZ', en: 'en_US' }[lang]);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html, /href="\/css\/style\.css"/, 'assets are absolute: /en/ does not break them');
  }
});

test('an unknown language is not a page', async () => {
  for (const url of ['/de', '/xx/building', '/en/nope']) assert.notEqual((await fetch(base() + url)).status, 200, url);
});

test('static "/" and "/building.html" are the Russian pages with production URLs', async () => {
  for (const [file, page] of [['index.html', 'planner'], ['building.html', 'building']]) {
    const html = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    assert.ok(html.includes(pages.ogBlock(page, 'ru')), `${file}: run the block from server/pages.js again`);
    assert.match(html, /<html lang="ru">/);
  }
  const res = await fetch(base() + '/');
  assert.equal(og(await res.text(), 'og:locale'), 'ru_RU');
});

test('vercel.json ships both pages with the function', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const f of ['public/index.html', 'public/building.html']) assert.ok(v.functions['server.js'].includeFiles.includes(f), f);
});

// Texture library sets on demand: download the ambientCG 1K-JPG zip of a whitelisted set (library.json,
// bundled: false) and unpack its maps — color / normal (OpenGL) / roughness, or the set's own list (`maps`, e.g.
// leaves: color / opacity) — into public/textures/lib/<id>/.
const fs = require('fs/promises');
const path = require('path');
const { listZip, readEntry } = require('./zip');

const ROOT = path.join(__dirname, '..', 'public', 'textures');
const LIB_DIR = path.join(ROOT, 'lib');
const MAX_ZIP = 40 * 1024 * 1024;
const TIMEOUT = 90 * 1000;
const MAPS = { color: /_Color\.jpg$/i, normal: /_NormalGL\.jpg$/i, roughness: /_Roughness\.jpg$/i, opacity: /_Opacity\.jpg$/i };
const DEFAULT_MAPS = ['color', 'normal', 'roughness'];
const mapsOf = e => (Array.isArray(e.maps) ? e.maps.filter(k => MAPS[k]) : DEFAULT_MAPS);

async function readLibrary() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'library.json'), 'utf8'));
}

// Sets that may be downloaded: only ids from the library, never a path from the request.
async function downloadable(id) {
  const lib = await readLibrary();
  const e = lib.find(x => x.id === id && !x.bundled);
  return e && /^[A-Za-z0-9]+$/.test(e.source?.ambientcg || '') ? e : null;
}

const exists = p => fs.access(p).then(() => true, () => false);

// Library entries with `available`: all maps of the set are on disk (bundled or downloaded).
async function libraryStatus() {
  const lib = await readLibrary();
  return Promise.all(lib.map(async e => {
    const dir = path.join(ROOT, e.bundled ? 'sets' : 'lib', e.id);
    const ok = await Promise.all(mapsOf(e).map(f => exists(path.join(dir, f + '.jpg'))));
    return { ...e, available: ok.every(Boolean) };
  }));
}

// The maps from a zip buffer → { color, normal, roughness } buffers (or the keys asked for).
function mapsFromZip(buf, keys = DEFAULT_MAPS) {
  const entries = listZip(buf);
  const out = {};
  for (const key of keys) {
    const re = MAPS[key];
    const e = entries.find(x => re.test(x.name) && !x.name.includes('/') && !x.name.includes('\\'));
    if (!e) throw new Error('missing ' + key);
    out[key] = readEntry(buf, e, 16 * 1024 * 1024);
  }
  return out;
}

async function download(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (Number(res.headers.get('content-length')) > MAX_ZIP) throw new Error('too large');
    const chunks = [];
    let size = 0;
    for await (const c of res.body) {
      size += c.length;
      if (size > MAX_ZIP) throw new Error('too large');
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

let busy = false;

// Download and unpack one set; one download at a time. Resolves to the written folder.
async function fetchSet(id, { log = () => {} } = {}) {
  const e = await downloadable(id);
  if (!e) throw Object.assign(new Error('unknown set'), { status: 404 });
  if (busy) throw Object.assign(new Error('busy'), { status: 429 });
  busy = true;
  try {
    const asset = e.source.ambientcg;
    log(`${id}: downloading ${asset}_1K-JPG.zip`);
    const buf = await download(`https://ambientcg.com/get?file=${asset}_1K-JPG.zip`);
    const maps = mapsFromZip(buf, mapsOf(e));
    const dir = path.join(LIB_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    for (const [k, data] of Object.entries(maps)) await fs.writeFile(path.join(dir, k + '.jpg'), data);
    log(`${id}: ${(buf.length / 1048576).toFixed(1)} MB zip → ${dir}`);
    return dir;
  } finally {
    busy = false;
  }
}

module.exports = { fetchSet, libraryStatus, mapsFromZip, downloadable, LIB_DIR };

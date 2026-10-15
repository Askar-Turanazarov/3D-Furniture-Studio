// Pre-download the on-demand texture sets of public/textures/library.json (ambientCG, CC0) into public/textures/lib/.
// Usage: npm run textures [-- --kind floor|wall|rough|furniture] [-- --id oakPlanks] [-- --facade]
const { fetchSet, libraryStatus } = require('../server/textureFetch');

// The building facade and site sets (FACADE_SETS and SITE_SETS in public/js/bld3d/facadeTex.js).
const FACADE = ['travertine', 'marbleBlack', 'concreteFloor', 'woodPanels', 'lawnGrass', 'asphaltRoad', 'paversWave', 'leaves', 'bark'];

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : null;
}

(async () => {
  const kind = arg('kind'), id = arg('id'), facade = process.argv.includes('--facade');
  const todo = (await libraryStatus())
    .filter(e => !e.bundled && !e.available && (!kind || e.kind === kind) && (!id || e.id === id) && (!facade || FACADE.includes(e.id)));
  if (!todo.length) return console.log('Nothing to download: all sets are on disk.');
  const mb = todo.reduce((s, e) => s + (e.mb || 5), 0);
  console.log(`${todo.length} set(s), about ${Math.round(mb)} MB of zips from ambientcg.com`);
  let failed = 0;
  for (const e of todo) {
    try {
      await fetchSet(e.id, { log: m => console.log('  ' + m) });
    } catch (err) {
      failed++;
      console.error(`  ${e.id}: ${err.message}`);
    }
  }
  console.log(failed ? `Done, ${failed} failed.` : 'Done.');
  process.exitCode = failed ? 1 : 0;
})();

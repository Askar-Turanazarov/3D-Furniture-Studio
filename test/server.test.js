// Server routes on a real server (port 0) with a temporary data folder.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'fsp3d-'));
process.env.ADMIN_TOKEN = 'server-test-token-123';
const app = require('../server.js');
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}`;
const auth = { Authorization: 'Bearer ' + process.env.ADMIN_TOKEN, 'Content-Type': 'application/json' };

test('PATCH /api/orders/:id: a non-numeric id is 404', async () => {
  for (const id of ['abc', '1x', '-1', '1.5']) {
    const res = await fetch(`${base()}/api/orders/${id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'done' }) });
    assert.equal(res.status, 404, id);
    assert.deepEqual(await res.json(), { error: 'not_found' });
  }
});

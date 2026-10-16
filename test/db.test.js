// The storage contract (server/db.js): files always; Postgres only with TEST_DATABASE_URL (a throwaway Neon branch —
// the test writes orders and statuses there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { fileDb, pgDb } = require('../server/db.js');

function contract(name, make, opts = {}) {
  test(`db (${name}): orders, pictures, statuses, limit`, opts, async () => {
    const db = make();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const before = (await db.listOrders()).length;
    const ip = 'test-' + Math.random();
    const a = await db.addOrder({ name: 'A', phone: '+998901234567' }, [['plan.png', png]], ip);
    const b = await db.addOrder({ name: 'B', phone: '+998901234567' }, [], ip);
    assert.notEqual(a, b);
    const list = await db.listOrders();
    assert.equal(list.length, before + 2);
    const oa = list.find(o => o.id === a);
    assert.equal(oa.status, 'new');
    assert.equal(oa.name, 'A');
    assert.deepEqual(oa.files, [`orders/${a}/plan.png`]);
    assert.ok(!('files' in list.find(o => o.id === b)));
    assert.deepEqual(await db.orderFile(a, 'plan.png'), png);
    assert.equal(await db.orderFile(b, 'plan.png'), null);

    const upd = await db.updateOrder(a, o => { o.status = 'inWork'; o.note = 'call'; });
    assert.equal(upd.status, 'inWork');
    assert.equal((await db.listOrders()).find(o => o.id === a).note, 'call');
    assert.equal(await db.updateOrder(1, () => {}), null);

    await db.setStatus('test-building', 7, 'sold');
    await db.setStatus('test-building', 7, 'booked');
    assert.equal((await db.statuses())['test-building'][7], 'booked');

    // 5 orders per IP in 10 minutes (the two above count in Postgres; in files every call counts)
    const ip2 = 'limit-' + Math.random();
    let allowed = 0;
    for (let i = 0; i < 7; i++) {
      if (await db.allowOrder(ip2)) { allowed++; await db.addOrder({ name: 'L' }, [], ip2); }
    }
    assert.equal(allowed, 5);
  });
}

contract('files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fsp3d-db-'));
  return fileDb({ ordersFile: join(dir, 'order.json'), filesDir: join(dir, 'orders'), statusFile: join(dir, 'data', 'st.json') });
});

contract('postgres', () => pgDb(process.env.TEST_DATABASE_URL),
  { skip: !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL is not set' });

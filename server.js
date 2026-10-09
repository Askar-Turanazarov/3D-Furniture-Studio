const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CATALOG = path.join(__dirname, 'catalog.json');
const ORDERS = path.join(__dirname, 'order.json');

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/catalog', async (req, res) => {
  try {
    res.type('json').send(await fs.readFile(CATALOG, 'utf8'));
  } catch (e) {
    res.status(500).json({ error: 'catalog_unavailable' });
  }
});

app.post('/api/order', async (req, res) => {
  const { name, phone, comment, room, items, lang } = req.body || {};
  if (!name || !phone || !room || !Array.isArray(items)) {
    return res.status(400).json({ error: 'invalid_order' });
  }
  try {
    let orders = [];
    try { orders = JSON.parse(await fs.readFile(ORDERS, 'utf8')); } catch { orders = []; }
    const order = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      name: String(name).slice(0, 100),
      phone: String(phone).slice(0, 30),
      comment: String(comment || '').slice(0, 1000),
      lang, room, items
    };
    orders.push(order);
    await fs.writeFile(ORDERS, JSON.stringify(orders, null, 2));
    res.json({ ok: true, id: order.id });
  } catch (e) {
    res.status(500).json({ error: 'save_failed' });
  }
});

app.listen(PORT, () => console.log(`Furniture Super Planner 3D: http://localhost:${PORT}`));

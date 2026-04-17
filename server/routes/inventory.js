import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/inventory — public (storefront needs this)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT i.*, s.name AS shop_name, s.type AS shop_type
             FROM inventory i
             LEFT JOIN shops s ON i.outlet_id = s.shop_id
             ORDER BY i.item_id ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/low-stock
router.get('/low-stock', requireRole('admin','manager','retail'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT i.*, s.name AS shop_name FROM inventory i
             LEFT JOIN shops s ON i.outlet_id = s.shop_id
             WHERE i.is_low_stock = 1 ORDER BY i.stock_count ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/with-shops — all shops with their inventory items nested
router.get('/with-shops', async (req, res) => {
    try {
        const [shops] = await db.query('SELECT * FROM shops ORDER BY shop_id ASC');
        const [items] = await db.query('SELECT * FROM inventory ORDER BY item_id ASC');

        const result = shops.map(shop => ({
            ...shop,
            outlet_id: shop.shop_id,   // alias for frontend compatibility
            inventory: items.filter(item => item.outlet_id === shop.shop_id),
        }));

        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM inventory WHERE item_id = ?', [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Item not found.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/inventory
router.post('/', requireRole('admin','manager','retail'), async (req, res) => {
    const { outlet_id, item_name, stock_count, restock_threshold,
            cost_to_restock_cents, category, price_cents, image_url } = req.body;
    try {
        const [result] = await db.query(
            `INSERT INTO inventory
             (outlet_id, item_name, stock_count, restock_threshold,
              cost_to_restock_cents, category, price_cents, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [outlet_id || null, item_name, stock_count ?? 0,
             restock_threshold ?? 10, cost_to_restock_cents ?? 500,
             category || null, price_cents, image_url || null]
        );
        return res.status(201).json({ item_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/inventory/:id/restock — add quantity to stock_count
router.patch('/:id/restock', requireRole('admin', 'manager', 'retail'), async (req, res) => {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity.' });
    try {
        await db.query(
            'UPDATE inventory SET stock_count = stock_count + ? WHERE item_id = ?',
            [quantity, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/inventory/:id
router.patch('/:id', requireRole('admin','manager','retail'), async (req, res) => {
    const fields = ['item_name','stock_count','restock_threshold',
                    'cost_to_restock_cents','category','price_cents','image_url','outlet_id'];
    const updates = []; const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    vals.push(req.params.id);
    try {
        await db.query(`UPDATE inventory SET ${updates.join(', ')} WHERE item_id = ?`, vals);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/inventory/:id/decrement — replaces the decrement_stock pg function
router.post('/:id/decrement', requireRole('admin','manager','retail'), async (req, res) => {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity.' });
    try {
        await db.query(
            'UPDATE inventory SET stock_count = GREATEST(0, stock_count - ?) WHERE item_id = ?',
            [quantity, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/shops/all
router.get('/shops/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM shops ORDER BY shop_id ASC');
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

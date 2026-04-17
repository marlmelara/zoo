import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/donations/my — current customer's donations
router.get('/my', requireAuth, async (req, res) => {
    try {
        const { customerId } = req.user;
        const [rows] = await db.query(
            `SELECT * FROM donations WHERE customer_id = ? ORDER BY donation_date DESC`,
            [customerId]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/donations — admin
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT d.*, c.first_name, c.last_name
             FROM donations d
             LEFT JOIN customers c ON d.customer_id = c.customer_id
             ORDER BY d.donation_date DESC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/donations — create (used by checkout)
router.post('/', async (req, res) => {
    const { donor_name, amount_cents, customer_id } = req.body;
    if (!amount_cents || amount_cents <= 0) {
        return res.status(400).json({ error: 'Invalid donation amount.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO donations (donor_name, amount_cents, customer_id)
             VALUES (?, ?, ?)`,
            [donor_name || null, amount_cents, customer_id || null]
        );
        return res.status(201).json({ donation_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

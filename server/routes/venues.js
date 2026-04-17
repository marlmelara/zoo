import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM venues ORDER BY venue_id ASC');
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/', requireRole('admin','manager'), async (req, res) => {
    const { venue_name, location, capacity } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO venues (venue_name, location, capacity) VALUES (?, ?, ?)',
            [venue_name, location || null, capacity ?? 150]
        );
        return res.status(201).json({ venue_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', requireRole('admin','manager'), async (req, res) => {
    const { venue_name, location, capacity } = req.body;
    try {
        await db.query(
            'UPDATE venues SET venue_name=?, location=?, capacity=? WHERE venue_id=?',
            [venue_name, location || null, capacity ?? 150, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
    try {
        await db.query('DELETE FROM venues WHERE venue_id = ?', [req.params.id]);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

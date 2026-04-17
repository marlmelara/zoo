import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/activity-log
router.get('/', requireRole('admin','manager'), async (req, res) => {
    try {
        const { limit = 100, offset = 0, action_type } = req.query;
        let query = `SELECT al.*, e.first_name, e.last_name
                     FROM activity_log al
                     LEFT JOIN employees e ON al.performed_by = e.employee_id`;
        const params = [];
        if (action_type) { query += ' WHERE al.action_type = ?'; params.push(action_type); }
        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/activity-log — internal use from other routes
router.post('/', requireAuth, async (req, res) => {
    const { action_type, description, target_type, target_id, metadata } = req.body;
    try {
        await db.query(
            `INSERT INTO activity_log
             (action_type, description, performed_by, target_type, target_id, metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [action_type, description, req.user.employeeId || null,
             target_type || null, target_id || null,
             JSON.stringify(metadata || {})]
        );
        return res.status(201).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

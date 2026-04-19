import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/activity-log
// Supports:
//   limit, offset   — page through the log (default 25 / 0)
//   action_type     — legacy single filter
//   action_types    — comma-separated list (Inventory uses this for its whitelist)
//   dept_id         — scope to one department
//   from, to        — YYYY-MM-DD date range (inclusive). When set, caller
//                     typically passes a large limit to pull everything.
//   search          — LIKE match against description / action_type / performer name
//   include_total=1 — also return { total } so the client can render a
//                     "page N of M" indicator
//
// Response: either an array (legacy) or { rows, total } when include_total=1.
router.get('/', requireRole('admin','manager'), async (req, res) => {
    try {
        const {
            limit = 25, offset = 0,
            action_type, action_types,
            dept_id, from, to, search,
            include_total,
        } = req.query;
        const where = [];
        const params = [];
        if (action_type) { where.push('al.action_type = ?'); params.push(action_type); }
        if (action_types) {
            const arr = String(action_types).split(',').map(s => s.trim()).filter(Boolean);
            if (arr.length) {
                where.push(`al.action_type IN (${arr.map(() => '?').join(',')})`);
                params.push(...arr);
            }
        }
        if (dept_id) { where.push('e.dept_id = ?');      params.push(parseInt(dept_id)); }
        if (from)    { where.push('al.created_at >= ?'); params.push(`${from} 00:00:00`); }
        if (to)      { where.push('al.created_at <= ?'); params.push(`${to} 23:59:59`); }
        if (search && String(search).trim()) {
            const q = `%${String(search).trim()}%`;
            where.push(`(al.description LIKE ?
                       OR al.action_type LIKE ?
                       OR CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,'')) LIKE ?)`);
            params.push(q, q, q);
        }
        const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

        const baseFrom = `FROM activity_log al
                          LEFT JOIN employees   e ON al.performed_by = e.employee_id
                          LEFT JOIN departments d ON e.dept_id        = d.dept_id`;

        const query = `SELECT al.*,
                              e.first_name, e.last_name, e.role, e.dept_id,
                              d.dept_name
                       ${baseFrom}
                       ${whereSql}
                       ORDER BY al.created_at DESC
                       LIMIT ? OFFSET ?`;
        const [rows] = await db.query(query, [...params, parseInt(limit), parseInt(offset)]);

        const shaped = rows.map(r => ({
            ...r,
            created_at: toIsoUtc(r.created_at),
            performer: r.performed_by ? {
                first_name: r.first_name,
                last_name:  r.last_name,
                role:       r.role,
                dept_id:    r.dept_id,
                dept_name:  r.dept_name,
            } : null,
        }));

        if (include_total === '1') {
            const [[{ total }]] = await db.query(
                `SELECT COUNT(*) AS total ${baseFrom} ${whereSql}`,
                params
            );
            return res.json({ rows: shaped, total });
        }
        return res.json(shaped);
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

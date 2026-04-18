import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/supplies — employees can see their dept supplies
router.get('/', requireAuth, async (req, res) => {
    try {
        const { role, deptId, employeeId } = req.user;
        let rows;
        if (role === 'admin' || role === 'manager') {
            [rows] = await db.query(
                `SELECT os.*, d.dept_name FROM operational_supplies os
                 LEFT JOIN departments d ON os.department_id = d.dept_id
                 ORDER BY os.supply_id ASC`
            );
        } else {
            [rows] = await db.query(
                `SELECT os.*, d.dept_name FROM operational_supplies os
                 LEFT JOIN departments d ON os.department_id = d.dept_id
                 WHERE os.department_id = ?
                 ORDER BY os.supply_id ASC`, [deptId]
            );
        }
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/supplies — admin + manager can create a new operational supply.
router.post('/', requireRole('admin','manager'), async (req, res) => {
    const { department_id, item_name, stock_count, restock_threshold,
            cost_to_restock_cents, category, description } = req.body;
    if (!department_id || !item_name) {
        return res.status(400).json({ error: 'department_id and item_name are required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO operational_supplies
             (department_id, item_name, stock_count, restock_threshold,
              cost_to_restock_cents, category, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [department_id, item_name, stock_count ?? 0,
             restock_threshold ?? 10, cost_to_restock_cents ?? 500,
             category || null, description || null]
        );
        return res.status(201).json({ supply_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/supplies/:id — admin + manager can remove an operational supply.
router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
    try {
        await db.query('DELETE FROM operational_supplies WHERE supply_id = ?', [req.params.id]);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/supplies/requests — supply requests
router.get('/requests', requireAuth, async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        let rows;
        if (role === 'admin' || role === 'manager') {
            [rows] = await db.query(
                `SELECT sr.*,
                        req.first_name AS req_first, req.last_name AS req_last,
                        reqd.dept_name AS req_dept_name,
                        rev.first_name AS rev_first, rev.last_name AS rev_last
                 FROM supply_requests sr
                 LEFT JOIN employees   req  ON sr.requested_by = req.employee_id
                 LEFT JOIN departments reqd ON req.dept_id     = reqd.dept_id
                 LEFT JOIN employees   rev  ON sr.reviewed_by  = rev.employee_id
                 ORDER BY sr.created_at DESC`
            );
        } else {
            [rows] = await db.query(
                `SELECT sr.*,
                        req.first_name AS req_first, req.last_name AS req_last,
                        reqd.dept_name AS req_dept_name
                 FROM supply_requests sr
                 LEFT JOIN employees   req  ON sr.requested_by = req.employee_id
                 LEFT JOIN departments reqd ON req.dept_id     = reqd.dept_id
                 WHERE sr.requested_by = ?
                 ORDER BY sr.created_at DESC`, [employeeId]
            );
        }
        // Reshape so the frontend can use req.requester / req.reviewer directly.
        const shaped = rows.map(r => ({
            ...r,
            requester: r.requested_by ? {
                first_name: r.req_first,
                last_name:  r.req_last,
                departments: r.req_dept_name ? { dept_name: r.req_dept_name } : null,
            } : null,
            reviewer: r.reviewed_by ? {
                first_name: r.rev_first,
                last_name:  r.rev_last,
            } : null,
        }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/supplies/requests
router.post('/requests', requireAuth, async (req, res) => {
    const { supply_type, item_id, item_name, requested_quantity, reason } = req.body;
    try {
        const [result] = await db.query(
            `INSERT INTO supply_requests
             (requested_by, supply_type, item_id, item_name, requested_quantity, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.employeeId, supply_type, item_id, item_name,
             requested_quantity, reason || null]
        );
        return res.status(201).json({ request_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/supplies/requests/:id — approve/deny
router.patch('/requests/:id', requireRole('admin','manager'), async (req, res) => {
    const { status } = req.body;
    if (!['approved','denied'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or denied.' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `UPDATE supply_requests SET status=?, reviewed_by=?, reviewed_at=NOW()
             WHERE request_id=?`,
            [status, req.user.employeeId, req.params.id]
        );
        // If approved, restock the item
        if (status === 'approved') {
            const [reqRows] = await conn.query(
                'SELECT * FROM supply_requests WHERE request_id = ?', [req.params.id]
            );
            const sr = reqRows[0];
            if (sr.supply_type === 'retail') {
                await conn.query(
                    'UPDATE inventory SET stock_count = stock_count + ? WHERE item_id = ?',
                    [sr.requested_quantity, sr.item_id]
                );
                // Also log this as an `inventory` event so the Retail filter in
                // the Inventory Activity Log picks it up — Retail should
                // reflect every shop-item restock, including those triggered
                // by approving a supply request.
                await conn.query(
                    `INSERT INTO activity_log
                     (action_type, description, performed_by, target_type, target_id, metadata)
                     VALUES (?, ?, ?, 'inventory', ?, ?)`,
                    [
                        'supply_restocked',
                        `Restocked ${sr.requested_quantity}x ${sr.item_name} (via approved request)`,
                        req.user.employeeId || null,
                        sr.item_id,
                        JSON.stringify({ source: 'retail', quantity: sr.requested_quantity, via_request: sr.request_id }),
                    ]
                );
            } else {
                await conn.query(
                    'UPDATE operational_supplies SET stock_count = stock_count + ? WHERE supply_id = ?',
                    [sr.requested_quantity, sr.item_id]
                );
            }
        }
        await conn.commit();
        return res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

export default router;

import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

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

// PATCH /api/supplies/:id/restock — add quantity to operational stock.
// Mirrors /inventory/:id/restock so the manager UI has symmetric endpoints
// for ops and retail; emits an activity_log row for the Activity tab.
router.patch('/:id/restock', requireRole('admin','manager'), async (req, res) => {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity.' });
    try {
        await db.query(
            'UPDATE operational_supplies SET stock_count = stock_count + ? WHERE supply_id = ?',
            [quantity, req.params.id]
        );
        const [rows] = await db.query(
            'SELECT item_name FROM operational_supplies WHERE supply_id = ?', [req.params.id]
        );
        const itemName = rows[0]?.item_name || `supply #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log
             (action_type, description, performed_by, target_type, target_id, metadata)
             VALUES (?, ?, ?, 'operational_supply', ?, ?)`,
            [
                'supply_restocked',
                `Restocked ${quantity}x ${itemName}`,
                req.user?.employeeId || null,
                req.params.id,
                JSON.stringify({ source: 'operational', quantity, item_name: itemName }),
            ]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/supplies/:id/remove — subtract from operational stock.
router.patch('/:id/remove', requireRole('admin','manager'), async (req, res) => {
    const { quantity, reason } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity.' });
    try {
        await db.query(
            'UPDATE operational_supplies SET stock_count = GREATEST(stock_count - ?, 0) WHERE supply_id = ?',
            [quantity, req.params.id]
        );
        const [rows] = await db.query(
            'SELECT item_name FROM operational_supplies WHERE supply_id = ?', [req.params.id]
        );
        const itemName = rows[0]?.item_name || `supply #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log
             (action_type, description, performed_by, target_type, target_id, metadata)
             VALUES (?, ?, ?, 'operational_supply', ?, ?)`,
            [
                'supply_removed',
                `Removed ${quantity}x ${itemName}${reason ? ` (${reason})` : ''}`,
                req.user?.employeeId || null,
                req.params.id,
                JSON.stringify({ source: 'operational', quantity, item_name: itemName, reason: reason || null }),
            ]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/supplies/requests — supply requests
//   admin   → sees everything
//   manager → sees only requests made by someone in their department
//             (even if that someone reports to a different manager in the
//              same dept; the dept is the boundary for approvals)
//   other   → sees only their own requests
router.get('/requests', requireAuth, async (req, res) => {
    try {
        const { role, employeeId, deptId } = req.user;
        let rows;
        if (role === 'admin') {
            [rows] = await db.query(
                `SELECT sr.*,
                        req.first_name AS req_first, req.last_name AS req_last,
                        req.dept_id    AS req_dept_id,
                        reqd.dept_name AS req_dept_name,
                        rev.first_name AS rev_first, rev.last_name AS rev_last
                 FROM supply_requests sr
                 LEFT JOIN employees   req  ON sr.requested_by = req.employee_id
                 LEFT JOIN departments reqd ON req.dept_id     = reqd.dept_id
                 LEFT JOIN employees   rev  ON sr.reviewed_by  = rev.employee_id
                 ORDER BY sr.created_at DESC`
            );
        } else if (role === 'manager') {
            [rows] = await db.query(
                `SELECT sr.*,
                        req.first_name AS req_first, req.last_name AS req_last,
                        req.dept_id    AS req_dept_id,
                        reqd.dept_name AS req_dept_name,
                        rev.first_name AS rev_first, rev.last_name AS rev_last
                 FROM supply_requests sr
                 LEFT JOIN employees   req  ON sr.requested_by = req.employee_id
                 LEFT JOIN departments reqd ON req.dept_id     = reqd.dept_id
                 LEFT JOIN employees   rev  ON sr.reviewed_by  = rev.employee_id
                 WHERE req.dept_id = ?
                 ORDER BY sr.created_at DESC`, [deptId]
            );
        } else {
            // Include the reviewer join so the employee can see WHO approved
            // or denied their request ("approved by <name>"). Without it the
            // UI showed "approved by on <date>" — reviewer came back null.
            // LEFT JOIN intentionally ignores employees.is_active so disabled
            // reviewers still surface their name on historical requests.
            [rows] = await db.query(
                `SELECT sr.*,
                        req.first_name AS req_first, req.last_name AS req_last,
                        reqd.dept_name AS req_dept_name,
                        rev.first_name AS rev_first, rev.last_name AS rev_last
                 FROM supply_requests sr
                 LEFT JOIN employees   req  ON sr.requested_by = req.employee_id
                 LEFT JOIN departments reqd ON req.dept_id     = reqd.dept_id
                 LEFT JOIN employees   rev  ON sr.reviewed_by  = rev.employee_id
                 WHERE sr.requested_by = ?
                 ORDER BY sr.created_at DESC`, [employeeId]
            );
        }
        // Reshape so the frontend can use req.requester / req.reviewer directly.
        // Emit DATETIMEs as ISO-UTC so the browser localizes them correctly
        // (mysql2's naive strings are parsed as local time otherwise).
        const shaped = rows.map(r => ({
            ...r,
            created_at:  toIsoUtc(r.created_at),
            reviewed_at: toIsoUtc(r.reviewed_at),
            requester: r.requested_by ? {
                first_name: r.req_first,
                last_name:  r.req_last,
                departments: r.req_dept_name ? { dept_name: r.req_dept_name } : null,
            } : null,
            // Prefer the live join (current name) but fall back to the
            // snapshot so reviews keep their attribution after the
            // employee record is removed/disabled.
            reviewer: (r.rev_first || r.reviewer_first_name || r.reviewed_by) ? {
                first_name: r.rev_first || r.reviewer_first_name || null,
                last_name:  r.rev_last  || r.reviewer_last_name  || null,
            } : null,
        }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/supplies/requests
// `action` defaults to 'restock' for backwards compatibility; 'remove'
// subtracts from stock when approved (e.g., damaged/expired inventory).
router.post('/requests', requireAuth, async (req, res) => {
    const { supply_type, item_id, item_name, requested_quantity, reason, action } = req.body;
    const requestAction = action === 'remove' ? 'remove' : 'restock';
    try {
        const [result] = await db.query(
            `INSERT INTO supply_requests
             (requested_by, supply_type, action, item_id, item_name,
              requested_quantity, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.employeeId, supply_type, requestAction, item_id, item_name,
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
        // Snapshot the reviewer's name so the log survives the reviewer
        // being deactivated/removed (FK goes to NULL on delete).
        const [revRows] = await conn.query(
            'SELECT first_name, last_name FROM employees WHERE employee_id = ?',
            [req.user.employeeId]
        );
        const rev = revRows[0] || {};
        await conn.query(
            `UPDATE supply_requests
                SET status=?, reviewed_by=?, reviewed_at=NOW(),
                    reviewer_first_name=?, reviewer_last_name=?
              WHERE request_id=?`,
            [status, req.user.employeeId, rev.first_name || null, rev.last_name || null, req.params.id]
        );
        // If approved, apply the requested action.
        // `action='remove'` subtracts (e.g., damage/expiry write-offs);
        // default `restock` adds. GREATEST(...,0) guards against negative
        // stock if the admin approves a removal larger than what's on hand.
        if (status === 'approved') {
            const [reqRows] = await conn.query(
                'SELECT * FROM supply_requests WHERE request_id = ?', [req.params.id]
            );
            const sr = reqRows[0];
            const isRemove = sr.action === 'remove';
            const delta    = isRemove ? -sr.requested_quantity : sr.requested_quantity;
            const logVerb  = isRemove ? 'Removed' : 'Restocked';
            const logAction = isRemove ? 'supply_removed' : 'supply_restocked';

            if (sr.supply_type === 'retail') {
                await conn.query(
                    `UPDATE inventory
                        SET stock_count = GREATEST(stock_count + ?, 0)
                      WHERE item_id = ?`,
                    [delta, sr.item_id]
                );
                await conn.query(
                    `INSERT INTO activity_log
                     (action_type, description, performed_by, target_type, target_id, metadata)
                     VALUES (?, ?, ?, 'inventory', ?, ?)`,
                    [
                        logAction,
                        `${logVerb} ${sr.requested_quantity}x ${sr.item_name} (via approved request)`,
                        req.user.employeeId || null,
                        sr.item_id,
                        JSON.stringify({
                            source: 'retail',
                            quantity: sr.requested_quantity,
                            action: sr.action,
                            via_request: sr.request_id,
                        }),
                    ]
                );
            } else {
                await conn.query(
                    `UPDATE operational_supplies
                        SET stock_count = GREATEST(stock_count + ?, 0)
                      WHERE supply_id = ?`,
                    [delta, sr.item_id]
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

// POST /api/supplies/requests/bulk-review — approve or deny multiple at once.
// Body: { ids: [1,2,3], status: 'approved' | 'denied' }. Each row runs through
// the same single-request transaction so stock stays consistent even when
// half the batch is retail and half is operational.
router.post('/requests/bulk-review', requireRole('admin','manager'), async (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids[] is required.' });
    }
    if (!['approved','denied'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or denied.' });
    }
    // Resolve the reviewer's name once for the whole batch so each row
    // snapshots it (see single-review route for rationale).
    const [revRowsBatch] = await db.query(
        'SELECT first_name, last_name FROM employees WHERE employee_id = ?',
        [req.user.employeeId]
    );
    const revBatch = revRowsBatch[0] || {};

    const results = [];
    for (const rawId of ids) {
        const id = parseInt(rawId, 10);
        if (!Number.isFinite(id)) { results.push({ id: rawId, ok: false, error: 'bad id' }); continue; }
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE supply_requests
                    SET status=?, reviewed_by=?, reviewed_at=NOW(),
                        reviewer_first_name=?, reviewer_last_name=?
                  WHERE request_id=? AND status='pending'`,
                [status, req.user.employeeId, revBatch.first_name || null, revBatch.last_name || null, id]
            );
            if (status === 'approved') {
                const [reqRows] = await conn.query(
                    `SELECT * FROM supply_requests
                      WHERE request_id = ? AND reviewed_by = ?`, [id, req.user.employeeId]
                );
                const sr = reqRows[0];
                if (sr) {
                    const isRemove  = sr.action === 'remove';
                    const delta     = isRemove ? -sr.requested_quantity : sr.requested_quantity;
                    const logVerb   = isRemove ? 'Removed' : 'Restocked';
                    const logAction = isRemove ? 'supply_removed' : 'supply_restocked';
                    if (sr.supply_type === 'retail') {
                        await conn.query(
                            `UPDATE inventory
                                SET stock_count = GREATEST(stock_count + ?, 0)
                              WHERE item_id = ?`, [delta, sr.item_id]
                        );
                        await conn.query(
                            `INSERT INTO activity_log
                             (action_type, description, performed_by, target_type, target_id, metadata)
                             VALUES (?, ?, ?, 'inventory', ?, ?)`,
                            [logAction,
                             `${logVerb} ${sr.requested_quantity}x ${sr.item_name} (via bulk approval)`,
                             req.user.employeeId || null, sr.item_id,
                             JSON.stringify({ source: 'retail', quantity: sr.requested_quantity, action: sr.action, via_request: sr.request_id, bulk: true })]
                        );
                    } else {
                        await conn.query(
                            `UPDATE operational_supplies
                                SET stock_count = GREATEST(stock_count + ?, 0)
                              WHERE supply_id = ?`, [delta, sr.item_id]
                        );
                    }
                }
            }
            await conn.commit();
            results.push({ id, ok: true });
        } catch (err) {
            await conn.rollback();
            results.push({ id, ok: false, error: err.message });
        } finally {
            conn.release();
        }
    }
    return res.json({ results, processed: results.length });
});

export default router;

import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ──────────────────────────────────────────────────────────────
// Helper: fetch a request plus its entries + employee + reviewer
// ──────────────────────────────────────────────────────────────
async function getRequestWithEntries(conn, requestId) {
    const [reqRows] = await conn.query(
        `SELECT hr.*,
                emp.first_name AS emp_first, emp.last_name AS emp_last, emp.role AS emp_role,
                emp.dept_id   AS emp_dept_id,
                d.dept_name   AS emp_dept_name,
                rev.first_name AS rev_first, rev.last_name AS rev_last
         FROM hours_requests hr
         LEFT JOIN employees   emp ON emp.employee_id = hr.employee_id
         LEFT JOIN departments d   ON d.dept_id       = emp.dept_id
         LEFT JOIN employees   rev ON rev.employee_id = hr.reviewed_by
         WHERE hr.request_id = ?`,
        [requestId]
    );
    if (reqRows.length === 0) return null;

    const [entries] = await conn.query(
        `SELECT entry_id, work_date, hours, description
         FROM hours_request_entries
         WHERE request_id = ?
         ORDER BY work_date ASC`,
        [requestId]
    );
    const r = reqRows[0];
    return {
        ...r,
        entries,
        employee: { first_name: r.emp_first, last_name: r.emp_last,
                    role: r.emp_role, dept_id: r.emp_dept_id, dept_name: r.emp_dept_name },
        reviewer: r.reviewed_by ? { first_name: r.rev_first, last_name: r.rev_last } : null,
    };
}

// ──────────────────────────────────────────────────────────────
// POST /api/hours — employee submits a batch of hours.
// Body: { entries: [{ work_date, hours, description? }, ...] }
// The supply-of-hours trigger (trg_hours_request_notify) fires the
// manager notification automatically on INSERT.
// ──────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
    const { employeeId } = req.user;
    if (!employeeId) return res.status(403).json({ error: 'Only employees can submit hours.' });
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'At least one entry is required.' });
    }
    for (const e of entries) {
        if (!e.work_date) return res.status(400).json({ error: 'Each entry needs a work_date.' });
        const h = Number(e.hours);
        if (!Number.isFinite(h) || h <= 0 || h > 24) {
            return res.status(400).json({ error: 'Each entry must have hours in (0, 24].' });
        }
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [insert] = await conn.query(
            'INSERT INTO hours_requests (employee_id) VALUES (?)',
            [employeeId]
        );
        const requestId = insert.insertId;

        const values = entries.map(e =>
            [requestId, e.work_date, Number(e.hours), e.description || null]
        );
        await conn.query(
            `INSERT INTO hours_request_entries
             (request_id, work_date, hours, description) VALUES ?`,
            [values]
        );

        const shaped = await getRequestWithEntries(conn, requestId);
        await conn.commit();
        return res.status(201).json(shaped);
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/hours/my — all hours requests submitted by the current employee
router.get('/my', requireAuth, async (req, res) => {
    const { employeeId } = req.user;
    if (!employeeId) return res.json([]);
    const conn = await db.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT request_id FROM hours_requests
             WHERE employee_id = ?
             ORDER BY created_at DESC`,
            [employeeId]
        );
        const results = [];
        for (const r of rows) {
            results.push(await getRequestWithEntries(conn, r.request_id));
        }
        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/hours — admin: everything. manager: requests from their dept.
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    const { role, deptId } = req.user;
    const { status } = req.query;
    const conn = await db.getConnection();
    try {
        let sql = `SELECT hr.request_id FROM hours_requests hr
                   LEFT JOIN employees e ON e.employee_id = hr.employee_id`;
        const where = [];
        const params = [];
        if (role === 'manager' && deptId) {
            where.push('e.dept_id = ?'); params.push(deptId);
        }
        if (status) { where.push('hr.status = ?'); params.push(status); }
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY hr.created_at DESC';
        const [rows] = await conn.query(sql, params);
        const results = [];
        for (const r of rows) {
            results.push(await getRequestWithEntries(conn, r.request_id));
        }
        return res.json(results);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PATCH /api/hours/:id/review — admin/manager approve or deny
router.patch('/:id/review', requireRole('admin', 'manager'), async (req, res) => {
    const { status, notes } = req.body;
    if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or denied.' });
    }
    try {
        await db.query(
            `UPDATE hours_requests
               SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
             WHERE request_id = ?`,
            [status, req.user.employeeId, notes || null, req.params.id]
        );

        // Look up the submitter + total hours so the activity-log entry reads
        // as a sentence instead of "hours request #17".
        const [[meta]] = await db.query(
            `SELECT CONCAT(e.first_name, ' ', e.last_name) AS submitter,
                    COALESCE(SUM(hre.hours), 0) AS total_hours
             FROM hours_requests hr
             LEFT JOIN employees e            ON e.employee_id = hr.employee_id
             LEFT JOIN hours_request_entries hre ON hre.request_id = hr.request_id
             WHERE hr.request_id = ?
             GROUP BY hr.request_id`,
            [req.params.id]
        );
        const submitter  = meta?.submitter?.trim() || 'an employee';
        const totalHours = Number(meta?.total_hours || 0).toFixed(2);

        await db.query(
            `INSERT INTO activity_log
             (action_type, description, performed_by, target_type, target_id, metadata)
             VALUES (?, ?, ?, 'hours_request', ?, ?)`,
            [
                status === 'approved' ? 'supply_request_approved' : 'supply_request_denied',
                `${status === 'approved' ? 'Approved' : 'Denied'} ${totalHours} hrs submitted by ${submitter}`,
                req.user.employeeId,
                req.params.id,
                JSON.stringify({ hours_request_id: Number(req.params.id), status, notes: notes || null }),
            ]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

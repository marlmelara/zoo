import { Router } from '../lib/router.js';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/employees — admin/manager (includes role-specific columns).
// Active by default; pass ?include_inactive=1 to get everyone.
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { include_inactive, status } = req.query;
        // `status` (active|inactive|all) takes precedence over legacy
        // include_inactive so the admin UI can ask for a single bucket.
        let where = '';
        if (status === 'active')        where = ' WHERE e.is_active = 1';
        else if (status === 'inactive') where = ' WHERE e.is_active = 0';
        else if (status === 'all')      where = '';
        else where = include_inactive === '1' ? '' : ' WHERE e.is_active = 1';
        const [rows] = await db.query(
            `SELECT e.*, d.dept_name,
                    m.first_name AS manager_first, m.last_name AS manager_last,
                    v.license_no, v.specialty,
                    ac.specialization_species,
                    mg.office_location
             FROM employees e
             LEFT JOIN departments   d  ON d.dept_id       = e.dept_id
             LEFT JOIN employees     m  ON m.employee_id   = e.manager_id
             LEFT JOIN vets          v  ON v.employee_id   = e.employee_id
             LEFT JOIN animal_caretakers ac ON ac.employee_id = e.employee_id
             LEFT JOIN managers      mg ON mg.employee_id  = e.employee_id
             ${where}
             ORDER BY e.employee_id ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/deactivated — admin: list soft-deleted employees.
// Search by name OR email via `?q=...` (legacy `?email=` also supported).
router.get('/deactivated', requireRole('admin'), async (req, res) => {
    try {
        const q = (req.query.q || req.query.email || '').trim();
        let sql = `SELECT e.*, d.dept_name, u.email FROM employees e
                   LEFT JOIN departments d ON d.dept_id = e.dept_id
                   LEFT JOIN users u ON u.user_id = e.user_id
                   WHERE e.is_active = 0`;
        const params = [];
        if (q) {
            sql += ' AND (u.email LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR CONCAT(e.first_name, " ", e.last_name) LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }
        sql += ' ORDER BY e.employee_id DESC';
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/:id/reactivate — admin: restore a soft-deleted employee.
// Also stamps an activity_log entry so the profile's Log modal can show
// the full activation/deactivation history.
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT first_name, last_name FROM employees WHERE employee_id = ?',
            [req.params.id]
        );
        await db.query('UPDATE employees SET is_active = 1 WHERE employee_id = ?', [req.params.id]);
        const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : `employee #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('employee_reactivated', ?, ?, 'employee', ?)`,
            [`Reactivated ${name}`, req.user.employeeId || null, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id/lifecycle-log — activation/deactivation history
// for one employee. Returns rows newest-first with the performer's name.
// created_at gets the ISO-UTC treatment so the browser localizes it —
// mysql2's naive string would otherwise be parsed as local and display
// shifted by the server↔client offset.
router.get('/:id/lifecycle-log', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT al.log_id, al.action_type, al.description, al.created_at,
                    al.performed_by,
                    e.first_name AS performer_first, e.last_name AS performer_last,
                    e.role       AS performer_role
               FROM activity_log al
               LEFT JOIN employees e ON e.employee_id = al.performed_by
              WHERE al.target_type = 'employee'
                AND al.target_id   = ?
                AND al.action_type IN ('employee_created','employee_deactivated','employee_reactivated')
              ORDER BY al.created_at DESC`,
            [req.params.id]
        );
        return res.json(rows.map(r => ({ ...r, created_at: toIsoUtc(r.created_at) })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/my-team — manager-scoped view of their direct reports.
// Returns the manager themselves (flagged is_self=1) plus every employee
// whose manager_id points at them. Admin gets everyone (no supervisor
// concept applies).
router.get('/my-team', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        let sql, params;
        if (role === 'admin') {
            sql = `SELECT e.*, d.dept_name,
                          v.license_no, v.specialty,
                          ac.specialization_species,
                          mg.office_location,
                          (e.employee_id = ?) AS is_self
                     FROM employees e
                     LEFT JOIN departments    d  ON d.dept_id     = e.dept_id
                     LEFT JOIN vets           v  ON v.employee_id = e.employee_id
                     LEFT JOIN animal_caretakers ac ON ac.employee_id = e.employee_id
                     LEFT JOIN managers       mg ON mg.employee_id = e.employee_id
                    WHERE e.is_active = 1
                    ORDER BY e.employee_id ASC`;
            params = [employeeId];
        } else {
            // Manager sees themselves + everyone reporting to them.
            sql = `SELECT e.*, d.dept_name,
                          v.license_no, v.specialty,
                          ac.specialization_species,
                          mg.office_location,
                          (e.employee_id = ?) AS is_self
                     FROM employees e
                     LEFT JOIN departments    d  ON d.dept_id     = e.dept_id
                     LEFT JOIN vets           v  ON v.employee_id = e.employee_id
                     LEFT JOIN animal_caretakers ac ON ac.employee_id = e.employee_id
                     LEFT JOIN managers       mg ON mg.employee_id = e.employee_id
                    WHERE e.is_active = 1
                      AND (e.employee_id = ? OR e.manager_id = ?)
                    ORDER BY (e.employee_id = ?) DESC, e.last_name ASC, e.first_name ASC`;
            params = [employeeId, employeeId, employeeId, employeeId];
        }
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/me — current employee's profile
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, d.dept_name FROM employees e
             LEFT JOIN departments d ON e.dept_id = d.dept_id
             WHERE e.user_id = ?`, [req.user.userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/departments/all
router.get('/departments/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM departments ORDER BY dept_id ASC');
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/vets — admin/manager
router.get('/vets', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT v.employee_id, v.license_no, v.specialty,
                    e.first_name, e.last_name, e.dept_id, e.shift_timeframe
             FROM vets v
             JOIN employees e ON e.employee_id = v.employee_id
             ORDER BY e.employee_id ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/managers — active managers, optionally filtered by
// department. Used by the supervisor dropdown when creating/editing an
// employee — every non-admin, non-manager must pick one.
router.get('/managers', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { dept_id } = req.query;
        const params = [];
        let sql = `SELECT e.employee_id, e.first_name, e.last_name, e.dept_id,
                          d.dept_name
                     FROM employees e
                     LEFT JOIN departments d ON d.dept_id = e.dept_id
                    WHERE e.role = 'manager' AND e.is_active = 1`;
        if (dept_id) { sql += ' AND e.dept_id = ?'; params.push(parseInt(dept_id)); }
        sql += ' ORDER BY e.last_name ASC, e.first_name ASC';
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/caretakers — admin/manager
router.get('/caretakers', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ac.employee_id, ac.specialization_species, ac.assigned_animal_id,
                    e.first_name, e.last_name, e.dept_id
             FROM animal_caretakers ac
             JOIN employees e ON e.employee_id = ac.employee_id
             ORDER BY e.employee_id ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id
router.get('/:id', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, d.dept_name FROM employees e
             LEFT JOIN departments d ON e.dept_id = d.dept_id
             WHERE e.employee_id = ?`, [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/employees — create employee + auth user (replaces create_zoo_user function)
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
    const { email, password, first_name, last_name, middle_name,
            contact_info, pay_rate_cents, shift_timeframe,
            dept_id, manager_id, role, date_of_birth } = req.body;

    if (!email || !password || !first_name || !last_name || !role) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Supervisor rule: every non-admin / non-manager must be assigned to
    // a manager. Admins never have supervisors (their role is unique), and
    // managers sit at the top of their dept so they don't either. Anyone
    // else — vet, caretaker, security, retail — needs a manager_id.
    if (role !== 'admin' && role !== 'manager') {
        if (!manager_id) {
            return res.status(400).json({
                error: `${role} must be assigned to a supervising manager.`,
            });
        }
        // Validate the chosen manager is real, active, and in the same dept.
        const [mgrRows] = await db.query(
            `SELECT employee_id, dept_id, is_active, role
               FROM employees WHERE employee_id = ?`, [manager_id]
        );
        const mgr = mgrRows[0];
        if (!mgr || mgr.is_active !== 1 || mgr.role !== 'manager') {
            return res.status(400).json({ error: 'Chosen supervisor is not an active manager.' });
        }
        if (dept_id && mgr.dept_id !== parseInt(dept_id)) {
            return res.status(400).json({ error: 'Supervisor must be in the same department.' });
        }
    } else if (manager_id) {
        // Admins/managers can't have a supervisor — quietly ignore.
        // (Caller shouldn't send one; this is a safety net.)
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'Email already in use.' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, password_hash]
        );
        const userId = userResult.insertId;

        const [empResult] = await conn.query(
            `INSERT INTO employees
             (first_name, middle_name, last_name, contact_info, pay_rate_cents,
              shift_timeframe, dept_id, user_id, manager_id, role, date_of_birth)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, middle_name || null, last_name,
             contact_info || email, pay_rate_cents || 2000,
             shift_timeframe || '09:00-17:00',
             dept_id || null, userId, manager_id || null, role,
             date_of_birth || null]
        );

        // Insert into sub-type table(s) as needed.
        //
        // A manager in Veterinary Services is still a practising vet, so
        // they get a row in BOTH `managers` and `vets` when a license is
        // supplied. This keeps Sarah-the-vet-manager's license discoverable
        // via the existing vets JOIN everywhere else in the app.
        if (role === 'vet' && req.body.license_no) {
            await conn.query(
                'INSERT INTO vets (employee_id, license_no, specialty) VALUES (?, ?, ?)',
                [empResult.insertId, req.body.license_no, req.body.specialty || null]
            );
        } else if (role === 'caretaker') {
            await conn.query(
                'INSERT INTO animal_caretakers (employee_id, specialization_species) VALUES (?, ?)',
                [empResult.insertId, req.body.specialization_species || null]
            );
        } else if (role === 'manager') {
            await conn.query(
                'INSERT INTO managers (employee_id, office_location) VALUES (?, ?)',
                [empResult.insertId, req.body.office_location || null]
            );
            // Vet-dept managers keep their clinical license on file too.
            // Look up the dept name so we don't rely on the caller to
            // flag this — any manager with a license + dept name
            // matching "Veterinary" gets the extra row.
            if (req.body.license_no && dept_id) {
                const [[dept]] = await conn.query(
                    'SELECT dept_name FROM departments WHERE dept_id = ?', [dept_id]
                );
                if (dept && /veterinary/i.test(dept.dept_name)) {
                    await conn.query(
                        'INSERT INTO vets (employee_id, license_no, specialty) VALUES (?, ?, ?)',
                        [empResult.insertId, req.body.license_no, req.body.specialty || null]
                    );
                }
            }
        }

        await conn.commit();
        // Stamp the lifecycle log outside the transaction — activity_log is
        // purely audit data; a failure here must not undo the hire.
        try {
            await db.query(
                `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
                 VALUES ('employee_created', ?, ?, 'employee', ?)`,
                [`Created ${first_name} ${last_name}`, req.user?.employeeId || null, empResult.insertId]
            );
        } catch { /* logging is best-effort */ }
        return res.status(201).json({ employee_id: empResult.insertId, user_id: userId });
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PATCH /api/employees/:id
router.patch('/:id', requireRole('admin', 'manager'), async (req, res) => {
    const fields = ['first_name', 'middle_name', 'last_name', 'contact_info',
                    'pay_rate_cents', 'shift_timeframe', 'dept_id', 'manager_id', 'role',
                    'date_of_birth'];
    const updates = []; const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    // Keep the supervisor invariant intact across edits. Pull the current
    // role/dept if the caller didn't include them, then validate.
    try {
        const [[current]] = await db.query(
            'SELECT role, dept_id, manager_id FROM employees WHERE employee_id = ?',
            [req.params.id]
        );
        if (!current) return res.status(404).json({ error: 'Employee not found.' });
        const nextRole     = req.body.role       !== undefined ? req.body.role       : current.role;
        const nextDeptId   = req.body.dept_id    !== undefined ? req.body.dept_id    : current.dept_id;
        const nextMgrId    = req.body.manager_id !== undefined ? req.body.manager_id : current.manager_id;
        if (nextRole !== 'admin' && nextRole !== 'manager') {
            if (!nextMgrId) {
                return res.status(400).json({
                    error: `${nextRole} must be assigned to a supervising manager.`,
                });
            }
            const [mgrRows] = await db.query(
                `SELECT employee_id, dept_id, is_active, role
                   FROM employees WHERE employee_id = ?`, [nextMgrId]
            );
            const mgr = mgrRows[0];
            if (!mgr || mgr.is_active !== 1 || mgr.role !== 'manager') {
                return res.status(400).json({ error: 'Chosen supervisor is not an active manager.' });
            }
            if (nextDeptId != null && mgr.dept_id !== parseInt(nextDeptId)) {
                return res.status(400).json({ error: 'Supervisor must be in the same department.' });
            }
        }

        vals.push(req.params.id);
        await db.query(`UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ?`, vals);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id — soft-delete (deactivate). Reactivate later via
// POST /api/employees/:id/reactivate. Emits an activity_log row so the
// lifecycle modal on the profile can show who took the action and when.
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT first_name, last_name FROM employees WHERE employee_id = ?',
            [req.params.id]
        );
        await db.query('UPDATE employees SET is_active = 0 WHERE employee_id = ?', [req.params.id]);
        const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : `employee #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('employee_deactivated', ?, ?, 'employee', ?)`,
            [`Deactivated ${name}`, req.user.employeeId || null, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

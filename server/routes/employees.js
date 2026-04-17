import { Router } from '../lib/router.js';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/employees — admin/manager (includes role-specific columns)
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
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
             ORDER BY e.employee_id ASC`
        );
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
            dept_id, manager_id, role } = req.body;

    if (!email || !password || !first_name || !last_name || !role) {
        return res.status(400).json({ error: 'Missing required fields.' });
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
              shift_timeframe, dept_id, user_id, manager_id, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, middle_name || null, last_name,
             contact_info || email, pay_rate_cents || 2000,
             shift_timeframe || '09:00-17:00',
             dept_id || null, userId, manager_id || null, role]
        );

        // Insert into sub-type table if needed
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
        }

        await conn.commit();
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
                    'pay_rate_cents', 'shift_timeframe', 'dept_id', 'manager_id', 'role'];
    const updates = []; const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    vals.push(req.params.id);
    try {
        await db.query(`UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ?`, vals);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM employees WHERE employee_id = ?', [req.params.id]);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

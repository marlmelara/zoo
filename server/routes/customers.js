import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/customers/me — current customer's full profile (active only)
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM customers WHERE user_id = ? AND is_active = 1',
            [req.user.userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Profile not found.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/customers/me — update profile
router.patch('/me', requireAuth, async (req, res) => {
    const { first_name, last_name, phone, date_of_birth, address,
            city, state, zip_code } = req.body;
    try {
        await db.query(
            `UPDATE customers SET first_name=?, last_name=?, phone=?, date_of_birth=?,
             address=?, city=?, state=?, zip_code=? WHERE user_id=?`,
            [first_name, last_name, phone || null, date_of_birth || null,
             address || null, city || null, state || null, zip_code || null,
             req.user.userId]
        );
        const [rows] = await db.query(
            'SELECT * FROM customers WHERE user_id = ?', [req.user.userId]
        );
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/customers/me/membership — update membership after checkout
router.patch('/me/membership', requireAuth, async (req, res) => {
    const { is_member, membership_type, membership_start, membership_end } = req.body;
    try {
        await db.query(
            `UPDATE customers SET is_member=?, membership_type=?,
             membership_start=?, membership_end=? WHERE user_id=?`,
            [is_member, membership_type, membership_start, membership_end, req.user.userId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/customers/me/billing — save billing/shipping addresses
router.patch('/me/billing', requireAuth, async (req, res) => {
    const { billing_street, billing_city, billing_state, billing_zip, billing_phone,
            shipping_street, shipping_city, shipping_state, shipping_zip, shipping_phone,
            shipping_same_as_billing } = req.body;
    try {
        await db.query(
            `UPDATE customers SET
             billing_street=?, billing_city=?, billing_state=?, billing_zip=?, billing_phone=?,
             shipping_street=?, shipping_city=?, shipping_state=?, shipping_zip=?, shipping_phone=?,
             shipping_same_as_billing=? WHERE user_id=?`,
            [billing_street||null, billing_city||null, billing_state||null,
             billing_zip||null, billing_phone||null,
             shipping_street||null, shipping_city||null, shipping_state||null,
             shipping_zip||null, shipping_phone||null,
             shipping_same_as_billing ? 1 : 0,
             req.user.userId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/customers/me — soft-deactivate account. Tickets, donations,
// and transactions are preserved for reporting; the customer can be
// reactivated later by an admin via POST /api/customers/:id/reactivate.
router.delete('/me', requireAuth, async (req, res) => {
    try {
        const { customerId } = req.user;
        if (!customerId) return res.status(400).json({ error: 'Not a customer account.' });
        const [rows] = await db.query(
            'SELECT first_name, last_name FROM customers WHERE customer_id = ?',
            [customerId]
        );
        await db.query('UPDATE customers SET is_active = 0 WHERE customer_id = ?', [customerId]);
        const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : `customer #${customerId}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('customer_deactivated', ?, NULL, 'customer', ?)`,
            [`${name} deactivated their account`, customerId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/customers — admin/manager: list customers (active by default)
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { include_inactive } = req.query;
        const sql = include_inactive === '1'
            ? 'SELECT * FROM customers ORDER BY customer_id DESC'
            : 'SELECT * FROM customers WHERE is_active = 1 ORDER BY customer_id DESC';
        const [rows] = await db.query(sql);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/customers/deactivated — admin: list soft-deleted customers.
// Search by name OR email via `?q=...` (legacy `?email=` also supported).
router.get('/deactivated', requireRole('admin'), async (req, res) => {
    try {
        const q = (req.query.q || req.query.email || '').trim();
        let sql = 'SELECT * FROM customers WHERE is_active = 0';
        const params = [];
        if (q) {
            sql += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, " ", last_name) LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }
        sql += ' ORDER BY customer_id DESC';
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/customers/:id/reactivate — admin: restore a soft-deleted customer.
// Logs a 'customer_reactivated' row so the profile's lifecycle modal can
// show the full activation/deactivation history.
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT first_name, last_name FROM customers WHERE customer_id = ?',
            [req.params.id]
        );
        await db.query('UPDATE customers SET is_active = 1 WHERE customer_id = ?', [req.params.id]);
        const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : `customer #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('customer_reactivated', ?, ?, 'customer', ?)`,
            [`Reactivated ${name}`, req.user.employeeId || null, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/customers/:id/lifecycle-log — activation/deactivation history
// for one customer. Admin-only so we don't leak other users' history.
router.get('/:id/lifecycle-log', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT al.log_id, al.action_type, al.description, al.created_at,
                    al.performed_by,
                    e.first_name AS performer_first, e.last_name AS performer_last,
                    e.role       AS performer_role
               FROM activity_log al
               LEFT JOIN employees e ON e.employee_id = al.performed_by
              WHERE al.target_type = 'customer'
                AND al.target_id   = ?
                AND al.action_type IN ('customer_deactivated','customer_reactivated')
              ORDER BY al.created_at DESC`,
            [req.params.id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

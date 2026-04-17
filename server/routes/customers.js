import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/customers/me — current customer's full profile
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM customers WHERE user_id = ?', [req.user.userId]
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

// DELETE /api/customers/me — delete account
router.delete('/me', requireAuth, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { userId, customerId } = req.user;
        if (customerId) {
            await conn.query('DELETE FROM tickets    WHERE customer_id = ?', [customerId]);
            await conn.query('UPDATE donations   SET customer_id = NULL WHERE customer_id = ?', [customerId]);
            await conn.query('UPDATE transactions SET customer_id = NULL WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM customers WHERE customer_id = ?', [customerId]);
        }
        await conn.query('DELETE FROM users WHERE user_id = ?', [userId]);
        await conn.commit();
        return res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/customers — admin: list all customers
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM customers ORDER BY customer_id DESC'
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

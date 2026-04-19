import { Router } from '../lib/router.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

// In-memory token store (sufficient for a class project; production would use DB)
const resetTokens = new Map(); // token → { userId, expires }

const router = Router();

// ── POST /api/auth/signup ────────────────────────────────────
router.post('/signup', async (req, res) => {
    const { email, password, firstName, lastName, phone, dateOfBirth,
            address, city, state, zipCode } = req.body;

    const required = { email, password, firstName, lastName, phone,
                       dateOfBirth, address, city, state, zipCode };
    for (const [k, v] of Object.entries(required)) {
        if (!v || !String(v).trim()) {
            return res.status(400).json({ error: `Missing required field: ${k}` });
        }
    }
    if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be 6-128 characters.' });
    }
    if (String(firstName).length > 50 || String(lastName).length > 50) {
        return res.status(400).json({ error: 'Name fields must be 50 characters or fewer.' });
    }
    if (String(email).length > 255) {
        return res.status(400).json({ error: 'Email is too long.' });
    }
    if (String(phone).replace(/\D/g, '').length !== 10) {
        return res.status(400).json({ error: 'Phone number must be exactly 10 digits.' });
    }
    if (!/^\d{5}$/.test(String(zipCode))) {
        return res.status(400).json({ error: 'Zip code must be exactly 5 digits.' });
    }
    const dobDate = new Date(dateOfBirth);
    if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) {
        return res.status(400).json({ error: 'Date of birth must be a valid past date.' });
    }
    if (String(address).length > 200 || String(city).length > 100) {
        return res.status(400).json({ error: 'Address or city is too long.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check duplicate email
        const [existing] = await conn.query(
            'SELECT user_id FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12);

        // Insert user
        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, password_hash]
        );
        const userId = userResult.insertId;

        // Insert customer profile
        const [custResult] = await conn.query(
            `INSERT INTO customers
                (user_id, first_name, last_name, email, phone, date_of_birth,
                 address, city, state, zip_code, is_member)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [userId, firstName, lastName, email,
             phone || null, dateOfBirth || null,
             address || null, city || null, state || null, zipCode || null]
        );

        await conn.commit();

        // Stamp a 'customer_created' lifecycle entry outside the transaction —
        // a failure here shouldn't roll back the signup. Best-effort only.
        try {
            await db.query(
                `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
                 VALUES ('customer_created', ?, NULL, 'customer', ?)`,
                [`${firstName} ${lastName} signed up`, custResult.insertId]
            );
        } catch { /* audit failure is non-fatal */ }

        const token = signToken({
            userId,
            customerId: custResult.insertId,
            email,
            role: 'customer',
        });

        return res.status(201).json({
            token,
            user: { userId, email, role: 'customer', customerId: custResult.insertId,
                    firstName, lastName },
        });
    } catch (err) {
        await conn.rollback();
        console.error('Signup error:', err);
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // Check users table
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const user = users[0];

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Is this user a customer? (Must be active.)
        const [customers] = await db.query(
            'SELECT customer_id, first_name, last_name, is_active FROM customers WHERE user_id = ?',
            [user.user_id]
        );

        // Is this user an employee? (Must be active.)
        const [employees] = await db.query(
            `SELECT e.employee_id, e.first_name, e.last_name, e.role, e.dept_id,
                    e.is_active, d.dept_name
               FROM employees e
               LEFT JOIN departments d ON d.dept_id = e.dept_id
              WHERE e.user_id = ?`,
            [user.user_id]
        );

        const activeCustomer = customers.find(c => c.is_active === 1);
        const activeEmployee = employees.find(e => e.is_active === 1);
        const inactiveMatch  = (!activeCustomer && !activeEmployee)
            && (customers.length > 0 || employees.length > 0);
        if (inactiveMatch) {
            return res.status(403).json({
                error: 'This account has been deactivated. Please contact an administrator to reactivate it.',
            });
        }

        let payload, responseUser;

        if (activeEmployee) {
            const emp = activeEmployee;
            payload = {
                userId:     user.user_id,
                employeeId: emp.employee_id,
                deptId:     emp.dept_id,
                email:      user.email,
                role:       emp.role,
            };
            responseUser = {
                userId: user.user_id, email: user.email,
                role: emp.role, employeeId: emp.employee_id,
                deptId: emp.dept_id, deptName: emp.dept_name || null,
                firstName: emp.first_name, lastName: emp.last_name,
            };
        } else if (activeCustomer) {
            const cust = activeCustomer;
            payload = {
                userId:     user.user_id,
                customerId: cust.customer_id,
                email:      user.email,
                role:       'customer',
            };
            responseUser = {
                userId: user.user_id, email: user.email,
                role: 'customer', customerId: cust.customer_id,
                firstName: cust.first_name, lastName: cust.last_name,
            };
        } else {
            return res.status(403).json({ error: 'No profile linked to this account.' });
        }

        const token = signToken(payload);
        return res.json({ token, user: responseUser });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/me ─────────────────────────────────────────
// Validate a stored token and return fresh user data
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { userId, role, customerId, employeeId } = req.user;

        if (role === 'customer') {
            const [rows] = await db.query(
                'SELECT * FROM customers WHERE user_id = ?', [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
            return res.json({ user: { ...req.user, profile: rows[0] } });
        } else {
            const [rows] = await db.query(
                'SELECT * FROM employees WHERE user_id = ?', [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
            return res.json({ user: { ...req.user, profile: rows[0] } });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── POST /api/auth/forgot-password ──────────────────────────
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    // Always respond 200 to avoid leaking which emails are registered
    if (!email) return res.json({ message: 'If that email is registered, a reset link has been generated.' });
    try {
        const [users] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            resetTokens.set(token, { userId: users[0].user_id, expires: Date.now() + 3600_000 });
            // In production: send email with ?token=<token> link
            // For dev: log the token so you can test manually
            console.log(`[Password Reset] Token for ${email}: ${token}`);
            console.log(`[Password Reset] Reset URL: http://localhost:5173/reset-password?token=${token}`);
        }
        return res.json({ message: 'If that email is registered, a reset link has been generated.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const entry = resetTokens.get(token);
    if (!entry) return res.status(400).json({ error: 'Invalid or expired reset token.' });
    if (Date.now() > entry.expires) {
        resetTokens.delete(token);
        return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }
    try {
        const password_hash = await bcrypt.hash(password, 12);
        await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [password_hash, entry.userId]);
        resetTokens.delete(token);
        return res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

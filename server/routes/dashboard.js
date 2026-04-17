import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/stats — admin/manager summary stats
router.get('/stats', requireRole('admin','manager'), async (req, res) => {
    try {
        const [[{ total_customers }]] = await db.query(
            'SELECT COUNT(*) AS total_customers FROM customers'
        );
        const [[{ total_members }]] = await db.query(
            `SELECT COUNT(*) AS total_members FROM customers
             WHERE is_member = 1 AND membership_end >= CURDATE()`
        );
        const [[{ total_tickets }]] = await db.query(
            'SELECT COUNT(*) AS total_tickets FROM tickets'
        );
        const [[{ total_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(total_amount_cents),0) AS total_revenue
             FROM transactions WHERE is_donation = 0`
        );
        const [[{ total_donations }]] = await db.query(
            `SELECT COALESCE(SUM(amount_cents),0) AS total_donations FROM donations`
        );
        const [[{ total_animals }]] = await db.query(
            'SELECT COUNT(*) AS total_animals FROM animals'
        );
        const [[{ total_employees }]] = await db.query(
            'SELECT COUNT(*) AS total_employees FROM employees'
        );
        const [[{ low_stock_count }]] = await db.query(
            'SELECT COUNT(*) AS low_stock_count FROM inventory WHERE is_low_stock = 1'
        );
        const [[{ pending_requests }]] = await db.query(
            `SELECT COUNT(*) AS pending_requests FROM supply_requests WHERE status = 'pending'`
        );

        // Revenue by month (last 6 months)
        const [monthlyRevenue] = await db.query(
            `SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month,
                    SUM(total_amount_cents) AS revenue_cents
             FROM transactions
             WHERE is_donation = 0
               AND transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY month ORDER BY month ASC`
        );

        // Recent activity
        const [recentActivity] = await db.query(
            `SELECT al.*, e.first_name, e.last_name
             FROM activity_log al
             LEFT JOIN employees e ON al.performed_by = e.employee_id
             ORDER BY al.created_at DESC LIMIT 10`
        );

        return res.json({
            total_customers, total_members, total_tickets,
            total_revenue, total_donations,
            total_animals, total_employees,
            low_stock_count, pending_requests,
            monthly_revenue: monthlyRevenue,
            recent_activity: recentActivity,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

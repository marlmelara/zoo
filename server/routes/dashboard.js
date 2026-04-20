import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/dashboard/stats — admin/manager summary stats
// Optional `from` / `to` (YYYY-MM-DD) filter all revenue aggregates to that
// window so the Admin panel can slice by YTD / quarter / year. Counts
// (employees, animals, customers) stay lifetime — they're not
// date-scoped concepts.
router.get('/stats', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateClause = (col) => {
            const parts = [];
            const vals = [];
            if (from) { parts.push(`${col} >= ?`); vals.push(from); }
            if (to)   { parts.push(`${col} <  DATE_ADD(?, INTERVAL 1 DAY)`); vals.push(to); }
            return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', vals };
        };
        const txClause        = dateClause('transaction_date');
        const txJoinClause    = dateClause('t.transaction_date');
        const donationClause  = dateClause('donation_date');

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
        // Revenue breakdown: pull the three line-item sources individually
        // (tickets / sale_items / donations) and build the total from those.
        // The older query used transactions.total_amount_cents which bakes in
        // tax and excludes donations, so "Total Revenue" in the header never
        // matched Tickets + Retail + Donations.
        const [[{ ticket_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(tk.price_cents),0) AS ticket_revenue
             FROM tickets tk
             LEFT JOIN transactions t ON tk.transaction_id = t.transaction_id
             WHERE 1=1${txJoinClause.sql}`,
            txJoinClause.vals
        );
        const [[{ retail_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(si.price_at_sale_cents * si.quantity),0) AS retail_revenue
             FROM sale_items si
             LEFT JOIN transactions t ON si.transaction_id = t.transaction_id
             WHERE 1=1${txJoinClause.sql}`,
            txJoinClause.vals
        );
        const [[{ total_donations }]] = await db.query(
            `SELECT COALESCE(SUM(amount_cents),0) AS total_donations FROM donations
             WHERE 1=1${donationClause.sql}`,
            donationClause.vals
        );
        const total_revenue = Number(ticket_revenue) + Number(retail_revenue) + Number(total_donations);
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
            total_revenue, ticket_revenue, retail_revenue, total_donations,
            total_animals, total_employees,
            low_stock_count, pending_requests,
            monthly_revenue: monthlyRevenue,
            recent_activity: recentActivity.map(r => ({ ...r, created_at: toIsoUtc(r.created_at) })),
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ────────────────────────────────────────────────────────────────
// ANALYTICS ENDPOINTS — power the three "big picture" Admin graphs.
// Each endpoint takes optional `from` / `to` YYYY-MM-DD dates and
// joins across ≥2 tables so the data is actually composite (a
// teacher/owner requirement, not decoration).
// ────────────────────────────────────────────────────────────────

// Helper: clamp a (from, to) pair into WHERE fragments against any date column.
// Uses explicit time suffixes so the range is the full local calendar day
// (00:00:00 → 23:59:59) — same pattern activity-log filtering uses. This
// matters when the target column is a DATETIME (e.g. transactions.transaction_date
// or customers.created_at): comparing against a bare YYYY-MM-DD silently
// excluded anything later than midnight on the end date. For DATE columns
// (event_date, membership_start) MySQL widens the date with 00:00:00 and
// the comparison still works correctly.
function buildDateWhere(col, from, to) {
    const parts = [];
    const vals  = [];
    if (from) { parts.push(`${col} >= ?`); vals.push(`${from} 00:00:00`); }
    if (to)   { parts.push(`${col} <= ?`); vals.push(`${to} 23:59:59`); }
    return {
        sql: parts.length ? ` AND ${parts.join(' AND ')}` : '',
        firstSql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '',
        vals,
    };
}

// GET /api/dashboard/analytics/event-performance
// Joins: events + tickets (+ venues for readability)
// Answers "which events are actually drawing, and which aren't?"
router.get('/analytics/event-performance', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const w = buildDateWhere('ev.event_date', from, to);
        const [rows] = await db.query(
            `SELECT ev.event_id,
                    ev.title,
                    ev.event_date,
                    ev.max_capacity,
                    ev.actual_attendance,
                    ev.ticket_price_cents,
                    v.venue_name,
                    COALESCE(tk.tickets_sold, 0)      AS tickets_sold,
                    COALESCE(tk.revenue_cents, 0)     AS revenue_cents,
                    CASE WHEN ev.max_capacity > 0
                         THEN ROUND(100 * COALESCE(tk.tickets_sold,0) / ev.max_capacity, 1)
                         ELSE 0
                    END AS fill_rate_pct
               FROM events ev
               LEFT JOIN venues v ON v.venue_id = ev.venue_id
               LEFT JOIN (
                     SELECT event_id,
                            COUNT(*)         AS tickets_sold,
                            SUM(price_cents) AS revenue_cents
                       FROM tickets
                      WHERE event_id IS NOT NULL
                      GROUP BY event_id
               ) tk ON tk.event_id = ev.event_id
              WHERE COALESCE(ev.is_archived, 0) = 0${w.sql}
              ORDER BY ev.event_date DESC`,
            w.vals
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard/analytics/membership-insights
// Joins: customers + transactions — monthly bucketing.
// Answers "how are we growing? new sign-ups vs returning revenue per month."
router.get('/analytics/membership-insights', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateCol = `COALESCE(c.membership_start, c.created_at)`;
        // Build a union of per-customer rows with signup month, active status,
        // and their lifetime non-donation transaction total so we can
        // bucket new/returning per month without a second pass over the DB.
        const w = buildDateWhere(dateCol, from, to);
        const [rows] = await db.query(
            `SELECT DATE_FORMAT(${dateCol}, '%Y-%m') AS period,
                    SUM(CASE WHEN c.is_member = 1 THEN 1 ELSE 0 END) AS new_members,
                    SUM(CASE WHEN c.is_member = 0 THEN 1 ELSE 0 END) AS new_non_members,
                    COUNT(*)                                         AS new_customers_total,
                    COALESCE(SUM(t.tot), 0)                          AS revenue_cents
               FROM customers c
               LEFT JOIN (
                     SELECT customer_id, SUM(total_amount_cents) AS tot
                       FROM transactions
                      WHERE is_donation = 0 AND customer_id IS NOT NULL
                      GROUP BY customer_id
               ) t ON t.customer_id = c.customer_id
              ${w.firstSql}
              GROUP BY period
              ORDER BY period ASC`,
            w.vals
        );

        // Returning spend = money from customers whose signup predates the
        // window (i.e., not new). One extra query keeps the shape simple.
        const txW = buildDateWhere('t.transaction_date', from, to);
        const [[{ returning_revenue_cents = 0 } = {}]] = await db.query(
            `SELECT COALESCE(SUM(t.total_amount_cents), 0) AS returning_revenue_cents
               FROM transactions t
               JOIN customers c ON c.customer_id = t.customer_id
              WHERE t.is_donation = 0
                AND (${from ? 'COALESCE(c.membership_start, c.created_at) < ?' : '1=1'})
                ${txW.sql}`,
            from ? [from, ...txW.vals] : txW.vals
        );
        // Summary top-line for the header cards + CSV footer.
        const [[summary]] = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM customers WHERE is_member = 1 AND membership_end >= CURDATE()) AS active_members_now,
                (SELECT COUNT(*) FROM customers${w.firstSql}) AS new_customers_in_range`,
            w.vals
        );
        return res.json({
            rows,
            returning_revenue_cents,
            active_members_now: summary?.active_members_now ?? 0,
            new_customers_in_range: summary?.new_customers_in_range ?? 0,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── "Joined view" endpoints — return the UNAGGREGATED rows produced
// by the underlying JOIN, so the Admin can see the raw materials each
// chart was built from. Limited to 500 rows per request to keep
// payloads sane; the UI calls these on demand from a collapsible
// "Joined View" panel.

router.get('/analytics/event-performance/rows', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const w = buildDateWhere('ev.event_date', from, to);
        const [rows] = await db.query(
            `SELECT tk.ticket_id, tk.type AS ticket_type, tk.price_cents,
                    ev.event_id, ev.title AS event_title,
                    ev.event_date, ev.max_capacity,
                    v.venue_name, v.capacity AS venue_capacity,
                    t.transaction_id, t.transaction_date,
                    c.customer_id,
                    TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS customer_name,
                    c.email AS customer_email
               FROM events ev
               LEFT JOIN venues       v  ON v.venue_id = ev.venue_id
               LEFT JOIN tickets      tk ON tk.event_id = ev.event_id
               LEFT JOIN transactions t  ON t.transaction_id = tk.transaction_id
               LEFT JOIN customers    c  ON c.customer_id = t.customer_id
              WHERE COALESCE(ev.is_archived, 0) = 0${w.sql}
              ORDER BY ev.event_date DESC, tk.ticket_id ASC
              LIMIT 500`,
            w.vals
        );
        // Emit DATETIMEs as ISO-UTC so the browser localises them
        // correctly (mysql2 would otherwise hand back naive strings that
        // Date() parses as local time). Same pattern activity log uses.
        const shaped = rows.map(r => ({ ...r, transaction_date: toIsoUtc(r.transaction_date) }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/analytics/membership-insights/rows', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateCol = `COALESCE(c.membership_start, c.created_at)`;
        const w = buildDateWhere(dateCol, from, to);
        const [rows] = await db.query(
            `SELECT c.customer_id, c.first_name, c.last_name, c.email,
                    c.is_member, c.membership_type, c.membership_start, c.created_at,
                    DATE_FORMAT(${dateCol}, '%Y-%m')        AS signup_period,
                    COALESCE(t.tx_count, 0)                  AS lifetime_tx_count,
                    COALESCE(t.lifetime_spend_cents, 0)      AS lifetime_spend_cents
               FROM customers c
               LEFT JOIN (
                     SELECT customer_id,
                            COUNT(*) AS tx_count,
                            SUM(total_amount_cents) AS lifetime_spend_cents
                       FROM transactions
                      WHERE is_donation = 0 AND customer_id IS NOT NULL
                      GROUP BY customer_id
               ) t ON t.customer_id = c.customer_id
              ${w.firstSql}
              ORDER BY ${dateCol} DESC, c.customer_id DESC
              LIMIT 500`,
            w.vals
        );
        const shaped = rows.map(r => ({
            ...r,
            created_at:       toIsoUtc(r.created_at),
            membership_start: toIsoUtc(r.membership_start),
        }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/analytics/shop-performance/rows', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const w = buildDateWhere('t.transaction_date', from, to);
        const [rows] = await db.query(
            `SELECT si.sale_item_id, si.transaction_id, si.quantity, si.price_at_sale_cents,
                    (si.quantity * si.price_at_sale_cents) AS line_total_cents,
                    i.item_id, i.item_name,
                    COALESCE(i.category, 'Misc') AS category,
                    s.shop_id, s.name AS shop_name,
                    t.transaction_date,
                    c.customer_id,
                    TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS customer_name,
                    c.email AS customer_email
               FROM sale_items si
               JOIN inventory   i ON i.item_id       = si.item_id
               LEFT JOIN shops  s ON s.shop_id       = i.outlet_id
               LEFT JOIN transactions t ON t.transaction_id = si.transaction_id
               LEFT JOIN customers    c ON c.customer_id = t.customer_id
              WHERE 1=1${w.sql}
              ORDER BY t.transaction_date DESC, si.sale_item_id ASC
              LIMIT 500`,
            w.vals
        );
        const shaped = rows.map(r => ({ ...r, transaction_date: toIsoUtc(r.transaction_date) }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard/analytics/shop-performance
// Joins: sale_items + inventory + transactions (+ shops).
// Answers "which categories/items drive retail revenue?"
router.get('/analytics/shop-performance', requireRole('admin','manager'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const w = buildDateWhere('t.transaction_date', from, to);
        const [byCategory] = await db.query(
            `SELECT COALESCE(i.category, 'Misc') AS category,
                    SUM(si.quantity)                                  AS units_sold,
                    SUM(si.quantity * si.price_at_sale_cents)         AS revenue_cents,
                    COUNT(DISTINCT si.transaction_id)                 AS orders
               FROM sale_items si
               JOIN inventory   i ON i.item_id       = si.item_id
               LEFT JOIN transactions t ON t.transaction_id = si.transaction_id
              WHERE 1=1${w.sql}
              GROUP BY category
              ORDER BY revenue_cents DESC`,
            w.vals
        );
        const [topItems] = await db.query(
            `SELECT i.item_id, i.item_name, COALESCE(i.category, 'Misc') AS category,
                    s.name AS shop_name,
                    SUM(si.quantity)                          AS units_sold,
                    SUM(si.quantity * si.price_at_sale_cents) AS revenue_cents
               FROM sale_items si
               JOIN inventory   i ON i.item_id       = si.item_id
               LEFT JOIN shops  s ON s.shop_id       = i.outlet_id
               LEFT JOIN transactions t ON t.transaction_id = si.transaction_id
              WHERE 1=1${w.sql}
              GROUP BY i.item_id
              ORDER BY revenue_cents DESC
              LIMIT 15`,
            w.vals
        );
        return res.json({ by_category: byCategory, top_items: topItems });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

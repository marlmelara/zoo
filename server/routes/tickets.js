import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/tickets/my — current customer's tickets with full event & venue info
router.get('/my', requireAuth, async (req, res) => {
    try {
        const { customerId } = req.user;
        if (!customerId) return res.status(403).json({ error: 'Not a customer account.' });

        const [rows] = await db.query(
            `SELECT t.*,
                    e.title        AS event_title,
                    e.event_date   AS event_date,
                    e.description  AS event_description,
                    e.start_time   AS event_start_time,
                    e.end_time     AS event_end_time,
                    v.venue_name   AS event_venue_name,
                    v.location     AS event_venue_location,
                    tr.transaction_date
             FROM tickets t
             LEFT JOIN events       e  ON t.event_id       = e.event_id
             LEFT JOIN venues       v  ON e.venue_id        = v.venue_id
             LEFT JOIN transactions tr ON t.transaction_id  = tr.transaction_id
             WHERE t.customer_id = ?
             ORDER BY t.ticket_id DESC`,
            [customerId]
        );
        // Nest event/venue/transaction for frontend convenience
        const shaped = rows.map(r => ({
            ticket_id:      r.ticket_id,
            customer_id:    r.customer_id,
            type:           r.type,
            event_id:       r.event_id,
            price_cents:    r.price_cents,
            transaction_id: r.transaction_id,
            events: r.event_id ? {
                title:       r.event_title,
                description: r.event_description,
                event_date:  r.event_date,
                start_time:  r.event_start_time,
                end_time:    r.event_end_time,
                venues: r.event_venue_name ? {
                    venue_name: r.event_venue_name,
                    location:   r.event_venue_location,
                } : null,
            } : null,
            transactions: r.transaction_date ? {
                transaction_date: r.transaction_date,
            } : null,
        }));
        return res.json(shaped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/tickets — admin: all tickets
router.get('/', requireRole('admin', 'manager', 'retail'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, e.title AS event_title, e.event_date,
                    c.first_name, c.last_name
             FROM tickets t
             LEFT JOIN events    e ON t.event_id    = e.event_id
             LEFT JOIN customers c ON t.customer_id = c.customer_id
             ORDER BY t.ticket_id DESC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/tickets — insert tickets (called from checkout)
router.post('/', requireAuth, async (req, res) => {
    // tickets: [{ customer_id, type, event_id, price_cents, transaction_id }]
    const { tickets } = req.body;
    if (!Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json({ error: 'No tickets provided.' });
    }
    try {
        const values = tickets.map(t =>
            [t.customer_id || null, t.type, t.event_id || null,
             t.price_cents, t.transaction_id || null]
        );
        await db.query(
            `INSERT INTO tickets (customer_id, type, event_id, price_cents, transaction_id)
             VALUES ?`,
            [values]
        );
        // Update event tickets_sold counter
        for (const t of tickets) {
            if (t.event_id) {
                await db.query(
                    'UPDATE events SET tickets_sold = tickets_sold + 1, actual_attendance = COALESCE(actual_attendance,0) + 1 WHERE event_id = ?',
                    [t.event_id]
                );
            }
        }
        return res.status(201).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

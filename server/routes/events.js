import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/events
// Non-admin callers (or any caller without ?include_archived=1) receive
// only non-archived events. Admin UIs pass include_archived=1 when they
// want the full picture.
// Optional ?filter=upcoming|past|archived narrows the result set.
router.get('/', async (req, res) => {
    try {
        const { include_archived, filter } = req.query;
        const where = [];
        if (include_archived !== '1') where.push('COALESCE(e.is_archived, 0) = 0');
        if (filter === 'upcoming') where.push('e.event_date >= CURDATE()');
        if (filter === 'past')     where.push('e.event_date <  CURDATE()');
        if (filter === 'archived') { where.length = 0; where.push('COALESCE(e.is_archived, 0) = 1'); }
        const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [rows] = await db.query(
            `SELECT e.*, v.venue_name, v.location AS venue_location, v.capacity AS venue_capacity
             FROM events e
             LEFT JOIN venues v ON e.venue_id = v.venue_id
             ${clause}
             ORDER BY e.event_date DESC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/events/assigned — events assigned to the logged-in employee
router.get('/assigned', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, v.venue_name, v.location AS venue_location, ea.assignment_id
             FROM event_assignments ea
             JOIN events e ON e.event_id = ea.event_id
             LEFT JOIN venues v ON e.venue_id = v.venue_id
             WHERE ea.employee_id = ?
             ORDER BY e.event_date DESC`,
            [req.user.employeeId]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/events/with-assignments — all events with employee/animal assignments (admin/manager)
router.get('/with-assignments', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [events] = await db.query(
            `SELECT e.*, v.venue_name, v.location AS venue_location
             FROM events e
             LEFT JOIN venues v ON e.venue_id = v.venue_id
             WHERE COALESCE(e.is_archived, 0) = 0
             ORDER BY e.event_date DESC`
        );

        const [assignments] = await db.query(
            `SELECT ea.assignment_id, ea.event_id, ea.employee_id, ea.animal_id,
                    emp.first_name, emp.last_name,
                    a.name AS animal_name
             FROM event_assignments ea
             LEFT JOIN employees emp ON emp.employee_id = ea.employee_id
             LEFT JOIN animals a ON a.animal_id = ea.animal_id`
        );

        const result = events.map(event => ({
            ...event,
            assignments: assignments.filter(a => a.event_id === event.event_id),
        }));

        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/events/:id/assignments — all assignments for a single event with employee/animal details
router.get('/:id/assignments', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ea.assignment_id, ea.event_id, ea.employee_id, ea.animal_id,
                    emp.first_name, emp.last_name, d.dept_name,
                    a.name AS animal_name, a.species_common_name
             FROM event_assignments ea
             LEFT JOIN employees emp ON emp.employee_id = ea.employee_id
             LEFT JOIN departments d ON d.dept_id = emp.dept_id
             LEFT JOIN animals a ON a.animal_id = ea.animal_id
             WHERE ea.event_id = ?`,
            [req.params.id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/events/:id/assign — assign an employee OR animal to an event
router.post('/:id/assign', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { employee_id, animal_id } = req.body;
        if (!employee_id && !animal_id) {
            return res.status(400).json({ error: 'Must provide employee_id or animal_id.' });
        }
        const [result] = await db.query(
            'INSERT INTO event_assignments (event_id, employee_id, animal_id) VALUES (?, ?, ?)',
            [req.params.id, employee_id || null, animal_id || null]
        );
        return res.status(201).json({ assignment_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, v.venue_name, v.location AS venue_location
             FROM events e
             LEFT JOIN venues v ON e.venue_id = v.venue_id
             WHERE e.event_id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/events — admin/manager
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
    const { title, description, event_date, start_time, end_time,
            venue_id, max_capacity, ticket_price_cents } = req.body;
    try {
        const [result] = await db.query(
            `INSERT INTO events
             (title, description, event_date, start_time, end_time,
              venue_id, max_capacity, ticket_price_cents, tickets_sold, actual_attendance)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [title, description || null, event_date, start_time || null, end_time || null,
             venue_id || null, max_capacity || null, ticket_price_cents || 0]
        );
        return res.status(201).json({ event_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/events/:id/assign-employee — admin/manager
router.post('/:id/assign-employee', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { employee_id } = req.body;
        const [result] = await db.query(
            'INSERT INTO event_assignments (event_id, employee_id) VALUES (?, ?)',
            [req.params.id, employee_id]
        );
        return res.status(201).json({ assignment_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/events/:id
router.patch('/:id', requireRole('admin', 'manager'), async (req, res) => {
    const fields = ['title', 'description', 'event_date', 'start_time', 'end_time',
                    'venue_id', 'max_capacity', 'ticket_price_cents', 'actual_attendance'];
    const updates = [];
    const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) {
            updates.push(`${f} = ?`);
            vals.push(req.body[f]);
        }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    vals.push(req.params.id);
    try {
        await db.query(`UPDATE events SET ${updates.join(', ')} WHERE event_id = ?`, vals);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/events/assignments/:assignmentId — admin/manager
router.delete('/assignments/:assignmentId', requireRole('admin', 'manager'), async (req, res) => {
    try {
        await db.query(
            'DELETE FROM event_assignments WHERE assignment_id = ?',
            [req.params.assignmentId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/events/:id — soft-archive.
// Preserves tickets + receipts + assignments so prior purchasers still
// see the event on their dashboard. Not reversible.
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
    try {
        await db.query(
            `UPDATE events
                SET is_archived = 1, archived_at = NOW()
              WHERE event_id = ?`,
            [req.params.id]
        );
        return res.json({ success: true, archived: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

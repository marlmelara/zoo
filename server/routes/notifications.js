import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/notifications — recent notifications for the logged-in employee.
// Unresolved notifications (is_resolved = 0) are returned first, then resolved.
// They are "persistent until handled" — a notification only flips to resolved
// when the underlying target (supply request, hours request, stock level)
// is acted on, via MySQL triggers.
router.get('/', requireAuth, async (req, res) => {
    try {
        const { employeeId } = req.user;
        if (!employeeId) return res.json([]);
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
        const [rows] = await db.query(
            `SELECT * FROM notifications
             WHERE recipient_id = ?
             ORDER BY is_resolved ASC, created_at DESC
             LIMIT ?`,
            [employeeId, limit]
        );
        return res.json(rows.map(r => ({
            ...r,
            created_at: toIsoUtc(r.created_at),
        })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/unread-count — counts UNRESOLVED notifications.
// The badge in the sidebar tracks active work to be done, not simply unread.
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const { employeeId } = req.user;
        if (!employeeId) return res.json({ count: 0 });
        const [[row]] = await db.query(
            'SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND is_resolved = 0',
            [employeeId]
        );
        return res.json({ count: row.count });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/:id/read — mark one notification read
router.patch('/:id/read', requireAuth, async (req, res) => {
    try {
        const { employeeId } = req.user;
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND recipient_id = ?',
            [req.params.id, employeeId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/read-all — mark all of my notifications read
router.patch('/read-all', requireAuth, async (req, res) => {
    try {
        const { employeeId } = req.user;
        await db.query(
            'UPDATE notifications SET is_read = 1 WHERE recipient_id = ?',
            [employeeId]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/notifications/:id — dismiss a HANDLED notification.
// Unresolved ones can't be dismissed — the inbox needs to keep showing
// the outstanding work until the underlying target is resolved (trigger
// will flip is_resolved once that happens). The recipient_id match
// stops someone from dismissing another user's row.
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { employeeId } = req.user;
        const [result] = await db.query(
            `DELETE FROM notifications
             WHERE notification_id = ? AND recipient_id = ? AND is_resolved = 1`,
            [req.params.id, employeeId]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Notification is not handled yet or does not belong to you.' });
        }
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

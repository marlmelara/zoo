import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/animals — public (active only; admin can include inactive)
router.get('/', async (req, res) => {
    try {
        const { include_inactive } = req.query;
        const where = include_inactive === '1' ? '' : ' WHERE a.is_active = 1';
        const [rows] = await db.query(
            `SELECT a.*, z.zone_name, z.location_description
             FROM animals a
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             ${where}
             ORDER BY a.animal_id ASC`
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/deactivated — admin: list soft-deleted animals
router.get('/deactivated', requireRole('admin'), async (req, res) => {
    try {
        const { name } = req.query;
        let sql = `SELECT a.*, z.zone_name FROM animals a
                   LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
                   WHERE a.is_active = 0`;
        const params = [];
        if (name) { sql += ' AND a.name LIKE ?'; params.push(`%${name}%`); }
        sql += ' ORDER BY a.animal_id DESC';
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/animals/:id/reactivate — admin: restore a soft-deleted animal
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
    try {
        await db.query('UPDATE animals SET is_active = 1 WHERE animal_id = ?', [req.params.id]);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/animals/:id — soft-delete (deactivate)
router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
    try {
        await db.query('UPDATE animals SET is_active = 0 WHERE animal_id = ?', [req.params.id]);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/zones/all
router.get('/zones/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM animal_zones ORDER BY zone_id ASC');
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/assigned/caretaker — animals assigned to the logged-in caretaker
router.get('/assigned/caretaker', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT a.*, z.zone_name
             FROM animals a
             JOIN caretaker_animal_assignments ca ON ca.animal_id = a.animal_id
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             WHERE ca.caretaker_id = ?
             ORDER BY a.animal_id ASC`,
            [req.user.employeeId]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/assigned/vet — animals assigned to the logged-in vet
router.get('/assigned/vet', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT a.*, z.zone_name
             FROM animals a
             JOIN vet_animal_assignments va ON va.animal_id = a.animal_id
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             WHERE va.vet_id = ?
             ORDER BY a.animal_id ASC`,
            [req.user.employeeId]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/with-assignments — all animals with vet + caretaker assignments (admin/manager)
router.get('/with-assignments', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [animals] = await db.query(
            `SELECT a.*, z.zone_name
             FROM animals a
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             WHERE a.is_active = 1
             ORDER BY a.health_status = 'critical' DESC,
                      a.health_status = 'sick' DESC,
                      a.animal_id ASC`
        );

        const [vetAssignments] = await db.query(
            `SELECT va.vet_id, va.animal_id, e.first_name, e.last_name
             FROM vet_animal_assignments va
             JOIN employees e ON e.employee_id = va.vet_id`
        );

        const [caretakerAssignments] = await db.query(
            `SELECT ca.caretaker_id, ca.animal_id, e.first_name, e.last_name
             FROM caretaker_animal_assignments ca
             JOIN employees e ON e.employee_id = ca.caretaker_id`
        );

        const result = animals.map(animal => ({
            ...animal,
            vet_assignments: vetAssignments.filter(va => va.animal_id === animal.animal_id),
            caretaker_assignments: caretakerAssignments.filter(ca => ca.animal_id === animal.animal_id),
        }));

        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/:id — with health record + vet assignments
router.get('/:id', async (req, res) => {
    try {
        const [animals] = await db.query(
            `SELECT a.*, z.zone_name FROM animals a
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             WHERE a.animal_id = ?`, [req.params.id]
        );
        if (animals.length === 0) return res.status(404).json({ error: 'Animal not found.' });

        const [healthRecords] = await db.query(
            `SELECT hr.*, mh.history_id, mh.injury, mh.disease,
                    mh.date_treated, mh.animal_age_at_treatment,
                    e.first_name AS vet_first, e.last_name AS vet_last
             FROM health_records hr
             LEFT JOIN medical_history mh ON mh.record_id = hr.record_id
             LEFT JOIN vets v ON hr.vet_id = v.employee_id
             LEFT JOIN employees e ON v.employee_id = e.employee_id
             WHERE hr.record_id = ?`, [animals[0].health_record_id]
        );

        return res.json({ ...animals[0], health_records: healthRecords });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/:id/medical-history — expanded with recorder + vitals
router.get('/:id/medical-history', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT mh.*,
                    e.first_name AS recorded_by_first,
                    e.last_name  AS recorded_by_last,
                    e.role       AS recorded_by_role
             FROM medical_history mh
             JOIN animals a    ON a.health_record_id = mh.record_id
             LEFT JOIN employees e ON e.employee_id = mh.recorded_by
             WHERE a.animal_id = ?
             ORDER BY mh.created_at DESC, mh.date_treated DESC`,
            [req.params.id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/animals/:id/health-status — set/update the quick-look flag.
// This is the UPDATE that fires trg_animal_sick_notify (or the healthy
// resolver).
router.patch('/:id/health-status', requireAuth, async (req, res) => {
    const { health_status } = req.body;
    const allowed = ['healthy','under_observation','sick','critical','recovering'];
    if (!allowed.includes(health_status)) {
        return res.status(400).json({ error: 'Invalid health_status value.' });
    }
    try {
        await db.query(
            `UPDATE animals
                SET health_status = ?, last_health_update = NOW()
              WHERE animal_id = ?`,
            [health_status, req.params.id]
        );
        return res.json({ success: true, health_status });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/:id/care-log — recent care log entries for an animal
router.get('/:id/care-log', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT cl.*,
                    e.first_name, e.last_name, e.role
             FROM animal_care_log cl
             LEFT JOIN employees e ON e.employee_id = cl.employee_id
             WHERE cl.animal_id = ?
             ORDER BY cl.logged_at DESC
             LIMIT 100`,
            [req.params.id]
        );
        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/animals/:id/care-log — anyone on staff can log an update.
router.post('/:id/care-log', requireRole('admin','manager','vet','caretaker'), async (req, res) => {
    const { log_type, notes } = req.body;
    if (!notes || !notes.trim()) return res.status(400).json({ error: 'Notes are required.' });
    try {
        const [result] = await db.query(
            `INSERT INTO animal_care_log (animal_id, employee_id, log_type, notes)
             VALUES (?, ?, ?, ?)`,
            [req.params.id, req.user.employeeId, log_type || 'observation', notes]
        );
        return res.status(201).json({ log_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/animals
router.post('/', requireRole('admin', 'manager', 'vet', 'caretaker'), async (req, res) => {
    const { name, species_common_name, species_binomial, age, zone_id } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [hrResult] = await conn.query('INSERT INTO health_records (vet_id) VALUES (NULL)');
        const [result] = await conn.query(
            `INSERT INTO animals (name, species_common_name, species_binomial, age, zone_id, health_record_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, species_common_name, species_binomial || null,
             age || null, zone_id || null, hrResult.insertId]
        );
        await conn.commit();
        return res.status(201).json({ animal_id: result.insertId });
    } catch (err) {
        await conn.rollback();
        return res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// POST /api/animals/:id/vet-assign
router.post('/:id/vet-assign', requireRole('admin', 'manager', 'vet'), async (req, res) => {
    try {
        const { vet_id } = req.body;
        await db.query(
            'INSERT INTO vet_animal_assignments (vet_id, animal_id) VALUES (?, ?)',
            [vet_id, req.params.id]
        );
        return res.status(201).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/animals/:id/caretaker-assign
router.post('/:id/caretaker-assign', requireRole('admin', 'manager', 'caretaker'), async (req, res) => {
    try {
        const { caretaker_id } = req.body;
        await db.query(
            'INSERT INTO caretaker_animal_assignments (caretaker_id, animal_id) VALUES (?, ?)',
            [caretaker_id, req.params.id]
        );
        return res.status(201).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/animals/:id/medical-history — full medical record entry.
router.post('/:id/medical-history', requireRole('admin', 'manager', 'vet'), async (req, res) => {
    const {
        injury, disease, diagnosis, treatment, medications,
        severity, status, weight_kg, temperature_c, heart_rate_bpm,
        notes, next_followup_date, date_treated, animal_age_at_treatment,
    } = req.body;
    try {
        const [animals] = await db.query(
            'SELECT health_record_id FROM animals WHERE animal_id = ?', [req.params.id]
        );
        if (animals.length === 0 || !animals[0].health_record_id) {
            return res.status(404).json({ error: 'No health record for this animal.' });
        }
        const [result] = await db.query(
            `INSERT INTO medical_history
             (record_id, injury, disease, diagnosis, treatment, medications,
              severity, status, weight_kg, temperature_c, heart_rate_bpm,
              notes, recorded_by, next_followup_date,
              date_treated, animal_age_at_treatment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                animals[0].health_record_id,
                injury || null, disease || null, diagnosis || null,
                treatment || null, medications || null,
                severity || 'minor', status || 'active',
                weight_kg || null, temperature_c || null, heart_rate_bpm || null,
                notes || null,
                req.user.employeeId || null,
                next_followup_date || null,
                date_treated || null,
                animal_age_at_treatment || null,
            ]
        );
        return res.status(201).json({ history_id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /api/animals/:id
router.patch('/:id', requireRole('admin', 'manager', 'vet', 'caretaker'), async (req, res) => {
    const fields = ['name', 'species_common_name', 'species_binomial', 'age', 'zone_id'];
    const updates = []; const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    vals.push(req.params.id);
    try {
        await db.query(`UPDATE animals SET ${updates.join(', ')} WHERE animal_id = ?`, vals);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/animals/:id/vet-assign/:vetId
router.delete('/:id/vet-assign/:vetId', requireRole('admin', 'manager'), async (req, res) => {
    try {
        await db.query(
            'DELETE FROM vet_animal_assignments WHERE vet_id = ? AND animal_id = ?',
            [req.params.vetId, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/animals/:id/caretaker-assign/:caretakerId
router.delete('/:id/caretaker-assign/:caretakerId', requireRole('admin', 'manager'), async (req, res) => {
    try {
        await db.query(
            'DELETE FROM caretaker_animal_assignments WHERE caretaker_id = ? AND animal_id = ?',
            [req.params.caretakerId, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;

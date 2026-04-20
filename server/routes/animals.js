import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';
import { toIsoUtc } from '../lib/dates.js';

const router = Router();

// GET /api/animals — public (active only; admin can include inactive)
router.get('/', async (req, res) => {
    try {
        const { include_inactive, status } = req.query;
        let where = '';
        if (status === 'active')        where = ' WHERE a.is_active = 1';
        else if (status === 'departed' || status === 'inactive') where = ' WHERE a.is_active = 0';
        else if (status === 'all')      where = '';
        else where = include_inactive === '1' ? '' : ' WHERE a.is_active = 1';
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

// POST /api/animals/:id/reactivate — admin: restore a soft-deleted animal.
// Clears departed_date so the animal reads as currently present and
// stamps an 'animal_arrived' activity_log row for the lifecycle modal.
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT name FROM animals WHERE animal_id = ?',
            [req.params.id]
        );
        await db.query(
            `UPDATE animals
                SET is_active = 1, departed_date = NULL,
                    arrived_date = COALESCE(arrived_date, CURDATE())
              WHERE animal_id = ?`,
            [req.params.id]
        );
        const name = rows[0]?.name || `animal #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('animal_arrived', ?, ?, 'animal', ?)`,
            [`${name} returned to the zoo`, req.user.employeeId || null, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/animals/:id — soft-delete. Stamps departed_date so the
// Departed view can show *when* the animal left, plus an 'animal_departed'
// activity_log row for the lifecycle modal.
router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT name FROM animals WHERE animal_id = ?',
            [req.params.id]
        );
        await db.query(
            `UPDATE animals
                SET is_active = 0,
                    departed_date = COALESCE(departed_date, CURDATE())
              WHERE animal_id = ?`,
            [req.params.id]
        );
        const name = rows[0]?.name || `animal #${req.params.id}`;
        await db.query(
            `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
             VALUES ('animal_departed', ?, ?, 'animal', ?)`,
            [`${name} departed the zoo`, req.user.employeeId || null, req.params.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/animals/:id/lifecycle-log — arrival/departure history for one
// animal. Same shape as the employee + customer variants so the shared
// LifecycleLogModal can consume all three.
router.get('/:id/lifecycle-log', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT al.log_id, al.action_type, al.description, al.created_at,
                    al.performed_by,
                    e.first_name AS performer_first, e.last_name AS performer_last,
                    e.role       AS performer_role
               FROM activity_log al
               LEFT JOIN employees e ON e.employee_id = al.performed_by
              WHERE al.target_type = 'animal'
                AND al.target_id   = ?
                AND al.action_type IN ('animal_added','animal_arrived','animal_departed')
              ORDER BY al.created_at DESC`,
            [req.params.id]
        );
        return res.json(rows.map(r => ({ ...r, created_at: toIsoUtc(r.created_at) })));
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
// resolver). Only animal-care roles may flag status — customers and
// retail/security staff cannot trigger clinical alerts.
router.patch('/:id/health-status', requireRole('admin','manager','vet','caretaker'), async (req, res) => {
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
    const { name, species_common_name, species_binomial, age, zone_id,
            arrived_date, date_of_birth, image_url } = req.body;

    // DOB rule: born-at-zoo shares the arrival day; acquired animals were
    // born before they got here. So DOB <= arrived_date always. Reject
    // up-front with a friendly message instead of leaking the CHECK error.
    const effectiveArrival = arrived_date || new Date().toISOString().slice(0, 10);
    if (date_of_birth && date_of_birth > effectiveArrival) {
        return res.status(400).json({
            error: 'Date of birth must be on or before the arrival date.',
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [hrResult] = await conn.query('INSERT INTO health_records (vet_id) VALUES (NULL)');
        const [result] = await conn.query(
            `INSERT INTO animals
             (name, species_common_name, species_binomial, age, zone_id,
              health_record_id, arrived_date, date_of_birth, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, species_common_name, species_binomial || null,
             age || null, zone_id || null, hrResult.insertId,
             effectiveArrival, date_of_birth || null,
             image_url && String(image_url).trim() ? String(image_url).trim() : null]
        );
        await conn.commit();
        try {
            await db.query(
                `INSERT INTO activity_log (action_type, description, performed_by, target_type, target_id)
                 VALUES ('animal_added', ?, ?, 'animal', ?)`,
                [`${name} added to the zoo`, req.user?.employeeId || null, result.insertId]
            );
        } catch { /* best-effort audit */ }
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
    const fields = ['name', 'species_common_name', 'species_binomial', 'age', 'zone_id',
                    'arrived_date', 'departed_date', 'date_of_birth', 'image_url'];
    const updates = []; const vals = [];
    for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    // Keep the DOB ≤ arrived_date invariant. Load current values for any
    // fields the client didn't overwrite, then validate the final pair.
    try {
        const [[current]] = await db.query(
            'SELECT date_of_birth, arrived_date FROM animals WHERE animal_id = ?',
            [req.params.id]
        );
        if (!current) return res.status(404).json({ error: 'Animal not found.' });
        const nextDob     = req.body.date_of_birth !== undefined ? req.body.date_of_birth : current.date_of_birth;
        const nextArrived = req.body.arrived_date  !== undefined ? req.body.arrived_date  : current.arrived_date;
        if (nextDob && nextArrived && String(nextDob) > String(nextArrived)) {
            return res.status(400).json({
                error: 'Date of birth must be on or before the arrival date.',
            });
        }

        vals.push(req.params.id);
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

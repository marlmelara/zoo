import { Router } from '../lib/router.js';
import db from '../db.js';
import { requireRole, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/animals — public
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT a.*, z.zone_name, z.location_description
             FROM animals a
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             ORDER BY a.animal_id ASC`
        );
        return res.json(rows);
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
            `SELECT a.*, z.zone_name FROM animals a
             LEFT JOIN animal_zones z ON a.zone_id = z.zone_id
             ORDER BY a.animal_id ASC`
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

// GET /api/animals/:id/medical-history
router.get('/:id/medical-history', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT mh.* FROM medical_history mh
             JOIN animals a ON a.health_record_id = mh.record_id
             WHERE a.animal_id = ?
             ORDER BY mh.date_treated DESC`,
            [req.params.id]
        );
        return res.json(rows);
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

// POST /api/animals/:id/medical-history
router.post('/:id/medical-history', requireRole('admin', 'manager', 'vet'), async (req, res) => {
    const { injury, disease, date_treated, animal_age_at_treatment } = req.body;
    try {
        const [animals] = await db.query(
            'SELECT health_record_id FROM animals WHERE animal_id = ?', [req.params.id]
        );
        if (animals.length === 0 || !animals[0].health_record_id) {
            return res.status(404).json({ error: 'No health record for this animal.' });
        }
        await db.query(
            `INSERT INTO medical_history (record_id, injury, disease, date_treated, animal_age_at_treatment)
             VALUES (?, ?, ?, ?, ?)`,
            [animals[0].health_record_id, injury || null, disease || null,
             date_treated || null, animal_age_at_treatment || null]
        );
        return res.status(201).json({ success: true });
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

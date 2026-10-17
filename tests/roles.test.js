// ============================================================
// server/lib/roles.js — the "who is allowed to do X" rules.
//
// These are the checks that break silently: get one wrong and
// nothing throws, a Retail manager just quietly gains the ability
// to edit animal records. Every case below is a rule the comments
// in roles.js claim, pinned down against real rows.
//
// The `user` objects mirror the JWT payload built in
// server/routes/auth.js — { userId, employeeId, deptId, role } —
// so these aren't testing an invented shape.
// ============================================================
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { connect } from './helpers/database.js';
import { applyServerEnv } from './helpers/config.js';

let db;
let pool;
let roles;

// Ids filled in by the fixture below.
const dept = {};
const emp  = {};
let assignedAnimalId;
let unassignedAnimalId;

before(async () => {
    applyServerEnv();
    roles  = await import('../server/lib/roles.js');
    pool   = (await import('../server/db.js')).default;
    db     = await connect();

    const insert = async (sql, params) => (await db.query(sql, params))[0].insertId;

    for (const name of ['Veterinary', 'Animal Care', 'Retail', 'Security']) {
        dept[name] = await insert(
            'INSERT INTO departments (dept_name) VALUES (?)', [name]);
    }

    const employee = (first, role, deptId, managerId = null) => insert(
        `INSERT INTO employees (first_name, last_name, role, dept_id, manager_id)
         VALUES (?, 'Tester', ?, ?, ?)`,
        [first, role, deptId, managerId]);

    emp.vetManager      = await employee('Vera',  'manager', dept['Veterinary']);
    emp.careManager     = await employee('Cara',  'manager', dept['Animal Care']);
    emp.retailManager   = await employee('Rhys',  'manager', dept['Retail']);
    emp.deptlessManager = await employee('Dana',  'manager', null);
    emp.vet             = await employee('Vince', 'vet',     dept['Veterinary'], null);
    emp.otherVet        = await employee('Olive', 'vet',     dept['Veterinary'], null);
    emp.vetsReport      = await employee('Reed',  'vet',     dept['Veterinary'], emp.vetManager);
    emp.retailsReport   = await employee('Robin', 'retail',  dept['Retail'],     emp.retailManager);
    emp.departed        = await employee('Gus',   'vet',     dept['Veterinary'], emp.vetManager);
    await db.query('UPDATE employees SET is_active = 0 WHERE employee_id = ?', [emp.departed]);

    for (const id of [emp.vet, emp.otherVet, emp.vetsReport]) {
        await db.query(
            `INSERT INTO vets (employee_id, license_no) VALUES (?, ?)`,
            [id, `LIC-${id}`]);
    }

    assignedAnimalId = await insert(
        `INSERT INTO animals (name, species_common_name) VALUES ('Nessa', 'River Otter')`);
    unassignedAnimalId = await insert(
        `INSERT INTO animals (name, species_common_name) VALUES ('Boris', 'Red Panda')`);
    await db.query(
        'INSERT INTO vet_animal_assignments (vet_id, animal_id) VALUES (?, ?)',
        [emp.vet, assignedAnimalId]);
});

after(async () => {
    await db?.end();
    await pool?.end();
});

const user = (role, { employeeId = null, deptId = null } = {}) =>
    ({ userId: 1, role, employeeId, deptId });

describe('isAnimalDeptManager', () => {
    it('lets an admin through regardless of department', async () => {
        assert.equal(await roles.isAnimalDeptManager(user('admin')), true);
    });

    it('accepts managers of the Veterinary and Animal Care departments', async () => {
        assert.equal(
            await roles.isAnimalDeptManager(
                user('manager', { employeeId: emp.vetManager, deptId: dept['Veterinary'] })),
            true);
        assert.equal(
            await roles.isAnimalDeptManager(
                user('manager', { employeeId: emp.careManager, deptId: dept['Animal Care'] })),
            true);
    });

    it('refuses a Retail manager', async () => {
        assert.equal(
            await roles.isAnimalDeptManager(
                user('manager', { employeeId: emp.retailManager, deptId: dept['Retail'] })),
            false);
    });

    it('refuses a Security manager and a manager with no department', async () => {
        assert.equal(
            await roles.isAnimalDeptManager(user('manager', { deptId: dept['Security'] })),
            false);
        assert.equal(
            await roles.isAnimalDeptManager(
                user('manager', { employeeId: emp.deptlessManager })),
            false);
    });

    it('refuses a vet — the rule is about managers, not animal staff', async () => {
        assert.equal(
            await roles.isAnimalDeptManager(
                user('vet', { employeeId: emp.vet, deptId: dept['Veterinary'] })),
            false);
    });

    it('refuses an absent user', async () => {
        assert.equal(await roles.isAnimalDeptManager(null), false);
        assert.equal(await roles.isAnimalDeptManager(undefined), false);
    });
});

describe('managerOwnsEmployee', () => {
    it('lets an admin act on anyone', async () => {
        assert.equal(await roles.managerOwnsEmployee(user('admin'), emp.retailsReport), true);
    });

    it('lets a manager act on their own report', async () => {
        assert.equal(
            await roles.managerOwnsEmployee(
                user('manager', { employeeId: emp.vetManager }), emp.vetsReport),
            true);
    });

    it("refuses a manager acting on another manager's report", async () => {
        assert.equal(
            await roles.managerOwnsEmployee(
                user('manager', { employeeId: emp.vetManager }), emp.retailsReport),
            false);
    });

    it('lets anyone act on themselves', async () => {
        assert.equal(
            await roles.managerOwnsEmployee(
                user('vet', { employeeId: emp.vet }), emp.vet),
            true);
    });

    it('refuses a non-manager acting on someone else', async () => {
        assert.equal(
            await roles.managerOwnsEmployee(
                user('vet', { employeeId: emp.vet }), emp.otherVet),
            false);
    });

    it('refuses a deactivated employee — soft-deleted staff are out of scope', async () => {
        assert.equal(
            await roles.managerOwnsEmployee(
                user('manager', { employeeId: emp.vetManager }), emp.departed),
            false);
    });

    it('refuses an absent user', async () => {
        assert.equal(await roles.managerOwnsEmployee(null, emp.vetsReport), false);
    });
});

describe('isVetAssignedToAnimal', () => {
    it('is true only for the vet actually on the assignment', async () => {
        assert.equal(await roles.isVetAssignedToAnimal(emp.vet, assignedAnimalId), true);
        assert.equal(await roles.isVetAssignedToAnimal(emp.otherVet, assignedAnimalId), false);
    });

    it('is false for an animal the vet is not assigned to', async () => {
        assert.equal(await roles.isVetAssignedToAnimal(emp.vet, unassignedAnimalId), false);
    });

    it('is false when either id is missing', async () => {
        assert.equal(await roles.isVetAssignedToAnimal(null, assignedAnimalId), false);
        assert.equal(await roles.isVetAssignedToAnimal(emp.vet, null), false);
        assert.equal(await roles.isVetAssignedToAnimal(undefined, undefined), false);
    });
});

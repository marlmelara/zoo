// ================================================================
// Re-register every pre-existing customer and employee as a MySQL
// auth user with a known shared password. Links back to the
// existing customer/employee rows by setting their user_id FK.
//
// Run once against Azure after the initial data push:
//     node reregister-users.mjs
//
// All users end up with the password:  DEFAULT_PASSWORD (below)
// Re-running is safe — INSERT IGNORE + ON DUPLICATE KEY on email.
// ================================================================

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_PASSWORD = 'zoo123456';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
    console.log(`Target: mysql://${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
    console.log(`Default password: ${DEFAULT_PASSWORD}\n`);

    const isAzure = (process.env.DB_HOST || '').includes('database.azure.com');
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT || '3306'),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      isAzure ? { rejectUnauthorized: true } : undefined,
    });

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // ── Gather every (email, customer_id, employee_id) we can find ──
    const [customers] = await conn.query(
        'SELECT customer_id, email FROM customers WHERE email IS NOT NULL'
    );
    const [employees] = await conn.query(
        `SELECT employee_id, contact_info AS email
         FROM employees
         WHERE contact_info IS NOT NULL`
    );

    // Map email → { customer_ids[], employee_ids[] }
    const byEmail = new Map();
    for (const c of customers) {
        if (!EMAIL_REGEX.test(c.email)) continue;
        const e = c.email.toLowerCase().trim();
        if (!byEmail.has(e)) byEmail.set(e, { customer_ids: [], employee_ids: [] });
        byEmail.get(e).customer_ids.push(c.customer_id);
    }
    for (const emp of employees) {
        if (!EMAIL_REGEX.test(emp.email)) continue;
        const e = emp.email.toLowerCase().trim();
        if (!byEmail.has(e)) byEmail.set(e, { customer_ids: [], employee_ids: [] });
        byEmail.get(e).employee_ids.push(emp.employee_id);
    }

    console.log(`Found ${byEmail.size} unique emails to register.\n`);

    let created = 0;
    let reused = 0;
    let linkedC = 0;
    let linkedE = 0;

    for (const [email, { customer_ids, employee_ids }] of byEmail) {
        // Insert-or-fetch the user row by email
        const [ins] = await conn.query(
            `INSERT INTO users (email, password_hash) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE user_id = LAST_INSERT_ID(user_id)`,
            [email, hash]
        );
        // insertId is the new row's ID or (via LAST_INSERT_ID trick) the existing one
        const userId = ins.insertId;
        if (ins.affectedRows === 1) created++;
        else reused++;

        // Link back
        for (const cid of customer_ids) {
            const [u] = await conn.query(
                'UPDATE customers SET user_id = ? WHERE customer_id = ?',
                [userId, cid]
            );
            if (u.affectedRows > 0) linkedC++;
        }
        for (const eid of employee_ids) {
            const [u] = await conn.query(
                'UPDATE employees SET user_id = ? WHERE employee_id = ?',
                [userId, eid]
            );
            if (u.affectedRows > 0) linkedE++;
        }

        const roles = [
            customer_ids.length ? `customer(${customer_ids.join(',')})` : null,
            employee_ids.length ? `employee(${employee_ids.join(',')})` : null,
        ].filter(Boolean).join(' + ');
        console.log(`  ${String(userId).padStart(3)}  ${email.padEnd(34)}  ${roles}`);
    }

    console.log(`\nusers:      created=${created}  reused=${reused}`);
    console.log(`customers:  linked=${linkedC}/${customers.length}`);
    console.log(`employees:  linked=${linkedE}/${employees.length}`);

    // Show who got skipped (no email)
    const [orphanC] = await conn.query(
        'SELECT customer_id, first_name, last_name FROM customers WHERE user_id IS NULL'
    );
    const [orphanE] = await conn.query(
        'SELECT employee_id, first_name, last_name FROM employees WHERE user_id IS NULL'
    );
    if (orphanC.length) {
        console.log('\n⚠️  Customers with no email (cannot log in until manually set):');
        orphanC.forEach(o => console.log(`     customer_id=${o.customer_id}  ${o.first_name} ${o.last_name}`));
    }
    if (orphanE.length) {
        console.log('\n⚠️  Employees with no valid contact_info email:');
        orphanE.forEach(o => console.log(`     employee_id=${o.employee_id}  ${o.first_name} ${o.last_name}`));
    }

    await conn.end();
    console.log('\n✨ Done. Everyone above can log in with password "' + DEFAULT_PASSWORD + '".');
}

main().catch(err => {
    console.error('\nFATAL:', err);
    process.exit(1);
});

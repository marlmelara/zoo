// ================================================================
// One-shot Supabase → MySQL data migration
//
// Reads every zoo table from your Supabase project via the REST API
// and inserts each row into the matching MySQL table. IDs are
// preserved so foreign-key references still line up.
//
// Run with:   node migrate-from-supabase.mjs
// Safe to re-run: uses INSERT IGNORE, duplicates are skipped.
// ================================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

// ----------------------------------------------------------------
// Table definitions, in insert order.
// "columns" = columns we insert into MySQL (must be a subset of what
// exists in Supabase). Generated columns like is_low_stock are
// omitted since MySQL computes them.
// "deferredFKs" = columns skipped on first pass + updated in pass 2
// to break FK cycles (e.g. departments.manager_id -> employees).
// ----------------------------------------------------------------
const TABLES = [
    { name: 'users', pk: 'user_id',
      columns: ['user_id', 'email', 'password_hash', 'created_at'] },

    { name: 'animal_zones', pk: 'zone_id',
      columns: ['zone_id', 'zone_name', 'location_description'] },

    // Insert departments first without manager_id (cycle with employees)
    { name: 'departments', pk: 'dept_id',
      columns: ['dept_id', 'dept_name'],
      deferredFKs: ['manager_id'] },

    { name: 'employees', pk: 'employee_id',
      columns: ['employee_id', 'first_name', 'middle_name', 'last_name',
                'contact_info', 'pay_rate_cents', 'shift_timeframe',
                'dept_id', 'user_id', 'role'],
      deferredFKs: ['manager_id'] },

    { name: 'vets', pk: 'employee_id',
      columns: ['employee_id', 'license_no', 'specialty'] },

    { name: 'animal_caretakers', pk: 'employee_id',
      columns: ['employee_id', 'specialization_species'],
      deferredFKs: ['assigned_animal_id'] },

    { name: 'managers', pk: 'employee_id',
      columns: ['employee_id', 'office_location'] },

    { name: 'health_records', pk: 'record_id',
      columns: ['record_id', 'vet_id'] },

    { name: 'animals', pk: 'animal_id',
      columns: ['animal_id', 'name', 'species_common_name', 'species_binomial',
                'age', 'zone_id', 'health_record_id'] },

    { name: 'medical_history', pk: 'history_id',
      columns: ['history_id', 'record_id', 'injury', 'disease',
                'date_treated', 'animal_age_at_treatment'] },

    { name: 'customers', pk: 'customer_id',
      columns: ['customer_id', 'user_id', 'first_name', 'last_name', 'email',
                'phone', 'age', 'gender', 'is_member', 'address', 'city',
                'state', 'zip_code', 'date_of_birth', 'membership_type',
                'membership_start', 'membership_end',
                'billing_street', 'billing_city', 'billing_state',
                'billing_zip', 'billing_phone',
                'shipping_street', 'shipping_city', 'shipping_state',
                'shipping_zip', 'shipping_phone', 'shipping_same_as_billing',
                'created_at'] },

    { name: 'venues', pk: 'venue_id',
      columns: ['venue_id', 'venue_name', 'location', 'capacity'] },

    { name: 'events', pk: 'event_id',
      columns: ['event_id', 'title', 'description', 'event_date',
                'start_time', 'end_time', 'venue_id', 'max_capacity',
                'actual_attendance', 'ticket_price_cents', 'tickets_sold'] },

    { name: 'donations', pk: 'donation_id',
      columns: ['donation_id', 'donor_name', 'amount_cents',
                'donation_date', 'customer_id'] },

    { name: 'transactions', pk: 'transaction_id',
      columns: ['transaction_id', 'transaction_date', 'total_amount_cents',
                'donation_id', 'customer_id', 'guest_email', 'is_donation'] },

    { name: 'tickets', pk: 'ticket_id',
      columns: ['ticket_id', 'customer_id', 'type', 'event_id',
                'price_cents', 'transaction_id'] },

    { name: 'shops', pk: 'shop_id',
      columns: ['shop_id', 'name', 'type'] },

    { name: 'inventory', pk: 'item_id',
      // is_low_stock is GENERATED in MySQL, don't insert it
      columns: ['item_id', 'outlet_id', 'item_name', 'stock_count',
                'restock_threshold', 'cost_to_restock_cents',
                'category', 'price_cents', 'image_url'] },

    { name: 'shop_items', pk: 'shop_item_id',
      columns: ['shop_item_id', 'shop_id', 'item_id', 'sale_price_cents'] },

    { name: 'sale_items', pk: 'sale_item_id',
      columns: ['sale_item_id', 'transaction_id', 'item_id',
                'quantity', 'price_at_sale_cents'] },

    { name: 'receipts', pk: 'receipt_id',
      columns: ['receipt_id', 'transaction_id', 'email', 'customer_name',
                'line_items', 'subtotal_cents', 'tax_cents', 'total_cents',
                'is_donation', 'donation_fund', 'created_at'] },

    { name: 'operational_supplies', pk: 'supply_id',
      columns: ['supply_id', 'department_id', 'item_name', 'stock_count',
                'restock_threshold', 'cost_to_restock_cents', 'category',
                'description'] },

    { name: 'supply_requests', pk: 'request_id',
      columns: ['request_id', 'requested_by', 'supply_type', 'item_id',
                'item_name', 'requested_quantity', 'reason', 'status',
                'reviewed_by', 'created_at', 'reviewed_at'] },

    { name: 'event_assignments', pk: 'assignment_id',
      columns: ['assignment_id', 'event_id', 'employee_id', 'animal_id'] },

    { name: 'caretaker_animal_assignments', pk: 'id',
      columns: ['id', 'caretaker_id', 'animal_id', 'assigned_at'] },

    { name: 'vet_animal_assignments', pk: 'id',
      columns: ['id', 'vet_id', 'animal_id', 'assigned_at'] },

    { name: 'activity_log', pk: 'log_id',
      columns: ['log_id', 'action_type', 'description', 'performed_by',
                'target_type', 'target_id', 'metadata', 'created_at'] },
];

// ----------------------------------------------------------------
// Supabase REST fetch with pagination (Supabase caps at 1000 rows/page)
// ----------------------------------------------------------------
async function fetchTable(name) {
    const all = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/${name}?select=*`;
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Range: `${from}-${from + pageSize - 1}`,
                'Range-Unit': 'items',
                Prefer: 'count=exact',
            },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GET ${name} → ${res.status}: ${body.slice(0, 200)}`);
        }
        const page = await res.json();
        all.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

// Convert a Supabase/PG value into a MySQL-safe value
function toMysqlValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    // JSON / arrays → string the MySQL JSON column will parse
    if (typeof v === 'object') return JSON.stringify(v);
    // Trim the "Z" off ISO datetimes so MySQL treats them as local
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        return v.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/\+\d\d:\d\d$/, '').slice(0, 19);
    }
    return v;
}

// Columns that reference Supabase's UUID-based auth.users. Our MySQL users
// table uses INT IDs, so there's no valid mapping — NULL them out on import.
// Users will re-register via the new MySQL auth flow.
const UUID_AUTH_COLUMNS = {
    customers: ['user_id'],
    employees: ['user_id'],
};

async function insertRows(conn, table, rows) {
    const { name, columns } = table;
    if (rows.length === 0) return 0;
    const nullOut = UUID_AUTH_COLUMNS[name] || [];
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT IGNORE INTO \`${name}\` (${columns.map(c => `\`${c}\``).join(', ')})
                 VALUES (${placeholders})`;
    let inserted = 0;
    for (const row of rows) {
        const values = columns.map(c => nullOut.includes(c) ? null : toMysqlValue(row[c]));
        try {
            const [result] = await conn.query(sql, values);
            if (result.affectedRows > 0) inserted++;
        } catch (err) {
            console.error(`    ❌ ${name} row ${row[table.pk]}: ${err.message}`);
        }
    }
    return inserted;
}

async function updateDeferredFKs(conn, table, rows) {
    if (!table.deferredFKs || rows.length === 0) return 0;
    let updated = 0;
    for (const fkCol of table.deferredFKs) {
        for (const row of rows) {
            if (row[fkCol] == null) continue;
            try {
                const [result] = await conn.query(
                    `UPDATE \`${table.name}\` SET \`${fkCol}\` = ? WHERE \`${table.pk}\` = ?`,
                    [row[fkCol], row[table.pk]]
                );
                if (result.affectedRows > 0) updated++;
            } catch (err) {
                console.error(`    ❌ ${table.name}.${fkCol} id=${row[table.pk]}: ${err.message}`);
            }
        }
    }
    return updated;
}

// ----------------------------------------------------------------
async function main() {
    console.log(`Source: ${SUPABASE_URL}`);
    console.log(`Target: mysql://${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}\n`);

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'coog_zoo',
        multipleStatements: false,
        dateStrings: true,
    });

    console.log('→ Disabling FK checks for bulk load');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Cache every table's rows for pass 2
    const cache = new Map();
    let grandTotal = 0;

    console.log('\n=== PASS 1: fetch + insert (without deferred FKs) ===');
    for (const table of TABLES) {
        try {
            const rows = await fetchTable(table.name);
            cache.set(table.name, rows);
            const inserted = await insertRows(conn, table, rows);
            grandTotal += inserted;
            const tag = inserted === rows.length ? '✅' : (inserted === 0 && rows.length === 0 ? '·' : '⚠️');
            console.log(`  ${tag} ${table.name.padEnd(32)} fetched=${String(rows.length).padStart(4)}  inserted=${String(inserted).padStart(4)}`);
        } catch (err) {
            console.error(`  ❌ ${table.name}: ${err.message}`);
        }
    }

    console.log('\n=== PASS 2: backfill deferred foreign keys ===');
    for (const table of TABLES) {
        if (!table.deferredFKs) continue;
        const rows = cache.get(table.name) || [];
        const updated = await updateDeferredFKs(conn, table, rows);
        console.log(`  ↪ ${table.name}.${table.deferredFKs.join(',')}  updated=${updated}`);
    }

    console.log('\n→ Re-enabling FK checks');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Bump each table's auto-increment so new rows don't collide with imported IDs
    console.log('\n=== PASS 3: advance AUTO_INCREMENT counters ===');
    for (const table of TABLES) {
        try {
            const [[{ m }]] = await conn.query(
                `SELECT COALESCE(MAX(\`${table.pk}\`), 0) + 1 AS m FROM \`${table.name}\``
            );
            await conn.query(`ALTER TABLE \`${table.name}\` AUTO_INCREMENT = ?`, [m]);
        } catch (err) {
            // Some PKs are composite or non-numeric — skip silently
        }
    }
    console.log('  ✅ done');

    await conn.end();
    console.log(`\n✨ Migration complete. Total rows inserted: ${grandTotal}\n`);
}

main().catch(err => {
    console.error('\nFatal:', err);
    process.exit(1);
});

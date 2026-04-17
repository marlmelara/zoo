// ================================================================
// Ship the local coog_zoo database up to Azure MySQL Flexible Server.
//
// 1. Loads schema.sql on Azure (creates coog_zoo + 28 tables)
// 2. Copies every row from local MySQL → Azure, preserving IDs
// 3. Advances each table's AUTO_INCREMENT counter
//
// Uses Node.js mysql2 so we sidestep the MySQL 9 client dropping
// the mysql_native_password plugin that Azure Flexible Server uses.
// ================================================================

import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const AZURE = {
    host: process.env.AZURE_DB_HOST || 'coog-zoo-marlon.mysql.database.azure.com',
    port: 3306,
    user: process.env.AZURE_DB_USER || 'zooadmin',
    password: process.env.AZURE_DB_PASSWORD || 'Spurs@2014',
    ssl: { rejectUnauthorized: true },
    multipleStatements: true,
    // mysql2 supports mysql_native_password natively
};

const LOCAL = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Spurs@2014',
    database: 'coog_zoo',
};

// Tables in FK-safe order. Same as migrate-from-supabase.mjs.
const TABLES = [
    'users', 'animal_zones', 'departments', 'employees', 'vets',
    'animal_caretakers', 'managers', 'health_records', 'animals',
    'medical_history', 'customers', 'venues', 'events', 'donations',
    'transactions', 'tickets', 'shops', 'inventory', 'shop_items',
    'sale_items', 'receipts', 'membership_plans', 'operational_supplies',
    'supply_requests', 'event_assignments', 'caretaker_animal_assignments',
    'vet_animal_assignments', 'activity_log',
];

// Primary key columns (for ALTER TABLE AUTO_INCREMENT pass 3)
const PKS = {
    users: 'user_id', animal_zones: 'zone_id', departments: 'dept_id',
    employees: 'employee_id', vets: 'employee_id',
    animal_caretakers: 'employee_id', managers: 'employee_id',
    health_records: 'record_id', animals: 'animal_id',
    medical_history: 'history_id', customers: 'customer_id',
    venues: 'venue_id', events: 'event_id', donations: 'donation_id',
    transactions: 'transaction_id', tickets: 'ticket_id',
    shops: 'shop_id', inventory: 'item_id', shop_items: 'shop_item_id',
    sale_items: 'sale_item_id', receipts: 'receipt_id',
    membership_plans: 'plan_id', operational_supplies: 'supply_id',
    supply_requests: 'request_id', event_assignments: 'assignment_id',
    caretaker_animal_assignments: 'id',
    vet_animal_assignments: 'id', activity_log: 'log_id',
};

// Describe table on Azure, return column names excluding GENERATED columns
async function nonGeneratedColumns(conn, table) {
    const [rows] = await conn.query(
        `SELECT COLUMN_NAME, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = 'coog_zoo' AND TABLE_NAME = ?`,
        [table]
    );
    return rows
        .filter(r => !/GENERATED/i.test(r.EXTRA))
        .map(r => r.COLUMN_NAME);
}

// Chunk array into batches of N
function chunks(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function main() {
    console.log(`→ Source: mysql://${LOCAL.user}@${LOCAL.host}/${LOCAL.database}`);
    console.log(`→ Target: mysql://${AZURE.user}@${AZURE.host}  (SSL)\n`);

    // ── Step 1: connect to Azure (server-level, no db yet) ───────
    console.log('[1/4] Connecting to Azure...');
    const azure = await mysql.createConnection(AZURE);
    const [[azInfo]] = await azure.query('SELECT VERSION() AS v, @@hostname AS h');
    console.log(`      ✅ Azure ${azInfo.v} @ ${azInfo.h}`);

    // ── Step 2: load schema.sql ──────────────────────────────────
    console.log('\n[2/4] Loading schema.sql on Azure...');
    const schemaSql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    // multipleStatements=true lets us run the whole file in one query
    await azure.query(schemaSql);
    await azure.query('USE coog_zoo');
    const [azTables] = await azure.query(
        `SELECT COUNT(*) AS n FROM information_schema.tables
         WHERE TABLE_SCHEMA = 'coog_zoo' AND TABLE_TYPE = 'BASE TABLE'`
    );
    console.log(`      ✅ ${azTables[0].n} tables live on Azure`);

    // ── Step 3: copy data local → Azure ──────────────────────────
    console.log('\n[3/4] Copying rows local → Azure...');
    const local = await mysql.createConnection(LOCAL);
    await azure.query('SET FOREIGN_KEY_CHECKS = 0');

    let grandTotal = 0;
    for (const table of TABLES) {
        const cols = await nonGeneratedColumns(azure, table);
        if (cols.length === 0) {
            console.log(`  ·  ${table.padEnd(32)} skip (not in schema)`);
            continue;
        }
        const selectCols = cols.map(c => `\`${c}\``).join(', ');
        const [rows] = await local.query(
            `SELECT ${selectCols} FROM \`${table}\``
        );
        if (rows.length === 0) {
            console.log(`  ·  ${table.padEnd(32)} 0 rows`);
            continue;
        }

        const insertCols = cols.map(c => `\`${c}\``).join(', ');
        const placeholderRow = `(${cols.map(() => '?').join(',')})`;
        let inserted = 0;
        for (const batch of chunks(rows, 100)) {
            const placeholders = batch.map(() => placeholderRow).join(',');
            const values = batch.flatMap(r => cols.map(c => r[c] ?? null));
            try {
                const [result] = await azure.query(
                    `INSERT IGNORE INTO \`${table}\` (${insertCols}) VALUES ${placeholders}`,
                    values
                );
                inserted += result.affectedRows;
            } catch (err) {
                console.error(`     ❌ batch failed in ${table}: ${err.message}`);
            }
        }
        grandTotal += inserted;
        const tag = inserted === rows.length ? '✅' : '⚠️ ';
        console.log(`  ${tag} ${table.padEnd(32)} local=${String(rows.length).padStart(4)}  → azure=${String(inserted).padStart(4)}`);
    }

    await azure.query('SET FOREIGN_KEY_CHECKS = 1');
    await local.end();

    // ── Step 4: bump AUTO_INCREMENT counters ─────────────────────
    console.log('\n[4/4] Advancing AUTO_INCREMENT counters...');
    for (const table of TABLES) {
        const pk = PKS[table];
        if (!pk) continue;
        try {
            const [[{ m }]] = await azure.query(
                `SELECT COALESCE(MAX(\`${pk}\`), 0) + 1 AS m FROM \`${table}\``
            );
            await azure.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ?`, [m]);
        } catch { /* PK may be composite — skip silently */ }
    }
    console.log('      ✅ done');

    await azure.end();
    console.log(`\n✨ Azure now holds ${grandTotal} rows across ${TABLES.length} tables.`);
}

main().catch(err => {
    console.error('\nFATAL:', err);
    process.exit(1);
});

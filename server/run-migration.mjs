// ============================================================
// Apply a .sql migration file against the DB configured in
// server/.env. Handles DELIMITER blocks (needed for triggers).
//
// Usage:
//   cd server
//   node run-migration.mjs migrations/0010_triggers_soft_delete_hours.sql
// ============================================================
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { splitStatements, retargetDatabase } from './lib/sql-file.js';

const file = process.argv[2];
if (!file) {
    console.error('Usage: node run-migration.mjs <path-to-sql-file>');
    process.exit(1);
}
const fullPath = path.resolve(file);
if (!fs.existsSync(fullPath)) {
    console.error(`Migration file not found: ${fullPath}`);
    process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');

const dbName = process.env.DB_NAME || 'coog_zoo';
// Migrations hardcode `USE coog_zoo;`. Honour DB_NAME instead, so pointing
// this script at a scratch database can't silently write to the real one.
const statements = retargetDatabase(splitStatements(sql), dbName);
console.log(`→ Parsed ${statements.length} statements from ${path.basename(fullPath)} (target: ${dbName})`);

// ── Connect and run ─────────────────────────────────────────
const isAzure = (process.env.DB_HOST || '').includes('database.azure.com');
const useSSL  = isAzure || process.env.DB_SSL === 'true';

const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    ssl:      useSSL ? { rejectUnauthorized: true } : undefined,
    multipleStatements: false,
});

let failed = 0;
for (let i = 0; i < statements.length; i++) {
    const stmt  = statements[i];
    const label = stmt.replace(/\s+/g, ' ').slice(0, 80);
    try {
        await conn.query(stmt);
        console.log(`  ✓ [${i + 1}/${statements.length}] ${label}`);
    } catch (err) {
        // Tolerate "already exists" so this migration is re-runnable.
        const skippable = /Duplicate|already exists|Duplicate key name/i.test(err.message);
        if (skippable) {
            console.log(`  ⊘ [${i + 1}/${statements.length}] skipped (already applied): ${label}`);
        } else {
            console.error(`  ✗ [${i + 1}/${statements.length}] FAILED: ${label}`);
            console.error(`       ${err.message}`);
            failed++;
        }
    }
}

await conn.end();

if (failed > 0) {
    console.error(`\nDone with ${failed} failure(s).`);
    process.exit(1);
}
console.log('\n✔ Migration applied successfully.');

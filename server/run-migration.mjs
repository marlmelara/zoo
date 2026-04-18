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

// ── DELIMITER-aware statement splitter ──────────────────────
function splitStatements(text) {
    const out = [];
    let delimiter = ';';
    let current = '';
    const lines = text.split('\n');
    for (let rawLine of lines) {
        const line = rawLine;
        const trimmed = line.trim();
        // Skip full-line comments (-- ...) / blank lines when splitting
        if (/^DELIMITER\s+\S+/i.test(trimmed)) {
            const flush = current.trim();
            if (flush) out.push(flush);
            current = '';
            delimiter = trimmed.replace(/^DELIMITER\s+/i, '').trim();
            continue;
        }
        current += line + '\n';
        // Check if the current buffer (minus trailing whitespace) ends with
        // the active delimiter.
        const end = current.trimEnd();
        if (end.endsWith(delimiter)) {
            const stmt = end.slice(0, -delimiter.length).trim();
            if (stmt) out.push(stmt);
            current = '';
        }
    }
    const leftover = current.trim();
    if (leftover) out.push(leftover);
    return out;
}

const statements = splitStatements(sql);
console.log(`→ Parsed ${statements.length} statements from ${path.basename(fullPath)}`);

// ── Connect and run ─────────────────────────────────────────
const isAzure = (process.env.DB_HOST || '').includes('database.azure.com');
const useSSL  = isAzure || process.env.DB_SSL === 'true';

const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'coog_zoo',
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

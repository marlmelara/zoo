// ============================================================
// Build and tear down the throwaway test database.
//
// The schema this project ships is split in two: `server/schema.sql`
// (tables as first created) and twenty `server/migrations/*.sql`
// files applied on top. Tests load both, in that order, so what they
// exercise is the schema production actually runs — triggers,
// generated columns, CHECK constraints and all.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

import { splitStatements, retargetDatabase } from '../../server/lib/sql-file.js';
import { testDbConfig } from './config.js';

const execFileAsync = promisify(execFile);

const REPO_ROOT   = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SERVER_DIR  = path.join(REPO_ROOT, 'server');
const SCHEMA_SQL  = path.join(SERVER_DIR, 'schema.sql');
const MIGRATIONS  = path.join(SERVER_DIR, 'migrations');

const quiet = process.env.TEST_VERBOSE ? console.log : () => {};

// A connection with no database selected — used to CREATE/DROP it.
async function serverConnection() {
    const { database, ...rest } = testDbConfig();
    void database;
    try {
        return await mysql.createConnection({ ...rest, multipleStatements: false });
    } catch (err) {
        throw new Error(
            `Cannot reach a test MySQL server at ${rest.user}@${rest.host}:${rest.port} ` +
            `(${err.code || err.message}).\n` +
            'Point the suite at one with TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / ' +
            'TEST_DB_PASSWORD — see tests/helpers/config.js for the account it needs.\n' +
            'The README\'s Docker setup section has a one-liner for a local MySQL 8.'
        );
    }
}

// A connection bound to the test database. Callers own closing it.
export async function connect() {
    return mysql.createConnection({ ...testDbConfig(), multipleStatements: false });
}

export async function dropTestDatabase() {
    const { database } = testDbConfig();
    const conn = await serverConnection();
    try {
        await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    } finally {
        await conn.end();
    }
}

async function createEmptyDatabase() {
    const { database } = testDbConfig();
    const conn = await serverConnection();
    try {
        await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await conn.query(
            `CREATE DATABASE \`${database}\` ` +
            'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
        );
    } finally {
        await conn.end();
    }
}

async function loadSchema() {
    const { database } = testDbConfig();
    const sql = fs.readFileSync(SCHEMA_SQL, 'utf8');
    const statements = retargetDatabase(splitStatements(sql), database);
    const conn = await connect();
    try {
        for (const stmt of statements) {
            try {
                await conn.query(stmt);
            } catch (err) {
                throw new Error(
                    `schema.sql statement failed: ${stmt.replace(/\s+/g, ' ').slice(0, 120)}\n  ${err.message}`
                );
            }
        }
    } finally {
        await conn.end();
    }
    quiet(`  schema.sql → ${statements.length} statements`);
}

// Run every migration through the real `server/run-migration.mjs`,
// the same script a developer would use by hand. Spawned from the
// repo root (which has no .env) with the test DB_* passed explicitly,
// so it cannot pick up server/.env and reach production.
async function runMigrations() {
    const cfg = testDbConfig();
    const files = fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
    const env = {
        ...process.env,
        DB_HOST: cfg.host,
        DB_PORT: String(cfg.port),
        DB_USER: cfg.user,
        DB_PASSWORD: cfg.password,
        DB_NAME: cfg.database,
        DB_SSL: 'false',
    };
    for (const file of files) {
        const { stdout } = await execFileAsync(
            process.execPath,
            [path.join(SERVER_DIR, 'run-migration.mjs'), path.join(MIGRATIONS, file)],
            { cwd: REPO_ROOT, env }
        ).catch(err => {
            throw new Error(
                `Migration ${file} failed:\n${err.stdout || ''}${err.stderr || ''}`
            );
        });
        quiet(`  ${file} ok`);
        void stdout;
    }
    return files.length;
}

export async function provisionTestDatabase() {
    const { database, host, port } = testDbConfig();
    const started = Date.now();
    await createEmptyDatabase();
    await loadSchema();
    const migrations = await runMigrations();
    console.log(
        `[tests] provisioned ${database} on ${host}:${port} ` +
        `(schema + ${migrations} migrations) in ${Date.now() - started}ms`
    );
}

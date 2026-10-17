// ============================================================
// node --test global setup: build the throwaway database once,
// before any test file runs, and drop it afterwards.
//
// Set TEST_KEEP_DB=1 to leave it behind for post-mortem poking.
// ============================================================
import { provisionTestDatabase, dropTestDatabase } from './helpers/database.js';

export async function globalSetup() {
    await provisionTestDatabase();
}

export async function globalTeardown() {
    if (process.env.TEST_KEEP_DB) {
        console.log('[tests] TEST_KEEP_DB set — leaving the test database in place');
        return;
    }
    await dropTestDatabase();
}

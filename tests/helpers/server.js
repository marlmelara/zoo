// ============================================================
// Boot the real API in-process and hand back a base URL.
//
// This is deliberately the same `dispatch()` that `server/index.js`
// and `api/handler.js` both wrap, listening on an ephemeral port —
// so the concurrency tests go over real HTTP, through the real
// router, into the real connection pool. Anything less and the race
// being tested wouldn't be the race production runs.
// ============================================================
import http from 'node:http';
import { applyServerEnv } from './config.js';

export async function startTestServer() {
    applyServerEnv();

    // Dynamic import: server/db.js builds its pool from process.env
    // at module-evaluation time, so the env above has to be in place
    // first. A static import would be hoisted above it.
    const { dispatch } = await import('../../server/app.js');
    const { default: pool } = await import('../../server/db.js');

    // dispatch() logs a line per request; 300+ of them bury the test
    // output. TEST_VERBOSE=1 brings them back.
    const realLog = console.log;
    if (!process.env.TEST_VERBOSE) {
        console.log = (...args) =>
            String(args[0]).startsWith('[dispatch]') ? undefined : realLog(...args);
    }

    const server = http.createServer((req, res) => dispatch(req, res));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    return {
        baseUrl: `http://127.0.0.1:${port}`,

        async post(pathname, body) {
            const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            let json = null;
            try { json = await res.json(); } catch { /* empty body */ }
            return { status: res.status, body: json };
        },

        async close() {
            console.log = realLog;
            await new Promise((resolve) => server.close(resolve));
            await pool.end();
        },
    };
}

// ================================================================
// Shared request dispatch — used by both local `server/index.js`
// and the Vercel serverless catch-all at `api/[...slug].js`.
//
// Exposes:
//   - MOUNTS: the route mount table
//   - dispatch(req, res): handles one request end-to-end
// ================================================================

import 'dotenv/config';
import { parse } from 'url';

import authRoutes        from './routes/auth.js';
import customerRoutes    from './routes/customers.js';
import ticketRoutes      from './routes/tickets.js';
import eventRoutes       from './routes/events.js';
import donationRoutes    from './routes/donations.js';
import transactionRoutes from './routes/transactions.js';
import animalRoutes      from './routes/animals.js';
import employeeRoutes    from './routes/employees.js';
import inventoryRoutes   from './routes/inventory.js';
import supplyRoutes      from './routes/supplies.js';
import activityRoutes    from './routes/activityLog.js';
import venueRoutes       from './routes/venues.js';
import dashboardRoutes   from './routes/dashboard.js';

export const MOUNTS = [
    { prefix: '/api/auth',         router: authRoutes },
    { prefix: '/api/customers',    router: customerRoutes },
    { prefix: '/api/tickets',      router: ticketRoutes },
    { prefix: '/api/events',       router: eventRoutes },
    { prefix: '/api/donations',    router: donationRoutes },
    { prefix: '/api/transactions', router: transactionRoutes },
    { prefix: '/api/animals',      router: animalRoutes },
    { prefix: '/api/employees',    router: employeeRoutes },
    { prefix: '/api/inventory',    router: inventoryRoutes },
    { prefix: '/api/supplies',     router: supplyRoutes },
    { prefix: '/api/activity-log', router: activityRoutes },
    { prefix: '/api/venues',       router: venueRoutes },
    { prefix: '/api/dashboard',    router: dashboardRoutes },
];

// ── Body reader — accepts whatever Vercel / Node hands us ─────
// Returns an object no matter what; never rejects.
export function readBody(req) {
    // Vercel's Node runtime sometimes pre-populates req.body
    if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
            return Promise.resolve(req.body);
        }
        if (typeof req.body === 'string') {
            try { return Promise.resolve(JSON.parse(req.body)); }
            catch { return Promise.resolve({}); }
        }
        if (Buffer.isBuffer(req.body)) {
            try { return Promise.resolve(JSON.parse(req.body.toString('utf8'))); }
            catch { return Promise.resolve({}); }
        }
    }
    // Otherwise read the raw IncomingMessage stream
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve({});
            try { resolve(JSON.parse(raw)); }
            catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

// ── Augment req/res with Express-like helpers ────────────────
export function augmentReqRes(req, res) {
    res.json = (data) => {
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    };

    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
}

// ── Middleware chain runner ──────────────────────────────────
export async function runHandlers(handlers, req, res) {
    for (let i = 0; i < handlers.length; i++) {
        let nextCalled = false;
        let nextError  = null;

        await new Promise((resolve, reject) => {
            const next = (err) => {
                nextCalled = true;
                nextError  = err || null;
                resolve();
            };
            try {
                const result = handlers[i](req, res, next);
                if (result && typeof result.then === 'function') {
                    result
                        .then(() => { if (!nextCalled) resolve(); })
                        .catch(reject);
                } else {
                    if (!nextCalled) resolve();
                }
            } catch (err) {
                reject(err);
            }
        });

        if (nextError) throw nextError;
        if (!nextCalled) break;
    }
}

// ── The big one: dispatch a single request through the MOUNTS ─
// Top-level try/catch guarantees we always return a JSON response —
// never let Vercel's default HTML error page surface to the client.
export async function dispatch(req, res) {
    // Augment first so error paths below can use res.json / res.status
    augmentReqRes(req, res);

    try {
        const { pathname, query } = parse(req.url, true);
        req.query = query;
        req.body  = await readBody(req);

        console.log('[dispatch]', req.method, pathname,
                    'body-keys:', Object.keys(req.body || {}).length);

        // Health check (before MOUNT loop)
        if (req.method === 'GET' && pathname === '/api/health') {
            return res.json({ status: 'ok' });
        }

        for (const { prefix, router } of MOUNTS) {
            if (!pathname.startsWith(prefix)) continue;

            const subPath = pathname.slice(prefix.length) || '/';
            const match   = router.match(req.method, subPath);

            if (match) {
                req.params = match.params;
                await runHandlers(match.handlers, req, res);
                return;
            }
        }

        res.statusCode = 404;
        return res.json({ error: `Route ${pathname} not found.` });
    } catch (err) {
        console.error('[dispatch-error]', err);
        if (!res.headersSent) {
            res.statusCode = 500;
            return res.json({ error: err.message || 'Internal server error' });
        }
    }
}

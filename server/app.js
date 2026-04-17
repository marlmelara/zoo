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

// ── Body reader ──────────────────────────────────────────────
export function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString();
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
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
// Handles: URL parse, body parse, augment, health check, route
// match, 404 + 500. Body parsing is skipped if req.body is
// already an object (e.g. Vercel pre-parsed it).
export async function dispatch(req, res) {
    const { pathname, query } = parse(req.url, true);
    req.query = query;

    // Parse body only if not already parsed by the host runtime
    const bodyIsPreparsed =
        req.body &&
        typeof req.body === 'object' &&
        !Buffer.isBuffer(req.body) &&
        !(req.body.on && typeof req.body.on === 'function');
    if (!bodyIsPreparsed) {
        req.body = await readBody(req);
    }

    augmentReqRes(req, res);

    // Health check (before MOUNT loop)
    if (req.method === 'GET' && pathname === '/api/health') {
        return res.json({ status: 'ok' });
    }

    try {
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
        res.json({ error: `Route ${pathname} not found.` });
    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.json({ error: err.message || 'Internal server error' });
        }
    }
}

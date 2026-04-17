import 'dotenv/config';
import http from 'http';
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

// ── Allowed origins ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:4173',
];

// ── Route mount table ────────────────────────────────────────
const MOUNTS = [
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
function readBody(req) {
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
function augmentReqRes(req, res) {
    // res.json(data)
    res.json = (data) => {
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    };

    // res.status(code)  — returns res so you can chain .json()
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
}

// ── Middleware chain runner ──────────────────────────────────
async function runHandlers(handlers, req, res) {
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
        if (!nextCalled) break;  // handler sent response, stop chain
    }
}

// ── HTTP server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    // ── CORS ────────────────────────────────────────────────
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // ── Preflight ────────────────────────────────────────────
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    // ── Parse URL & body ─────────────────────────────────────
    const { pathname, query } = parse(req.url, true);
    req.query = query;
    req.body  = await readBody(req);

    augmentReqRes(req, res);

    // ── Health check (no router needed) ──────────────────────
    if (req.method === 'GET' && pathname === '/api/health') {
        return res.json({ status: 'ok' });
    }

    // ── Route matching ────────────────────────────────────────
    try {
        for (const { prefix, router } of MOUNTS) {
            if (!pathname.startsWith(prefix)) continue;

            // Strip the mount prefix so the router sees a relative path
            const subPath = pathname.slice(prefix.length) || '/';
            const match   = router.match(req.method, subPath);

            if (match) {
                req.params = match.params;
                await runHandlers(match.handlers, req, res);
                return;
            }
        }

        // ── 404 ────────────────────────────────────────────────
        res.statusCode = 404;
        res.json({ error: `Route ${pathname} not found.` });

    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.json({ error: err.message || 'Internal server error' });
        }
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Zoo API server running on http://localhost:${PORT}`);
});

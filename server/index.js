// ================================================================
// Local development HTTP server.
//
// In production, the same dispatch logic runs inside Vercel's
// serverless catch-all at `api/[...slug].js`. This file just wraps
// it in a plain Node `http.createServer` for `npm run dev`.
// ================================================================

import 'dotenv/config';
import http from 'http';
import { dispatch } from './app.js';

// Origins allowed to hit the local dev server from the browser
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:4173',
];

const server = http.createServer(async (req, res) => {
    // CORS (local dev only — on Vercel frontend + API share an origin)
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    return dispatch(req, res);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Zoo API server running on http://localhost:${PORT}`);
});

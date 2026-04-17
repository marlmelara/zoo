// ================================================================
// Vercel serverless catch-all for /api/*
//
// Every incoming request like /api/events, /api/auth/login, etc.
// lands here. We delegate to the shared dispatch() that both local
// dev and production share.
//
// `export const config.api.bodyParser = false` tells Vercel NOT to
// auto-consume the request body — our dispatch() reads it via the
// raw stream so it works identically to local dev.
// ================================================================

import { dispatch } from '../server/app.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    return dispatch(req, res);
}

// ================================================================
// Vercel serverless catch-all for /api/*
//
// Every incoming request like /api/events, /api/auth/login, etc.
// lands here. We delegate to the shared dispatch() that both local
// dev and production share.
//
// Our readBody() handles every shape Vercel's @vercel/node runtime
// might hand us (pre-parsed object, string, Buffer, or raw stream),
// so we don't need the bodyParser config export.
// ================================================================

import { dispatch } from '../server/app.js';

export default async function handler(req, res) {
    return dispatch(req, res);
}

// Diagnostic endpoint — zero dependencies, no DB.
// If POST /api/ping works and POST /api/auth/login doesn't, we know
// the problem is in the catch-all + server/ import chain, not Vercel
// itself. If POST /api/ping also fails, Vercel is rejecting POST.

export default function handler(req, res) {
    res.status(200).json({
        ok: true,
        method: req.method,
        url: req.url,
        bodyType: typeof req.body,
        bodyKeys: req.body && typeof req.body === 'object'
            ? Object.keys(req.body)
            : null,
        headers: {
            'content-type': req.headers['content-type'] || null,
        },
        runtime: 'vercel-node',
        node: process.version,
    });
}

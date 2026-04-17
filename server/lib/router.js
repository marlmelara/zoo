/**
 * Lightweight Router — drop-in replacement for Express Router.
 * Uses only Node.js built-ins (no express/cors dependency).
 *
 * Usage (identical to Express):
 *   import { Router } from '../lib/router.js';
 *   const router = Router();
 *   router.get('/path', handler);
 *   router.post('/path/:id', handler);
 *   router.get('/stats', requireRole('admin'), handler);  // array middleware flattens
 *   export default router;
 */
export function Router() {
    const routes = [];

    function register(method, path, handlers) {
        // Flatten nested middleware arrays (e.g. requireRole returns [authFn, roleFn])
        // and discard any non-function slots so handlers[i](req, res, next) never
        // throws "handlers[i] is not a function".
        const flatHandlers = handlers
            .flat(Infinity)
            .filter(h => typeof h === 'function');

        // Build the URL-match regex.
        // 1. Escape regex-special chars in the literal parts of the path
        // 2. Turn each `:param` segment into an `([^/]+)` capture group
        const keys = [];
        const pattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // escape regex specials
            .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => {
                keys.push(key);
                return '([^/]+)';
            });
        const regex = new RegExp(`^${pattern}$`);
        routes.push({ method: method.toUpperCase(), regex, keys, handlers: flatHandlers });
    }

    return {
        get:    (path, ...handlers) => register('GET',    path, handlers),
        post:   (path, ...handlers) => register('POST',   path, handlers),
        patch:  (path, ...handlers) => register('PATCH',  path, handlers),
        put:    (path, ...handlers) => register('PUT',    path, handlers),
        delete: (path, ...handlers) => register('DELETE', path, handlers),

        /**
         * Try to match a request against this router's routes.
         * Returns { handlers, params } on match, or null.
         */
        match(method, pathname) {
            for (const route of routes) {
                if (route.method !== method.toUpperCase()) continue;
                const m = pathname.match(route.regex);
                if (m) {
                    const params = {};
                    route.keys.forEach((k, i) => {
                        params[k] = decodeURIComponent(m[i + 1]);
                    });
                    return { handlers: route.handlers, params };
                }
            }
            return null;
        },
    };
}

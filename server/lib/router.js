/**
 * Lightweight Router — drop-in replacement for Express Router.
 * Uses only Node.js built-ins (no express/cors dependency).
 *
 * Usage (identical to Express):
 *   import { Router } from '../lib/router.js';
 *   const router = Router();
 *   router.get('/path', handler);
 *   router.post('/path/:id', handler);
 *   export default router;
 */
export function Router() {
    const routes = [];

    function register(method, path, handlers) {
        const keys = [];
        // Convert :param segments to capture groups
        const pattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // escape regex special chars first
            .replace(/\\:([^/]+)/g, (_, key) => {       // then un-escape and capture :params
                keys.push(key);
                return '([^/]+)';
            });
        const regex = new RegExp(`^${pattern}$`);
        routes.push({ method: method.toUpperCase(), regex, keys, handlers });
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

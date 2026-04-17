/**
 * Thin fetch wrapper that:
 *  - Automatically attaches the JWT from localStorage
 *  - Parses JSON responses
 *  - Throws on non-2xx status codes with the server's error message
 */

const BASE = '/api';

function getToken() {
    return localStorage.getItem('zoo_token');
}

export function setToken(token) {
    localStorage.setItem('zoo_token', token);
}

export function clearToken() {
    localStorage.removeItem('zoo_token');
    localStorage.removeItem('zoo_user');
}

async function request(method, path, body) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Handle empty responses (204 No Content, etc.)
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
    }
    return data;
}

export const api = {
    get:    (path)         => request('GET',    path),
    post:   (path, body)   => request('POST',   path, body),
    patch:  (path, body)   => request('PATCH',  path, body),
    put:    (path, body)   => request('PUT',    path, body),
    delete: (path)         => request('DELETE', path),
};

export default api;

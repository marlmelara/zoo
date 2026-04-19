import api from '../lib/api';

export const logActivity       = (body)     => api.post('/activity-log', body);
export const getRecentActivity = (limit=20) =>
    api.get(`/activity-log?limit=${limit}`);
export const getDepartmentActivity = (deptId, limit=20) =>
    api.get(`/activity-log?limit=${limit}&dept_id=${deptId}`);
export const getMyActivity     = (employeeId, limit=20) =>
    api.get(`/activity-log?limit=${limit}`).then(rows =>
        rows.filter(r => r.performed_by === employeeId)
    );

// Paginated + filterable activity fetch. Returns { rows, total } so the
// caller can render "N of M" + enable/disable Next.
//
//   queryActivity({ limit, offset, deptId, actionTypes, from, to, search })
//
// When `from`/`to` is set, callers typically pass a large `limit` to
// effectively disable pagination within the range.
export async function queryActivity({
    limit       = 25,
    offset      = 0,
    deptId      = null,
    actionTypes = null,   // array of strings
    from        = '',
    to          = '',
    search      = '',
} = {}) {
    const params = new URLSearchParams();
    params.set('limit',  String(limit));
    params.set('offset', String(offset));
    params.set('include_total', '1');
    if (deptId != null) params.set('dept_id', String(deptId));
    if (actionTypes && actionTypes.length) params.set('action_types', actionTypes.join(','));
    if (from)   params.set('from',   from);
    if (to)     params.set('to',     to);
    if (search) params.set('search', search);
    const data = await api.get(`/activity-log?${params.toString()}`);
    // Server returns { rows, total } when include_total=1.
    return data && typeof data === 'object' && 'rows' in data
        ? data
        : { rows: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0 };
}

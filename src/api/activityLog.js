import api from '../lib/api';

export const logActivity       = (body)     => api.post('/activity-log', body);
export const getRecentActivity = (limit=20) =>
    api.get(`/activity-log?limit=${limit}`);
export const getDepartmentActivity = (deptId, limit=20) =>
    api.get(`/activity-log?limit=${limit}`).then(rows =>
        rows.filter(r => r.dept_id === deptId)
    );
export const getMyActivity     = (employeeId, limit=20) =>
    api.get(`/activity-log?limit=${limit}`).then(rows =>
        rows.filter(r => r.performed_by === employeeId)
    );

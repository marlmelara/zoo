import api from '../lib/api';

export const getAllOperationalSupplies    = ()       => api.get('/supplies');
export const getSuppliesByDepartment     = (deptId) =>
    api.get('/supplies').then(rows => rows.filter(r => r.department_id === deptId));

export const createSupplyRequest = (body) => api.post('/supplies/requests', body);
export const getAllSupplyRequests = ()     => api.get('/supplies/requests');
export const getMySupplyRequests  = ()    => api.get('/supplies/requests');

export async function getPendingRequestsForManager(deptId) {
    const rows = await api.get('/supplies/requests');
    return rows.filter(r => r.status === 'pending');
}

export async function reviewSupplyRequest(requestId, reviewerId, status) {
    return api.patch(`/supplies/requests/${requestId}`, { status });
}

// Restocking is handled automatically on the server when a request is approved
export async function restockOperationalSupply(supplyId, quantity) {
    return api.patch(`/supplies/${supplyId}`, { stock_count_delta: quantity });
}

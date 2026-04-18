import api from '../lib/api';

export const submitHoursRequest = (entries) => api.post('/hours', { entries });
export const getMyHoursRequests = ()        => api.get('/hours/my');
export const getAllHoursRequests = (status) =>
    api.get(status ? `/hours?status=${status}` : '/hours');
export const getReviewedByMeHoursRequests = () => api.get('/hours/reviewed-by-me');
export const reviewHoursRequest  = (id, status, notes) =>
    api.patch(`/hours/${id}/review`, { status, notes });

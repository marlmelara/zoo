import api from '../lib/api';

export const getNotifications    = (limit = 50) => api.get(`/notifications?limit=${limit}`);
export const getUnreadCount      = ()           => api.get('/notifications/unread-count');
export const markNotificationRead = (id)        => api.patch(`/notifications/${id}/read`);
export const markAllRead         = ()           => api.patch('/notifications/read-all');
export const dismissNotification = (id)         => api.delete(`/notifications/${id}`);

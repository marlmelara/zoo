import api from '../lib/api';

export const getAdminEvents    = ()     => api.get('/events');
export const getUpcomingEvents = (limit = 6) =>
    api.get('/events').then(events => {
        const today = new Date().toISOString().split('T')[0];
        return events.filter(e => e.event_date >= today).slice(0, limit);
    });
export const getEventById      = (id)   => api.get(`/events/${id}`);
export const createEvent       = (body) => api.post('/events', body);
export const updateEvent       = (id, b) => api.patch(`/events/${id}`, b);
export const deleteEvent       = (id)   => api.delete(`/events/${id}`);

export async function getEventAssignments(eventId) {
    // Returns assignments via the events route (uses JOIN in Express)
    return api.get(`/events/${eventId}`);
}

export async function assignResourceToEvent({ event_id, employee_id = null, animal_id = null }) {
    return api.post('/events/assignments', { event_id, employee_id, animal_id });
}

import api from '../lib/api';

export const getAdminTickets  = ()     => api.get('/tickets');
export const getMyTickets     = ()     => api.get('/tickets/my');
export const createTickets    = (body) => api.post('/tickets', body);  // { tickets: [...] }

// Static ticket types — no DB call needed
export function getPublicTicketTypes() {
    return [
        { id: 'adult',  title: 'General Admission — Adult',  description: 'Standard zoo entry for adults.',     price: 24.99 },
        { id: 'youth',  title: 'General Admission — Youth',  description: 'Discounted entry for children.',     price: 17.99 },
        { id: 'senior', title: 'General Admission — Senior', description: 'Discounted entry for seniors 65+.', price: 19.99 },
    ];
}

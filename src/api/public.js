import api from '../lib/api';

export async function getUpcomingEvents(limit = 100) {
    const events = await api.get('/events');
    const today = new Date().toISOString().split('T')[0];
    return events
        .filter(e => e.event_date >= today)
        .slice(0, limit);
}

export async function getHomeStats() {
    const [animals, events] = await Promise.all([
        api.get('/animals'),
        api.get('/events'),
    ]);
    return {
        animals: animals.length,
        events:  events.length,
    };
}

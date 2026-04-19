import api from '../lib/api';

export async function getUpcomingEvents(limit = 100) {
    const events = await api.get('/events');
    const today = new Date().toISOString().split('T')[0];
    return events
        .filter(e => e.event_date >= today)
        .sort((a, b) => {
            const dateCompare = new Date(a.event_date) - new Date(b.event_date);
            if (dateCompare !== 0) return dateCompare;
            // If same date, sort by start_time
            return (a.start_time || '00:00').localeCompare(b.start_time || '00:00');
        })
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

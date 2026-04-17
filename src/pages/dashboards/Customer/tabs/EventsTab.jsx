import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import { Calendar, Clock, MapPin, Ticket, ShoppingCart } from 'lucide-react';

export default function EventsTab() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, venues(venue_name, location)')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.event_date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (filter === 'upcoming' && eventDate < today) return false;
    if (dateFrom && eventDate < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && eventDate > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><Calendar size={24} /> Events</h2>
        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '0.5rem 1.125rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Ticket size={14} /> Buy Event Tickets
        </button>
      </div>

      <div className="filter-bar">
        <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
          {['upcoming', 'all'].map(f => (
            <button key={f} className="glass-button" onClick={() => setFilter(f)} style={{
              padding: '0.25rem 1rem', fontSize: '0.8rem', borderRadius: 0,
              background: filter === f ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
              fontWeight: filter === f ? 700 : 400,
              textTransform: 'capitalize',
            }}>
              {f === 'upcoming' ? 'Upcoming' : 'All Events'}
            </button>
          ))}
        </div>
        <span className="filter-label">Date range:</span>
        <input type="date" className="glass-input filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: 'var(--color-text-muted)' }}>to</span>
        <input type="date" className="glass-input filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && (
          <button className="glass-button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }}>Clear</button>
        )}
      </div>

      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} className="empty-state-icon" />
          <p>No events at this time.</p>
        </div>
      ) : (
        <div>
          {filteredEvents.map(event => {
            const eventDate = new Date(event.event_date + 'T00:00:00');
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isPast = eventDate < today;
            return (
              <div key={event.event_id} className="item-card" style={{ opacity: isPast ? 0.65 : 1 }}>
                <div className="item-card-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <Calendar color={isPast ? 'var(--color-text-muted)' : 'var(--color-secondary)'} size={20} />
                      <h3 className="item-title" style={{ margin: 0 }}>{event.title}</h3>
                      <span style={{
                        fontSize: '0.7rem', padding: '0.15rem 0.6rem', borderRadius: '1rem', fontWeight: 600,
                        background: isPast ? 'rgba(255,255,255,0.08)' : 'rgba(16,185,129,0.15)',
                        color: isPast ? 'var(--color-text-muted)' : '#6ee7b7',
                      }}>
                        {isPast ? 'Past' : 'Upcoming'}
                      </span>
                    </div>
                    {event.description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.25rem 0' }}>{event.description}</p>
                    )}
                    <div className="item-meta" style={{ marginTop: '0.5rem' }}>
                      <Clock size={13} />
                      {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      {event.start_time && ` · ${formatTime(event.start_time)}`}
                      {event.end_time && ` – ${formatTime(event.end_time)}`}
                    </div>
                    {event.venues?.venue_name && (
                      <div className="item-meta">
                        <MapPin size={13} /> {event.venues.venue_name}{event.venues.location ? ` — ${event.venues.location}` : ''}
                      </div>
                    )}
                    {event.ticket_price_cents > 0 && (
                      <div className="item-meta">
                        <Ticket size={12} /> ${(event.ticket_price_cents / 100).toFixed(2)} per ticket
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {!isPast && event.max_capacity && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {event.max_capacity - (event.actual_attendance || 0)} spots left
                      </p>
                    )}
                    {isPast && event.actual_attendance != null && (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {event.actual_attendance} attended
                      </p>
                    )}
                    {!isPast && event.ticket_price_cents > 0 && (
                      <button className="glass-button" onClick={() => {
                        const cart = JSON.parse(localStorage.getItem('zooCart') || '{"admission":null,"events":{},"shop":{},"membership":null}');
                        const eid = event.event_id;
                        const existing = cart.events[eid];
                        cart.events[eid] = {
                          event_id: eid,
                          title: event.title,
                          date: eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                          venue: event.venues?.venue_name || null,
                          price_cents: event.ticket_price_cents,
                          quantity: existing ? existing.quantity + 1 : 1,
                        };
                        localStorage.setItem('zooCart', JSON.stringify(cart));
                        navigate('/checkout');
                      }} style={{ background: 'var(--color-secondary)', padding: '0.25rem 0.875rem', fontSize: '0.8rem' }}>
                        ${(event.ticket_price_cents / 100).toFixed(2)} — Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
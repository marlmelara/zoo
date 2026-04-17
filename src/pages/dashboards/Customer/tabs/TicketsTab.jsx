import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { Ticket, Calendar, MapPin, Clock, ShoppingCart, Star } from 'lucide-react';

export default function TicketsTab() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [user?.id]);

  async function fetchTickets() {
    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .single();

      if (!custData) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('tickets')
        .select('*, events(*, venues(*)), transactions(transaction_date)')
        .eq('customer_id', custData.customer_id)
        .order('ticket_id', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
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

  const ticketTypeLabel = (type) => {
    switch (type) {
      case 'adult': return 'Adult';
      case 'child': return 'Child';
      case 'senior': return 'Senior';
      case 'member': return 'Member';
      default: return type || 'General';
    }
  };

  const isMembershipActive = profile?.membership_type && profile?.membership_end && new Date(profile.membership_end) >= new Date();

  const filteredTickets = tickets.filter(ticket => {
    const purchaseDate = ticket.transactions?.transaction_date;
    if (!purchaseDate) return true;
    const d = new Date(purchaseDate);
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalSpent = filteredTickets.reduce((sum, t) => sum + t.price_cents, 0) / 100;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title"><Ticket size={24} /> My Tickets</h2>
        <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-secondary)', padding: '0.5rem 1.125rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <ShoppingCart size={14} /> Buy Tickets
        </button>
      </div>

      {isMembershipActive && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <Star size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
          As a <strong style={{ textTransform: 'capitalize' }}>{profile.membership_type}</strong> member, you get free general admission and discounted rates on event tickets!
        </div>
      )}

      {tickets.length > 0 && (
        <div className="filter-bar">
          <span className="filter-label">Filter by purchase date:</span>
          <input type="date" className="glass-input filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: 'var(--color-text-muted)' }}>to</span>
          <input type="date" className="glass-input filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button className="glass-button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem' }}>Clear</button>
          )}
        </div>
      )}

      {loading ? (
        <p>Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <Ticket size={48} className="empty-state-icon" />
          <p>No tickets purchased yet.</p>
          <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Buy tickets from our website to visit the zoo!</p>
          <button className="glass-button" onClick={() => navigate('/tickets')} style={{ background: 'var(--color-primary)', padding: '0.6rem 1.5rem' }}>Browse Tickets</button>
        </div>
      ) : (
        <div>
          {filteredTickets.map(ticket => {
            const isEvent = ticket.type === 'event' && ticket.events;
            const purchaseDate = ticket.transactions?.transaction_date;
            return (
              <div key={ticket.ticket_id} className="item-card">
                <div className="item-card-header">
                  <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                    <div className={`item-icon ${isEvent ? 'event' : 'ticket'}`}>
                      {isEvent ? <Calendar size={22} color="#f59e0b" /> : <Ticket size={22} color="var(--color-primary)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className="item-title">{isEvent ? ticket.events.title : 'General Admission'}</h3>
                      <span className={`item-badge ${isEvent ? 'event' : ''}`}>
                        {isEvent ? 'Event' : ticketTypeLabel(ticket.type)}
                      </span>
                      {isEvent && (
                        <div style={{ marginTop: '0.5rem' }}>
                          {ticket.events.description && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 0.25rem' }}>{ticket.events.description}</p>
                          )}
                          <div className="item-meta">
                            <Clock size={12} />
                            {new Date(ticket.events.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            {ticket.events.start_time && ` · ${formatTime(ticket.events.start_time)}`}
                            {ticket.events.end_time && ` – ${formatTime(ticket.events.end_time)}`}
                          </div>
                          {ticket.events.venues?.venue_name && (
                            <div className="item-meta">
                              <MapPin size={12} /> {ticket.events.venues.venue_name}{ticket.events.venues.location ? ` — ${ticket.events.venues.location}` : ''}
                            </div>
                          )}
                        </div>
                      )}
                      {purchaseDate && (
                        <div className="item-meta" style={{ marginTop: '0.5rem' }}>
                          <Clock size={11} />
                          Purchased {new Date(purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(purchaseDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="item-price">${(ticket.price_cents / 100).toFixed(2)}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>Ticket #{ticket.ticket_id}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="totals-bar">
            <span style={{ color: 'var(--color-text-muted)', marginRight: '1rem' }}>Total Spent:</span>
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-primary)' }}>${totalSpent.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
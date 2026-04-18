import React, { useEffect, useState } from 'react';
import { getAdminEvents as fetchEventsApi } from '../../../../api/events';
import api from '../../../../lib/api';
import { Calendar, Users, X, Plus, User, Cat, MapPin, Clock, Trash2, AlertTriangle, Archive } from 'lucide-react';
import { StatusFilter } from '../../../../components/AnimalsPanel';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter + manage state
  const [filter, setFilter] = useState('upcoming'); // upcoming | past | all | archived
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // Modal states
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({ employee_id: '', animal_id: '' });

  // Create event modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', event_date: '', venue_id: '',
    start_time: '', end_time: '', max_capacity: 100, ticket_price_cents: 0,
  });
  const [createError, setCreateError] = useState('');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadEvents();
    fetchResources();
    loadVenues();
  }, []);

  async function loadEvents() {
    try {
      const data = await fetchEventsApi();
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadVenues() {
    const data = await api.get('/venues');
    setVenues(data || []);
  }

  async function fetchResources() {
    try {
      const [staffData, animalData] = await Promise.all([
        api.get('/employees'),
        api.get('/animals'),
      ]);
      setStaff(staffData || []);
      setAnimals(animalData || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  }

  async function fetchAssignments(eventId) {
    try {
      const data = await api.get(`/events/${eventId}/assignments`);
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    }
  }

  function openEventModal(event) {
    setSelectedEvent(event);
    fetchAssignments(event.event_id);
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      await api.post(`/events/${selectedEvent.event_id}/assign`, {
        employee_id: assignmentForm.employee_id || null,
        animal_id: assignmentForm.animal_id || null,
      });
      setAssignmentForm({ employee_id: '', animal_id: '' });
      fetchAssignments(selectedEvent.event_id);
    } catch (error) {
      console.error('Error assigning:', error);
    }
  }

  async function handleRemoveAssignment(assignmentId) {
    try {
      await api.delete(`/events/assignments/${assignmentId}`);
      if (selectedEvent) fetchAssignments(selectedEvent.event_id);
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  }

  // ── Scheduling conflict check (client-side using loaded events) ──
  function checkVenueConflict(venueId, eventDate, startTime, endTime) {
    const conflicts = events.filter(ev =>
      ev.venue_id === parseInt(venueId) && ev.event_date === eventDate
    );
    for (const ev of conflicts) {
      if (startTime < ev.end_time && endTime > ev.start_time) {
        return ev;
      }
    }
    return null;
  }

  // ── Create event ──
  async function handleCreateEvent(e) {
    e.preventDefault();
    setCreateError('');

    const { title, event_date, venue_id, start_time, end_time, max_capacity, ticket_price_cents } = createForm;

    if (!title || !event_date || !venue_id || !start_time || !end_time) {
      setCreateError('Please fill in all required fields.');
      return;
    }

    if (start_time < '09:00' || end_time > '17:00') {
      setCreateError('Events must be within zoo hours: 9:00 AM - 5:00 PM.');
      return;
    }

    if (end_time <= start_time) {
      setCreateError('End time must be after start time.');
      return;
    }

    const startMins = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1]);
    const endMins = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1]);
    if (endMins - startMins < 120) {
      setCreateError('Events must be at least 2 hours long.');
      return;
    }

    if (end_time > '17:00') {
      setCreateError('Event cannot extend past closing time (5:00 PM).');
      return;
    }

    const conflict = checkVenueConflict(venue_id, event_date, start_time + ':00', end_time + ':00');
    if (conflict) {
      setCreateError(
        `Venue conflict: "${conflict.title}" is scheduled ${conflict.start_time?.slice(0, 5)} - ${conflict.end_time?.slice(0, 5)} at this venue on that date.`
      );
      return;
    }

    const venue = venues.find(v => v.venue_id === parseInt(venue_id));
    if (venue && max_capacity > venue.capacity) {
      setCreateError(`Max capacity cannot exceed venue capacity of ${venue.capacity}.`);
      return;
    }

    try {
      await api.post('/events', {
        title,
        description: createForm.description,
        event_date,
        venue_id: parseInt(venue_id),
        start_time: start_time + ':00',
        end_time: end_time + ':00',
        max_capacity: parseInt(max_capacity),
        ticket_price_cents: Math.round(parseFloat(ticket_price_cents) * 100) || 0,
      });

      setShowCreate(false);
      setCreateForm({
        title: '', description: '', event_date: '', venue_id: '',
        start_time: '', end_time: '', max_capacity: 100, ticket_price_cents: 0,
      });
      loadEvents();
    } catch (err) {
      setCreateError('Failed to create event: ' + err.message);
    }
  }

  // ── Archive event (soft-delete). Existing tickets/receipts still resolve.
  async function handleArchiveEvent(eventId) {
    try {
      await api.delete(`/events/${eventId}`);
      setDeleteConfirm(null);
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      console.error('Error archiving event:', err);
      alert('Failed to archive event: ' + err.message);
    }
  }

  // ── Bulk manage helpers ──
  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected(new Set(filteredEvents.filter(e => !e.is_archived).map(e => e.event_id)));
  }
  function exitManageMode() {
    setManageMode(false);
    setSelected(new Set());
  }
  async function handleArchiveSelected() {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Archive ${selected.size} event${selected.size === 1 ? '' : 's'}? This hides them from listings but preserves tickets already sold. Archives are permanent — create a new event if you need to bring one back.`
    );
    if (!confirmed) return;
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map(id => api.delete(`/events/${id}`)));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) alert(`${failed.length} archive${failed.length === 1 ? '' : 's'} failed.`);
    exitManageMode();
    loadEvents();
  }

  const getVenueName = (venueId) => {
    const v = venues.find(v => v.venue_id === venueId);
    return v ? v.venue_name : 'No venue';
  };

  // ── Derived filter: upcoming / past / all / archived (date-based + archive flag)
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredEvents = (events || []).filter(ev => {
    const archived = !!ev.is_archived;
    if (filter === 'archived') return archived;
    if (archived) return false;
    if (filter === 'upcoming') return ev.event_date >= todayStr;
    if (filter === 'past')     return ev.event_date <  todayStr;
    return true; // 'all'
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="glass-button" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Create Event
          </button>
          {manageMode ? (
            <button className="glass-button" onClick={exitManageMode}
              style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              × Exit Archive
            </button>
          ) : (
            <button className="glass-button" onClick={() => setManageMode(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={14} /> Manage Events
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <StatusFilter
          label="Filter"
          tabs={[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past',     label: 'Past' },
            { key: 'all',      label: 'All' },
            { key: 'archived', label: 'Archived' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <p>Loading events...</p>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <p>No {filter === 'all' ? '' : filter} events to display.</p>
        </div>
      ) : (
        <div className="grid-cards" style={{ paddingBottom: manageMode ? '90px' : 0 }}>
          {filteredEvents.map((event) => {
            const isPast = new Date(event.event_date + 'T00:00:00') < new Date(new Date().toDateString());
            const isArchived = !!event.is_archived;
            const selectable = manageMode && !isArchived;
            const checked = selected.has(event.event_id);
            const badgeLabel = isArchived ? 'Archived' : isPast ? 'Past' : 'Upcoming';
            const badgeBg    = isArchived ? '#6b7280' : isPast ? 'gray' : 'var(--color-primary)';
            return (
              <div
                key={event.event_id}
                className="glass-panel"
                style={{
                  padding: '20px', position: 'relative', overflow: 'hidden',
                  cursor: selectable ? 'pointer' : (manageMode ? 'default' : 'pointer'),
                  transition: 'transform 0.2s',
                  opacity: isArchived ? 0.5 : isPast ? 0.75 : 1,
                  outline: checked ? '2px solid #ef4444' : 'none',
                }}
                onClick={() => {
                  if (manageMode) {
                    if (selectable) toggleSelect(event.event_id);
                  } else {
                    openEventModal(event);
                  }
                }}
              >
                {manageMode && !isArchived && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(event.event_id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: '10px', left: '10px', width: '18px', height: '18px', accentColor: '#ef4444', zIndex: 2 }}
                  />
                )}
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '5px 10px', background: badgeBg, borderBottomLeftRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                  {badgeLabel}
                </div>

                <h3 style={{ margin: '0 0 4px', paddingRight: '70px', paddingLeft: manageMode && !isArchived ? '28px' : 0 }}>{event.title || 'Untitled Event'}</h3>
                {event.description && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 10px', paddingLeft: manageMode && !isArchived ? '28px' : 0 }}>
                    {event.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Calendar size={14} color="var(--color-secondary)" />
                  <span style={{ fontSize: '0.9rem' }}>
                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                {event.start_time && event.end_time && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    <Clock size={14} />
                    <span>{event.start_time?.slice(0, 5)} - {event.end_time?.slice(0, 5)}</span>
                  </div>
                )}

                {event.venue_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    <MapPin size={14} />
                    <span>{getVenueName(event.venue_id)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  <Users size={14} />
                  <span>Attendance: {event.actual_attendance || 0} / {event.max_capacity}</span>
                </div>

                <div style={{ marginTop: '12px', height: '5px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                  <div style={{ height: '100%', width: `${event.max_capacity ? ((event.actual_attendance || 0) / event.max_capacity) * 100 : 0}%`, background: 'var(--color-secondary)', borderRadius: '3px' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {manageMode && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1f2e', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '14px', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 999,
        }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'white' }}>{selected.size}</strong> selected
          </span>
          <button onClick={selectAllVisible}
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Select All
          </button>
          <button onClick={handleArchiveSelected} disabled={selected.size === 0}
            style={{ background: selected.size === 0 ? 'rgba(239,68,68,0.25)' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: selected.size === 0 ? 'not-allowed' : 'pointer' }}>
            Archive Selected
          </button>
          <button onClick={exitManageMode}
            style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {/* ══ Event Detail Modal ══ */}
      {selectedEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '30px', background: '#0f172a', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{selectedEvent.title || 'Event Details'}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!selectedEvent.is_archived && (
                  <button onClick={() => setDeleteConfirm(selectedEvent.event_id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 10px', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                    <Archive size={14} /> Archive
                  </button>
                )}
                <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                  <X />
                </button>
              </div>
            </div>

            {deleteConfirm === selectedEvent.event_id && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <AlertTriangle size={16} color="#fca5a5" />
                <span style={{ fontSize: '0.85rem', color: '#fca5a5', flex: 1 }}>
                  Archive this event? Already-purchased tickets stay visible to customers, but the event disappears from public listings. Archives are permanent — create a new event to bring it back.
                </span>
                <button onClick={() => handleArchiveEvent(selectedEvent.event_id)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                  Confirm Archive
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Cancel
                </button>
              </div>
            )}

            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {selectedEvent.description && <p style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>{selectedEvent.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
                <div><Calendar size={14} style={{ marginRight: '6px' }} />{new Date(selectedEvent.event_date + 'T00:00:00').toDateString()}</div>
                {selectedEvent.start_time && <div><Clock size={14} style={{ marginRight: '6px' }} />{selectedEvent.start_time?.slice(0, 5)} - {selectedEvent.end_time?.slice(0, 5)}</div>}
                {selectedEvent.venue_id && <div><MapPin size={14} style={{ marginRight: '6px' }} />{getVenueName(selectedEvent.venue_id)}</div>}
                <div><Users size={14} style={{ marginRight: '6px' }} />{selectedEvent.actual_attendance || 0} / {selectedEvent.max_capacity}</div>
              </div>
              {selectedEvent.ticket_price_cents > 0 && (
                <p style={{ marginTop: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  Ticket Price: ${(selectedEvent.ticket_price_cents / 100).toFixed(2)}
                </p>
              )}
            </div>

            <h3>Personnel & Animals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, fontSize: '0.9rem' }}><User size={14} /> Personnel</h4>
                {assignments.filter(a => a.employee_id).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>
                      {a.first_name} {a.last_name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({a.dept_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: 1 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.employee_id).length === 0 && <p style={{ fontSize: '0.75rem', color: 'gray' }}>None assigned.</p>}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, fontSize: '0.9rem' }}><Cat size={14} /> Animals</h4>
                {assignments.filter(a => a.animal_id).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>
                      {a.animal_name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({a.species_common_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: 1 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.animal_id).length === 0 && <p style={{ fontSize: '0.75rem', color: 'gray' }}>None assigned.</p>}
              </div>
            </div>

            <form onSubmit={handleAssign} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
              <h4 style={{ marginTop: 0, fontSize: '0.9rem' }}>Assign Personnel / Animal</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <select className="glass-input" value={assignmentForm.employee_id} onChange={(e) => setAssignmentForm({ employee_id: e.target.value, animal_id: '' })}>
                  <option value="">Select Staff...</option>
                  {staff.filter(s => !assignments.some(a => a.employee_id === s.employee_id)).map(s => <option key={s.employee_id} value={s.employee_id}>{s.first_name} {s.last_name}</option>)}
                </select>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>OR</div>
                <select className="glass-input" value={assignmentForm.animal_id} onChange={(e) => setAssignmentForm({ animal_id: e.target.value, employee_id: '' })}>
                  <option value="">Select Animal...</option>
                  {animals.filter(a => !assignments.some(asn => asn.animal_id === a.animal_id)).map(a => <option key={a.animal_id} value={a.animal_id}>{a.name} ({a.species_common_name})</option>)}
                </select>
              </div>
              <button type="submit" disabled={!assignmentForm.employee_id && !assignmentForm.animal_id} className="glass-button" style={{ width: '100%', marginTop: '12px' }}>
                <Plus size={16} style={{ marginRight: '4px' }} /> Assign
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ Create Event Modal ══ */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '550px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '30px', background: '#0f172a', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Create Event</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X />
              </button>
            </div>

            {createError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.82rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="glass-input" style={inputStyle} value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="Event title" required />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea className="glass-input" style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" className="glass-input" style={inputStyle} value={createForm.event_date} onChange={e => setCreateForm(p => ({ ...p, event_date: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>Venue <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="glass-input" style={inputStyle} value={createForm.venue_id} onChange={e => setCreateForm(p => ({ ...p, venue_id: e.target.value }))} required>
                    <option value="">Select venue...</option>
                    {venues.map(v => <option key={v.venue_id} value={v.venue_id}>{v.venue_name} (Cap: {v.capacity})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Start Time <span style={{ color: '#ef4444' }}>*</span> <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal', fontSize: '0.75rem' }}>(9am-5pm)</span></label>
                  <input type="time" className="glass-input" style={inputStyle} value={createForm.start_time} onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))} min="09:00" max="17:00" required />
                </div>
                <div>
                  <label style={labelStyle}>End Time <span style={{ color: '#ef4444' }}>*</span> <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal', fontSize: '0.75rem' }}>(min 2hrs)</span></label>
                  <input type="time" className="glass-input" style={inputStyle} value={createForm.end_time} onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))} min="09:00" max="17:00" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Max Capacity</label>
                  <input type="number" className="glass-input" style={inputStyle} value={createForm.max_capacity} onChange={e => setCreateForm(p => ({ ...p, max_capacity: e.target.value }))} min={1} />
                </div>
                <div>
                  <label style={labelStyle}>Ticket Price ($)</label>
                  <input type="number" step="0.01" className="glass-input" style={inputStyle} value={createForm.ticket_price_cents} onChange={e => setCreateForm(p => ({ ...p, ticket_price_cents: e.target.value }))} min={0} placeholder="0.00 = free" />
                </div>
              </div>

              <button type="submit" className="glass-button" style={{ width: '100%', marginTop: '4px', padding: '12px' }}>
                Create Event
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  marginBottom: '5px',
  color: 'var(--color-text)',
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  boxSizing: 'border-box',
};

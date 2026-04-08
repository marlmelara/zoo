import React, { useEffect, useState } from 'react';
import { getAdminEvents as fetchEventsApi } from '../../../../api/events';
import { supabase } from '../../../../lib/supabase';
import { Calendar, Users, X, Plus, User, Cat, MapPin, Clock, Trash2, AlertTriangle } from 'lucide-react';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const { data } = await supabase.from('venues').select('*').order('venue_name');
    setVenues(data || []);
  }

  async function fetchResources() {
    try {
      const { data: staffData } = await supabase
        .from('employees')
        .select('employee_id, first_name, last_name, departments!employees_dept_id_fkey(dept_name)');
      const { data: animalData } = await supabase
        .from('animals')
        .select('animal_id, name, species_common_name');
      setStaff(staffData || []);
      setAnimals(animalData || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  }

  async function fetchAssignments(eventId) {
    try {
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          assignment_id,
          employees (first_name, last_name, departments!employees_dept_id_fkey(dept_name)),
          animals (name, species_common_name)
        `)
        .eq('event_id', eventId);
      if (error) throw error;
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
      const { error } = await supabase.from('event_assignments').insert([{
        event_id: selectedEvent.event_id,
        employee_id: assignmentForm.employee_id || null,
        animal_id: assignmentForm.animal_id || null,
      }]);
      if (error) throw error;
      setAssignmentForm({ employee_id: '', animal_id: '' });
      fetchAssignments(selectedEvent.event_id);
    } catch (error) {
      console.error('Error assigning:', error);
    }
  }

  async function handleRemoveAssignment(assignmentId) {
    try {
      const { error } = await supabase.from('event_assignments').delete().eq('assignment_id', assignmentId);
      if (error) throw error;
      if (selectedEvent) fetchAssignments(selectedEvent.event_id);
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  }

  // ── Scheduling conflict check ──
  async function checkVenueConflict(venueId, eventDate, startTime, endTime) {
    const { data: conflicts } = await supabase
      .from('events')
      .select('event_id, title, start_time, end_time')
      .eq('venue_id', venueId)
      .eq('event_date', eventDate);

    if (!conflicts || conflicts.length === 0) return null;

    for (const ev of conflicts) {
      // Overlapping if new start < existing end AND new end > existing start
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

    // Validate zoo hours (9am-5pm)
    if (start_time < '09:00' || end_time > '17:00') {
      setCreateError('Events must be within zoo hours: 9:00 AM - 5:00 PM.');
      return;
    }

    if (end_time <= start_time) {
      setCreateError('End time must be after start time.');
      return;
    }

    // Minimum 2 hours
    const startMins = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1]);
    const endMins = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1]);
    if (endMins - startMins < 120) {
      setCreateError('Events must be at least 2 hours long.');
      return;
    }

    // Check remaining time — if venue is occupied until X, can we fit?
    // Also check if event would run past 5pm
    if (end_time > '17:00') {
      setCreateError('Event cannot extend past closing time (5:00 PM).');
      return;
    }

    // Check venue conflict
    const conflict = await checkVenueConflict(venue_id, event_date, start_time + ':00', end_time + ':00');
    if (conflict) {
      setCreateError(
        `Venue conflict: "${conflict.title}" is scheduled ${conflict.start_time?.slice(0, 5)} - ${conflict.end_time?.slice(0, 5)} at this venue on that date.`
      );
      return;
    }

    // Check venue capacity
    const venue = venues.find(v => v.venue_id === parseInt(venue_id));
    if (venue && max_capacity > venue.capacity) {
      setCreateError(`Max capacity cannot exceed venue capacity of ${venue.capacity}.`);
      return;
    }

    try {
      const { error } = await supabase.from('events').insert([{
        title,
        description: createForm.description,
        event_date,
        venue_id: parseInt(venue_id),
        start_time: start_time + ':00',
        end_time: end_time + ':00',
        max_capacity: parseInt(max_capacity),
        ticket_price_cents: Math.round(parseFloat(ticket_price_cents) * 100) || 0,
        actual_attendance: 0,
      }]);
      if (error) throw error;

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

  // ── Delete event ──
  async function handleDeleteEvent(eventId) {
    try {
      // Delete assignments first
      await supabase.from('event_assignments').delete().eq('event_id', eventId);
      // Delete tickets tied to this event
      await supabase.from('tickets').delete().eq('event_id', eventId);
      // Delete event
      const { error } = await supabase.from('events').delete().eq('event_id', eventId);
      if (error) throw error;
      setDeleteConfirm(null);
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event: ' + err.message);
    }
  }

  const getVenueName = (venueId) => {
    const v = venues.find(v => v.venue_id === venueId);
    return v ? v.venue_name : 'No venue';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <button className="glass-button" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Create Event
        </button>
      </div>

      {loading ? (
        <p>Loading events...</p>
      ) : (events?.length ?? 0) === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <p>No events yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {events.map((event) => {
            const isPast = new Date(event.event_date) < new Date(new Date().toDateString());
            return (
              <div
                key={event.event_id}
                className="glass-panel"
                style={{ padding: '20px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s', opacity: isPast ? 0.6 : 1 }}
                onClick={() => openEventModal(event)}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '5px 10px', background: isPast ? 'gray' : 'var(--color-primary)', borderBottomLeftRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                  {isPast ? 'Past' : 'Upcoming'}
                </div>

                <h3 style={{ margin: '0 0 8px', paddingRight: '60px' }}>{event.title || 'Untitled Event'}</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Calendar size={14} color="var(--color-secondary)" />
                  <span style={{ fontSize: '0.9rem' }}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

      {/* ══ Event Detail Modal ══ */}
      {selectedEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '30px', background: '#0f172a', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{selectedEvent.title || 'Event Details'}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setDeleteConfirm(selectedEvent.event_id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 10px', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                  <Trash2 size={14} /> Delete
                </button>
                <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                  <X />
                </button>
              </div>
            </div>

            {deleteConfirm === selectedEvent.event_id && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <AlertTriangle size={16} color="#fca5a5" />
                <span style={{ fontSize: '0.85rem', color: '#fca5a5', flex: 1 }}>This will delete the event and all associated assignments and tickets.</span>
                <button onClick={() => handleDeleteEvent(selectedEvent.event_id)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                  Confirm Delete
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Cancel
                </button>
              </div>
            )}

            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {selectedEvent.description && <p style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>{selectedEvent.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
                <div><Calendar size={14} style={{ marginRight: '6px' }} />{new Date(selectedEvent.event_date).toDateString()}</div>
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
                {assignments.filter(a => a.employees).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>
                      {a.employees.first_name} {a.employees.last_name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({a.employees.departments?.dept_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: 1 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.employees).length === 0 && <p style={{ fontSize: '0.75rem', color: 'gray' }}>None assigned.</p>}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, fontSize: '0.9rem' }}><Cat size={14} /> Animals</h4>
                {assignments.filter(a => a.animals).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>
                      {a.animals.name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({a.animals.species_common_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: 1 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.animals).length === 0 && <p style={{ fontSize: '0.75rem', color: 'gray' }}>None assigned.</p>}
              </div>
            </div>

            <form onSubmit={handleAssign} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
              <h4 style={{ marginTop: 0, fontSize: '0.9rem' }}>Assign Personnel / Animal</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <select className="glass-input" value={assignmentForm.employee_id} onChange={(e) => setAssignmentForm({ employee_id: e.target.value, animal_id: '' })}>
                  <option value="">Select Staff...</option>
                  {staff.map(s => <option key={s.employee_id} value={s.employee_id}>{s.first_name} {s.last_name}</option>)}
                </select>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>OR</div>
                <select className="glass-input" value={assignmentForm.animal_id} onChange={(e) => setAssignmentForm({ animal_id: e.target.value, employee_id: '' })}>
                  <option value="">Select Animal...</option>
                  {animals.map(a => <option key={a.animal_id} value={a.animal_id}>{a.name} ({a.species_common_name})</option>)}
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

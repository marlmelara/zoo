import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAdminEvents as fetchEventsApi } from '../../../../api/events';
import api from '../../../../lib/api';
import { Calendar, Users, X, Plus, User, Cat, MapPin, Clock, Trash2, AlertTriangle, Archive, Pencil } from 'lucide-react';

// Descriptions are free-form but previously had no cap, so a pasted wall
// of text would push the events card off the layout. 400 chars is roughly
// ~70 words — plenty for "Learn about lemurs & have snacks with the crew"
// style blurbs without ever overflowing the card.
const DESCRIPTION_MAX = 400;
import { StatusFilter } from '../../../../components/AnimalsPanel';
import BulkActionBar from '../../../../components/BulkActionBar';
import { useToast, useConfirm } from '../../../../components/Feedback';
import { formatTime } from '../../../../utils/staff';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

export default function Events() {
  const toast   = useToast();
  const confirm = useConfirm();
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

  // Create event modal — max_capacity starts empty so the field reads as
  // "pick a venue first". Once a venue is selected, it auto-fills with the
  // venue's capacity and is hard-capped to that value on edit.
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', event_date: '', venue_id: '',
    start_time: '', end_time: '', max_capacity: '', ticket_price_cents: 0,
  });
  const [createError, setCreateError] = useState('');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Edit event modal
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');

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
      // /employees/my-team returns the full roster for admins and just the
      // reports for managers — same shape either way, so the dropdown
      // automatically respects "can only assign my staff" without the
      // frontend having to know the role.
      const [staffData, animalData] = await Promise.all([
        api.get('/employees/my-team'),
        api.get('/animals'),
      ]);
      setStaff((staffData || []).filter(e => !e.is_self));
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
        `Venue conflict: "${conflict.title}" is scheduled ${formatTime(conflict.start_time?.slice(0, 5))} – ${formatTime(conflict.end_time?.slice(0, 5))} at this venue on that date.`
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
        start_time: '', end_time: '', max_capacity: '', ticket_price_cents: 0,
      });
      loadEvents();
    } catch (err) {
      setCreateError('Failed to create event: ' + err.message);
    }
  }

  // ── Edit event (PATCH) ──
  function startEditEvent(event) {
    setEditing(event);
    setEditError('');
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      event_date: event.event_date ? event.event_date.slice(0, 10) : '',
      venue_id: event.venue_id != null ? String(event.venue_id) : '',
      start_time: event.start_time ? event.start_time.slice(0, 5) : '',
      end_time:   event.end_time   ? event.end_time.slice(0, 5)   : '',
      max_capacity: event.max_capacity ?? 100,
      ticket_price_cents: event.ticket_price_cents != null ? (event.ticket_price_cents / 100).toFixed(2) : '0.00',
    });
  }
  function cancelEditEvent() { setEditing(null); setEditForm({}); setEditError(''); }
  async function handleEditEventSave(e) {
    e.preventDefault();
    setEditError('');
    const { title, event_date, venue_id, start_time, end_time, max_capacity, ticket_price_cents } = editForm;
    if (!title || !event_date || !venue_id || !start_time || !end_time) {
      setEditError('Please fill in all required fields.');
      return;
    }
    if (start_time < '09:00' || end_time > '17:00') {
      setEditError('Events must be within zoo hours: 9:00 AM – 5:00 PM.');
      return;
    }
    if (end_time <= start_time) {
      setEditError('End time must be after start time.');
      return;
    }
    const venue = venues.find(v => v.venue_id === parseInt(venue_id));
    if (venue && max_capacity > venue.capacity) {
      setEditError(`Max capacity cannot exceed venue capacity of ${venue.capacity}.`);
      return;
    }
    try {
      await api.patch(`/events/${editing.event_id}`, {
        title,
        description: editForm.description || null,
        event_date,
        venue_id: parseInt(venue_id),
        start_time: start_time + ':00',
        end_time:   end_time   + ':00',
        max_capacity: parseInt(max_capacity),
        ticket_price_cents: Math.round(parseFloat(ticket_price_cents) * 100) || 0,
      });
      cancelEditEvent();
      loadEvents();
    } catch (err) {
      setEditError('Failed to save: ' + err.message);
    }
  }

  // ── Archive event (soft-delete). Existing tickets/receipts still resolve.
  async function handleArchiveEvent(eventId) {
    try {
      await api.delete(`/events/${eventId}`);
      setDeleteConfirm(null);
      setSelectedEvent(null);
      toast.success('Event archived.');
      loadEvents();
    } catch (err) {
      console.error('Error archiving event:', err);
      toast.error('Failed to archive event: ' + err.message);
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
    const ok = await confirm({
      title: `Archive ${selected.size} event${selected.size === 1 ? '' : 's'}?`,
      message: 'Hides them from listings but preserves tickets already sold. Archives are permanent — you\'d have to create a new event to bring one back.',
      confirmLabel: 'Archive',
      tone: 'danger',
    });
    if (!ok) return;
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map(id => api.delete(`/events/${id}`)));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      toast.error(`${failed.length} archive${failed.length === 1 ? '' : 's'} failed.`);
    } else {
      toast.success(`Archived ${ids.length} event${ids.length === 1 ? '' : 's'}.`);
    }
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
  })
  // Upcoming reads best chronologically (soonest first). Past / all /
  // archived stay newest-first since they're retrospective views.
  .sort((a, b) => {
    if (filter === 'upcoming') return a.event_date.localeCompare(b.event_date);
    return b.event_date.localeCompare(a.event_date);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="glass-button" onClick={() => setShowCreate(true)}
            style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    <span>{formatTime(event.start_time?.slice(0, 5))} – {formatTime(event.end_time?.slice(0, 5))}</span>
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
        <BulkActionBar
          count={selected.size}
          onSelectAll={selectAllVisible}
          onRemove={handleArchiveSelected}
          onCancel={exitManageMode}
          actionLabel="Archive Selected"
        />
      )}

      {/* ══ Event Detail Modal ══ */}
      {/* Styled to match the Edit modal — cream background, green accents,
          dark text — so the two popups feel like part of the same surface. */}
      {selectedEvent && createPortal((
        <div onClick={() => setSelectedEvent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '600px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
            padding: '28px', background: 'rgba(255,255,255,0.96)', color: 'var(--color-text-dark)',
            border: `1px solid ${GREEN}`, borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, color: GREEN_DARK }}>{selectedEvent.title || 'Event Details'}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!selectedEvent.is_archived && (
                  <button onClick={() => { const ev = selectedEvent; setSelectedEvent(null); startEditEvent(ev); }}
                    style={{ background: 'rgba(121,162,128,0.18)', border: `1px solid ${GREEN}`, borderRadius: '8px', padding: '6px 12px', color: GREEN_DARK, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                    <Pencil size={14} /> Edit
                  </button>
                )}
                {!selectedEvent.is_archived && (
                  <button onClick={() => setDeleteConfirm(selectedEvent.event_id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', padding: '6px 12px', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                    <Archive size={14} /> Archive
                  </button>
                )}
                <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: GREEN_DARK, cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {deleteConfirm === selectedEvent.event_id && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <AlertTriangle size={16} color="#b91c1c" />
                <span style={{ fontSize: '0.85rem', color: '#b91c1c', flex: 1 }}>
                  Archive this event? Already-purchased tickets stay visible to customers, but the event disappears from public listings. Archives are permanent — create a new event to bring it back.
                </span>
                <button onClick={() => handleArchiveEvent(selectedEvent.event_id)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                  Confirm Archive
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: `1px solid ${GREEN}`, borderRadius: '6px', padding: '6px 14px', color: GREEN_DARK, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  Cancel
                </button>
              </div>
            )}

            <div style={{ marginBottom: '22px', paddingBottom: '16px', borderBottom: `1px solid ${GREEN}33` }}>
              {selectedEvent.description && <p style={{ color: 'var(--color-text-dark)', marginBottom: '12px', opacity: 0.85 }}>{selectedEvent.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', color: GREEN_DARK, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} color={GREEN} />{new Date(selectedEvent.event_date + 'T00:00:00').toDateString()}</div>
                {selectedEvent.start_time && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} color={GREEN} />{formatTime(selectedEvent.start_time?.slice(0, 5))} – {formatTime(selectedEvent.end_time?.slice(0, 5))}</div>}
                {selectedEvent.venue_id && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} color={GREEN} />{getVenueName(selectedEvent.venue_id)}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} color={GREEN} />{selectedEvent.actual_attendance || 0} / {selectedEvent.max_capacity}</div>
              </div>
              {selectedEvent.ticket_price_cents > 0 && (
                <p style={{ marginTop: '10px', color: GREEN_DARK, fontWeight: 700 }}>
                  Ticket Price: ${(selectedEvent.ticket_price_cents / 100).toFixed(2)}
                </p>
              )}
            </div>

            <h3 style={{ color: GREEN_DARK, margin: '0 0 12px' }}>Personnel & Animals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(121,162,128,0.08)', border: `1px solid ${GREEN}33`, padding: '12px', borderRadius: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '10px', fontSize: '0.88rem', color: GREEN_DARK }}><User size={14} /> Personnel</h4>
                {assignments.filter(a => a.employee_id).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-text-dark)' }}>
                    <span>
                      {a.first_name} {a.last_name}
                      <span style={{ fontSize: '0.7rem', color: GREEN_DARK, marginLeft: '4px', opacity: 0.8 }}>({a.dept_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: 1, fontWeight: 700 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.employee_id).length === 0 && <p style={{ fontSize: '0.75rem', color: GREEN_DARK, opacity: 0.7, margin: 0, fontStyle: 'italic' }}>None assigned.</p>}
              </div>
              <div style={{ background: 'rgba(121,162,128,0.08)', border: `1px solid ${GREEN}33`, padding: '12px', borderRadius: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, marginBottom: '10px', fontSize: '0.88rem', color: GREEN_DARK }}><Cat size={14} /> Animals</h4>
                {assignments.filter(a => a.animal_id).map(a => (
                  <div key={a.assignment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--color-text-dark)' }}>
                    <span>
                      {a.animal_name}
                      <span style={{ fontSize: '0.7rem', color: GREEN_DARK, marginLeft: '4px', opacity: 0.8 }}>({a.species_common_name})</span>
                    </span>
                    <button onClick={() => handleRemoveAssignment(a.assignment_id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: 1, fontWeight: 700 }} title="Remove">&times;</button>
                  </div>
                ))}
                {assignments.filter(a => a.animal_id).length === 0 && <p style={{ fontSize: '0.75rem', color: GREEN_DARK, opacity: 0.7, margin: 0, fontStyle: 'italic' }}>None assigned.</p>}
              </div>
            </div>

            <form onSubmit={handleAssign} style={{ background: 'rgba(121,162,128,0.08)', border: `1px solid ${GREEN}33`, padding: '16px', borderRadius: '10px' }}>
              <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.88rem', color: GREEN_DARK }}>Assign Personnel / Animal</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <select style={modalSelectStyle} value={assignmentForm.employee_id} onChange={(e) => setAssignmentForm({ employee_id: e.target.value, animal_id: '' })}>
                  <option value="">Select Staff...</option>
                  {staff.filter(s => !assignments.some(a => a.employee_id === s.employee_id)).map(s => <option key={s.employee_id} value={s.employee_id}>{s.first_name} {s.last_name}</option>)}
                </select>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: GREEN_DARK, fontWeight: 600, letterSpacing: '0.08em' }}>OR</div>
                <select style={modalSelectStyle} value={assignmentForm.animal_id} onChange={(e) => setAssignmentForm({ animal_id: e.target.value, employee_id: '' })}>
                  <option value="">Select Animal...</option>
                  {animals.filter(a => !assignments.some(asn => asn.animal_id === a.animal_id)).map(a => <option key={a.animal_id} value={a.animal_id}>{a.name} ({a.species_common_name})</option>)}
                </select>
              </div>
              <button type="submit" disabled={!assignmentForm.employee_id && !assignmentForm.animal_id}
                style={{
                  width: '100%', marginTop: '12px', padding: '10px',
                  background: (!assignmentForm.employee_id && !assignmentForm.animal_id) ? 'rgba(121,162,128,0.2)' : GREEN,
                  color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700,
                  cursor: (!assignmentForm.employee_id && !assignmentForm.animal_id) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem',
                }}>
                <Plus size={16} /> Assign
              </button>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* ══ Create Event Modal ══ */}
      {/* Themed to match the Edit modal: cream background, green accents,
          dark text, click-outside-to-close. */}
      {showCreate && createPortal((
        <div onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '550px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
            padding: '28px', background: 'rgba(255,255,255,0.96)', color: 'var(--color-text-dark)',
            border: `1px solid ${GREEN}`, borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: GREEN_DARK }}>Create Event</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ background: 'none', border: 'none', color: GREEN_DARK, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.82rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={editLabelStyle}>Title <span style={{ color: '#b91c1c' }}>*</span></label>
                <input className="glass-input" value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="Event title" required />
              </div>

              <div>
                <label style={editLabelStyle}>Description</label>
                <textarea className="glass-input" style={{ minHeight: '60px', resize: 'vertical' }}
                  value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value.slice(0, DESCRIPTION_MAX) }))}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="Optional description" />
                <div style={{ fontSize: '10px', color: GREEN_DARK, opacity: 0.7, textAlign: 'right', marginTop: '2px' }}>
                  {createForm.description.length} / {DESCRIPTION_MAX}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={editLabelStyle}>Date <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input type="date" className="glass-input" value={createForm.event_date} onChange={e => setCreateForm(p => ({ ...p, event_date: e.target.value }))} required />
                </div>
                <div>
                  <label style={editLabelStyle}>Venue <span style={{ color: '#b91c1c' }}>*</span></label>
                  <select className="glass-input" value={createForm.venue_id}
                    onChange={e => {
                      const venueId = e.target.value;
                      // Auto-fill max_capacity with the chosen venue's capacity.
                      // If the previous value exceeded the new venue's cap, clamp it.
                      const v = venues.find(vv => String(vv.venue_id) === venueId);
                      const current = parseInt(createForm.max_capacity, 10);
                      const nextCap = v
                        ? (Number.isFinite(current) && current > 0 && current <= v.capacity
                             ? current
                             : v.capacity)
                        : '';
                      setCreateForm(p => ({ ...p, venue_id: venueId, max_capacity: nextCap }));
                    }} required>
                    <option value="">Select venue...</option>
                    {venues.map(v => <option key={v.venue_id} value={v.venue_id}>{v.venue_name} (Cap: {v.capacity})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={editLabelStyle}>Start Time <span style={{ color: '#b91c1c' }}>*</span> <span style={{ color: GREEN_DARK, opacity: 0.7, fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: '10px' }}>(9am-5pm)</span></label>
                  <input type="time" className="glass-input" value={createForm.start_time} onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))} min="09:00" max="17:00" required />
                </div>
                <div>
                  <label style={editLabelStyle}>End Time <span style={{ color: '#b91c1c' }}>*</span> <span style={{ color: GREEN_DARK, opacity: 0.7, fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: '10px' }}>(min 2hrs)</span></label>
                  <input type="time" className="glass-input" value={createForm.end_time} onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))} min="09:00" max="17:00" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  {(() => {
                    const createVenue = venues.find(v => String(v.venue_id) === String(createForm.venue_id));
                    const venueCap = createVenue?.capacity ?? null;
                    return (
                      <>
                        <label style={editLabelStyle}>
                          Max Capacity
                          {venueCap != null && (
                            <span style={{ color: GREEN_DARK, opacity: 0.7, fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: '10px', marginLeft: 6 }}>
                              (max {venueCap})
                            </span>
                          )}
                        </label>
                        <input type="number" className="glass-input"
                          value={createForm.max_capacity}
                          onChange={e => {
                            // Clamp to venue capacity so the field can never be
                            // higher than the venue allows; empty string is fine
                            // (lets the user clear + retype).
                            let v = e.target.value;
                            if (v !== '' && venueCap != null) {
                              const n = parseInt(v, 10);
                              if (Number.isFinite(n) && n > venueCap) v = String(venueCap);
                            }
                            setCreateForm(p => ({ ...p, max_capacity: v }));
                          }}
                          min={1}
                          max={venueCap ?? undefined}
                          disabled={!createForm.venue_id}
                          placeholder={createForm.venue_id ? '' : 'Select venue first'}
                          required
                        />
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label style={editLabelStyle}>Ticket Price ($)</label>
                  <input type="number" step="0.01" className="glass-input" value={createForm.ticket_price_cents} onChange={e => setCreateForm(p => ({ ...p, ticket_price_cents: e.target.value }))} min={0} placeholder="0.00 = free" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); }} className="glass-button" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>Create Event</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* ══ Edit Event Modal (portaled) ══ */}
      {editing && createPortal((
        <div onClick={cancelEditEvent} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '550px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
            padding: '28px', background: 'rgba(255,255,255,0.96)', color: 'var(--color-text-dark)',
            border: `1px solid ${GREEN}`, borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: GREEN_DARK }}>Edit: {editing.title}</h2>
              <button onClick={cancelEditEvent} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN_DARK }}>
                <X size={20} />
              </button>
            </div>
            {editError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.82rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {editError}
              </div>
            )}
            <form onSubmit={handleEditEventSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={editLabelStyle}>Title *</label>
                <input required className="glass-input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div>
                <label style={editLabelStyle}>Description</label>
                <textarea className="glass-input" style={{ minHeight: '60px', resize: 'vertical' }}
                  value={editForm.description || ''}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value.slice(0, DESCRIPTION_MAX) })}
                  maxLength={DESCRIPTION_MAX}
                />
                <div style={{ fontSize: '10px', color: GREEN_DARK, opacity: 0.7, textAlign: 'right', marginTop: '2px' }}>
                  {(editForm.description || '').length} / {DESCRIPTION_MAX}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={editLabelStyle}>Date *</label>
                  <input type="date" required className="glass-input" value={editForm.event_date} onChange={e => setEditForm({ ...editForm, event_date: e.target.value })} />
                </div>
                <div>
                  <label style={editLabelStyle}>Venue *</label>
                  <select required className="glass-input" value={editForm.venue_id}
                    onChange={e => {
                      const venueId = e.target.value;
                      const v = venues.find(vv => String(vv.venue_id) === venueId);
                      const current = parseInt(editForm.max_capacity, 10);
                      // Clamp the existing capacity down to the new venue's
                      // cap if it exceeds; otherwise keep the user's value.
                      const nextCap = v
                        ? (Number.isFinite(current) && current > 0 && current <= v.capacity
                             ? current
                             : v.capacity)
                        : '';
                      setEditForm({ ...editForm, venue_id: venueId, max_capacity: nextCap });
                    }}>
                    <option value="">Select venue...</option>
                    {venues.map(v => <option key={v.venue_id} value={v.venue_id}>{v.venue_name} (Cap: {v.capacity})</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={editLabelStyle}>Start *</label>
                  <input type="time" required min="09:00" max="17:00" className="glass-input" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })} />
                </div>
                <div>
                  <label style={editLabelStyle}>End *</label>
                  <input type="time" required min="09:00" max="17:00" className="glass-input" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  {(() => {
                    const editVenue = venues.find(v => String(v.venue_id) === String(editForm.venue_id));
                    const venueCap = editVenue?.capacity ?? null;
                    return (
                      <>
                        <label style={editLabelStyle}>
                          Max Capacity
                          {venueCap != null && (
                            <span style={{ color: GREEN_DARK, opacity: 0.7, fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: '10px', marginLeft: 6 }}>
                              (max {venueCap})
                            </span>
                          )}
                        </label>
                        <input type="number" className="glass-input"
                          value={editForm.max_capacity ?? ''}
                          onChange={e => {
                            let v = e.target.value;
                            if (v !== '' && venueCap != null) {
                              const n = parseInt(v, 10);
                              if (Number.isFinite(n) && n > venueCap) v = String(venueCap);
                            }
                            setEditForm({ ...editForm, max_capacity: v });
                          }}
                          min={1}
                          max={venueCap ?? undefined}
                          disabled={!editForm.venue_id}
                          placeholder={editForm.venue_id ? '' : 'Select venue first'}
                          required
                        />
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label style={editLabelStyle}>Ticket Price ($)</label>
                  <input type="number" step="0.01" min={0} className="glass-input" value={editForm.ticket_price_cents} onChange={e => setEditForm({ ...editForm, ticket_price_cents: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={cancelEditEvent} className="glass-button" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
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

const editLabelStyle = {
  display: 'block',
  fontSize: '11px',
  color: GREEN_DARK,
  marginBottom: '4px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// Selects inside the cream-themed event-detail modal — `glass-input` is
// designed for the dark panels; on white it renders light-on-light.
const modalSelectStyle = {
  width: '100%',
  padding: '8px 10px',
  background: 'white',
  color: 'var(--color-text-dark)',
  border: `1px solid ${GREEN}55`,
  borderRadius: '8px',
  fontSize: '0.88rem',
  fontFamily: 'inherit',
};

import React, { useEffect, useState } from 'react';
import { getAdminEvents as fetchEventsApi } from '../../../../api/events';
import { supabase } from '../../../../lib/supabase';
import { Calendar, Users, X, Plus, User, Cat } from 'lucide-react';

export default function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [animals, setAnimals] = useState([]);
    const [assignmentForm, setAssignmentForm] = useState({ employee_id: '', animal_id: '' });

    useEffect(() => {
        loadEvents();
        fetchResources();
    }, []);

    async function loadEvents() {
        try {
            const data = await fetchEventsApi();
            setEvents(data || []);
        } catch (error) {
            console.error("Error fetching events:", error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }

    async function fetchResources() {
        try {
            const { data: staffData, error: staffError } = await supabase
                .from('employees')
                .select('employee_id, first_name, last_name, departments!employees_dept_id_fkey(dept_name)');

            const { data: animalData, error: animalError } = await supabase
                .from('animals')
                .select('animal_id, name, species_common_name');

            if (staffError) throw staffError;
            if (animalError) throw animalError;

            setStaff(staffData || []);
            setAnimals(animalData || []);
        } catch (error) {
            console.error("Error fetching resources:", error);
            setStaff([]);
            setAnimals([]);
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
            console.error("Error fetching assignments:", error);
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
                animal_id: assignmentForm.animal_id || null
            }]);

            if (error) throw error;

            setAssignmentForm({ employee_id: '', animal_id: '' });
            fetchAssignments(selectedEvent.event_id);
        } catch (error) {
            console.error("Error assigning resource:", error);
        }
    }

    return (
        <div>
            <h1>Upcoming Events</h1>

            {loading ? (
                <p>Loading events...</p>
            ) : (events?.length ?? 0) === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                    <p>No upcoming events.</p>
                </div>
            ) : (
                <div className="grid-cards">
                    {events.map((event) => (
                        <div
                            key={event.event_id}
                            className="glass-panel"
                            style={{
                                padding: '20px',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onClick={() => openEventModal(event)}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    padding: '5px 10px',
                                    background: 'var(--color-primary)',
                                    borderBottomLeftRadius: '10px',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Upcoming
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                <Calendar color="var(--color-secondary)" />
                                <h3 style={{ margin: 0 }}>
                                    {new Date(event.event_date).toLocaleDateString('en-US', {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)' }}>
                                <Users size={16} />
                                <span>
                                    Attendance: {event.actual_attendance} / {event.max_capacity}
                                </span>
                            </div>

                            <div
                                style={{
                                    marginTop: '15px',
                                    height: '6px',
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '3px'
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${event.max_capacity ? (event.actual_attendance / event.max_capacity) * 100 : 0}%`,
                                        background: 'var(--color-secondary)',
                                        borderRadius: '3px'
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedEvent && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                >
                    <div
                        className="glass-panel"
                        style={{
                            width: '600px',
                            maxWidth: '90vw',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            padding: '30px',
                            background: '#0f172a',
                            border: '1px solid var(--glass-border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Event Details</h2>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                <X />
                            </button>
                        </div>

                        <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 style={{ color: 'var(--color-primary)' }}>
                                {new Date(selectedEvent.event_date).toDateString()}
                            </h3>
                            <p>Max Capacity: {selectedEvent.max_capacity}</p>
                            <p>Actual Attendance: {selectedEvent.actual_attendance}</p>
                        </div>

                        <h3>Resource Assignments</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
                                    <User size={16} /> Staff Assigned
                                </h4>

                                {assignments.filter((a) => a.employees).map((a) => (
                                    <div key={a.assignment_id} style={{ fontSize: '14px', marginBottom: '5px' }}>
                                        {a.employees.first_name} {a.employees.last_name}
                                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '5px' }}>
                                            ({a.employees.departments?.dept_name})
                                        </span>
                                    </div>
                                ))}

                                {assignments.filter((a) => a.employees).length === 0 && (
                                    <p style={{ fontSize: '12px', color: 'gray' }}>No staff assigned.</p>
                                )}
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
                                    <Cat size={16} /> Animals Featured
                                </h4>

                                {assignments.filter((a) => a.animals).map((a) => (
                                    <div key={a.assignment_id} style={{ fontSize: '14px', marginBottom: '5px' }}>
                                        {a.animals.name}
                                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '5px' }}>
                                            ({a.animals.species_common_name})
                                        </span>
                                    </div>
                                ))}

                                {assignments.filter((a) => a.animals).length === 0 && (
                                    <p style={{ fontSize: '12px', color: 'gray' }}>No animals assigned.</p>
                                )}
                            </div>
                        </div>

                        <form
                            onSubmit={handleAssign}
                            style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px' }}
                        >
                            <h4 style={{ marginTop: 0 }}>Assign New Resource</h4>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                <select
                                    className="glass-input"
                                    value={assignmentForm.employee_id}
                                    onChange={(e) =>
                                        setAssignmentForm({
                                            ...assignmentForm,
                                            employee_id: e.target.value,
                                            animal_id: ''
                                        })
                                    }
                                >
                                    <option value="">Select Staff...</option>
                                    {staff.map((s) => (
                                        <option key={s.employee_id} value={s.employee_id}>
                                            {s.first_name} {s.last_name}
                                        </option>
                                    ))}
                                </select>

                                <div style={{ textAlign: 'center' }}>OR</div>

                                <select
                                    className="glass-input"
                                    value={assignmentForm.animal_id}
                                    onChange={(e) =>
                                        setAssignmentForm({
                                            ...assignmentForm,
                                            animal_id: e.target.value,
                                            employee_id: ''
                                        })
                                    }
                                >
                                    <option value="">Select Animal...</option>
                                    {animals.map((a) => (
                                        <option key={a.animal_id} value={a.animal_id}>
                                            {a.name} ({a.species_common_name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={!assignmentForm.employee_id && !assignmentForm.animal_id}
                                className="glass-button"
                                style={{ width: '100%', marginTop: '15px' }}
                            >
                                <Plus size={16} style={{ marginRight: '5px' }} />
                                Assign
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
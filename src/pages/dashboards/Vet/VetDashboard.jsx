import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import { logActivity } from '../../../api/activityLog';
import {
    Cat, Activity, Package, Calendar, AlertTriangle, Plus, X,
    ClipboardList, Clock, CheckCircle, XCircle, Send
} from 'lucide-react';

const TABS = ['My Animals', 'Medical Records', 'My Events', 'Supplies'];

export default function VetDashboard() {
    const { user, employeeId, deptId } = useAuth();
    const [activeTab, setActiveTab] = useState('My Animals');

    // Resolved IDs
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

    // Animals state
    const [animals, setAnimals] = useState([]);
    const [animalsLoading, setAnimalsLoading] = useState(true);

    // Medical records state
    const [selectedAnimal, setSelectedAnimal] = useState(null);
    const [medicalHistory, setMedicalHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistoryForm, setShowHistoryForm] = useState(false);
    const [historyForm, setHistoryForm] = useState({ injury: '', disease: '', date_treated: '', animal_age_at_treatment: '' });

    // Supplies state
    const [supplies, setSupplies] = useState([]);
    const [suppliesLoading, setSuppliesLoading] = useState(true);
    const [myRequests, setMyRequests] = useState([]);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestForm, setRequestForm] = useState({ supply_id: '', quantity: '', reason: '' });

    // Events state
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            if (!user?.id) return;

            let empId = employeeId;
            let depId = deptId;

            if (!empId || !depId) {
                try {
                    const { data, error } = await supabase
                        .from('employees')
                        .select('employee_id, dept_id')
                        .eq('user_id', user.id)
                        .single();
                    if (!error && data) {
                        empId = data.employee_id;
                        depId = data.dept_id;
                        setResolvedEmpId(empId);
                        setResolvedDeptId(depId);
                    }
                } catch (err) {
                    console.error('Error resolving employee:', err);
                }
            } else {
                setResolvedEmpId(empId);
                setResolvedDeptId(depId);
            }

            fetchMyAnimals(empId);
            fetchMyEvents(empId);
            if (depId) {
                fetchSupplies(depId);
                fetchMyRequests(empId);
            } else {
                setSuppliesLoading(false);
            }
        }
        loadDashboard();
    }, [user?.id, employeeId, deptId]);

    async function fetchMyAnimals(empId) {
        const id = empId || resolvedEmpId || employeeId;
        if (!id) { setAnimalsLoading(false); return; }
        try {
            // Vet's animals via vet_animal_assignments junction table
            const { data: assignments, error: vaError } = await supabase
                .from('vet_animal_assignments')
                .select('animal_id')
                .eq('vet_id', id);

            if (vaError || !assignments?.length) {
                setAnimals([]);
                setAnimalsLoading(false);
                return;
            }

            const animalIds = assignments.map(a => a.animal_id).filter(Boolean);
            if (animalIds.length === 0) {
                setAnimals([]);
                setAnimalsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('animals')
                .select('*, animal_zones(zone_name), health_records(record_id)')
                .in('animal_id', animalIds);

            if (error) throw error;
            setAnimals(data || []);
        } catch (err) {
            console.error('Error fetching vet animals:', err);
            setAnimals([]);
        } finally {
            setAnimalsLoading(false);
        }
    }

    async function fetchMedicalHistory(animal) {
        if (!animal.health_record_id) return;
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('medical_history')
                .select('*')
                .eq('record_id', animal.health_record_id)
                .order('date_treated', { ascending: false });

            if (error) throw error;
            setMedicalHistory(data || []);
        } catch (err) {
            console.error('Error fetching medical history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }

    async function handleHistorySubmit(e) {
        e.preventDefault();
        try {
            const { error } = await supabase.from('medical_history').insert([{
                record_id: selectedAnimal.health_record_id,
                ...historyForm,
                animal_age_at_treatment: parseInt(historyForm.animal_age_at_treatment)
            }]);
            if (error) throw error;
            setShowHistoryForm(false);
            setHistoryForm({ injury: '', disease: '', date_treated: '', animal_age_at_treatment: '' });
            fetchMedicalHistory(selectedAnimal);
        } catch (err) {
            console.error('Error adding medical record:', err);
        }
    }

    async function fetchSupplies(depId) {
        const id = depId || resolvedDeptId || deptId;
        if (!id) { setSuppliesLoading(false); return; }
        try {
            const data = await getSuppliesByDepartment(id);
            setSupplies(data);
        } catch (err) {
            console.error('Error fetching supplies:', err);
        } finally {
            setSuppliesLoading(false);
        }
    }

    async function fetchMyRequests(empId) {
        const id = empId || resolvedEmpId || employeeId;
        if (!id) return;
        try {
            const data = await getMySupplyRequests(id);
            setMyRequests(data);
        } catch (err) {
            console.error('Error fetching my requests:', err);
        }
    }

    async function handleRequestSubmit(e) {
        e.preventDefault();
        const supply = supplies.find(s => s.supply_id === parseInt(requestForm.supply_id));
        const empId = resolvedEmpId || employeeId;
        if (!supply || !empId) return;
        try {
            const newRequest = await createSupplyRequest({
                requested_by: empId,
                supply_type: 'operational',
                item_id: supply.supply_id,
                item_name: supply.item_name,
                requested_quantity: parseInt(requestForm.quantity),
                reason: requestForm.reason
            });
            await logActivity({
                action_type: 'supply_request_created',
                description: `Requested ${requestForm.quantity}x ${supply.item_name}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: newRequest.request_id,
                metadata: { item_name: supply.item_name, quantity: parseInt(requestForm.quantity), reason: requestForm.reason }
            });
            setShowRequestForm(false);
            setRequestForm({ supply_id: '', quantity: '', reason: '' });
            fetchMyRequests(empId);
        } catch (err) {
            console.error('Error creating supply request:', err);
            alert('Failed to submit request: ' + err.message);
        }
    }

    async function fetchMyEvents(empId) {
        const id = empId || resolvedEmpId || employeeId;
        if (!id) { setEventsLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('event_assignments')
                .select('*, events(*)')
                .eq('employee_id', id);

            if (error) throw error;
            setEvents((data || []).map(a => a.events).filter(Boolean));
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    const statusColor = (status) => {
        switch (status) {
            case 'approved': return '#10b981';
            case 'denied': return '#ef4444';
            default: return '#f59e0b';
        }
    };

    const statusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={14} color="#10b981" />;
            case 'denied': return <XCircle size={14} color="#ef4444" />;
            default: return <Clock size={14} color="#f59e0b" />;
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Veterinarian Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Animal Health & Medical Management</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className="glass-button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: activeTab === tab ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 400
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ═══════════ MY ANIMALS TAB ═══════════ */}
            {activeTab === 'My Animals' && (
                <div>
                    {animalsLoading ? <p>Loading animals...</p> : animals.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Cat size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No animals currently assigned to you.</p>
                        </div>
                    ) : (
                        <div className="grid-cards">
                            {animals.map(animal => (
                                <div key={animal.animal_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 10px' }}>{animal.name}</h3>
                                    <p style={{ color: 'var(--color-primary)', fontSize: '14px', marginBottom: '15px' }}>
                                        {animal.species_common_name}
                                    </p>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>
                                        <p>Age: {animal.age} years</p>
                                        <p>Zone: {animal.animal_zones?.zone_name || 'Unassigned'}</p>
                                    </div>
                                    <button
                                        className="glass-button"
                                        style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                                        onClick={() => {
                                            setSelectedAnimal(animal);
                                            setActiveTab('Medical Records');
                                            fetchMedicalHistory(animal);
                                        }}
                                    >
                                        <Activity size={14} style={{ marginRight: '5px' }} />
                                        View Medical Records
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MEDICAL RECORDS TAB ═══════════ */}
            {activeTab === 'Medical Records' && (
                <div>
                    {!selectedAnimal ? (
                        <div>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>Select an animal to view their medical records.</p>
                            <div className="grid-cards">
                                {animals.map(animal => (
                                    <div
                                        key={animal.animal_id}
                                        className="glass-panel"
                                        style={{ padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
                                        onClick={() => { setSelectedAnimal(animal); fetchMedicalHistory(animal); }}
                                    >
                                        <h3 style={{ margin: '0 0 5px' }}>{animal.name}</h3>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{animal.species_common_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <button
                                    className="glass-button"
                                    onClick={() => { setSelectedAnimal(null); setMedicalHistory([]); }}
                                    style={{ padding: '8px 12px' }}
                                >
                                    Back
                                </button>
                                <Activity color="var(--color-accent)" />
                                <h2 style={{ margin: 0 }}>Medical History: {selectedAnimal.name}</h2>
                            </div>

                            {!showHistoryForm ? (
                                <button
                                    className="glass-button"
                                    onClick={() => setShowHistoryForm(true)}
                                    style={{ width: '100%', marginBottom: '20px', background: 'rgba(255,255,255,0.05)' }}
                                >
                                    <Plus size={16} style={{ marginRight: '5px' }} />
                                    Add Medical Entry
                                </button>
                            ) : (
                                <form onSubmit={handleHistorySubmit} style={{ marginBottom: '30px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px' }}>
                                    <h4 style={{ marginTop: 0 }}>New Entry</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <input placeholder="Injury (optional)" className="glass-input" value={historyForm.injury} onChange={e => setHistoryForm({ ...historyForm, injury: e.target.value })} />
                                        <input placeholder="Disease (optional)" className="glass-input" value={historyForm.disease} onChange={e => setHistoryForm({ ...historyForm, disease: e.target.value })} />
                                        <input type="date" required className="glass-input" value={historyForm.date_treated} onChange={e => setHistoryForm({ ...historyForm, date_treated: e.target.value })} />
                                        <input type="number" placeholder="Age at Treatment" required className="glass-input" value={historyForm.animal_age_at_treatment} onChange={e => setHistoryForm({ ...historyForm, animal_age_at_treatment: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                        <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', flex: 1 }}>Save</button>
                                        <button type="button" className="glass-button" onClick={() => setShowHistoryForm(false)} style={{ flex: 1 }}>Cancel</button>
                                    </div>
                                </form>
                            )}

                            {historyLoading ? <p>Loading records...</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {medicalHistory.length === 0 ? (
                                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No medical history found.</p>
                                    ) : medicalHistory.map(record => (
                                        <div key={record.history_id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{new Date(record.date_treated).toLocaleDateString()}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Age: {record.animal_age_at_treatment}</span>
                                            </div>
                                            {record.disease && <p style={{ margin: '5px 0', color: 'var(--color-primary)' }}>Disease: {record.disease}</p>}
                                            {record.injury && <p style={{ margin: '5px 0', color: 'orange' }}>Injury: {record.injury}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {activeTab === 'Supplies' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Medical Supplies</h2>
                        <button
                            className="glass-button"
                            onClick={() => setShowRequestForm(!showRequestForm)}
                            style={{ background: showRequestForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showRequestForm ? 'Cancel' : '+ Request Restock'}
                        </button>
                    </div>

                    {showRequestForm && (
                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--color-primary)' }}>
                            <h3 style={{ marginTop: 0 }}>New Supply Request</h3>
                            <form onSubmit={handleRequestSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <select required className="glass-input" value={requestForm.supply_id} onChange={e => setRequestForm({ ...requestForm, supply_id: e.target.value })}>
                                    <option value="">Select Supply...</option>
                                    {supplies.map(s => (
                                        <option key={s.supply_id} value={s.supply_id}>
                                            {s.item_name} (Stock: {s.stock_count})
                                        </option>
                                    ))}
                                </select>
                                <input type="number" min="1" required placeholder="Quantity Needed" className="glass-input" value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })} />
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <input placeholder="Reason (e.g., Running low, upcoming procedure)" className="glass-input" value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-primary)', width: '100%' }}>
                                        <Send size={14} style={{ marginRight: '5px' }} />
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {suppliesLoading ? <p>Loading supplies...</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                            {supplies.map(item => (
                                <div key={item.supply_id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px',
                                    border: item.is_low_stock ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid transparent'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Package size={18} color="var(--color-text-muted)" />
                                        <div>
                                            <span style={{ fontWeight: 'bold', display: 'block' }}>{item.item_name}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                                {item.category} {item.description && `- ${item.description}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '18px', display: 'block' }}>{item.stock_count}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Stock</span>
                                        </div>
                                        {item.is_low_stock && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-accent)', background: 'rgba(244, 63, 94, 0.1)', padding: '5px 8px', borderRadius: '6px' }}>
                                                <AlertTriangle size={14} />
                                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Low</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* My Requests */}
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ClipboardList size={20} /> My Requests
                    </h3>
                    {myRequests.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No supply requests submitted yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {myRequests.map(req => (
                                <div key={req.request_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 15px', borderRadius: '10px' }}>
                                    <div>
                                        <span style={{ fontWeight: 'bold' }}>{req.item_name}</span>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginLeft: '10px' }}>Qty: {req.requested_quantity}</span>
                                        {req.reason && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{req.reason}</p>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {statusIcon(req.status)}
                                        <span style={{ color: statusColor(req.status), fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{req.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MY EVENTS TAB ═══════════ */}
            {activeTab === 'My Events' && (
                <div>
                    <h2>My Assigned Events</h2>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No events assigned to you.</p>
                        </div>
                    ) : (
                        <div className="grid-cards">
                            {events.map(event => (
                                <div key={event.event_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                        <Calendar color="var(--color-secondary)" />
                                        <h3 style={{ margin: 0 }}>{event.title}</h3>
                                    </div>
                                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>{event.description}</p>
                                    <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                        {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                        Capacity: {event.actual_attendance || 0} / {event.max_capacity}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

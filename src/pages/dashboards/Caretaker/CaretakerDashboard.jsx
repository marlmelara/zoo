import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import { logActivity } from '../../../api/activityLog';
import {
    Cat, Package, Calendar, AlertTriangle, Plus,
    ClipboardList, Clock, CheckCircle, XCircle, Send
} from 'lucide-react';

const TABS = ['My Animals', 'My Events', 'Supplies'];

export default function CaretakerDashboard() {
    const { user, employeeId, deptId } = useAuth();
    const [activeTab, setActiveTab] = useState('My Animals');

    // Resolved IDs
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

    // Animals state
    const [animals, setAnimals] = useState([]);
    const [animalsLoading, setAnimalsLoading] = useState(true);

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
            if (!user?.userId) return;

            let empId = employeeId;
            let depId = deptId;

            if (!empId || !depId) {
                try {
                    const data = await api.get('/employees/me');
                    empId = data.employee_id;
                    depId = data.dept_id;
                    setResolvedEmpId(empId);
                    setResolvedDeptId(depId);
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
    }, [user?.userId, employeeId, deptId]);

    async function fetchMyAnimals(empId) {
        if (!empId && !resolvedEmpId && !employeeId) { setAnimalsLoading(false); return; }
        try {
            const data = await api.get('/animals/assigned/caretaker');
            setAnimals(data || []);
        } catch (err) {
            console.error('Error fetching caretaker animals:', err);
            setAnimals([]);
        } finally {
            setAnimalsLoading(false);
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
        if (!empId && !resolvedEmpId && !employeeId) { setEventsLoading(false); return; }
        try {
            const data = await api.get('/events/assigned');
            // Show earliest first — this view is about what's next on my plate.
            const sorted = (data || []).slice().sort(
                (a, b) => a.event_date.localeCompare(b.event_date)
            );
            setEvents(sorted);
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
                    <h1 style={{ margin: 0 }}>Caretaker Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Animal Care & Feeding Management</p>
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
                            background: activeTab === tab ? 'var(--color-secondary)' : 'rgba(255,255,255,0.05)',
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
                                    <p style={{ color: 'var(--color-secondary)', fontSize: '14px', marginBottom: '5px' }}>
                                        {animal.species_common_name}
                                    </p>
                                    {animal.species_binomial && (
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '15px' }}>
                                            {animal.species_binomial}
                                        </p>
                                    )}
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                                        <p>Age: {animal.age} years</p>
                                        <p>Zone: {animal.zone_name || 'Unassigned'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {activeTab === 'Supplies' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Animal Care Supplies</h2>
                        <button
                            className="glass-button"
                            onClick={() => setShowRequestForm(!showRequestForm)}
                            style={{ background: showRequestForm ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showRequestForm ? 'Cancel' : '+ Request Restock'}
                        </button>
                    </div>

                    {showRequestForm && (
                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--color-secondary)' }}>
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
                                    <input placeholder="Reason (e.g., Running low, new animal arrival)" className="glass-input" value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-secondary)', width: '100%' }}>
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
                                    <p style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                                        {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

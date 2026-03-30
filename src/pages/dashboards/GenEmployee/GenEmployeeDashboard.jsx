import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import {
    Clock, Package, Calendar, AlertTriangle,
    ClipboardList, CheckCircle, XCircle, Send, User
} from 'lucide-react';

const TABS = ['My Schedule', 'Supplies', 'My Events'];

export default function GenEmployeeDashboard() {
    const { employeeId, deptId, role } = useAuth();
    const [activeTab, setActiveTab] = useState('My Schedule');

    // Profile state
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);

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
        fetchProfile();
        fetchMyEvents();
        if (deptId) {
            fetchSupplies();
            fetchMyRequests();
        }
    }, [employeeId, deptId]);

    async function fetchProfile() {
        if (!employeeId) { setProfileLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*, departments!employees_dept_id_fkey(dept_name)')
                .eq('employee_id', employeeId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setProfileLoading(false);
        }
    }

    async function fetchSupplies() {
        try {
            const data = await getSuppliesByDepartment(deptId);
            setSupplies(data);
        } catch (err) {
            console.error('Error fetching supplies:', err);
        } finally {
            setSuppliesLoading(false);
        }
    }

    async function fetchMyRequests() {
        if (!employeeId) return;
        try {
            const data = await getMySupplyRequests(employeeId);
            setMyRequests(data);
        } catch (err) {
            console.error('Error fetching my requests:', err);
        }
    }

    async function handleRequestSubmit(e) {
        e.preventDefault();
        const supply = supplies.find(s => s.supply_id === parseInt(requestForm.supply_id));
        if (!supply) return;
        try {
            await createSupplyRequest({
                requested_by: employeeId,
                supply_type: 'operational',
                item_id: supply.supply_id,
                item_name: supply.item_name,
                requested_quantity: parseInt(requestForm.quantity),
                reason: requestForm.reason
            });
            setShowRequestForm(false);
            setRequestForm({ supply_id: '', quantity: '', reason: '' });
            fetchMyRequests();
        } catch (err) {
            console.error('Error creating supply request:', err);
            alert('Failed to submit request: ' + err.message);
        }
    }

    async function fetchMyEvents() {
        if (!employeeId) { setEventsLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('event_assignments')
                .select('*, events(*)')
                .eq('employee_id', employeeId);

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

    const roleLabel = (r) => {
        switch (r) {
            case 'security': return 'Security Officer';
            case 'retail': return 'Retail Associate';
            default: return r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Employee';
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Employee Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>
                        {roleLabel(role)} Portal
                    </p>
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
                            background: activeTab === tab ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 400
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ═══════════ MY SCHEDULE TAB ═══════════ */}
            {activeTab === 'My Schedule' && (
                <div>
                    {profileLoading ? <p>Loading profile...</p> : !profile ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>Could not load employee profile.</p>
                    ) : (
                        <div>
                            <div className="glass-panel" style={{ padding: '30px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                                    <div style={{
                                        width: '60px', height: '60px', borderRadius: '50%',
                                        background: 'var(--color-primary)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <User size={30} color="white" />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0 }}>{profile.first_name} {profile.last_name}</h2>
                                        <span style={{
                                            fontSize: '13px', padding: '4px 10px', borderRadius: '20px',
                                            background: role === 'security' ? 'rgba(168,85,247,0.2)' : 'rgba(236,72,153,0.2)',
                                            textTransform: 'capitalize'
                                        }}>
                                            {roleLabel(role)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Department</p>
                                        <p style={{ fontWeight: 600, margin: 0 }}>{profile.departments?.dept_name || 'Unassigned'}</p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Shift</p>
                                        <p style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={16} color="var(--color-secondary)" />
                                            {profile.shift_timeframe || 'Not set'}
                                        </p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Contact</p>
                                        <p style={{ fontWeight: 600, margin: 0 }}>{profile.contact_info || 'Not set'}</p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 5px' }}>Pay Rate</p>
                                        <p style={{ fontWeight: 600, margin: 0 }}>${(profile.pay_rate_cents / 100).toFixed(2)}/hr</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {activeTab === 'Supplies' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Department Supplies</h2>
                        <button
                            className="glass-button"
                            onClick={() => setShowRequestForm(!showRequestForm)}
                            style={{ background: showRequestForm ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showRequestForm ? 'Cancel' : '+ Request Restock'}
                        </button>
                    </div>

                    {showRequestForm && (
                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--color-accent)' }}>
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
                                    <input placeholder="Reason for request..." className="glass-input" value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <button type="submit" className="glass-button" style={{ background: 'var(--color-accent)', width: '100%' }}>
                                        <Send size={14} style={{ marginRight: '5px' }} />
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {suppliesLoading ? <p>Loading supplies...</p> : supplies.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No supplies found for your department.</p>
                    ) : (
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
                                    <p style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                                        {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

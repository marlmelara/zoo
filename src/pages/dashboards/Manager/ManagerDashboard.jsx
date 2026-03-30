import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
    getPendingRequestsForManager,
    getAllSupplyRequests,
    reviewSupplyRequest,
    restockOperationalSupply,
    getAllOperationalSupplies
} from '../../../api/supplies';
import {
    LayoutDashboard, Users, ClipboardList, Calendar, Package,
    CheckCircle, XCircle, Clock, AlertTriangle, Shield
} from 'lucide-react';

const TABS = ['Overview', 'Supply Requests', 'My Staff', 'Events'];

export default function ManagerDashboard() {
    const { employeeId, deptId, role } = useAuth();
    const [activeTab, setActiveTab] = useState('Overview');

    // Overview state
    const [overviewStats, setOverviewStats] = useState({ staffCount: 0, pendingRequests: 0, lowStockCount: 0, upcomingEvents: 0 });
    const [overviewLoading, setOverviewLoading] = useState(true);

    // Supply Requests state
    const [pendingRequests, setPendingRequests] = useState([]);
    const [allRequests, setAllRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [requestFilter, setRequestFilter] = useState('pending');

    // Staff state
    const [staff, setStaff] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);

    // Events state
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    // Supplies overview
    const [allSupplies, setAllSupplies] = useState([]);

    const isAdmin = role === 'admin';

    useEffect(() => {
        fetchOverview();
        fetchRequests();
        fetchStaff();
        fetchEvents();
        fetchAllSupplies();
    }, [employeeId, deptId]);

    async function fetchOverview() {
        try {
            const promises = [
                supabase.from('employees').select('*', { count: 'exact', head: true }).eq('dept_id', deptId),
                supabase.from('supply_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('operational_supplies').select('*', { count: 'exact', head: true }).lte('stock_count', 10),
                supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', new Date().toISOString())
            ];

            const [staffRes, pendingRes, lowStockRes, eventsRes] = await Promise.all(promises);

            setOverviewStats({
                staffCount: staffRes.count || 0,
                pendingRequests: pendingRes.count || 0,
                lowStockCount: lowStockRes.count || 0,
                upcomingEvents: eventsRes.count || 0
            });
        } catch (err) {
            console.error('Error fetching overview:', err);
        } finally {
            setOverviewLoading(false);
        }
    }

    async function fetchRequests() {
        try {
            const [pending, all] = await Promise.all([
                getPendingRequestsForManager(isAdmin ? null : deptId),
                getAllSupplyRequests()
            ]);
            setPendingRequests(pending);
            setAllRequests(all);
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setRequestsLoading(false);
        }
    }

    async function fetchAllSupplies() {
        try {
            const data = await getAllOperationalSupplies();
            setAllSupplies(data);
        } catch (err) {
            console.error('Error fetching all supplies:', err);
        }
    }

    async function handleReview(requestId, status) {
        try {
            await reviewSupplyRequest(requestId, employeeId, status);

            // If approved, auto-restock the supply
            if (status === 'approved') {
                const request = pendingRequests.find(r => r.request_id === requestId);
                if (request && request.supply_type === 'operational') {
                    await restockOperationalSupply(request.item_id, request.requested_quantity);
                }
            }

            fetchRequests();
            fetchOverview();
            fetchAllSupplies();
        } catch (err) {
            console.error('Error reviewing request:', err);
            alert('Failed to review request: ' + err.message);
        }
    }

    async function fetchStaff() {
        try {
            let query = supabase
                .from('employees')
                .select('*, departments!employees_dept_id_fkey(dept_name), vets(license_no, specialty), animal_caretakers(specialization_species)')
                .order('employee_id', { ascending: true });

            if (!isAdmin && deptId) {
                query = query.eq('dept_id', deptId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setStaff(data || []);
        } catch (err) {
            console.error('Error fetching staff:', err);
        } finally {
            setStaffLoading(false);
        }
    }

    async function fetchEvents() {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .gte('event_date', new Date().toISOString())
                .order('event_date', { ascending: true });

            if (error) throw error;
            setEvents(data || []);
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

    const filteredRequests = requestFilter === 'pending'
        ? pendingRequests
        : requestFilter === 'all'
            ? allRequests
            : allRequests.filter(r => r.status === requestFilter);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Manager Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Department Oversight & Supply Approvals</p>
                </div>
                {overviewStats.pendingRequests > 0 && (
                    <div className="glass-panel" style={{
                        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
                        border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)'
                    }}>
                        <AlertTriangle color="#f59e0b" size={20} />
                        <span style={{ fontWeight: 600 }}>{overviewStats.pendingRequests} Pending Request{overviewStats.pendingRequests !== 1 ? 's' : ''}</span>
                    </div>
                )}
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
                            fontWeight: activeTab === tab ? 700 : 400,
                            position: 'relative'
                        }}
                    >
                        {tab}
                        {tab === 'Supply Requests' && overviewStats.pendingRequests > 0 && (
                            <span style={{
                                position: 'absolute', top: '-5px', right: '-5px',
                                background: 'var(--color-accent)', color: 'white',
                                borderRadius: '50%', width: '20px', height: '20px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 'bold'
                            }}>
                                {overviewStats.pendingRequests}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══════════ OVERVIEW TAB ═══════════ */}
            {activeTab === 'Overview' && (
                <div>
                    <div className="grid-cards" style={{ marginBottom: '30px' }}>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Department Staff</h3>
                                <Users size={20} color="var(--color-primary)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
                                {overviewLoading ? '...' : overviewStats.staffCount}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Pending Requests</h3>
                                <ClipboardList size={20} color="#f59e0b" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: overviewStats.pendingRequests > 0 ? '#f59e0b' : 'inherit' }}>
                                {overviewLoading ? '...' : overviewStats.pendingRequests}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Low Stock Items</h3>
                                <AlertTriangle size={20} color="var(--color-accent)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: overviewStats.lowStockCount > 0 ? 'var(--color-accent)' : 'inherit' }}>
                                {overviewLoading ? '...' : overviewStats.lowStockCount}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Upcoming Events</h3>
                                <Calendar size={20} color="var(--color-secondary)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
                                {overviewLoading ? '...' : overviewStats.upcomingEvents}
                            </p>
                        </div>
                    </div>

                    {/* Low Stock Supplies */}
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Package size={20} /> Low Stock Operational Supplies
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {allSupplies.filter(s => s.is_low_stock).length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)' }}>All supplies are well-stocked.</p>
                        ) : allSupplies.filter(s => s.is_low_stock).map(item => (
                            <div key={item.supply_id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'rgba(244, 63, 94, 0.05)', padding: '12px 15px', borderRadius: '10px',
                                border: '1px solid rgba(244, 63, 94, 0.2)'
                            }}>
                                <div>
                                    <span style={{ fontWeight: 'bold' }}>{item.item_name}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '10px' }}>
                                        {item.departments?.dept_name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>{item.stock_count}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>/ {item.restock_threshold} threshold</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════ SUPPLY REQUESTS TAB ═══════════ */}
            {activeTab === 'Supply Requests' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Supply Requests</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['pending', 'approved', 'denied', 'all'].map(f => (
                                <button
                                    key={f}
                                    className="glass-button"
                                    onClick={() => setRequestFilter(f)}
                                    style={{
                                        padding: '6px 14px', fontSize: '12px',
                                        background: requestFilter === f ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {requestsLoading ? <p>Loading requests...</p> : filteredRequests.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <ClipboardList size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No {requestFilter !== 'all' ? requestFilter : ''} requests found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredRequests.map(req => (
                                <div key={req.request_id} className="glass-panel" style={{
                                    padding: '20px',
                                    border: req.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 5px' }}>{req.item_name}</h3>
                                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                                Requested by: <strong>{req.requester?.first_name} {req.requester?.last_name}</strong>
                                                {req.requester?.departments?.dept_name && (
                                                    <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: 'rgba(255,255,255,0.1)' }}>
                                                        {req.requester.departments.dept_name}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {req.status === 'pending' ? <Clock size={16} color="#f59e0b" /> :
                                                req.status === 'approved' ? <CheckCircle size={16} color="#10b981" /> :
                                                    <XCircle size={16} color="#ef4444" />}
                                            <span style={{ color: statusColor(req.status), fontWeight: 600, textTransform: 'capitalize' }}>
                                                {req.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                                        <span>Quantity: <strong style={{ color: 'white' }}>{req.requested_quantity}</strong></span>
                                        <span>Type: <strong style={{ color: 'white', textTransform: 'capitalize' }}>{req.supply_type}</strong></span>
                                        <span>Date: {new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>

                                    {req.reason && (
                                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 15px', fontStyle: 'italic' }}>
                                            "{req.reason}"
                                        </p>
                                    )}

                                    {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                className="glass-button"
                                                onClick={() => handleReview(req.request_id, 'approved')}
                                                style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                <CheckCircle size={16} /> Approve & Restock
                                            </button>
                                            <button
                                                className="glass-button"
                                                onClick={() => handleReview(req.request_id, 'denied')}
                                                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                <XCircle size={16} /> Deny
                                            </button>
                                        </div>
                                    )}

                                    {req.reviewer && (
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '10px 0 0' }}>
                                            Reviewed by {req.reviewer.first_name} {req.reviewer.last_name}
                                            {req.reviewed_at && ` on ${new Date(req.reviewed_at).toLocaleDateString()}`}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MY STAFF TAB ═══════════ */}
            {activeTab === 'My Staff' && (
                <div>
                    <h2>Department Staff</h2>
                    {staffLoading ? <p>Loading staff...</p> : staff.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Users size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No staff in your department.</p>
                        </div>
                    ) : (
                        <div className="grid-cards">
                            {staff.map(person => (
                                <div key={person.employee_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 5px' }}>{person.first_name} {person.last_name}</h3>
                                            <span style={{
                                                fontSize: '12px', padding: '4px 8px', borderRadius: '20px',
                                                background: 'rgba(255,255,255,0.1)', color: 'var(--color-text-muted)'
                                            }}>
                                                {person.departments?.dept_name || 'Unassigned'}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: '11px', padding: '3px 8px', borderRadius: '10px',
                                            background: person.role === 'vet' ? 'rgba(16,185,129,0.2)' :
                                                person.role === 'caretaker' ? 'rgba(59,130,246,0.2)' :
                                                    person.role === 'security' ? 'rgba(168,85,247,0.2)' :
                                                        'rgba(255,255,255,0.1)',
                                            textTransform: 'capitalize'
                                        }}>
                                            {person.role}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <p>Shift: {person.shift_timeframe || 'N/A'}</p>
                                        <p>Contact: {person.contact_info || 'N/A'}</p>
                                        {person.vets && <p style={{ color: 'var(--color-primary)' }}>Specialty: {person.vets.specialty}</p>}
                                        {person.animal_caretakers && <p>Species: {person.animal_caretakers.specialization_species}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ EVENTS TAB ═══════════ */}
            {activeTab === 'Events' && (
                <div>
                    <h2>Upcoming Events</h2>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No upcoming events.</p>
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
                                        {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <div style={{ marginTop: '10px', height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${event.max_capacity ? (event.actual_attendance / event.max_capacity) * 100 : 0}%`,
                                            background: 'var(--color-secondary)', borderRadius: '3px'
                                        }} />
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '5px' }}>
                                        {event.actual_attendance || 0} / {event.max_capacity} capacity
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

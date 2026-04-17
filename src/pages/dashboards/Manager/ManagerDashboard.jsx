import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import {
    getPendingRequestsForManager,
    getAllSupplyRequests,
    reviewSupplyRequest,
    restockOperationalSupply,
    getAllOperationalSupplies
} from '../../../api/supplies';
import { getRecentActivity, getDepartmentActivity, logActivity } from '../../../api/activityLog';
import {
    LayoutDashboard, Users, ClipboardList, Calendar, Package,
    CheckCircle, XCircle, Clock, AlertTriangle, Shield, Activity,
    Cat, UserPlus
} from 'lucide-react';

const TABS = ['Overview', 'Supply Requests', 'My Staff', 'Animal Assignments', 'Events', 'Activity Log'];

export default function ManagerDashboard() {
    const { user, employeeId, deptId, role } = useAuth();
    const [activeTab, setActiveTab] = useState('Overview');

    // Resolved IDs — fetched directly from DB to avoid context timing issues
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

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

    // Activity log state
    const [activityLog, setActivityLog] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);

    // Animal assignments state
    const [allAnimals, setAllAnimals] = useState([]);
    const [animalsLoading, setAnimalsLoading] = useState(true);
    const [vets, setVets] = useState([]);
    const [caretakers, setCaretakers] = useState([]);


    const isAdmin = role === 'admin';

    // Resolve employee profile directly from DB using auth user ID
    useEffect(() => {
        async function loadDashboard() {
            if (!user?.userId) return;

            let empId = employeeId;
            let depId = deptId;

            // If context IDs aren't ready yet, fetch directly
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

            if (!empId || !depId) return;

            // Now fetch everything with resolved IDs
            fetchOverview(depId);
            fetchRequests(depId);
            fetchStaff(depId);
            fetchEvents();
            fetchAllSupplies();
            fetchActivityLog(depId);
            fetchAnimalsWithAssignments();
            fetchVetsAndCaretakers();
        }

        loadDashboard();
    }, [user?.userId, employeeId, deptId]);

    async function fetchOverview(depId) {
        try {
            const data = await api.get('/dashboard/stats');
            setOverviewStats({
                staffCount: data.total_employees || 0,
                pendingRequests: data.pending_requests || 0,
                lowStockCount: data.low_stock_count || 0,
                upcomingEvents: 0, // will be updated when events load
            });
        } catch (err) {
            console.error('Error fetching overview:', err);
        } finally {
            setOverviewLoading(false);
        }
    }

    async function fetchRequests(depId) {
        const id = depId || resolvedDeptId || deptId;
        try {
            const [pending, all] = await Promise.all([
                getPendingRequestsForManager(isAdmin ? null : id),
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

    async function fetchActivityLog(depId) {
        const id = depId || resolvedDeptId || deptId;
        try {
            const data = isAdmin
                ? await getRecentActivity(30)
                : await getDepartmentActivity(id, 30);
            setActivityLog(data);
        } catch (err) {
            console.error('Error fetching activity log:', err);
        } finally {
            setActivityLoading(false);
        }
    }

    async function handleReview(requestId, status) {
        const empId = resolvedEmpId || employeeId;
        try {
            const request = pendingRequests.find(r => r.request_id === requestId);
            await reviewSupplyRequest(requestId, empId, status);

            // If approved, auto-restock the supply
            if (status === 'approved' && request && request.supply_type === 'operational') {
                await restockOperationalSupply(request.item_id, request.requested_quantity);
            }

            // Log the activity
            await logActivity({
                action_type: status === 'approved' ? 'supply_request_approved' : 'supply_request_denied',
                description: `${status === 'approved' ? 'Approved' : 'Denied'} request for ${request?.requested_quantity}x ${request?.item_name}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: requestId,
                metadata: { item_name: request?.item_name, quantity: request?.requested_quantity, status }
            });

            fetchRequests(resolvedDeptId);
            fetchOverview(resolvedDeptId);
            fetchAllSupplies();
            fetchActivityLog(resolvedDeptId);
        } catch (err) {
            console.error('Error reviewing request:', err);
            alert('Failed to review request: ' + err.message);
        }
    }

    async function fetchStaff(depId) {
        const id = depId || resolvedDeptId || deptId;
        try {
            const data = await api.get('/employees');
            const filtered = (!isAdmin && id)
                ? data.filter(e => e.dept_id === id || e.dept_id === parseInt(id))
                : data;
            setStaff(filtered);
        } catch (err) {
            console.error('Error fetching staff:', err);
        } finally {
            setStaffLoading(false);
        }
    }

    async function fetchEvents() {
        try {
            // /events/with-assignments returns each event with venue_name + assignments[] embedded
            const data = await api.get('/events/with-assignments');
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    async function fetchAnimalsWithAssignments() {
        try {
            // Returns animals with zone_name (flat) + vet_assignments[] + caretaker_assignments[]
            const data = await api.get('/animals/with-assignments');
            setAllAnimals(data || []);
        } catch (err) {
            console.error('Error fetching animals:', err);
        } finally {
            setAnimalsLoading(false);
        }
    }

    async function fetchVetsAndCaretakers() {
        try {
            const [vetData, ctData] = await Promise.all([
                api.get('/employees/vets'),
                api.get('/employees/caretakers'),
            ]);
            setVets(vetData || []);
            setCaretakers(ctData || []);
        } catch (err) {
            console.error('Error fetching vets/caretakers:', err);
        }
    }

    async function handleAssignVet(animalId, vetEmployeeId) {
        try {
            await api.post(`/animals/${animalId}/vet-assign`, { vet_id: vetEmployeeId });
            await logActivity({
                action_type: 'animal_vet_assigned',
                description: `Assigned vet to animal #${animalId}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'animal',
                target_id: animalId
            });
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error assigning vet:', err);
            alert('Failed to assign vet: ' + err.message);
        }
    }

    async function handleRemoveVetAssignment(vetId, animalId) {
        try {
            await api.delete(`/animals/${animalId}/vet-assign/${vetId}`);
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error removing vet:', err);
        }
    }

    async function handleAssignCaretaker(animalId, caretakerEmployeeId) {
        try {
            await api.post(`/animals/${animalId}/caretaker-assign`, { caretaker_id: caretakerEmployeeId });
            await logActivity({
                action_type: 'animal_caretaker_assigned',
                description: `Assigned caretaker to animal #${animalId}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'animal',
                target_id: animalId
            });
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error assigning caretaker:', err);
            alert('Failed to assign caretaker: ' + err.message);
        }
    }

    async function handleRemoveCaretakerAssignment(caretakerId, animalId) {
        try {
            await api.delete(`/animals/${animalId}/caretaker-assign/${caretakerId}`);
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error removing caretaker:', err);
        }
    }

    async function handleAssignEmployeeToEvent(eventId, empIdToAssign) {
        try {
            await api.post(`/events/${eventId}/assign-employee`, { employee_id: empIdToAssign });
            await logActivity({
                action_type: 'event_employee_assigned',
                description: `Assigned employee #${empIdToAssign} to event #${eventId}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'event',
                target_id: eventId
            });
            fetchEvents();
        } catch (err) {
            console.error('Error assigning employee to event:', err);
            alert('Failed to assign: ' + err.message);
        }
    }

    async function handleRemoveEventAssignment(assignmentId) {
        try {
            await api.delete(`/events/assignments/${assignmentId}`);
            fetchEvents();
        } catch (err) {
            console.error('Error removing assignment:', err);
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
                                                {person.dept_name || 'Unassigned'}
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

            {/* ═══════════ ACTIVITY LOG TAB ═══════════ */}
            {activeTab === 'Activity Log' && (
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={24} /> Recent Activity
                    </h2>
                    {activityLoading ? <p>Loading activity...</p> : activityLog.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Activity size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No activity recorded yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {activityLog.map(log => (
                                <div key={log.log_id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.05)', padding: '14px 18px', borderRadius: '10px',
                                    borderLeft: `3px solid ${
                                        log.action_type.includes('approved') ? '#10b981' :
                                        log.action_type.includes('denied') ? '#ef4444' :
                                        log.action_type.includes('created') ? '#3b82f6' :
                                        '#f59e0b'
                                    }`
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{log.description}</span>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                            {log.performer
                                                ? `${log.performer.first_name} ${log.performer.last_name} (${log.performer.role})`
                                                : 'System'}
                                            <span style={{
                                                marginLeft: '10px', padding: '2px 6px', borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.08)', fontSize: '11px'
                                            }}>
                                                {log.action_type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                                        <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ ANIMAL ASSIGNMENTS TAB ═══════════ */}
            {activeTab === 'Animal Assignments' && (
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Cat size={24} /> Animal Assignments
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                        Assign vets and caretakers to animals.
                    </p>

                    {animalsLoading ? <p>Loading animals...</p> : allAnimals.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Cat size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No animals found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {allAnimals.map(animal => {
                                const assignedVets = animal.vet_assignments || [];
                                const assignedVetIds = assignedVets.map(a => a.vet_id);
                                const assignedCts = animal.caretaker_assignments || [];
                                const assignedCtIds = assignedCts.map(a => a.caretaker_id);

                                return (
                                    <div key={animal.animal_id} className="glass-panel" style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '15px' }}>
                                            <div style={{ minWidth: '200px' }}>
                                                <h3 style={{ margin: '0 0 5px' }}>{animal.name}</h3>
                                                <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: '0 0 3px' }}>
                                                    {animal.species_common_name}
                                                </p>
                                                {animal.species_binomial && (
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                                                        {animal.species_binomial}
                                                    </p>
                                                )}
                                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '5px 0 0' }}>
                                                    Zone: {animal.zone_name || 'Unassigned'} | Age: {animal.age}
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                                {/* Vet Assignments (multiple) */}
                                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', minWidth: '220px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Assigned Vets</p>
                                                    {assignedVets.length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                                            {assignedVets.map(a => (
                                                                <div key={a.vet_id} style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '13px'
                                                                }}>
                                                                    <span>{a.first_name} {a.last_name}</span>
                                                                    <button
                                                                        onClick={() => handleRemoveVetAssignment(a.vet_id, animal.animal_id)}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                                        title="Remove"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <select
                                                        className="glass-input"
                                                        style={{ width: '100%', fontSize: '13px' }}
                                                        value=""
                                                        onChange={e => {
                                                            const vetId = parseInt(e.target.value);
                                                            if (vetId) handleAssignVet(animal.animal_id, vetId);
                                                        }}
                                                    >
                                                        <option value="">+ Add vet...</option>
                                                        {vets
                                                            .filter(v => !assignedVetIds.includes(v.employee_id))
                                                            .map(v => (
                                                                <option key={v.employee_id} value={v.employee_id}>
                                                                    {v.first_name} {v.last_name} — {v.specialty}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>

                                                {/* Caretaker Assignments (multiple) */}
                                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', minWidth: '220px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Assigned Caretakers</p>
                                                    {assignedCts.length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                                            {assignedCts.map(a => (
                                                                <div key={a.caretaker_id} style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '13px'
                                                                }}>
                                                                    <span>{a.first_name} {a.last_name}</span>
                                                                    <button
                                                                        onClick={() => handleRemoveCaretakerAssignment(a.caretaker_id, animal.animal_id)}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                                        title="Remove"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <select
                                                        className="glass-input"
                                                        style={{ width: '100%', fontSize: '13px' }}
                                                        value=""
                                                        onChange={e => {
                                                            const ctId = parseInt(e.target.value);
                                                            if (ctId) handleAssignCaretaker(animal.animal_id, ctId);
                                                        }}
                                                    >
                                                        <option value="">+ Add caretaker...</option>
                                                        {caretakers
                                                            .filter(c => !assignedCtIds.includes(c.employee_id))
                                                            .map(c => (
                                                                <option key={c.employee_id} value={c.employee_id}>
                                                                    {c.first_name} {c.last_name} — {c.specialization_species}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ EVENTS TAB ═══════════ */}
            {activeTab === 'Events' && (
                <div>
                    <h2>Events</h2>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No events found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {events.map(event => {
                                const assigned = event.assignments || [];
                                return (
                                    <div key={event.event_id} className="glass-panel" style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                    <Calendar color="var(--color-secondary)" size={20} />
                                                    <h3 style={{ margin: 0 }}>{event.title}</h3>
                                                </div>
                                                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '5px 0' }}>{event.description}</p>
                                                <p style={{ color: 'var(--color-secondary)', fontWeight: 600, fontSize: '14px' }}>
                                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                {event.start_time && event.end_time && (
                                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0' }}>
                                                        <Clock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                        {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                                                    </p>
                                                )}
                                                {event.venue_id && (
                                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0' }}>
                                                        📍 {event.venue_name || 'Unknown venue'}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                                {event.actual_attendance || 0} / {event.max_capacity} capacity
                                            </div>
                                        </div>

                                        {/* Personnel & Animals */}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '10px' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Personnel:</p>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                {assigned.filter(a => a.employee_id).length === 0 ? (
                                                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No staff assigned</span>
                                                ) : assigned.filter(a => a.employee_id).map(a => (
                                                    <div key={a.assignment_id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'rgba(255,255,255,0.08)', padding: '5px 10px', borderRadius: '8px', fontSize: '13px'
                                                    }}>
                                                        <Users size={14} />
                                                        <span>{a.first_name} {a.last_name}</span>
                                                        <button
                                                            onClick={() => handleRemoveEventAssignment(a.assignment_id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                            title="Remove"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Animals:</p>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                {assigned.filter(a => a.animal_id).length === 0 ? (
                                                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No animals assigned</span>
                                                ) : assigned.filter(a => a.animal_id).map(a => (
                                                    <div key={a.assignment_id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'rgba(255,255,255,0.08)', padding: '5px 10px', borderRadius: '8px', fontSize: '13px'
                                                    }}>
                                                        <Cat size={14} />
                                                        <span>{a.animal_name}</span>
                                                        <button
                                                            onClick={() => handleRemoveEventAssignment(a.assignment_id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                            title="Remove"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Assign new employee */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <select
                                                    className="glass-input"
                                                    style={{ flex: 1, fontSize: '13px' }}
                                                    id={`event-assign-${event.event_id}`}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select employee to assign...</option>
                                                    {staff
                                                        .filter(s => !assigned.some(a => a.employee_id === s.employee_id))
                                                        .map(s => (
                                                            <option key={s.employee_id} value={s.employee_id}>
                                                                {s.first_name} {s.last_name} ({s.role})
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                                <button
                                                    className="glass-button"
                                                    style={{ background: 'var(--color-secondary)', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    onClick={() => {
                                                        const sel = document.getElementById(`event-assign-${event.event_id}`);
                                                        if (sel.value) {
                                                            handleAssignEmployeeToEvent(event.event_id, parseInt(sel.value));
                                                            sel.value = '';
                                                        }
                                                    }}
                                                >
                                                    <UserPlus size={14} /> Assign
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

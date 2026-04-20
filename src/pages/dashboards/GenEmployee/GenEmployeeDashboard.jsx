import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import { logActivity } from '../../../api/activityLog';
import { useToast } from '../../../components/Feedback';
import {
    EmployeeSuppliesPanel, EmployeeRequestsPanel, EmployeeEventsPanel,
} from '../../../components/EmployeeDashboardPanels';
import { Clock, User } from 'lucide-react';

const TABS = ['My Schedule', 'My Events', 'Supplies', 'My Requests'];

export default function GenEmployeeDashboard() {
    const { user, employeeId, deptId, role } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('My Schedule');

    // Profile state — holds the full employee record + resolved IDs
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

    // Supplies state — both operational and retail. Retail employees can
    // request restocks for shop inventory in addition to operational supplies.
    const [supplies, setSupplies] = useState([]);
    const [retailItems, setRetailItems] = useState([]);
    const [suppliesLoading, setSuppliesLoading] = useState(true);
    const [myRequests, setMyRequests] = useState([]);
    const [showRequestForm, setShowRequestForm] = useState(false);
    // supply_id now carries a composite key like "op-123" or "retail-45" so
    // we can tell which list to hit.
    const [requestForm, setRequestForm] = useState({ supply_id: '', quantity: '', reason: '' });

    const isRetail = role === 'retail';

    // Events state
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    // Fetch profile directly using auth user ID — avoids context timing issues
    useEffect(() => {
        async function loadAll() {
            if (!user?.userId) {
                setProfileLoading(false);
                setSuppliesLoading(false);
                return;
            }

            try {
                // Get employee record by auth user_id
                const data = await api.get('/employees/me');
                setProfile(data);
                setResolvedEmpId(data.employee_id);
                setResolvedDeptId(data.dept_id);

                // Now fetch supplies and requests with the resolved IDs
                if (data.dept_id) {
                    const supplyData = await getSuppliesByDepartment(data.dept_id);
                    setSupplies(supplyData);
                }
                // Retail associates can also request shop inventory restocks.
                if (data.role === 'retail' || role === 'retail') {
                    try {
                        const retailData = await api.get('/inventory');
                        setRetailItems(retailData || []);
                    } catch (err) {
                        console.error('Error fetching retail inventory:', err);
                    }
                }
                if (data.employee_id) {
                    const reqData = await getMySupplyRequests(data.employee_id);
                    setMyRequests(reqData);
                    fetchMyEvents(data.employee_id);
                }
            } catch (err) {
                console.error('Error loading dashboard data:', err);
            } finally {
                setProfileLoading(false);
                setSuppliesLoading(false);
            }
        }

        loadAll();
    }, [user?.userId]);

    // Keep resolved IDs in sync if context updates later
    useEffect(() => {
        if (employeeId) setResolvedEmpId(employeeId);
        if (deptId) setResolvedDeptId(deptId);
    }, [employeeId, deptId]);

    async function fetchSupplies() {
        const id = resolvedDeptId || deptId;
        if (!id) return;
        try {
            const data = await getSuppliesByDepartment(id);
            setSupplies(data);
        } catch (err) {
            console.error('Error fetching supplies:', err);
        }
    }

    async function fetchMyRequests() {
        const id = resolvedEmpId || employeeId;
        if (!id) return;
        try {
            const data = await getMySupplyRequests(id);
            setMyRequests(data);
        } catch (err) {
            console.error('Error fetching my requests:', err);
        }
    }

    async function fetchMyEvents(empId) {
        if (!empId && !resolvedEmpId && !employeeId) { setEventsLoading(false); return; }
        try {
            const data = await api.get('/events/assigned');
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    async function handleRequestSubmit(e) {
        e.preventDefault();
        const empId = resolvedEmpId || employeeId;
        if (!requestForm.supply_id || !empId) return;

        // supply_id is "op-<id>" or "retail-<id>" so we know which catalog it came from.
        const [kind, rawId] = String(requestForm.supply_id).split('-');
        const itemId = parseInt(rawId, 10);
        const item = kind === 'retail'
            ? retailItems.find(r => r.item_id === itemId)
            : supplies.find(s => s.supply_id === itemId);
        if (!item) return;
        const supplyType = kind === 'retail' ? 'retail' : 'operational';
        const itemName   = item.item_name;
        const action     = requestForm.action === 'remove' ? 'remove' : 'restock';

        try {
            const newRequest = await createSupplyRequest({
                requested_by: empId,
                supply_type: supplyType,
                action,
                item_id: itemId,
                item_name: itemName,
                requested_quantity: parseInt(requestForm.quantity),
                reason: requestForm.reason,
            });
            await logActivity({
                action_type: 'supply_request_created',
                description: `Requested ${action === 'remove' ? 'removal of ' : ''}${requestForm.quantity}x ${itemName}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: newRequest.request_id,
                metadata: { item_name: itemName, supply_type: supplyType, action,
                            quantity: parseInt(requestForm.quantity), reason: requestForm.reason },
            });
            setShowRequestForm(false);
            setRequestForm({ supply_id: '', quantity: '', reason: '', action: 'restock' });
            fetchMyRequests();
            fetchSupplies();
            if (isRetail) {
                try { setRetailItems(await api.get('/inventory')); } catch {}
            }
        } catch (err) {
            console.error('Error creating supply request:', err);
            toast.error('Failed to submit request: ' + err.message);
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
                                        <p style={{ fontWeight: 600, margin: 0 }}>{profile.dept_name || 'Unassigned'}</p>
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

            {/* ═══════════ MY EVENTS TAB ═══════════ */}
            {activeTab === 'My Events' && (
                <EmployeeEventsPanel events={events} loading={eventsLoading} accentColor="var(--color-accent)" />
            )}

            {/* ═══════════ MY REQUESTS TAB ═══════════ */}
            {activeTab === 'My Requests' && (
                <EmployeeRequestsPanel myRequests={myRequests} loading={suppliesLoading} />
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {activeTab === 'Supplies' && (
                <EmployeeSuppliesPanel
                    title="Department Supplies"
                    supplies={supplies}
                    suppliesLoading={suppliesLoading}
                    retailItems={isRetail ? retailItems : null}
                    showRequestForm={showRequestForm}
                    setShowRequestForm={setShowRequestForm}
                    requestForm={requestForm}
                    setRequestForm={setRequestForm}
                    onSubmitRequest={handleRequestSubmit}
                    emptyLabel="No supplies available for your department."
                />
            )}
        </div>
    );
}

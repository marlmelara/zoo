import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import { logActivity } from '../../../api/activityLog';
import { useToast } from '../../../components/Feedback';
import {
    Clock, Package, AlertTriangle, Calendar,
    ClipboardList, CheckCircle, XCircle, Send, User
} from 'lucide-react';

const TABS = ['My Schedule', 'My Events', 'Supplies'];

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

    // Recommended restock quantity: aim for ~2x threshold so we have a buffer.
    const recommendRestock = (stock, threshold) => {
        const t = Number(threshold) || 0;
        const s = Number(stock)     || 0;
        return Math.max(Math.round(t * 2 - s), 1);
    };

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

        try {
            const newRequest = await createSupplyRequest({
                requested_by: empId,
                supply_type: supplyType,
                item_id: itemId,
                item_name: itemName,
                requested_quantity: parseInt(requestForm.quantity),
                reason: requestForm.reason,
            });
            await logActivity({
                action_type: 'supply_request_created',
                description: `Requested ${requestForm.quantity}x ${itemName}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: newRequest.request_id,
                metadata: { item_name: itemName, supply_type: supplyType,
                            quantity: parseInt(requestForm.quantity), reason: requestForm.reason },
            });
            setShowRequestForm(false);
            setRequestForm({ supply_id: '', quantity: '', reason: '' });
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
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={24} /> My Assigned Events
                    </h2>
                    {eventsLoading ? <p>Loading events...</p> : events.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No events assigned to you yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {events.map(event => (
                                <div key={event.event_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                <Calendar color="var(--color-secondary)" size={20} />
                                                <h3 style={{ margin: 0 }}>{event.title}</h3>
                                            </div>
                                            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '5px 0' }}>{event.description}</p>
                                            <p style={{ color: 'var(--color-secondary)', fontWeight: 600, fontSize: '14px' }}>
                                                {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                            {event.max_capacity && `${event.actual_attendance || 0} / ${event.max_capacity} capacity`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {/* (StockRow used below is defined at file scope) */}
            {activeTab === 'Supplies' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Department Supplies</h2>
                        <button
                            className="glass-button"
                            onClick={() => setShowRequestForm(!showRequestForm)}
                            style={{ background: showRequestForm ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {showRequestForm ? 'Cancel' : '+ Request Restock'}
                        </button>
                    </div>

                    {showRequestForm && (
                        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', border: '1px solid var(--color-accent)' }}>
                            <h3 style={{ marginTop: 0 }}>New Supply Request</h3>
                            <form onSubmit={handleRequestSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <select required className="glass-input" value={requestForm.supply_id} onChange={e => {
                                    const v = e.target.value;
                                    // Auto-fill quantity with recommended restock if the selected item is low.
                                    let rec = '';
                                    if (v) {
                                        const [kind, rawId] = v.split('-');
                                        const id = parseInt(rawId, 10);
                                        const item = kind === 'retail'
                                            ? retailItems.find(r => r.item_id === id)
                                            : supplies.find(s => s.supply_id === id);
                                        if (item && item.is_low_stock) {
                                            rec = String(recommendRestock(item.stock_count, item.restock_threshold));
                                        }
                                    }
                                    setRequestForm({ ...requestForm, supply_id: v, quantity: rec || requestForm.quantity });
                                }}>
                                    <option value="">Select Supply...</option>
                                    {supplies.length > 0 && (
                                        <optgroup label="Operational Supplies">
                                            {supplies.map(s => (
                                                <option key={`op-${s.supply_id}`} value={`op-${s.supply_id}`}>
                                                    {s.item_name} — stock {s.stock_count} / threshold {s.restock_threshold}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {isRetail && retailItems.length > 0 && (
                                        <optgroup label="Shop Inventory (Retail)">
                                            {retailItems.map(r => (
                                                <option key={`retail-${r.item_id}`} value={`retail-${r.item_id}`}>
                                                    {r.item_name} — stock {r.stock_count} / threshold {r.restock_threshold}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
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
                        <p style={{ color: 'var(--color-text-dark)' }}>No supplies found for your department.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                            {supplies.map(item => (
                                <StockRow
                                    key={item.supply_id}
                                    name={item.item_name}
                                    subtitle={`${item.category || 'Supplies'}${item.description ? ' - ' + item.description : ''}`}
                                    stock={item.stock_count}
                                    threshold={item.restock_threshold}
                                    isLow={!!item.is_low_stock}
                                    recommend={recommendRestock(item.stock_count, item.restock_threshold)}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Retail associates also see shop inventory ── */}
                    {isRetail && retailItems.length > 0 && (
                        <>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-dark)' }}>
                                <Package size={20} /> Shop Inventory
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                                {retailItems.map(item => (
                                    <StockRow
                                        key={item.item_id}
                                        name={item.item_name}
                                        subtitle={`${item.category || 'Retail'}`}
                                        stock={item.stock_count}
                                        threshold={item.restock_threshold}
                                        isLow={!!item.is_low_stock}
                                        recommend={recommendRestock(item.stock_count, item.restock_threshold)}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {/* My Requests */}
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ClipboardList size={20} /> My Requests
                    </h3>
                    {myRequests.length === 0 ? (
                        <p style={{ color: 'var(--color-text-dark)' }}>No supply requests submitted yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {myRequests.map(req => (
                                <div key={req.request_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 245, 231, 0.78)', padding: '12px 15px', borderRadius: '10px', border: '1px solid rgba(121,162,128,0.25)' }}>
                                    <div>
                                        <span style={{ fontWeight: 700, color: 'var(--color-text-dark)' }}>{req.item_name}</span>
                                        <span style={{ color: 'var(--color-text-dark)', fontSize: '13px', marginLeft: '10px' }}>Qty: <strong>{req.requested_quantity}</strong></span>
                                        {req.reason && (
                                            <p style={{ fontSize: '13px', color: 'var(--color-text-dark)', margin: '4px 0 0' }}>
                                                <strong>Reason:</strong> {req.reason}
                                            </p>
                                        )}
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
        </div>
    );
}

// ─── Reusable stock row ────────────────────────────────────────
function StockRow({ name, subtitle, stock, threshold, isLow, recommend }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255, 245, 231, 0.78)',
            padding: '14px 16px', borderRadius: '10px',
            border: isLow ? '1px solid rgba(239, 68, 68, 0.45)'
                          : '1px solid rgba(121, 162, 128, 0.25)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <Package size={20} color={isLow ? '#dc2626' : 'rgb(102, 122, 66)'} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '15px' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-dark)', opacity: 0.8 }}>{subtitle}</div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>
                        <strong style={{ fontSize: '18px' }}>{stock}</strong>
                        <span style={{ opacity: 0.7 }}> / threshold {threshold}</span>
                    </div>
                    {isLow ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      marginTop: '4px', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
                                      padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                            <AlertTriangle size={12} /> Low — recommended restock: {recommend}
                        </div>
                    ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      marginTop: '4px', color: 'rgb(102, 122, 66)',
                                      background: 'rgba(16,185,129,0.12)',
                                      padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                            <CheckCircle size={12} /> Healthy stock
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

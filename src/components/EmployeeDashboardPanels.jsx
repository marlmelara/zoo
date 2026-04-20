// Shared panels used by every employee dashboard (Vet, Caretaker, General)
// so the Supplies / My Requests / My Events views stay identical in behavior.
// Consolidating them here fixed a tangle where each dashboard had its own
// slightly-different copy — drifting on button colors, missing threshold
// displays, and inconsistent paginator support.
import React, { useMemo, useState } from 'react';
import {
    Package, AlertTriangle, CheckCircle, XCircle, Clock,
    ClipboardList, Send, Calendar,
} from 'lucide-react';
import ZooPaginator from './ZooPaginator';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

// Aim for a buffer of ~2x threshold when restocking so we don't hit low-stock
// the moment the request lands. If already above threshold, recommend at
// least 1 so the form stays usable.
function recommendRestock(stock, threshold) {
    const t = Number(threshold) || 0;
    const s = Number(stock)     || 0;
    return Math.max(Math.round(t * 2 - s), 1);
}

// ─── Single stock row, shared between Operational + Retail lists ───
function StockRow({ item }) {
    const isLow = !!item.is_low_stock;
    const recommend = recommendRestock(item.stock_count, item.restock_threshold);
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255, 245, 231, 0.78)',
            padding: '14px 16px', borderRadius: '10px',
            border: isLow ? '1px solid rgba(239, 68, 68, 0.45)'
                          : '1px solid rgba(121, 162, 128, 0.25)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <Package size={20} color={isLow ? '#dc2626' : GREEN_DARK} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '15px' }}>
                        {item.item_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-dark)', opacity: 0.8 }}>
                        {item.category || 'Supplies'}{item.description ? ` — ${item.description}` : ''}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>
                        <strong style={{ fontSize: '18px' }}>{item.stock_count}</strong>
                        <span style={{ opacity: 0.7 }}> / threshold {item.restock_threshold}</span>
                    </div>
                    {isLow ? (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            marginTop: '4px', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                        }}>
                            <AlertTriangle size={12} /> Low — recommended restock: {recommend}
                        </div>
                    ) : (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            marginTop: '4px', color: GREEN_DARK,
                            background: 'rgba(121,162,128,0.18)',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                        }}>
                            <CheckCircle size={12} /> Healthy stock
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Supplies panel (list + request-restock form) ───────────────────────
// Themed to the green palette so the "+ Request Restock" button is visible
// and consistent with the rest of the dashboard — the previous near-white
// button on cream was effectively invisible.
export function EmployeeSuppliesPanel({
    title = 'Supplies',
    supplies = [],
    suppliesLoading = false,
    retailItems = null,          // array or null — only Retail associates get this
    showRequestForm,
    setShowRequestForm,
    requestForm,
    setRequestForm,
    onSubmitRequest,
    emptyLabel = 'No supplies available for your department.',
}) {
    const hasRetail = Array.isArray(retailItems) && retailItems.length > 0;

    return (
        <div>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '14px', flexWrap: 'wrap', gap: '10px',
            }}>
                <h2 style={{ margin: 0 }}>{title}</h2>
                <button
                    type="button"
                    className="glass-button"
                    onClick={() => setShowRequestForm(!showRequestForm)}
                    style={{
                        background: showRequestForm ? 'rgba(239, 68, 68, 0.18)' : GREEN,
                        color: showRequestForm ? '#b91c1c' : 'white',
                        padding: '10px 18px',
                        fontSize: '14px', fontWeight: 700,
                        border: showRequestForm ? '1px solid rgba(239,68,68,0.35)' : 'none',
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    {showRequestForm ? '× Cancel' : '+ Request Restock'}
                </button>
            </div>

            {showRequestForm && (
                <div className="glass-panel" style={{
                    padding: '20px', marginBottom: '20px',
                    border: `1px solid ${GREEN}`,
                    background: 'rgba(255, 245, 231, 0.9)',
                }}>
                    <h3 style={{ marginTop: 0, color: GREEN_DARK }}>New Supply Request</h3>
                    {/* Action toggle — Restock (add) vs Remove (write-off).
                        Removes are for damaged/expired stock that needs to
                        leave the count; manager approval is still required. */}
                    <div style={{
                        display: 'inline-flex', gap: '4px',
                        background: 'rgba(255, 245, 231, 0.72)',
                        border: '1px solid rgba(121,162,128,0.25)',
                        padding: '4px 6px', borderRadius: '12px', marginBottom: '15px',
                    }}>
                        <span style={{
                            fontSize: '10px', color: GREEN_DARK, alignSelf: 'center',
                            padding: '0 10px', textTransform: 'uppercase',
                            letterSpacing: '0.08em', fontWeight: 700,
                        }}>Action</span>
                        {[
                            { key: 'restock', label: 'Restock' },
                            { key: 'remove',  label: 'Remove' },
                        ].map(t => {
                            const active = (requestForm.action || 'restock') === t.key;
                            return (
                                <button key={t.key} type="button"
                                    onClick={() => setRequestForm({ ...requestForm, action: t.key })}
                                    style={{
                                        padding: '6px 14px', fontSize: '12px',
                                        background: active ? (t.key === 'remove' ? '#dc2626' : GREEN) : 'transparent',
                                        color: active ? 'white' : GREEN_DARK,
                                        fontWeight: active ? 700 : 500,
                                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                                    }}>{t.label}</button>
                            );
                        })}
                    </div>
                    <form onSubmit={onSubmitRequest} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <select
                            required
                            className="glass-input"
                            value={requestForm.supply_id}
                            onChange={(e) => {
                                const v = e.target.value;
                                // Auto-suggest the recommended quantity when the
                                // selected item is already flagged low-stock.
                                let recQty = '';
                                if (v) {
                                    const [kind, rawId] = v.split('-');
                                    const id = parseInt(rawId, 10);
                                    const item = kind === 'retail'
                                        ? (retailItems || []).find(r => r.item_id === id)
                                        : supplies.find(s => s.supply_id === id);
                                    if (item && item.is_low_stock) {
                                        recQty = String(recommendRestock(item.stock_count, item.restock_threshold));
                                    }
                                }
                                setRequestForm({
                                    ...requestForm,
                                    supply_id: v,
                                    quantity: recQty || requestForm.quantity,
                                });
                            }}
                        >
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
                            {hasRetail && (
                                <optgroup label="Shop Inventory (Retail)">
                                    {retailItems.map(r => (
                                        <option key={`retail-${r.item_id}`} value={`retail-${r.item_id}`}>
                                            {r.item_name} — stock {r.stock_count} / threshold {r.restock_threshold}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <input
                            type="number" min="1" required
                            placeholder={(requestForm.action === 'remove')
                                ? 'Quantity to Remove'
                                : 'Quantity Needed'}
                            className="glass-input"
                            value={requestForm.quantity}
                            onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })}
                        />
                        <div style={{ gridColumn: '1 / -1' }}>
                            <input
                                placeholder={(requestForm.action === 'remove')
                                    ? 'Reason for removal (e.g., expired, damaged, spoiled)'
                                    : 'Reason (e.g., Running low, new arrival, upcoming procedure)'}
                                className="glass-input"
                                value={requestForm.reason}
                                onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="glass-button"
                                style={{
                                    background: requestForm.action === 'remove' ? '#dc2626' : GREEN,
                                    color: 'white', width: '100%', fontWeight: 700,
                                }}>
                                <Send size={14} style={{ marginRight: '5px' }} />
                                Submit {requestForm.action === 'remove' ? 'Removal' : 'Restock'} Request
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {suppliesLoading ? <p>Loading supplies...</p> : supplies.length === 0 && !hasRetail ? (
                <p style={{ color: 'var(--color-text-dark)' }}>{emptyLabel}</p>
            ) : (
                <>
                    {supplies.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: hasRetail ? '24px' : '30px' }}>
                            {supplies.map(item => <StockRow key={item.supply_id} item={item} />)}
                        </div>
                    )}
                    {hasRetail && (
                        <>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-dark)' }}>
                                <Package size={20} /> Shop Inventory
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                                {retailItems.map(item => (
                                    <StockRow key={item.item_id}
                                        item={{ ...item, supply_id: `retail-${item.item_id}` }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

// ─── My Requests log (paginated, Manager-style) ─────────────────────────
// Shows the employee every supply request they've ever filed, with the
// reviewer's name + decision surfaced inline. Mirrors the Activity-Log
// styling from ManagerDashboard so the two views feel like siblings.
export function EmployeeRequestsPanel({ myRequests = [], loading = false }) {
    const PAGE_SIZE = 15;
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('all'); // all | pending | approved | denied

    const filtered = useMemo(() => {
        const rows = myRequests.slice().sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        if (filter === 'all') return rows;
        return rows.filter(r => r.status === filter);
    }, [myRequests, filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Clamp page back to 0 when filters narrow the list below the current page.
    React.useEffect(() => { setPage(0); }, [filter, myRequests]);

    const statusMeta = (s) => {
        switch (s) {
            case 'approved': return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle size={14} color="#10b981" />, accent: '#10b981' };
            case 'denied':   return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: <XCircle size={14} color="#ef4444" />,     accent: '#ef4444' };
            default:         return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: <Clock size={14} color="#f59e0b" />,       accent: '#f59e0b' };
        }
    };

    const FILTER_TABS = [
        { key: 'all',      label: 'All'      },
        { key: 'pending',  label: 'Pending'  },
        { key: 'approved', label: 'Approved' },
        { key: 'denied',   label: 'Denied'   },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardList size={22} /> My Requests
                </h2>
                <div style={{
                    display: 'inline-flex', gap: '4px',
                    background: 'rgba(255, 245, 231, 0.72)',
                    border: '1px solid rgba(121,162,128,0.25)',
                    padding: '4px 6px', borderRadius: '12px',
                }}>
                    <span style={{
                        fontSize: '10px', color: GREEN_DARK, alignSelf: 'center',
                        padding: '0 10px', textTransform: 'uppercase',
                        letterSpacing: '0.08em', fontWeight: 700,
                    }}>Status</span>
                    {FILTER_TABS.map(t => {
                        const active = filter === t.key;
                        return (
                            <button key={t.key} type="button" onClick={() => setFilter(t.key)}
                                style={{
                                    padding: '6px 14px', fontSize: '12px',
                                    background: active ? GREEN : 'transparent',
                                    color: active ? 'white' : GREEN_DARK,
                                    fontWeight: active ? 700 : 500,
                                    border: 'none', borderRadius: '8px',
                                    cursor: 'pointer', transition: 'background 150ms, color 150ms',
                                }}>{t.label}</button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <p>Loading your requests...</p>
            ) : filtered.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <ClipboardList size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p>{myRequests.length === 0
                        ? 'You haven\'t submitted any supply requests yet.'
                        : `No ${filter} requests.`}</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pageRows.map(req => {
                            const m = statusMeta(req.status);
                            return (
                                <div key={req.request_id} style={{
                                    background: 'rgba(255, 245, 231, 0.78)',
                                    border: '1px solid rgba(121,162,128,0.25)',
                                    padding: '14px 18px', borderRadius: '10px',
                                    borderLeft: `3px solid ${m.accent}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '14px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '220px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <strong style={{ color: 'var(--color-text-dark)', fontSize: '15px' }}>
                                                    {req.item_name}
                                                </strong>
                                                {req.action === 'remove' ? (
                                                    <span style={{
                                                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                        background: 'rgba(239,68,68,0.15)', color: '#dc2626',
                                                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                                                    }}>Remove</span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                        background: 'rgba(16,185,129,0.15)', color: '#10b981',
                                                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                                                    }}>Restock</span>
                                                )}
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(121,162,128,0.18)', color: GREEN_DARK,
                                                    fontWeight: 600,
                                                }}>
                                                    Qty {req.requested_quantity}
                                                </span>
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(121,162,128,0.18)', color: GREEN_DARK,
                                                    fontWeight: 600, textTransform: 'capitalize',
                                                }}>
                                                    {req.supply_type}
                                                </span>
                                            </div>
                                            {req.reason && (
                                                <p style={{ fontSize: '13px', color: 'var(--color-text-dark)', margin: '4px 0 0' }}>
                                                    <span style={{ color: GREEN_DARK, fontWeight: 600 }}>Reason: </span>
                                                    {req.reason}
                                                </p>
                                            )}
                                            <p style={{ fontSize: '12px', color: GREEN_DARK, margin: '6px 0 0', opacity: 0.85 }}>
                                                Submitted {new Date(req.created_at).toLocaleString()}
                                            </p>
                                            {req.reviewer && (
                                                <p style={{ fontSize: '12px', color: GREEN_DARK, margin: '4px 0 0' }}>
                                                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                                        {req.status}
                                                    </span>
                                                    {' by '}
                                                    <strong>{req.reviewer.first_name} {req.reviewer.last_name}</strong>
                                                    {req.reviewed_at && ` on ${new Date(req.reviewed_at).toLocaleDateString()}`}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 12px', borderRadius: '10px',
                                            background: m.bg, color: m.color, fontWeight: 700,
                                            textTransform: 'capitalize', fontSize: '13px',
                                        }}>
                                            {m.icon} {req.status}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {totalPages > 1 && (
                        <ZooPaginator
                            page={page}
                            totalPages={totalPages}
                            onChange={(p) => setPage(p)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

// ─── My Assigned Events (Upcoming / Past / All) ─────────────────────────
// Splits the employee's assigned events into three buckets so the soonest
// work is always front-and-center, past events stay searchable, and "All"
// is available as a fallback.
export function EmployeeEventsPanel({ events = [], loading = false, accentColor = GREEN }) {
    const [when, setWhen] = useState('upcoming');
    const todayStr = new Date().toISOString().slice(0, 10);

    const filtered = useMemo(() => {
        return (events || []).filter(ev => {
            if (when === 'upcoming') return ev.event_date >= todayStr;
            if (when === 'past')     return ev.event_date <  todayStr;
            return true;
        }).sort((a, b) => {
            if (when === 'upcoming') return a.event_date.localeCompare(b.event_date);
            return b.event_date.localeCompare(a.event_date);
        });
    }, [events, when, todayStr]);

    const TABS = [
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'past',     label: 'Past'     },
        { key: 'all',      label: 'All'      },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>My Assigned Events</h2>
                <div style={{
                    display: 'inline-flex', gap: '4px',
                    background: 'rgba(255, 245, 231, 0.72)',
                    border: '1px solid rgba(121,162,128,0.25)',
                    padding: '4px 6px', borderRadius: '12px',
                }}>
                    <span style={{
                        fontSize: '10px', color: GREEN_DARK, alignSelf: 'center',
                        padding: '0 10px', textTransform: 'uppercase',
                        letterSpacing: '0.08em', fontWeight: 700,
                    }}>When</span>
                    {TABS.map(t => {
                        const active = when === t.key;
                        return (
                            <button key={t.key} type="button" onClick={() => setWhen(t.key)}
                                style={{
                                    padding: '6px 14px', fontSize: '12px',
                                    background: active ? GREEN : 'transparent',
                                    color: active ? 'white' : GREEN_DARK,
                                    fontWeight: active ? 700 : 500,
                                    border: 'none', borderRadius: '8px',
                                    cursor: 'pointer', transition: 'background 150ms, color 150ms',
                                }}>{t.label}</button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <p>Loading events...</p>
            ) : filtered.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                    <p>
                        {events.length === 0
                            ? 'No events assigned to you yet.'
                            : `No ${when === 'all' ? '' : when} events.`}
                    </p>
                </div>
            ) : (
                <div className="grid-cards">
                    {filtered.map(event => {
                        const isPast = event.event_date < todayStr;
                        return (
                            <div key={event.event_id} className="glass-panel" style={{
                                padding: '20px', opacity: isPast ? 0.8 : 1,
                                border: isPast ? '1px solid rgba(121,162,128,0.2)' : '1px solid rgba(121,162,128,0.3)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <Calendar color={accentColor} />
                                    <h3 style={{ margin: 0 }}>{event.title}</h3>
                                    {isPast && (
                                        <span style={{
                                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                                            background: 'rgba(107,114,128,0.2)', color: '#4b5563',
                                            fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>Past</span>
                                    )}
                                </div>
                                {event.description && (
                                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                                        {event.description}
                                    </p>
                                )}
                                <p style={{ color: accentColor, fontWeight: 600 }}>
                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                    Capacity: {event.actual_attendance || 0} / {event.max_capacity}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

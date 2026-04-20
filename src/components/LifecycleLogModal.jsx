// Shared lifecycle-log modal. Used by Staff, Animals, Customers, and the
// Admin Reactivate panel to show the full activation/deactivation history
// for one entity. The backend exposes a uniform response shape across
// /employees/:id/lifecycle-log, /animals/:id/lifecycle-log, and
// /customers/:id/lifecycle-log so one component handles all three.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, History, UserCheck, UserX, LogOut, LogIn } from 'lucide-react';
import api from '../lib/api';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

// Map entity -> API sub-path + display terms.
const ENTITY = {
    employee: { path: 'employees', heading: 'Staff Lifecycle' },
    animal:   { path: 'animals',   heading: 'Animal Lifecycle' },
    customer: { path: 'customers', heading: 'Customer Lifecycle' },
};

const ACTION_STYLE = {
    employee_created:      { label: 'Activated',   color: '#10b981', Icon: UserCheck },
    employee_reactivated:  { label: 'Reactivated', color: '#10b981', Icon: UserCheck },
    employee_deactivated:  { label: 'Deactivated', color: '#b91c1c', Icon: UserX },
    customer_created:      { label: 'Signed up',   color: '#10b981', Icon: UserCheck },
    customer_reactivated:  { label: 'Reactivated', color: '#10b981', Icon: UserCheck },
    customer_deactivated:  { label: 'Deactivated', color: '#b91c1c', Icon: UserX },
    animal_added:          { label: 'Arrived',     color: '#10b981', Icon: LogIn },
    animal_arrived:        { label: 'Arrived',     color: '#10b981', Icon: LogIn },
    animal_departed:       { label: 'Departed',    color: '#b91c1c', Icon: LogOut },
};

export default function LifecycleLogModal({ entity, id, name, onClose }) {
    const [log, setLog]         = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    const cfg = ENTITY[entity];

    useEffect(() => {
        if (!cfg || !id) return;
        setLoading(true);
        api.get(`/${cfg.path}/${id}/lifecycle-log`)
            .then(data => { setLog(Array.isArray(data) ? data : []); setError(null); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [entity, id]);

    if (!cfg) return null;

    return createPortal((
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 1100,
            }}>
            <div onClick={e => e.stopPropagation()} style={{
                width: '520px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
                padding: '28px', background: 'rgba(255,255,255,0.98)',
                border: `1px solid ${GREEN}`, borderRadius: '14px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <History size={20} color={GREEN_DARK} />
                        <h2 style={{ margin: 0, color: GREEN_DARK, fontSize: '20px' }}>{cfg.heading}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN_DARK }}>
                        <X size={20} />
                    </button>
                </div>
                {name && (
                    <p style={{ margin: '0 0 18px', color: GREEN_DARK, fontWeight: 600, fontSize: '14px' }}>
                        {name}
                    </p>
                )}

                {loading ? (
                    <p style={{ color: GREEN_DARK }}>Loading history...</p>
                ) : error ? (
                    <p style={{ color: '#b91c1c' }}>Failed to load: {error}</p>
                ) : log.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No lifecycle events recorded yet.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {log.map(entry => {
                            const style = ACTION_STYLE[entry.action_type] || { label: entry.action_type, color: GREEN_DARK, Icon: History };
                            const { Icon } = style;
                            const performer = entry.performer_first
                                ? `${entry.performer_first} ${entry.performer_last}${entry.performer_role ? ` (${entry.performer_role})` : ''}`
                                : 'System';
                            return (
                                <div key={entry.log_id} style={{
                                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                                    padding: '12px 14px',
                                    background: 'rgba(255, 245, 231, 0.78)',
                                    border: '1px solid rgba(121,162,128,0.25)',
                                    borderLeft: `3px solid ${style.color}`,
                                    borderRadius: '10px',
                                }}>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: `${style.color}22`, color: style.color, flexShrink: 0,
                                    }}>
                                        <Icon size={16} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, color: style.color, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {style.label}
                                            </span>
                                            <span style={{ fontSize: '12px', color: GREEN_DARK }}>
                                                by <strong>{performer}</strong>
                                            </span>
                                        </div>
                                        <p style={{ margin: '4px 0 0', color: 'var(--color-text-dark)', fontSize: '13px' }}>
                                            {entry.description}
                                        </p>
                                    </div>
                                    <div style={{ fontSize: '11px', color: GREEN_DARK, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                        <div>{new Date(entry.created_at).toLocaleDateString()}</div>
                                        <div style={{ opacity: 0.75 }}>{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    ), document.body);
}

// Small pill-button used by list views to open the lifecycle modal.
// Kept here so every caller picks up the same styling. Callers can
// pass extra `style` overrides (e.g. absolute positioning) to pin it
// to a corner of their card.
export function LifecycleLogButton({ onClick, compact = false, style }) {
    return (
        <button
            onClick={onClick}
            className="glass-button"
            title="View activation history"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: compact ? '11px' : '12px',
                padding: compact ? '4px 10px' : '6px 12px',
                background: 'rgba(121,162,128,0.18)', color: GREEN_DARK, fontWeight: 600,
                ...(style || {}),
            }}>
            <History size={compact ? 11 : 13} /> Log
        </button>
    );
}

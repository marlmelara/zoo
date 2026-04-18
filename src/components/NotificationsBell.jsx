import React, { useEffect, useRef, useState } from 'react';
import { Bell, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getNotifications } from '../api/notifications';

const GREEN_DARK = 'rgb(102, 122, 66)';

export default function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    async function load() {
        try {
            setLoading(true);
            const data = await getNotifications(50);
            setItems(data || []);
        } catch (err) {
            console.error('Notifications load failed:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    // Refresh every 20s so trigger-created rows and trigger-resolved rows
    // appear without a page reload.
    useEffect(() => {
        const id = setInterval(load, 20_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        function onClick(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    // Split by resolution state. Unresolved = still actionable work.
    const unresolved = items.filter(n => !n.is_resolved);
    const resolved   = items.filter(n =>  n.is_resolved);
    const urgent     = unresolved.length > 0;

    const formatTime = (s) => {
        const d = new Date(s);
        const diff = Date.now() - d.getTime();
        const mins = Math.round(diff / 60000);
        if (mins < 1)  return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.round(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString();
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            {/* Inline keyframes for the urgent pulse */}
            <style>{`
                @keyframes notif-pulse {
                    0%,100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
                    50%     { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                }
            `}</style>

            <button
                onClick={() => setOpen(o => !o)}
                aria-label="Notifications"
                style={{
                    position: 'relative',
                    background: urgent ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                    border: urgent ? '1px solid rgba(239, 68, 68, 0.55)' : '1px solid rgba(255, 255, 255, 0.18)',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    width: '100%',
                    justifyContent: 'flex-start',
                    animation: urgent ? 'notif-pulse 2s ease-in-out infinite' : 'none',
                }}
            >
                <Bell size={16} />
                <span>{urgent ? 'Action needed' : 'Notifications'}</span>
                {urgent && (
                    <span style={{
                        marginLeft: 'auto',
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '1px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                    }}>{unresolved.length}</span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    left: 'calc(100% + 10px)',
                    bottom: 0,
                    width: '360px',
                    maxHeight: '480px',
                    overflowY: 'auto',
                    background: 'white',
                    color: 'var(--color-text-dark)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    zIndex: 50,
                }}>
                    <div style={{
                        padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)',
                        position: 'sticky', top: 0, background: 'white',
                    }}>
                        <strong style={{ color: GREEN_DARK }}>Notifications</strong>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {urgent
                                ? `${unresolved.length} item${unresolved.length === 1 ? '' : 's'} need your attention.`
                                : 'Everything is handled.'}
                        </div>
                    </div>

                    {loading && items.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
                    ) : (
                        <>
                            {unresolved.length > 0 && (
                                <div>
                                    <SectionLabel>Needs action</SectionLabel>
                                    {unresolved.map(n => (
                                        <Row key={n.notification_id} n={n} urgent formatTime={formatTime} />
                                    ))}
                                </div>
                            )}
                            {resolved.length > 0 && (
                                <div>
                                    <SectionLabel>Handled</SectionLabel>
                                    {resolved.map(n => (
                                        <Row key={n.notification_id} n={n} formatTime={formatTime} />
                                    ))}
                                </div>
                            )}
                            {items.length === 0 && (
                                <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No notifications yet.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function SectionLabel({ children }) {
    return (
        <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
            textTransform: 'uppercase', color: 'var(--color-text-muted)',
            padding: '10px 14px 4px',
        }}>{children}</div>
    );
}

function Row({ n, urgent, formatTime }) {
    return (
        <div style={{
            padding: '12px 14px',
            borderLeft: urgent ? '3px solid #ef4444' : '3px solid transparent',
            background: urgent ? 'rgba(239, 68, 68, 0.06)' : 'white',
            opacity: urgent ? 1 : 0.75,
            display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {urgent
                    ? <AlertCircle size={16} color="#ef4444" />
                    : <CheckCircle2 size={16} color={GREEN_DARK} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '13px', color: urgent ? '#991b1b' : GREEN_DARK }}>
                        {n.title}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        {formatTime(n.created_at)}
                    </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-dark)', marginTop: '2px' }}>
                    {n.message}
                </div>
            </div>
        </div>
    );
}

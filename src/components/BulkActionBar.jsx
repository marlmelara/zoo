// Shared floating action bar used by every "Manage / Remove" flow
// (Animals, Staff, Inventory items, Events).
//
// Portals to <body> so it escapes the dashboard's glass-panel — any
// ancestor with backdrop-filter / transform / filter makes
// `position: fixed` anchor to THAT ancestor instead of the viewport, so
// without the portal the bar ended up at the bottom of the content list
// instead of fixed above the fold. createPortal(..., document.body) is
// the same fix the modals use.
//
// Theme matches the rest of the dashboard: cream panel + green border,
// with the destructive action painted red so it still reads as "this
// deletes/archives/deactivates things".
import React from 'react';
import { createPortal } from 'react-dom';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

export default function BulkActionBar({
    count,
    onSelectAll,
    onRemove,
    onCancel,
    actionLabel,
}) {
    const disabled = count === 0;
    return createPortal(
        <div style={{
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255, 245, 231, 0.98)',
            border: `1px solid ${GREEN}`,
            borderRadius: '14px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
            zIndex: 9999,
            color: GREEN_DARK,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
        }}>
            <span style={{ fontSize: '13px', color: GREEN_DARK, fontWeight: 500 }}>
                <strong style={{ color: GREEN_DARK, fontWeight: 700 }}>{count}</strong> selected
            </span>
            <button onClick={onSelectAll}
                style={{
                    background: 'rgba(121, 162, 128, 0.15)',
                    color: GREEN_DARK,
                    border: `1px solid ${GREEN}55`,
                    borderRadius: '8px', padding: '8px 14px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}>
                Select All
            </button>
            <button onClick={onRemove} disabled={disabled}
                style={{
                    background: disabled ? 'rgba(239, 68, 68, 0.18)' : '#ef4444',
                    color: disabled ? '#b91c1c' : 'white',
                    border: disabled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #ef4444',
                    borderRadius: '8px', padding: '8px 14px',
                    fontSize: '12px', fontWeight: 700,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.85 : 1,
                }}>
                {actionLabel}
            </button>
            <button onClick={onCancel}
                style={{
                    background: 'transparent',
                    color: GREEN_DARK,
                    border: `1px solid ${GREEN}55`,
                    borderRadius: '8px', padding: '8px 14px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}>
                Cancel
            </button>
        </div>,
        document.body
    );
}

// In-app replacement for window.alert() and window.confirm().
//
// Usage:
//   import { useToast, useConfirm } from '../../components/Feedback';
//   const toast   = useToast();
//   const confirm = useConfirm();
//
//   toast.error('Failed to save.');
//   toast.success('Saved!');
//
//   if (await confirm({ title: 'Reactivate this account?' })) {
//       await api.post(...);
//   }
//
// Wrapped around <App /> via <FeedbackProvider> in App.jsx.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

// ─── Toasts ──────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

const TOAST_TONE = {
    success: { bg: 'rgba(16,185,129,0.95)', color: 'white', Icon: CheckCircle },
    error:   { bg: 'rgba(239,68,68,0.95)',  color: 'white', Icon: XCircle },
    warn:    { bg: 'rgba(245,158,11,0.95)', color: 'white', Icon: AlertTriangle },
    info:    { bg: 'rgba(255, 245, 231, 0.98)', color: GREEN_DARK, Icon: Info },
};

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <FeedbackProvider>');
    return ctx;
}

function ToastStack({ toasts, onDismiss }) {
    return createPortal((
        <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
            display: 'flex', flexDirection: 'column', gap: '10px',
            pointerEvents: 'none', maxWidth: '380px',
        }}>
            {toasts.map(t => {
                const tone = TOAST_TONE[t.tone] || TOAST_TONE.info;
                const { Icon } = tone;
                return (
                    <div key={t.id} style={{
                        pointerEvents: 'auto',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '12px 14px', borderRadius: '12px',
                        background: tone.bg, color: tone.color,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                        fontSize: '14px', fontWeight: 500,
                        animation: 'zoo-toast-in 180ms ease-out',
                        border: t.tone === 'info' ? `1px solid ${GREEN}` : 'none',
                    }}>
                        <Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                            {t.title && (
                                <div style={{ fontWeight: 700, marginBottom: t.message ? '2px' : 0 }}>{t.title}</div>
                            )}
                            {t.message && <div style={{ opacity: 0.95 }}>{t.message}</div>}
                        </div>
                        <button
                            onClick={() => onDismiss(t.id)}
                            title="Dismiss"
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: tone.color, opacity: 0.8, padding: 0, lineHeight: 0,
                            }}>
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
            <style>{`
                @keyframes zoo-toast-in {
                    from { transform: translateY(-8px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    ), document.body);
}

// ─── Confirm ─────────────────────────────────────────────────────────────
const ConfirmContext = createContext(null);

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used inside <FeedbackProvider>');
    return ctx.confirm;
}

// usePrompt — native window.prompt replacement. Returns the entered string,
// or null if the user cancels. Accepts the same shape as confirm() plus
// `placeholder` and `defaultValue`.
export function usePrompt() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('usePrompt must be used inside <FeedbackProvider>');
    return ctx.prompt;
}

function ConfirmModal({ open, options, onResolve }) {
    // Dialog supports two modes: plain confirm (yes/no) and prompt (input + yes/no).
    const isPrompt = !!options?.prompt;
    const [inputValue, setInputValue] = useState('');

    // Reset the input each time the modal opens so a lingering value
    // from the previous prompt doesn't leak in.
    useEffect(() => {
        if (open && isPrompt) setInputValue(options.defaultValue ?? '');
    }, [open, isPrompt, options?.defaultValue]);

    // Close on ESC — matches native confirm() muscle memory.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onResolve(isPrompt ? null : false);
            if (e.key === 'Enter'   && !isPrompt) onResolve(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onResolve, isPrompt]);

    if (!open) return null;

    const {
        title = 'Are you sure?',
        message,
        confirmLabel = 'Confirm',
        cancelLabel  = 'Cancel',
        tone         = 'primary',   // primary | danger
        placeholder,
        inputType    = 'text',
    } = options || {};

    const confirmBg = tone === 'danger' ? 'rgb(220, 38, 38)' : GREEN;

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        onResolve(isPrompt ? inputValue : true);
    };

    return createPortal((
        <div
            onClick={() => onResolve(isPrompt ? null : false)}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 2100,
            }}>
            <form
                onSubmit={handleSubmit}
                onClick={e => e.stopPropagation()}
                role="alertdialog" aria-modal="true"
                style={{
                    width: '420px', maxWidth: '92vw',
                    padding: '26px', background: 'rgba(255,255,255,0.98)',
                    border: `1px solid ${GREEN}`, borderRadius: '14px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    animation: 'zoo-confirm-in 160ms ease-out',
                }}>
                <h2 style={{
                    margin: '0 0 8px', color: GREEN_DARK, fontSize: '19px',
                }}>{title}</h2>
                {message && (
                    <p style={{
                        margin: '0 0 14px', color: 'var(--color-text-dark)',
                        fontSize: '14px', lineHeight: 1.5,
                    }}>{message}</p>
                )}
                {isPrompt && (
                    <input
                        autoFocus
                        type={inputType}
                        className="glass-input"
                        placeholder={placeholder || ''}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        style={{ width: '100%', marginBottom: '18px', padding: '10px 12px', fontSize: '14px' }}
                    />
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => onResolve(isPrompt ? null : false)}
                        className="glass-button"
                        style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}>
                        {cancelLabel}
                    </button>
                    <button
                        type="submit"
                        autoFocus={!isPrompt}
                        className="glass-button"
                        style={{
                            padding: '8px 18px', fontSize: '13px', fontWeight: 700,
                            background: confirmBg, color: 'white',
                        }}>
                        {confirmLabel}
                    </button>
                </div>
                <style>{`
                    @keyframes zoo-confirm-in {
                        from { transform: scale(0.96); opacity: 0; }
                        to   { transform: scale(1);    opacity: 1; }
                    }
                `}</style>
            </form>
        </div>
    ), document.body);
}

// ─── Provider ────────────────────────────────────────────────────────────
export function FeedbackProvider({ children }) {
    // Toasts — stack with auto-dismiss.
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = useCallback((tone, input) => {
        // Accept either a string ("Saved!") or an options object
        // ({ title, message, duration }).
        const opts = typeof input === 'string' ? { message: input } : (input || {});
        const id = ++idRef.current;
        const duration = opts.duration ?? (tone === 'error' ? 5000 : 3500);
        setToasts(prev => [...prev, { id, tone, title: opts.title, message: opts.message }]);
        if (duration > 0) setTimeout(() => dismiss(id), duration);
        return id;
    }, [dismiss]);

    const toast = {
        success: (x) => push('success', x),
        error:   (x) => push('error',   x),
        warn:    (x) => push('warn',    x),
        info:    (x) => push('info',    x),
        dismiss,
    };

    // Confirm + prompt share one modal slot. confirm() resolves to a
    // boolean, prompt() resolves to a string (or null on cancel).
    const [confirmState, setConfirmState] = useState({ open: false, options: null, resolve: null });

    const confirm = useCallback((options = {}) => {
        return new Promise(resolve => {
            setConfirmState({ open: true, options, resolve });
        });
    }, []);

    const prompt = useCallback((options = {}) => {
        return new Promise(resolve => {
            setConfirmState({ open: true, options: { ...options, prompt: true }, resolve });
        });
    }, []);

    const handleResolve = useCallback((value) => {
        if (confirmState.resolve) confirmState.resolve(value);
        setConfirmState({ open: false, options: null, resolve: null });
    }, [confirmState.resolve]);

    return (
        <ToastContext.Provider value={toast}>
            <ConfirmContext.Provider value={{ confirm, prompt }}>
                {children}
                <ToastStack toasts={toasts} onDismiss={dismiss} />
                <ConfirmModal
                    open={confirmState.open}
                    options={confirmState.options}
                    onResolve={handleResolve}
                />
            </ConfirmContext.Provider>
        </ToastContext.Provider>
    );
}

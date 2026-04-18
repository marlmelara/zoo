import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    submitHoursRequest, getMyHoursRequests,
    getAllHoursRequests, reviewHoursRequest,
} from '../../../api/hours';
import {
    Clock, Plus, Trash2, CheckCircle, XCircle, Calendar, User
} from 'lucide-react';

const GREEN = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

export default function HoursDashboard() {
    const { role } = useAuth();
    const canReview = role === 'admin' || role === 'manager';

    const [tab, setTab] = useState(canReview ? 'review' : 'submit');
    const [myRequests, setMyRequests]   = useState([]);
    const [allRequests, setAllRequests] = useState([]);
    const [loading, setLoading]         = useState(true);

    // Submit form state: an array of { work_date, hours, description }
    const blankEntry = () => ({ work_date: '', hours: '', description: '' });
    const [entries, setEntries] = useState([blankEntry()]);
    const [submitting, setSubmitting] = useState(false);

    // Review filter
    const [reviewFilter, setReviewFilter] = useState('pending');

    useEffect(() => { loadAll(); /* eslint-disable-line */ }, []);

    async function loadAll() {
        try {
            setLoading(true);
            const jobs = [getMyHoursRequests()];
            if (canReview) jobs.push(getAllHoursRequests());
            const [mine, all = []] = await Promise.all(jobs);
            setMyRequests(mine || []);
            setAllRequests(all || []);
        } catch (err) {
            console.error('Error loading hours:', err);
        } finally {
            setLoading(false);
        }
    }

    const addEntry     = () => setEntries(prev => [...prev, blankEntry()]);
    const removeEntry  = (i) => setEntries(prev => prev.filter((_, idx) => idx !== i));
    const updateEntry  = (i, field, value) =>
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

    async function handleSubmit(e) {
        e.preventDefault();
        for (const entry of entries) {
            if (!entry.work_date) return alert('Each entry needs a work date.');
            const h = Number(entry.hours);
            if (!Number.isFinite(h) || h <= 0 || h > 24) {
                return alert('Each entry must have hours between 0 and 24.');
            }
        }
        try {
            setSubmitting(true);
            await submitHoursRequest(entries.map(e => ({
                work_date: e.work_date,
                hours: Number(e.hours),
                description: e.description || null,
            })));
            setEntries([blankEntry()]);
            await loadAll();
            alert('Hours submitted. Your manager will review the request.');
            if (!canReview) setTab('mine');
        } catch (err) {
            alert('Failed to submit: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleReview(id, status) {
        const notes = window.prompt(
            `${status === 'approved' ? 'Approve' : 'Deny'} — optional note for the employee:`, '');
        if (notes === null) return;
        try {
            await reviewHoursRequest(id, status, notes || null);
            await loadAll();
        } catch (err) {
            alert('Failed to update: ' + err.message);
        }
    }

    const statusBadge = (status) => {
        const colors = { pending: '#f59e0b', approved: '#10b981', denied: '#ef4444' };
        return (
            <span style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
                background: `${colors[status]}22`, color: colors[status],
                textTransform: 'capitalize', fontWeight: 600,
            }}>{status}</span>
        );
    };

    const formatDate = (s) => {
        if (!s) return '';
        const d = new Date(s + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const totalHours = (req) => (req.entries || []).reduce((s, e) => s + Number(e.hours || 0), 0);

    const filteredReview = reviewFilter === 'all'
        ? allRequests
        : allRequests.filter(r => r.status === reviewFilter);

    const TABS = [
        { key: 'submit', label: 'Submit Hours' },
        { key: 'mine',   label: 'My Submissions' },
        ...(canReview ? [{ key: 'review', label: 'Review Requests' }] : []),
    ];

    return (
        <div>
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={28} color={GREEN} /> Hours
                </h1>
                <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>
                    Submit worked hours for your manager to review.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className="glass-button"
                        style={{
                            background: tab === t.key ? GREEN : 'rgba(255,255,255,0.5)',
                            color: tab === t.key ? 'white' : GREEN_DARK,
                            padding: '10px 18px',
                            fontSize: '14px',
                            fontWeight: tab === t.key ? 700 : 500,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── SUBMIT ─── */}
            {tab === 'submit' && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h2 style={{ marginTop: 0, color: GREEN_DARK }}>New Hours Submission</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 0, fontSize: '0.9rem' }}>
                        Add one row per workday. You can submit multiple days at once.
                    </p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {entries.map((entry, i) => (
                            <div key={i} style={{
                                display: 'grid',
                                gridTemplateColumns: '180px 100px 1fr 40px',
                                gap: '10px', alignItems: 'end',
                                padding: '12px', borderRadius: '10px',
                                background: 'rgba(255,255,255,0.4)',
                                border: '1px solid rgba(121,162,128,0.25)',
                            }}>
                                <div>
                                    <label style={labelStyle}>Date</label>
                                    <input type="date" className="glass-input"
                                        value={entry.work_date}
                                        onChange={e => updateEntry(i, 'work_date', e.target.value)}
                                        required
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Hours</label>
                                    <input type="number" step="0.25" min="0.25" max="24"
                                        className="glass-input"
                                        value={entry.hours}
                                        onChange={e => updateEntry(i, 'hours', e.target.value)}
                                        placeholder="8"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Description (optional)</label>
                                    <input type="text" className="glass-input" maxLength={200}
                                        value={entry.description}
                                        onChange={e => updateEntry(i, 'description', e.target.value)}
                                        placeholder="What did you work on?"
                                    />
                                </div>
                                <button type="button"
                                    onClick={() => removeEntry(i)}
                                    disabled={entries.length === 1}
                                    title="Remove row"
                                    style={{
                                        border: 'none', background: 'transparent',
                                        cursor: entries.length === 1 ? 'not-allowed' : 'pointer',
                                        color: entries.length === 1 ? '#cbd5e1' : '#ef4444',
                                        padding: '8px',
                                    }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={addEntry} className="glass-button"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Plus size={16} /> Add another day
                            </button>
                            <button type="submit" disabled={submitting} className="glass-button"
                                style={{ background: GREEN, color: 'white', marginLeft: 'auto' }}>
                                {submitting ? 'Submitting...' : 'Submit for Review'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── MY SUBMISSIONS ─── */}
            {tab === 'mine' && (
                <div>
                    {loading ? <p>Loading...</p>
                      : myRequests.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Clock size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                            <p>No hours submitted yet.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {myRequests.map(req => (
                                <div key={req.request_id} className="glass-panel" style={{ padding: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <strong style={{ color: GREEN_DARK }}>Request #{req.request_id}</strong>
                                                {statusBadge(req.status)}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                Submitted {new Date(req.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: '18px', color: GREEN_DARK }}>
                                                {totalHours(req).toFixed(2)} hrs
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                {req.entries.length} {req.entries.length === 1 ? 'entry' : 'entries'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                                        {req.entries.map(e => (
                                            <div key={e.entry_id} style={{
                                                display: 'flex', justifyContent: 'space-between', gap: '12px',
                                                padding: '6px 10px', borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.4)',
                                                fontSize: '13px', color: 'var(--color-text-dark)',
                                            }}>
                                                <span><Calendar size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{formatDate(e.work_date)}</span>
                                                <span>{Number(e.hours).toFixed(2)} hrs</span>
                                                <span style={{ flex: 1, color: 'var(--color-text-muted)', textAlign: 'right' }}>{e.description || ''}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {req.reviewed_at && (
                                        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                            Reviewed by {req.reviewer?.first_name} {req.reviewer?.last_name} on {new Date(req.reviewed_at).toLocaleString()}
                                            {req.review_notes ? ` — "${req.review_notes}"` : ''}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                      )}
                </div>
            )}

            {/* ─── REVIEW (admin / manager) ─── */}
            {tab === 'review' && canReview && (
                <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        {['pending','approved','denied','all'].map(f => (
                            <button key={f} onClick={() => setReviewFilter(f)}
                                className="glass-button"
                                style={{
                                    padding: '6px 14px', fontSize: '12px',
                                    background: reviewFilter === f ? GREEN : 'rgba(255,255,255,0.5)',
                                    color: reviewFilter === f ? 'white' : GREEN_DARK,
                                    textTransform: 'capitalize',
                                }}>{f}</button>
                        ))}
                    </div>
                    {loading ? <p>Loading...</p>
                      : filteredReview.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <p>No {reviewFilter} hours requests.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredReview.map(req => (
                                <div key={req.request_id} className="glass-panel" style={{ padding: '18px',
                                    border: req.status === 'pending' ? '1px solid rgba(245,158,11,0.4)' : undefined }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <User size={16} color={GREEN_DARK} />
                                                <strong style={{ color: GREEN_DARK }}>
                                                    {req.employee?.first_name} {req.employee?.last_name}
                                                </strong>
                                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.5)', color: 'var(--color-text-muted)',
                                                    textTransform: 'capitalize' }}>
                                                    {req.employee?.role}
                                                </span>
                                                {req.employee?.dept_name && (
                                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                        background: 'rgba(121,162,128,0.15)', color: GREEN_DARK }}>
                                                        {req.employee.dept_name}
                                                    </span>
                                                )}
                                                {statusBadge(req.status)}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                Request #{req.request_id} · Submitted {new Date(req.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: '18px', color: GREEN_DARK }}>
                                                {totalHours(req).toFixed(2)} hrs
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', marginBottom: '10px' }}>
                                        {req.entries.map(e => (
                                            <div key={e.entry_id} style={{
                                                display: 'flex', justifyContent: 'space-between', gap: '12px',
                                                padding: '6px 10px', borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.4)',
                                                fontSize: '13px', color: 'var(--color-text-dark)',
                                            }}>
                                                <span><Calendar size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{formatDate(e.work_date)}</span>
                                                <span>{Number(e.hours).toFixed(2)} hrs</span>
                                                <span style={{ flex: 1, color: 'var(--color-text-muted)', textAlign: 'right' }}>{e.description || ''}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {req.status === 'pending' ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => handleReview(req.request_id, 'approved')}
                                                className="glass-button"
                                                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981',
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <CheckCircle size={16} /> Approve
                                            </button>
                                            <button onClick={() => handleReview(req.request_id, 'denied')}
                                                className="glass-button"
                                                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <XCircle size={16} /> Deny
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                            {req.status === 'approved' ? 'Approved' : 'Denied'} by {req.reviewer?.first_name} {req.reviewer?.last_name}
                                            {req.reviewed_at ? ` on ${new Date(req.reviewed_at).toLocaleString()}` : ''}
                                            {req.review_notes ? ` — "${req.review_notes}"` : ''}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                      )}
                </div>
            )}
        </div>
    );
}

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    marginBottom: '4px',
    fontWeight: 600,
};

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    submitHoursRequest, getMyHoursRequests,
    getAllHoursRequests, getReviewedByMeHoursRequests,
    reviewHoursRequest,
} from '../../../api/hours';
import {
    Clock, Plus, Trash2, CheckCircle, XCircle, Calendar, User
} from 'lucide-react';
import { DateRangeFilter } from '../../../components/AnimalsPanel';
import { useToast, usePrompt } from '../../../components/Feedback';
import { formatTime } from '../../../utils/staff';

// Older requests stored their time range as raw "HH:MM–HH:MM" inside the
// description. Rewrite them to 12-hour for display without mutating the DB.
function prettyDescription(desc) {
    if (!desc) return '';
    return String(desc).replace(
        /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g,
        (_, a, b) => `${formatTime(a)} – ${formatTime(b)}`
    );
}

const GREEN = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

// ── Auto-calc helper: returns decimal hours between two HH:MM strings.
// Handles end < start by returning 0 (caller flags the error).
function hoursBetween(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

export default function HoursDashboard() {
    const { role } = useAuth();
    const toast = useToast();
    const prompt = usePrompt();
    const canReview = role === 'admin' || role === 'manager';

    // Managers/admins don't submit their own hours here — they only see
    // pending reviews and their own approval log.
    const DEFAULT_TAB = canReview ? 'review' : 'submit';
    const [tab, setTab] = useState(DEFAULT_TAB);

    const [myRequests, setMyRequests]           = useState([]);
    const [allRequests, setAllRequests]         = useState([]);
    const [reviewedByMe, setReviewedByMe]       = useState([]);
    const [loading, setLoading]                 = useState(true);

    // Per-scope display numbers. Employees see their own chronology (1..N).
    // Managers see a dept-scoped sequence (backend already narrows the
    // /getAllHoursRequests payload to their department). Admins keep the
    // raw request_id because they're looking across the whole system and
    // a contiguous 1..N would hide gaps from deletions.
    const mineNumberByPK = useMemo(() => {
        const sorted = myRequests.slice().sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            || a.request_id - b.request_id);
        const map = new Map();
        sorted.forEach((r, i) => map.set(r.request_id, i + 1));
        return map;
    }, [myRequests]);
    const reviewNumberByPK = React.useMemo(() => {
        if (role === 'admin') return new Map();
        const sorted = allRequests.slice().sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            || a.request_id - b.request_id);
        const map = new Map();
        sorted.forEach((r, i) => map.set(r.request_id, i + 1));
        return map;
    }, [allRequests, role]);
    const displayNumberFor = (req, mode) => {
        if (mode === 'mine') return mineNumberByPK.get(req.request_id) || req.request_id;
        if (mode === 'review' && role === 'manager') return reviewNumberByPK.get(req.request_id) || req.request_id;
        // Admin reviewers + the reviewed-by-me log fall back to raw IDs so
        // nothing contradicts the system-wide numbering shown elsewhere.
        return req.request_id;
    };

    // Submit form — an array of { work_date, start_time, end_time, description }.
    // Hours auto-calculate from start/end for the employee as they fill it in.
    const blankEntry = () => ({ work_date: '', start_time: '', end_time: '', description: '' });
    const [entries, setEntries] = useState([blankEntry()]);
    const [submitting, setSubmitting] = useState(false);

    // Review filter
    const [reviewFilter, setReviewFilter] = useState('pending');
    // My Reviews date range
    const [myRevFrom, setMyRevFrom] = useState('');
    const [myRevTo,   setMyRevTo]   = useState('');

    useEffect(() => { loadAll(); /* eslint-disable-line */ }, []);

    async function loadAll() {
        try {
            setLoading(true);
            const jobs = [];
            if (!canReview) jobs.push(getMyHoursRequests());
            else jobs.push(Promise.resolve([])); // placeholder so indices line up
            if (canReview) {
                jobs.push(getAllHoursRequests());
                jobs.push(getReviewedByMeHoursRequests());
            }
            const results = await Promise.all(jobs);
            const [mine, all = [], mine_reviews = []] = results;
            setMyRequests(mine || []);
            setAllRequests(all || []);
            setReviewedByMe(mine_reviews || []);
        } catch (err) {
            console.error('Error loading hours:', err);
        } finally {
            setLoading(false);
        }
    }

    const addEntry    = () => setEntries(prev => [...prev, blankEntry()]);
    const removeEntry = (i) => setEntries(prev => prev.filter((_, idx) => idx !== i));
    const updateEntry = (i, field, value) =>
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

    async function handleSubmit(e) {
        e.preventDefault();
        for (const entry of entries) {
            if (!entry.work_date) { toast.warn('Each entry needs a work date.'); return; }
            if (!entry.start_time || !entry.end_time) { toast.warn('Each entry needs a start and end time.'); return; }
            const h = hoursBetween(entry.start_time, entry.end_time);
            if (!(h > 0 && h <= 24)) {
                toast.warn('End time must be after start time, and total hours ≤ 24.');
                return;
            }
        }
        try {
            setSubmitting(true);
            await submitHoursRequest(entries.map(e => ({
                work_date: e.work_date,
                hours: hoursBetween(e.start_time, e.end_time),
                description: [
                    `${formatTime(e.start_time)} – ${formatTime(e.end_time)}`,
                    e.description || null,
                ].filter(Boolean).join(' · '),
            })));
            setEntries([blankEntry()]);
            await loadAll();
            toast.success('Hours submitted. Your manager will review the request.');
            setTab('mine');
        } catch (err) {
            toast.error('Failed to submit: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleReview(id, status) {
        const notes = await prompt({
            title: `${status === 'approved' ? 'Approve' : 'Deny'} hours request`,
            message: 'Optional note for the employee:',
            defaultValue: '',
        });
        if (notes === null) return;
        try {
            await reviewHoursRequest(id, status, notes || null);
            await loadAll();
        } catch (err) {
            toast.error('Failed to update: ' + err.message);
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

    // Build tabs per role. Managers/admins don't see Submit/My Submissions.
    const TABS = canReview
        ? [
            { key: 'review',   label: role === 'admin' ? 'All Departments' : 'Department Queue' },
            { key: 'my-reviews', label: 'My Reviews' },
          ]
        : [
            { key: 'submit', label: 'Submit Hours' },
            { key: 'mine',   label: 'My Submissions' },
          ];

    return (
        <div>
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={28} color={GREEN} /> Hours
                </h1>
                <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>
                    {canReview
                        ? (role === 'admin'
                            ? 'Review and decide hours requests submitted across every department.'
                            : 'Review hours requests submitted by your department.')
                        : 'Log the start and end time of a shift — total hours auto-calculate before you submit.'}
                </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className="glass-button"
                        style={{
                            background: tab === t.key ? GREEN : 'rgba(255, 245, 231, 0.65)',
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

            {/* ─── SUBMIT (employees only) ─── */}
            {!canReview && tab === 'submit' && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h2 style={{ marginTop: 0, color: GREEN_DARK }}>New Hours Submission</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 0, fontSize: '0.9rem' }}>
                        Pick the start and end time you worked. Hours are auto-calculated. You can submit multiple days at once.
                    </p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {entries.map((entry, i) => {
                            const calcHours = hoursBetween(entry.start_time, entry.end_time);
                            const invalid = entry.start_time && entry.end_time && calcHours <= 0;
                            return (
                                <div key={i} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '160px 110px 110px 90px 1fr 40px',
                                    gap: '10px', alignItems: 'end',
                                    padding: '12px', borderRadius: '10px',
                                    background: 'rgba(255, 245, 231, 0.55)',
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
                                        <label style={labelStyle}>Start</label>
                                        <input type="time" className="glass-input" required
                                            value={entry.start_time}
                                            onChange={e => updateEntry(i, 'start_time', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>End</label>
                                        <input type="time" className="glass-input" required
                                            value={entry.end_time}
                                            onChange={e => updateEntry(i, 'end_time', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Hours</label>
                                        <div style={{
                                            padding: '10px 12px', borderRadius: '8px',
                                            background: invalid ? 'rgba(239,68,68,0.15)' : 'rgba(121,162,128,0.18)',
                                            color: invalid ? '#ef4444' : GREEN_DARK,
                                            fontWeight: 700, fontSize: '0.95rem', textAlign: 'center',
                                            border: '1px solid rgba(121,162,128,0.25)',
                                        }}>
                                            {calcHours > 0 ? calcHours.toFixed(2) : (invalid ? '!' : '—')}
                                        </div>
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
                            );
                        })}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button type="button" onClick={addEntry} className="glass-button"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Plus size={16} /> Add another day
                            </button>
                            <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: GREEN_DARK, fontWeight: 600 }}>
                                Total:&nbsp;
                                {entries.reduce((s, e) => s + hoursBetween(e.start_time, e.end_time), 0).toFixed(2)} hrs
                            </div>
                            <button type="submit" disabled={submitting} className="glass-button"
                                style={{ background: GREEN, color: 'white' }}>
                                {submitting ? 'Submitting...' : 'Submit for Review'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── MY SUBMISSIONS (employees only) ─── */}
            {!canReview && tab === 'mine' && (
                <div>
                    {loading ? <p>Loading...</p>
                      : myRequests.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Clock size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                            <p>No hours submitted yet.</p>
                        </div>
                      ) : (
                        <RequestList
                            items={myRequests}
                            totalHours={totalHours}
                            formatDate={formatDate}
                            statusBadge={statusBadge}
                            mode="mine"
                            displayNumberFor={displayNumberFor}
                        />
                      )}
                </div>
            )}

            {/* ─── REVIEW (admin / manager) ─── */}
            {canReview && tab === 'review' && (
                <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        {['pending','approved','denied','all'].map(f => (
                            <button key={f} onClick={() => setReviewFilter(f)}
                                className="glass-button"
                                style={{
                                    padding: '6px 14px', fontSize: '12px',
                                    background: reviewFilter === f ? GREEN : 'rgba(255, 245, 231, 0.65)',
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
                        <RequestList
                            items={filteredReview}
                            totalHours={totalHours}
                            formatDate={formatDate}
                            statusBadge={statusBadge}
                            mode="review"
                            onReview={handleReview}
                            displayNumberFor={displayNumberFor}
                        />
                      )}
                </div>
            )}

            {/* ─── MY REVIEWS (admin / manager) ─── */}
            {canReview && tab === 'my-reviews' && (
                <div>
                    <DateRangeFilter
                        from={myRevFrom} to={myRevTo}
                        onFrom={setMyRevFrom} onTo={setMyRevTo}
                        label="Reviewed between"
                    />
                    {loading ? <p>Loading...</p>
                      : (() => {
                            const fromTs = myRevFrom ? new Date(myRevFrom + 'T00:00:00').getTime() : null;
                            const toTs   = myRevTo   ? new Date(myRevTo   + 'T23:59:59').getTime() : null;
                            const filtered = reviewedByMe.filter(r => {
                                if (!r.reviewed_at) return false;
                                const ts = new Date(r.reviewed_at).getTime();
                                if (fromTs && ts < fromTs) return false;
                                if (toTs   && ts > toTs)   return false;
                                return true;
                            });
                            if (filtered.length === 0) {
                                return (
                                    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <p>{reviewedByMe.length === 0
                                            ? "You haven't reviewed any hours requests yet."
                                            : 'No reviews in this date range.'}</p>
                                    </div>
                                );
                            }
                            return (
                                <RequestList
                                    items={filtered}
                                    totalHours={totalHours}
                                    formatDate={formatDate}
                                    statusBadge={statusBadge}
                                    mode="reviewed"
                                    displayNumberFor={displayNumberFor}
                                />
                            );
                        })()}
                </div>
            )}
        </div>
    );
}

function RequestList({ items, totalHours, formatDate, statusBadge, mode, onReview, displayNumberFor }) {
    const numFor = (req) => displayNumberFor ? displayNumberFor(req, mode) : req.request_id;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(req => (
                <div key={req.request_id} className="glass-panel" style={{
                    padding: '18px',
                    border: mode === 'review' && req.status === 'pending' ? '1px solid rgba(245,158,11,0.4)' : undefined,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                {mode !== 'mine' && (
                                    <>
                                        <User size={16} color={GREEN_DARK} />
                                        <strong style={{ color: GREEN_DARK }}>
                                            {req.employee?.first_name} {req.employee?.last_name}
                                        </strong>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                            background: 'rgba(255, 245, 231, 0.65)', color: 'var(--color-text-muted)',
                                            textTransform: 'capitalize' }}>
                                            {req.employee?.role}
                                        </span>
                                        {req.employee?.dept_name && (
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                                                background: 'rgba(121,162,128,0.15)', color: GREEN_DARK }}>
                                                {req.employee.dept_name}
                                            </span>
                                        )}
                                    </>
                                )}
                                {mode === 'mine' && (
                                    <strong style={{ color: GREEN_DARK }}>Request #{numFor(req)}</strong>
                                )}
                                {statusBadge(req.status)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                {mode !== 'mine' && `Request #${numFor(req)} · `}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', marginBottom: mode === 'review' && req.status === 'pending' ? '10px' : 0 }}>
                        {req.entries.map(e => (
                            <div key={e.entry_id} style={{
                                display: 'flex', justifyContent: 'space-between', gap: '12px',
                                padding: '6px 10px', borderRadius: '6px',
                                background: 'rgba(255, 245, 231, 0.55)',
                                fontSize: '13px', color: 'var(--color-text-dark)',
                            }}>
                                <span><Calendar size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{formatDate(e.work_date)}</span>
                                <span>{Number(e.hours).toFixed(2)} hrs</span>
                                <span style={{ flex: 1, color: 'var(--color-text-muted)', textAlign: 'right' }}>{prettyDescription(e.description)}</span>
                            </div>
                        ))}
                    </div>

                    {mode === 'review' && req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => onReview(req.request_id, 'approved')}
                                className="glass-button"
                                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981',
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <CheckCircle size={16} /> Approve
                            </button>
                            <button onClick={() => onReview(req.request_id, 'denied')}
                                className="glass-button"
                                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <XCircle size={16} /> Deny
                            </button>
                        </div>
                    )}

                    {(mode === 'mine' || mode === 'reviewed' || (mode === 'review' && req.status !== 'pending')) && req.reviewed_at && (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {req.status === 'approved' ? 'Approved' : 'Denied'} by {req.reviewer?.first_name} {req.reviewer?.last_name}
                            {req.reviewed_at ? ` on ${new Date(req.reviewed_at).toLocaleString()}` : ''}
                            {req.review_notes ? ` — "${req.review_notes}"` : ''}
                        </div>
                    )}
                </div>
            ))}
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

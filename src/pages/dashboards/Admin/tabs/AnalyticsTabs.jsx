// Three big-picture analytics tabs for the Admin panel, each powered by
// a composite SQL query (≥2 tables) on the server. They replace the old
// "Employees per Department / Animals per Zone / Revenue Breakdown" trio.
//
// Every tab follows the same recipe:
//   • independent From / To date filter (the CSV & data preview follow it)
//   • CSV export button → downloads the currently-displayed rows
//   • Show Data toggle   → raw tabular view of the same rows
//   • Insight callouts   → one-or-two-sentence "so what" summary
//   • Responsive Recharts graph
//
// Keeping the panels side-by-side in one file is deliberate: they share
// formatters, the CSV helper, the DateRange component, and the render
// skeleton. Splitting them would triplicate all of that.

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../../lib/api';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    LineChart, Line, Legend,
} from 'recharts';
import {
    Calendar, Download, Database, ChevronDown, ChevronUp, TrendingUp,
    ShoppingBag, Users, AlertCircle,
} from 'lucide-react';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';
const AMBER      = '#f59e0b';
const EMERALD    = '#10b981';
const ROSE       = '#e11d48';
const SKY        = '#2563eb';

const dollars = (cents) =>
    `$${Number(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── CSV helper ──────────────────────────────────────────────
// Takes an array of rows + column definitions like
// [{ key: 'title', label: 'Event' }, { key: 'revenue_cents', label: 'Revenue ($)',
//   map: (v) => (v/100).toFixed(2) }]
// Produces a csv file the browser downloads under `filename`.
function exportCsv(rows, columns, filename) {
    const escape = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map(c => escape(c.label)).join(',');
    const body = rows.map(r => columns.map(c => {
        const raw = c.map ? c.map(r[c.key], r) : r[c.key];
        return escape(raw);
    }).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}\n`], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ── Shared UI fragments ─────────────────────────────────────
function DateRange({ from, to, setFrom, setTo }) {
    const input = {
        padding: '6px 10px', fontSize: '12px',
        border: '1px solid rgba(121,162,128,0.3)', borderRadius: '6px',
        background: 'white', color: GREEN_DARK, fontFamily: 'inherit',
    };
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
            background: 'rgba(255, 245, 231, 0.72)',
            border: '1px solid rgba(121,162,128,0.25)',
            borderRadius: '12px', padding: '6px 12px',
        }}>
            <Calendar size={14} color={GREEN_DARK} />
            <span style={{
                fontSize: '10px', color: GREEN_DARK,
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
            }}>Date range</span>
            <input type="date" value={from} max={to || undefined}
                onChange={e => setFrom(e.target.value)} style={input} />
            <span style={{ fontSize: '12px', color: GREEN_DARK }}>→</span>
            <input type="date" value={to} min={from || undefined}
                onChange={e => setTo(e.target.value)} style={input} />
            {(from || to) && (
                <button type="button" onClick={() => { setFrom(''); setTo(''); }}
                    style={{
                        background: 'transparent', border: 'none', color: GREEN_DARK,
                        fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
                    }}>Clear</button>
            )}
        </div>
    );
}

function Toolbar({ from, to, setFrom, setTo, onExport, showData, setShowData, disabledExport }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="glass-button"
                    onClick={() => setShowData(!showData)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}>
                    <Database size={14} />
                    {showData ? 'Hide Data' : 'Show Data'}
                    {showData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button className="glass-button"
                    disabled={disabledExport}
                    onClick={onExport}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', padding: '7px 12px',
                        background: GREEN, color: 'white', fontWeight: 700,
                        opacity: disabledExport ? 0.5 : 1,
                    }}>
                    <Download size={14} /> Export CSV
                </button>
            </div>
        </div>
    );
}

function Insight({ title, body, color = GREEN }) {
    return (
        <div style={{
            background: `${color}15`,
            border: `1px solid ${color}55`,
            borderLeft: `4px solid ${color}`,
            borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <TrendingUp size={14} color={color} />
                <strong style={{ color, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {title}
                </strong>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-dark)' }}>{body}</div>
        </div>
    );
}

function DataTable({ columns, rows }) {
    return (
        <div style={{
            background: 'rgba(255, 245, 231, 0.55)',
            border: '1px solid rgba(121,162,128,0.25)',
            borderRadius: '8px', padding: '10px', marginBottom: '20px', overflowX: 'auto',
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(121,162,128,0.3)', textAlign: 'left' }}>
                        {columns.map(c => (
                            <th key={c.key} style={{ padding: '8px 10px', color: GREEN_DARK }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ padding: '16px', textAlign: 'center', color: GREEN_DARK, opacity: 0.7 }}>
                                No rows in this date range.
                            </td>
                        </tr>
                    ) : rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(121,162,128,0.15)' }}>
                            {columns.map(c => (
                                <td key={c.key} style={{ padding: '8px 10px', color: 'var(--color-text-dark)' }}>
                                    {c.render ? c.render(r[c.key], r) : (c.map ? c.map(r[c.key], r) : r[c.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// GRAPH 1 — Event Performance
// Pulls from: events + tickets (+ venues)
// Insight: fill-rate ranking, worst performers, $/event
// ════════════════════════════════════════════════════════════
export function EventPerformanceTab() {
    const [from, setFrom] = useState('');
    const [to,   setTo]   = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showData, setShowData] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to)   qs.set('to',   to);
        api.get(`/dashboard/analytics/event-performance${qs.toString() ? `?${qs}` : ''}`)
            .then(d => { if (alive) setRows(d || []); })
            .catch(e => console.error('event-performance:', e))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [from, to]);

    // Chart feed — oldest → newest reads best left-to-right on a timeline.
    const chartData = useMemo(() =>
        rows.slice().sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            .map(r => ({
                name: r.title && r.title.length > 16 ? `${r.title.slice(0, 16)}…` : (r.title || 'Untitled'),
                fullName: r.title,
                date: r.event_date,
                Tickets: Number(r.tickets_sold) || 0,
                Capacity: Number(r.max_capacity) || 0,
                Fill: Number(r.fill_rate_pct) || 0,
                Revenue: Number(r.revenue_cents) || 0,
            })),
        [rows]
    );

    const insights = useMemo(() => {
        if (!rows.length) return null;
        const sortedByFill = rows.slice().sort((a, b) => (b.fill_rate_pct || 0) - (a.fill_rate_pct || 0));
        const top   = sortedByFill[0];
        const worst = sortedByFill[sortedByFill.length - 1];
        const totalRev = rows.reduce((s, r) => s + Number(r.revenue_cents || 0), 0);
        const avgFill  = rows.reduce((s, r) => s + Number(r.fill_rate_pct || 0), 0) / rows.length;
        return { top, worst, totalRev, avgFill };
    }, [rows]);

    const csvColumns = [
        { key: 'event_id',          label: 'Event ID' },
        { key: 'title',             label: 'Title' },
        { key: 'event_date',        label: 'Date',
          map: v => v ? String(v).slice(0, 10) : '' },
        { key: 'venue_name',        label: 'Venue' },
        { key: 'max_capacity',      label: 'Max Capacity' },
        { key: 'tickets_sold',      label: 'Tickets Sold' },
        { key: 'fill_rate_pct',     label: 'Fill Rate (%)' },
        { key: 'ticket_price_cents',label: 'Ticket Price ($)',
          map: v => (Number(v || 0) / 100).toFixed(2) },
        { key: 'revenue_cents',     label: 'Revenue ($)',
          map: v => (Number(v || 0) / 100).toFixed(2) },
    ];

    const handleExport = () => {
        const tag = `${from || 'all'}_${to || 'now'}`;
        exportCsv(rows, csvColumns, `event-performance_${tag}.csv`);
    };

    return (
        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={20} color={GREEN_DARK} />
                    Event Performance — Attendance vs Capacity
                </h3>
            </div>
            <p style={{ margin: '0 0 14px', color: GREEN_DARK, fontSize: '13px' }}>
                Join of <strong>events</strong> + <strong>tickets</strong> (+ venues) — answers
                "which events pull a crowd, and which ones flop?" so marketing spend can follow the winners.
            </p>
            <Toolbar
                from={from} to={to} setFrom={setFrom} setTo={setTo}
                onExport={handleExport} showData={showData} setShowData={setShowData}
                disabledExport={rows.length === 0}
            />

            {insights && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <Insight
                        color={EMERALD}
                        title="Top Draw"
                        body={<>
                            <strong>{insights.top.title}</strong> — {Number(insights.top.fill_rate_pct).toFixed(1)}% full
                            ({insights.top.tickets_sold}/{insights.top.max_capacity}).
                        </>}
                    />
                    <Insight
                        color={ROSE}
                        title="Needs Attention"
                        body={<>
                            <strong>{insights.worst.title}</strong> only hit {Number(insights.worst.fill_rate_pct).toFixed(1)}% capacity.
                            Consider promotion, rescheduling, or retiring.
                        </>}
                    />
                    <Insight
                        color={SKY}
                        title="Portfolio"
                        body={<>
                            {rows.length} events total · average fill <strong>{insights.avgFill.toFixed(1)}%</strong>
                            · ticket revenue {dollars(insights.totalRev)}.
                        </>}
                    />
                </div>
            )}

            {showData && (
                <DataTable
                    columns={[
                        { key: 'title',         label: 'Event' },
                        { key: 'event_date',    label: 'Date',
                          render: v => v ? String(v).slice(0,10) : '—' },
                        { key: 'venue_name',    label: 'Venue' },
                        { key: 'tickets_sold',  label: 'Sold' },
                        { key: 'max_capacity',  label: 'Capacity' },
                        { key: 'fill_rate_pct', label: 'Fill %',
                          render: v => `${Number(v || 0).toFixed(1)}%` },
                        { key: 'revenue_cents', label: 'Revenue',
                          render: v => dollars(v) },
                    ]}
                    rows={rows}
                />
            )}

            <div style={{ width: '100%', height: '380px' }}>
                {loading ? (
                    <p style={{ color: GREEN_DARK }}>Loading event performance...</p>
                ) : chartData.length === 0 ? (
                    <p style={{ color: GREEN_DARK, textAlign: 'center', padding: '40px' }}>
                        <AlertCircle size={16} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
                        No events in this date range.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,122,66,0.18)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: GREEN_DARK, fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
                            <YAxis tick={{ fill: GREEN_DARK, fontSize: 12 }} allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(121,162,128,0.08)' }}
                                contentStyle={{ background: 'white', border: `1px solid ${GREEN}`, borderRadius: '8px' }}
                                formatter={(v, k) => {
                                    if (k === 'Fill')     return [`${v}%`,        'Fill rate'];
                                    if (k === 'Revenue')  return [dollars(v),     'Revenue'];
                                    return [v, k];
                                }}
                                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="Capacity" fill="rgba(121,162,128,0.35)" radius={[4,4,0,0]} name="Capacity" />
                            <Bar dataKey="Tickets"  fill={GREEN}                  radius={[4,4,0,0]} name="Tickets Sold" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// GRAPH 2 — Membership Insights (new vs returning, monthly)
// Pulls from: customers + transactions
// ════════════════════════════════════════════════════════════
export function MembershipInsightsTab() {
    const [from, setFrom] = useState('');
    const [to,   setTo]   = useState('');
    const [state, setState] = useState({ rows: [], returning_revenue_cents: 0, active_members_now: 0, new_customers_in_range: 0 });
    const [loading, setLoading] = useState(true);
    const [showData, setShowData] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to)   qs.set('to',   to);
        api.get(`/dashboard/analytics/membership-insights${qs.toString() ? `?${qs}` : ''}`)
            .then(d => { if (alive) setState(d || { rows: [] }); })
            .catch(e => console.error('membership-insights:', e))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [from, to]);

    const chartData = useMemo(() =>
        (state.rows || []).map(r => ({
            period: r.period,
            'New Members':     Number(r.new_members)     || 0,
            'New Non-Members': Number(r.new_non_members) || 0,
            'Revenue ($)':     Math.round((Number(r.revenue_cents) || 0) / 100),
        })),
        [state.rows]
    );

    const totalNew = (state.rows || []).reduce((s, r) => s + Number(r.new_customers_total || 0), 0);
    const totalNewRevenue = (state.rows || []).reduce((s, r) => s + Number(r.revenue_cents || 0), 0);

    const csvColumns = [
        { key: 'period',              label: 'Month (YYYY-MM)' },
        { key: 'new_members',         label: 'New Members' },
        { key: 'new_non_members',     label: 'New Non-Members' },
        { key: 'new_customers_total', label: 'Total New Customers' },
        { key: 'revenue_cents',       label: 'Revenue from Cohort ($)',
          map: v => (Number(v || 0) / 100).toFixed(2) },
    ];

    const handleExport = () => {
        const tag = `${from || 'all'}_${to || 'now'}`;
        exportCsv(state.rows || [], csvColumns, `membership-insights_${tag}.csv`);
    };

    return (
        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
            <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={20} color={GREEN_DARK} />
                Membership Insights — New vs Returning
            </h3>
            <p style={{ margin: '0 0 14px', color: GREEN_DARK, fontSize: '13px' }}>
                Join of <strong>customers</strong> + <strong>transactions</strong> — tracks monthly
                signups and the revenue they drive, so you can tell a growth story from a churn story.
            </p>
            <Toolbar
                from={from} to={to} setFrom={setFrom} setTo={setTo}
                onExport={handleExport} showData={showData} setShowData={setShowData}
                disabledExport={(state.rows || []).length === 0}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                <Insight color={EMERALD} title="Active Members Now"
                    body={<><strong style={{ fontSize: '18px' }}>{state.active_members_now}</strong> paid members today.</>} />
                <Insight color={SKY} title="New in Range"
                    body={<><strong style={{ fontSize: '18px' }}>{totalNew}</strong> sign-ups · {dollars(totalNewRevenue)} in lifetime spend from that cohort.</>} />
                <Insight color={AMBER} title="Returning Revenue"
                    body={<>Customers who signed up <em>before</em> this window spent <strong>{dollars(state.returning_revenue_cents)}</strong>.</>} />
            </div>

            {showData && (
                <DataTable
                    columns={[
                        { key: 'period',              label: 'Month' },
                        { key: 'new_members',         label: 'New Members' },
                        { key: 'new_non_members',     label: 'New Non-Members' },
                        { key: 'new_customers_total', label: 'Total' },
                        { key: 'revenue_cents',       label: 'Cohort Revenue',
                          render: v => dollars(v) },
                    ]}
                    rows={state.rows || []}
                />
            )}

            <div style={{ width: '100%', height: '380px' }}>
                {loading ? (
                    <p style={{ color: GREEN_DARK }}>Loading membership insights...</p>
                ) : chartData.length === 0 ? (
                    <p style={{ color: GREEN_DARK, textAlign: 'center', padding: '40px' }}>
                        <AlertCircle size={16} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
                        No customer signups in this date range.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,122,66,0.18)" vertical={false} />
                            <XAxis dataKey="period" tick={{ fill: GREEN_DARK, fontSize: 12 }} />
                            <YAxis yAxisId="left"  tick={{ fill: GREEN_DARK, fontSize: 12 }} allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: SKY, fontSize: 12 }} />
                            <Tooltip
                                cursor={{ fill: 'rgba(121,162,128,0.08)' }}
                                contentStyle={{ background: 'white', border: `1px solid ${GREEN}`, borderRadius: '8px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="left" dataKey="New Members"     stackId="a" fill={GREEN} radius={[4,4,0,0]} />
                            <Bar yAxisId="left" dataKey="New Non-Members" stackId="a" fill={AMBER} radius={[4,4,0,0]} />
                            <Line yAxisId="right" type="monotone" dataKey="Revenue ($)" stroke={SKY} strokeWidth={2} dot={{ r: 3 }} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// GRAPH 3 — Shop Performance
// Pulls from: sale_items + inventory + transactions (+ shops)
// ════════════════════════════════════════════════════════════
export function ShopPerformanceTab() {
    const [from, setFrom] = useState('');
    const [to,   setTo]   = useState('');
    const [state, setState] = useState({ by_category: [], top_items: [] });
    const [loading, setLoading] = useState(true);
    const [showData, setShowData] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to)   qs.set('to',   to);
        api.get(`/dashboard/analytics/shop-performance${qs.toString() ? `?${qs}` : ''}`)
            .then(d => { if (alive) setState(d || { by_category: [], top_items: [] }); })
            .catch(e => console.error('shop-performance:', e))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [from, to]);

    const chartData = useMemo(() =>
        (state.by_category || []).map(r => ({
            category: r.category,
            'Revenue ($)': Math.round((Number(r.revenue_cents) || 0) / 100),
            'Units':       Number(r.units_sold) || 0,
        })),
        [state.by_category]
    );

    const totalRevenue = (state.by_category || []).reduce((s, r) => s + Number(r.revenue_cents || 0), 0);
    const totalUnits   = (state.by_category || []).reduce((s, r) => s + Number(r.units_sold    || 0), 0);
    const topCat       = (state.by_category || [])[0];
    const topItem      = (state.top_items || [])[0];

    const csvColumns = [
        { key: 'category',     label: 'Category' },
        { key: 'units_sold',   label: 'Units Sold' },
        { key: 'orders',       label: 'Orders' },
        { key: 'revenue_cents',label: 'Revenue ($)',
          map: v => (Number(v || 0) / 100).toFixed(2) },
    ];
    const itemCsvColumns = [
        { key: 'item_name',    label: 'Item' },
        { key: 'category',     label: 'Category' },
        { key: 'shop_name',    label: 'Shop' },
        { key: 'units_sold',   label: 'Units Sold' },
        { key: 'revenue_cents',label: 'Revenue ($)',
          map: v => (Number(v || 0) / 100).toFixed(2) },
    ];

    const handleExport = () => {
        const tag = `${from || 'all'}_${to || 'now'}`;
        exportCsv(state.by_category || [],   csvColumns,     `shop-performance-by-category_${tag}.csv`);
        exportCsv(state.top_items   || [],   itemCsvColumns, `shop-performance-top-items_${tag}.csv`);
    };

    return (
        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
            <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag size={20} color={GREEN_DARK} />
                Shop Performance — Revenue by Category
            </h3>
            <p style={{ margin: '0 0 14px', color: GREEN_DARK, fontSize: '13px' }}>
                Join of <strong>sale_items</strong> + <strong>inventory</strong> + <strong>transactions</strong>
                (+ shops) — tells you which categories actually turn foot traffic into cash
                and which shelves are dead weight.
            </p>
            <Toolbar
                from={from} to={to} setFrom={setFrom} setTo={setTo}
                onExport={handleExport} showData={showData} setShowData={setShowData}
                disabledExport={(state.by_category || []).length === 0}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                <Insight color={EMERALD} title="Total Retail"
                    body={<><strong>{dollars(totalRevenue)}</strong> across <strong>{totalUnits}</strong> units sold.</>} />
                {topCat && (
                    <Insight color={SKY} title="Top Category"
                        body={<>
                            <strong>{topCat.category}</strong> — {dollars(topCat.revenue_cents)}
                            {' '}({Number(totalRevenue ? (topCat.revenue_cents / totalRevenue) * 100 : 0).toFixed(1)}% of total)
                        </>} />
                )}
                {topItem && (
                    <Insight color={AMBER} title="Best-Seller"
                        body={<>
                            <strong>{topItem.item_name}</strong> moved {topItem.units_sold} units
                            for {dollars(topItem.revenue_cents)} at {topItem.shop_name || 'the shop'}.
                        </>} />
                )}
            </div>

            {showData && (
                <>
                    <h4 style={{ margin: '8px 0', color: GREEN_DARK }}>By Category</h4>
                    <DataTable
                        columns={[
                            { key: 'category',     label: 'Category' },
                            { key: 'units_sold',   label: 'Units' },
                            { key: 'orders',       label: 'Orders' },
                            { key: 'revenue_cents',label: 'Revenue', render: v => dollars(v) },
                        ]}
                        rows={state.by_category || []}
                    />
                    <h4 style={{ margin: '8px 0', color: GREEN_DARK }}>Top 15 Items</h4>
                    <DataTable
                        columns={[
                            { key: 'item_name',    label: 'Item' },
                            { key: 'category',     label: 'Category' },
                            { key: 'shop_name',    label: 'Shop' },
                            { key: 'units_sold',   label: 'Units' },
                            { key: 'revenue_cents',label: 'Revenue', render: v => dollars(v) },
                        ]}
                        rows={state.top_items || []}
                    />
                </>
            )}

            <div style={{ width: '100%', height: '380px' }}>
                {loading ? (
                    <p style={{ color: GREEN_DARK }}>Loading shop performance...</p>
                ) : chartData.length === 0 ? (
                    <p style={{ color: GREEN_DARK, textAlign: 'center', padding: '40px' }}>
                        <AlertCircle size={16} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
                        No shop sales in this date range.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,122,66,0.18)" vertical={false} />
                            <XAxis dataKey="category" tick={{ fill: GREEN_DARK, fontSize: 12 }} />
                            <YAxis yAxisId="left"  tick={{ fill: GREEN_DARK, fontSize: 12 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: AMBER, fontSize: 12 }} allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(121,162,128,0.08)' }}
                                contentStyle={{ background: 'white', border: `1px solid ${GREEN}`, borderRadius: '8px' }}
                                formatter={(v, k) => k === 'Revenue ($)' ? [`$${Number(v).toLocaleString()}`, k] : [v, k]}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="left"  dataKey="Revenue ($)" fill={GREEN} radius={[4,4,0,0]} />
                            <Bar yAxisId="right" dataKey="Units"       fill={AMBER} radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

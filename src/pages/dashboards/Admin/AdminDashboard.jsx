import React, { useEffect, useState, useMemo } from 'react';
import { Users, Ticket, ShoppingBag, DollarSign, Database, Heart } from 'lucide-react';
import api from '../../../lib/api';
import LifecycleLogModal, { LifecycleLogButton } from '../../../components/LifecycleLogModal';
import { useToast, useConfirm } from '../../../components/Feedback';
import {
    getAdminDashboardStats,
    getRecentTransactions,
} from '../../../api/dashboard';
import {
    EventPerformanceTab, MembershipInsightsTab, ShopPerformanceTab,
} from './tabs/AnalyticsTabs';

// ── Revenue period helpers ──
// Quarter bounds are inclusive [from, to]. The Stats endpoint handles the
// +1-day exclusive clamp server-side. "ytd" is start-of-year → today;
// "all" omits both params so the server sums lifetime.
function periodRange(key, year) {
    const pad = n => String(n).padStart(2, '0');
    const y = year;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    switch (key) {
        case 'ytd': return { from: `${y}-01-01`, to: todayStr };
        case 'q1':  return { from: `${y}-01-01`, to: `${y}-03-31` };
        case 'q2':  return { from: `${y}-04-01`, to: `${y}-06-30` };
        case 'q3':  return { from: `${y}-07-01`, to: `${y}-09-30` };
        case 'q4':  return { from: `${y}-10-01`, to: `${y}-12-31` };
        case 'year':return { from: `${y}-01-01`, to: `${y}-12-31` };
        case 'all':
        default:    return {};
    }
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalRevenueCents: 0,
        ticketRevenueCents: 0,
        retailRevenueCents: 0,
        donationRevenueCents: 0,
        totalEmployees: 0,
        totalAnimals: 0,
        totalCustomers: 0,
    });
    const [loading, setLoading] = useState(true);
    const [recentTransactions, setRecentTransactions] = useState([]);

    // UI State
    const [activeTab, setActiveTab] = useState('Overview');

    // Revenue-period filter: which year + which slice of it.
    // Year defaults to the most recent year present in the transactions log;
    // period defaults to YTD so the panel opens on "what's happened so far".
    const [period, setPeriod] = useState('ytd');
    const [periodYear, setPeriodYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchAdminData();
    }, []);

    // Refetch revenue whenever the period filter changes — counts stay
    // lifetime, so we only re-pull the stats.
    useEffect(() => {
        if (loading) return;
        const range = periodRange(period, periodYear);
        getAdminDashboardStats(range)
            .then(s => setStats(prev => ({ ...prev, ...s })))
            .catch(err => console.error('Error refetching stats for period:', err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, periodYear]);

    async function fetchAdminData() {
        try {
            const initialRange = periodRange('ytd', new Date().getFullYear());
            const [dashStats, transactions] = await Promise.all([
                getAdminDashboardStats(initialRange),
                getRecentTransactions(),
            ]);
            setStats(dashStats);
            setRecentTransactions(transactions);
            // Align year default with whatever year shows up in the log —
            // "last recorded year" in the user's words. Falls back to the
            // current calendar year if the log is empty.
            const years = Array.from(new Set((transactions || [])
                .map(t => t.transaction_date ? new Date(t.transaction_date).getFullYear() : null)
                .filter(Boolean)));
            if (years.length > 0) setPeriodYear(Math.max(...years));
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    }

    // Years with at least one recorded transaction — used to build the
    // period-filter dropdown. Desc order so the newest sits at top.
    const recordedYears = useMemo(() => {
        const ys = new Set((recentTransactions || [])
            .map(t => t.transaction_date ? new Date(t.transaction_date).getFullYear() : null)
            .filter(Boolean));
        const arr = Array.from(ys).sort((a, b) => b - a);
        return arr.length > 0 ? arr : [new Date().getFullYear()];
    }, [recentTransactions]);

    const formatDollars = (cents) =>
        (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

    const TABS = ['Overview', 'Event Performance', 'Membership Insights', 'Shop Performance', 'Reactivate'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Zoo Overview & Management</p>
                </div>
                <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <DollarSign color="#6d8243" />
                    <div>
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Revenue</span>
                        <span style={{ fontWeight: 'bold', fontSize: '18px' }}>${formatDollars(stats.totalRevenueCents)}</span>
                    </div>
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
                            background: activeTab === tab ? 'var(--color-primary)' : 'rgba(255, 245, 231, 0.65)',
                            color: activeTab === tab ? 'white' : 'rgb(102, 122, 66)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 500,
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ═══════════ OVERVIEW TAB ═══════════ */}
            {activeTab === 'Overview' && (
                <>
                    {/* Revenue period filter */}
                    <PeriodFilter
                        period={period}
                        year={periodYear}
                        years={recordedYears}
                        onPeriod={setPeriod}
                        onYear={setPeriodYear}
                    />

                    {/* Key Metrics Grid */}
                    <div className="grid-cards" style={{ marginBottom: '40px' }}>
                        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Tickets</h3>
                                <Ticket size={20} color="var(--color-primary)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.ticketRevenueCents)}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)',padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Retail</h3>
                                <ShoppingBag size={20} color="var(--color-secondary)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.retailRevenueCents)}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)',padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Donations</h3>
                                <Heart size={20} color="#e11d48" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.donationRevenueCents)}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Staff</h3>
                                <Users size={20} color="var(--color-accent)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalEmployees}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)',padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Animals</h3>
                                <Database size={20} color="#f59e0b" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalAnimals}</p>
                        </div>
                    </div>

                    <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px' }}>
                        <h3 style={{ marginTop: 0 }}>System Status</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                                <span>Database Connection: <span style={{ color: '#10b981' }}>Active</span></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
                                <span>Auth Service: <span style={{ color: '#10b981' }}>Active</span></span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════ EVENT PERFORMANCE TAB ═══════════ */}
            {activeTab === 'Event Performance' && <EventPerformanceTab />}

            {/* ═══════════ MEMBERSHIP INSIGHTS TAB ═══════════ */}
            {activeTab === 'Membership Insights' && <MembershipInsightsTab />}

            {/* ═══════════ SHOP PERFORMANCE TAB ═══════════ */}
            {activeTab === 'Shop Performance' && <ShopPerformanceTab />}


            {/* ═══════════ REACTIVATE TAB ═══════════ */}
            {activeTab === 'Reactivate' && <ReactivatePanel />}
        </div>
    );
}

function ReactivatePanel() {
    const toast   = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState('customers');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [logTarget, setLogTarget] = useState(null);

    // Single helper — api client auto-attaches the auth header and
    // throws on non-2xx responses. The previous raw fetch() swallowed
    // server errors by dropping non-array JSON into setRows([]), which
    // is why "No deactivated staff found" appeared even when rows existed.
    const runSearch = async (nextTab = tab, nextQuery = query) => {
        setLoading(true);
        // Clear rows immediately so stale data from the previous tab
        // doesn't get re-keyed with the new tab's id() accessor (React
        // warns about duplicate undefined keys when e.g. 'animals' rows
        // linger while the tab is now 'customers').
        setRows([]);
        try {
            const qs = nextQuery.trim()
                ? (nextTab === 'animals'
                    ? `?name=${encodeURIComponent(nextQuery)}`
                    : `?q=${encodeURIComponent(nextQuery)}`)
                : '';
            const path = nextTab === 'customers' ? `/customers/deactivated${qs}`
                       : nextTab === 'staff'     ? `/employees/deactivated${qs}`
                       :                           `/animals/deactivated${qs}`;
            const data = await api.get(path);
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            setRows([]);
            toast.error('Lookup failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-load when the tab mounts or changes so "staff" and "animals"
    // show their deactivated entries without requiring a Search click.
    useEffect(() => {
        setQuery('');
        runSearch(tab, '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const reactivate = async (id) => {
        const ok = await confirm({
            title: tab === 'animals' ? 'Return this animal to the zoo?' : 'Reactivate this account?',
            message: tab === 'animals'
                ? 'The animal will be flagged as currently present and appear in active rosters again.'
                : 'The account will be restored and the user can sign in again.',
            confirmLabel: tab === 'animals' ? 'Return' : 'Reactivate',
        });
        if (!ok) return;
        const path = tab === 'customers' ? `/customers/${id}/reactivate`
                   : tab === 'staff'     ? `/employees/${id}/reactivate`
                   :                       `/animals/${id}/reactivate`;
        try {
            await api.post(path);
            toast.success(tab === 'animals' ? 'Animal returned.' : 'Account reactivated.');
            await runSearch();
        } catch (err) {
            toast.error('Reactivate failed: ' + err.message);
        }
    };

    const label = (r) =>
        tab === 'customers' ? `${r.first_name} ${r.last_name} — ${r.email}`
      : tab === 'staff'     ? `${r.first_name} ${r.last_name}${r.email ? ` — ${r.email}` : ''} (${r.role}${r.dept_name ? ` · ${r.dept_name}` : ''})`
      :                       `${r.name} — ${r.species_common_name}${r.zone_name ? ` · ${r.zone_name}` : ''}`;

    const id = (r) =>
        tab === 'customers' ? r.customer_id
      : tab === 'staff'     ? r.employee_id
      :                       r.animal_id;

    const entityFor = (t) =>
        t === 'customers' ? 'customer'
      : t === 'staff'     ? 'employee'
      :                     'animal';

    return (
        <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Reactivate Deactivated Accounts</h3>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
                Look up customers, staff, or animals that were soft-deleted and restore them.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['customers','staff','animals'].map(t => (
                    <button key={t}
                        className="glass-button"
                        onClick={() => setTab(t)}
                        style={{
                            padding: '6px 14px', fontSize: '13px',
                            background: tab === t ? 'rgb(123, 144, 79)' : 'rgba(255, 245, 231, 0.65)',
                            color: tab === t ? 'white' : 'rgb(102, 122, 66)',
                            textTransform: 'capitalize',
                        }}>{t}</button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                    className="glass-input"
                    placeholder={tab === 'animals' ? 'Search by name...' : 'Search by name or email...'}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                    style={{ flex: 1 }}
                />
                <button className="glass-button" onClick={() => runSearch()}
                    style={{ background: 'rgb(123, 144, 79)', color: 'white' }}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : rows.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>
                    No deactivated {tab} found{query ? ` matching "${query}"` : ''}.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rows.map(r => (
                        // Key is tab-scoped so rows briefly held in state
                        // during a tab switch can't collide with the new
                        // tab's id accessor (which may return undefined
                        // for the wrong entity shape).
                        <div key={`${tab}-${id(r) ?? `idx${rows.indexOf(r)}`}`} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 14px', borderRadius: '10px',
                            background: 'rgba(255, 245, 231, 0.65)',
                            border: '1px solid rgba(121,162,128,0.25)',
                            gap: '10px',
                        }}>
                            <span style={{ flex: 1, minWidth: 0 }}>{label(r)}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <LifecycleLogButton
                                    compact
                                    onClick={() => setLogTarget({
                                        entity: entityFor(tab),
                                        id: id(r),
                                        name: tab === 'animals'
                                            ? r.name
                                            : `${r.first_name} ${r.last_name}`,
                                    })}
                                />
                                <button className="glass-button"
                                    onClick={() => reactivate(id(r))}
                                    style={{ background: 'rgb(123, 144, 79)', color: 'white', padding: '6px 14px', fontSize: '12px' }}>
                                    Reactivate
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {logTarget && (
                <LifecycleLogModal
                    entity={logTarget.entity}
                    id={logTarget.id}
                    name={logTarget.name}
                    onClose={() => setLogTarget(null)}
                />
            )}
        </div>
    );
}

// Period toggle: YTD / Q1–Q4 / Full year / All-time, scoped to one of the
// years with at least one transaction on record. "All" sweeps lifetime and
// ignores the year picker.
function PeriodFilter({ period, year, years, onPeriod, onYear }) {
    const GREEN      = 'rgb(123, 144, 79)';
    const GREEN_DARK = 'rgb(102, 122, 66)';
    const tabs = [
        { key: 'ytd',  label: 'YTD'  },
        { key: 'q1',   label: 'Q1'   },
        { key: 'q2',   label: 'Q2'   },
        { key: 'q3',   label: 'Q3'   },
        { key: 'q4',   label: 'Q4'   },
        { key: 'year', label: 'Full Year' },
        { key: 'all',  label: 'All'  },
    ];
    return (
        <div style={{
            display: 'inline-flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
            background: 'rgba(255, 245, 231, 0.72)',
            border: '1px solid rgba(121,162,128,0.25)',
            padding: '6px 10px', borderRadius: '12px', marginBottom: '20px',
        }}>
            <span style={{
                fontSize: '10px', color: GREEN_DARK, padding: '0 6px',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
            }}>Period</span>
            <div style={{ display: 'inline-flex', gap: '4px' }}>
                {tabs.map(t => {
                    const active = period === t.key;
                    return (
                        <button key={t.key} type="button" onClick={() => onPeriod(t.key)}
                            style={{
                                padding: '6px 12px', fontSize: '12px',
                                background: active ? GREEN : 'transparent',
                                color: active ? 'white' : GREEN_DARK,
                                fontWeight: active ? 700 : 500,
                                border: 'none', borderRadius: '8px',
                                cursor: 'pointer', transition: 'background 150ms, color 150ms',
                            }}>{t.label}</button>
                    );
                })}
            </div>
            {period !== 'all' && (
                <select value={year} onChange={e => onYear(parseInt(e.target.value))}
                    style={{
                        padding: '5px 8px', fontSize: '12px',
                        border: '1px solid rgba(121,162,128,0.3)', borderRadius: '6px',
                        background: 'white', color: GREEN_DARK, fontFamily: 'inherit',
                    }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            )}
        </div>
    );
}

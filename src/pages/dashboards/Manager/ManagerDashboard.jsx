import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import {
    getPendingRequestsForManager,
    getAllSupplyRequests,
    reviewSupplyRequest,
    restockOperationalSupply,
    getAllOperationalSupplies
} from '../../../api/supplies';
import { queryActivity, logActivity } from '../../../api/activityLog';
import { setHealthStatus } from '../../../api/animals';
import AnimalMedicalPanel from '../../../components/AnimalMedicalPanel';
import { StatusFilter, DateRangeFilter } from '../../../components/AnimalsPanel';
import { useToast } from '../../../components/Feedback';
import ZooPaginator from '../../../components/ZooPaginator';
import { formatShiftTimeframe } from '../../../utils/staff';
import {
    LayoutDashboard, Users, ClipboardList, Calendar, Package,
    CheckCircle, XCircle, Clock, AlertTriangle, Shield, Activity,
    Cat, UserPlus, Heart, ChevronDown, ChevronUp, Stethoscope
} from 'lucide-react';

const MGR_GREEN      = 'rgb(123, 144, 79)';
const MGR_GREEN_DARK = 'rgb(102, 122, 66)';

function HealthBadge({ status }) {
    const s = status || 'healthy';
    const map = {
        healthy:           { label: 'Healthy',      bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
        under_observation: { label: 'Observation',  bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
        recovering:        { label: 'Recovering',   bg: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
        sick:              { label: 'Sick',         bg: 'rgba(245,158,11,0.2)',  color: '#d97706' },
        critical:          { label: 'Critical',     bg: 'rgba(239,68,68,0.2)',   color: '#dc2626' },
    };
    const c = map[s] || map.healthy;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: 600,
            padding: '2px 8px', borderRadius: '10px',
            background: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: '0.3px',
        }}>
            <Heart size={10} /> {c.label}
        </span>
    );
}

const TABS = ['Overview', 'Supply Requests', 'My Staff', 'Animal Assignments', 'Events', 'Activity Log'];

export default function ManagerDashboard() {
    const { user, employeeId, deptId, role } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('Overview');

    // Resolved IDs — fetched directly from DB to avoid context timing issues
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

    // Overview state
    const [overviewStats, setOverviewStats] = useState({ staffCount: 0, pendingRequests: 0, lowStockCount: 0, upcomingEvents: 0 });
    const [overviewLoading, setOverviewLoading] = useState(true);

    // Supply Requests state
    const [pendingRequests, setPendingRequests] = useState([]);
    const [allRequests, setAllRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [requestFilter, setRequestFilter] = useState('pending');
    // Date-range filters — applied to Supply Requests, Activity Log, Events.
    const [reqFrom,   setReqFrom]   = useState('');
    const [reqTo,     setReqTo]     = useState('');
    const [logFrom,   setLogFrom]   = useState('');
    const [logTo,     setLogTo]     = useState('');
    const [eventFrom, setEventFrom] = useState('');
    const [eventTo,   setEventTo]   = useState('');
    const [eventWhen, setEventWhen] = useState('upcoming'); // all | upcoming | past — default to upcoming so the soonest events are front-and-center for assignment

    // Staff state
    const [staff, setStaff] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);

    // Events state
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    // Supplies overview
    const [allSupplies, setAllSupplies] = useState([]);

    // Activity log state — paginated. Default page shows the 25 newest
    // rows; Next/Prev walks back through history. When a date range is
    // set we switch to "all rows in range" mode (one big fetch).
    const ACTIVITY_PAGE_SIZE = 25;
    const [activityLog, setActivityLog] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityTotal, setActivityTotal] = useState(0);
    const [activityPage,  setActivityPage]  = useState(0);
    const [activitySearch, setActivitySearch] = useState('');

    // Animal assignments state
    const [allAnimals, setAllAnimals] = useState([]);
    const [animalsLoading, setAnimalsLoading] = useState(true);
    const [vets, setVets] = useState([]);
    const [caretakers, setCaretakers] = useState([]);
    const [expandedAnimalId, setExpandedAnimalId] = useState(null);

    // Search + zone filter for Animal Assignments.
    // animalSearch — matches animal name, species, assigned vet/caretaker name.
    // zoneFilter  — single zone_name or 'all'.
    const [animalSearch, setAnimalSearch] = useState('');
    const [zoneFilter,   setZoneFilter]   = useState('all');

    // Search for My Staff + Events. Events search also matches vet/caretaker
    // (assignee) names so the manager can find "which event has Sarah on it".
    const [staffSearch, setStaffSearch] = useState('');
    const [eventSearch, setEventSearch] = useState('');


    const isAdmin = role === 'admin';

    // Resolve employee profile directly from DB using auth user ID
    useEffect(() => {
        async function loadDashboard() {
            if (!user?.userId) return;

            let empId = employeeId;
            let depId = deptId;

            // If context IDs aren't ready yet, fetch directly
            if (!empId || !depId) {
                try {
                    const data = await api.get('/employees/me');
                    empId = data.employee_id;
                    depId = data.dept_id;
                    setResolvedEmpId(empId);
                    setResolvedDeptId(depId);
                } catch (err) {
                    console.error('Error resolving employee:', err);
                }
            } else {
                setResolvedEmpId(empId);
                setResolvedDeptId(depId);
            }

            if (!empId || !depId) return;

            // Now fetch everything with resolved IDs
            fetchOverview(depId);
            fetchRequests(depId);
            fetchStaff(depId);
            fetchEvents();
            fetchAllSupplies();
            fetchActivityLog(depId);
            fetchAnimalsWithAssignments();
            fetchVetsAndCaretakers();
        }

        loadDashboard();
    }, [user?.userId, employeeId, deptId]);

    // Re-fetch activity log when its filter inputs change. Debounced via
    // setTimeout so typing in the search box doesn't fire a request per keystroke.
    useEffect(() => {
        if (!resolvedDeptId && !isAdmin) return;
        const handle = setTimeout(() => fetchActivityLog(resolvedDeptId), 220);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityPage, logFrom, logTo, activitySearch, resolvedDeptId]);

    // Reset to page 0 whenever the search / date inputs change so the
    // user doesn't get stuck on an empty page 3 after narrowing results.
    useEffect(() => { setActivityPage(0); }, [logFrom, logTo, activitySearch]);

    async function fetchOverview(depId) {
        try {
            const data = await api.get('/dashboard/stats');
            setOverviewStats({
                staffCount: data.total_employees || 0,
                pendingRequests: data.pending_requests || 0,
                lowStockCount: data.low_stock_count || 0,
                upcomingEvents: 0, // will be updated when events load
            });
        } catch (err) {
            console.error('Error fetching overview:', err);
        } finally {
            setOverviewLoading(false);
        }
    }

    async function fetchRequests(depId) {
        const id = depId || resolvedDeptId || deptId;
        try {
            const [pending, all] = await Promise.all([
                getPendingRequestsForManager(isAdmin ? null : id),
                getAllSupplyRequests()
            ]);
            setPendingRequests(pending);
            setAllRequests(all);
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setRequestsLoading(false);
        }
    }

    async function fetchAllSupplies() {
        try {
            const data = await getAllOperationalSupplies();
            setAllSupplies(data);
        } catch (err) {
            console.error('Error fetching all supplies:', err);
        }
    }

    async function fetchActivityLog(depId) {
        const id = depId || resolvedDeptId || deptId;
        setActivityLoading(true);
        try {
            // Always paginate 25/page — even when a date range is set we
            // walk through matches 25 at a time so the UI never dumps a
            // giant list in one shot.
            const { rows, total } = await queryActivity({
                limit:  ACTIVITY_PAGE_SIZE,
                offset: activityPage * ACTIVITY_PAGE_SIZE,
                deptId: isAdmin ? null : id,
                from:   logFrom || '',
                to:     logTo   || '',
                search: activitySearch,
            });
            setActivityLog(rows);
            setActivityTotal(total);
        } catch (err) {
            console.error('Error fetching activity log:', err);
        } finally {
            setActivityLoading(false);
        }
    }

    async function handleReview(requestId, status) {
        const empId = resolvedEmpId || employeeId;
        try {
            const request = pendingRequests.find(r => r.request_id === requestId);
            // Server auto-restocks the supply when status === 'approved'
            await reviewSupplyRequest(requestId, empId, status);

            // Log the activity
            await logActivity({
                action_type: status === 'approved' ? 'supply_request_approved' : 'supply_request_denied',
                description: `${status === 'approved' ? 'Approved' : 'Denied'} request for ${request?.requested_quantity}x ${request?.item_name}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: requestId,
                metadata: { item_name: request?.item_name, quantity: request?.requested_quantity, status }
            });

            fetchRequests(resolvedDeptId);
            fetchOverview(resolvedDeptId);
            fetchAllSupplies();
            fetchActivityLog(resolvedDeptId);
        } catch (err) {
            console.error('Error reviewing request:', err);
            toast.error('Failed to review request: ' + err.message);
        }
    }

    async function fetchStaff(depId) {
        // /employees/my-team returns self + direct reports for managers, and
        // every active employee for admins. The response flags self with
        // is_self=1 so the UI can surface "(Me)" without recomputing.
        try {
            const data = await api.get('/employees/my-team');
            setStaff(data || []);
        } catch (err) {
            console.error('Error fetching staff:', err);
        } finally {
            setStaffLoading(false);
        }
    }

    async function fetchEvents() {
        try {
            // /events/with-assignments returns each event with venue_name + assignments[] embedded
            const data = await api.get('/events/with-assignments');
            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    async function fetchAnimalsWithAssignments() {
        try {
            // Returns animals with zone_name (flat) + vet_assignments[] + caretaker_assignments[]
            const data = await api.get('/animals/with-assignments');
            setAllAnimals(data || []);
        } catch (err) {
            console.error('Error fetching animals:', err);
        } finally {
            setAnimalsLoading(false);
        }
    }

    async function fetchVetsAndCaretakers() {
        try {
            const [vetData, ctData] = await Promise.all([
                api.get('/employees/vets'),
                api.get('/employees/caretakers'),
            ]);
            setVets(vetData || []);
            setCaretakers(ctData || []);
        } catch (err) {
            console.error('Error fetching vets/caretakers:', err);
        }
    }

    async function handleAssignVet(animalId, vetEmployeeId) {
        try {
            await api.post(`/animals/${animalId}/vet-assign`, { vet_id: vetEmployeeId });
            const animal = allAnimals.find(a => a.animal_id === animalId);
            const vet    = vets.find(v => v.employee_id === vetEmployeeId);
            const animalLabel = animal ? animal.name : `animal #${animalId}`;
            const vetLabel    = vet ? `${vet.first_name} ${vet.last_name}` : `vet #${vetEmployeeId}`;
            await logActivity({
                action_type: 'animal_vet_assigned',
                description: `Assigned ${vetLabel} to ${animalLabel}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'animal',
                target_id: animalId
            });
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error assigning vet:', err);
            toast.error('Failed to assign vet: ' + err.message);
        }
    }

    async function handleRemoveVetAssignment(vetId, animalId) {
        try {
            await api.delete(`/animals/${animalId}/vet-assign/${vetId}`);
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error removing vet:', err);
        }
    }

    async function handleAssignCaretaker(animalId, caretakerEmployeeId) {
        try {
            await api.post(`/animals/${animalId}/caretaker-assign`, { caretaker_id: caretakerEmployeeId });
            const animal    = allAnimals.find(a => a.animal_id === animalId);
            const caretaker = caretakers.find(c => c.employee_id === caretakerEmployeeId);
            const animalLabel    = animal ? animal.name : `animal #${animalId}`;
            const caretakerLabel = caretaker ? `${caretaker.first_name} ${caretaker.last_name}` : `caretaker #${caretakerEmployeeId}`;
            await logActivity({
                action_type: 'animal_caretaker_assigned',
                description: `Assigned ${caretakerLabel} to ${animalLabel}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'animal',
                target_id: animalId
            });
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error assigning caretaker:', err);
            toast.error('Failed to assign caretaker: ' + err.message);
        }
    }

    async function handleRemoveCaretakerAssignment(caretakerId, animalId) {
        try {
            await api.delete(`/animals/${animalId}/caretaker-assign/${caretakerId}`);
            fetchAnimalsWithAssignments();
        } catch (err) {
            console.error('Error removing caretaker:', err);
        }
    }

    async function handleAssignEmployeeToEvent(eventId, empIdToAssign) {
        try {
            await api.post(`/events/${eventId}/assign-employee`, { employee_id: empIdToAssign });
            const event = events.find(e => e.event_id === eventId);
            const emp   = staff.find(s => s.employee_id === empIdToAssign);
            const eventLabel = event ? event.title : `event #${eventId}`;
            const empLabel   = emp ? `${emp.first_name} ${emp.last_name}` : `employee #${empIdToAssign}`;
            await logActivity({
                action_type: 'event_employee_assigned',
                description: `Assigned ${empLabel} to ${eventLabel}`,
                performed_by: resolvedEmpId || employeeId,
                target_type: 'event',
                target_id: eventId
            });
            fetchEvents();
        } catch (err) {
            console.error('Error assigning employee to event:', err);
            toast.error('Failed to assign: ' + err.message);
        }
    }

    async function handleRemoveEventAssignment(assignmentId) {
        try {
            await api.delete(`/events/assignments/${assignmentId}`);
            fetchEvents();
        } catch (err) {
            console.error('Error removing assignment:', err);
        }
    }

    const statusColor = (status) => {
        switch (status) {
            case 'approved': return '#10b981';
            case 'denied': return '#ef4444';
            default: return '#f59e0b';
        }
    };

    // Small helper — ts falls inside [from, to] when both set; each side
    // is optional. Used by every Manager Panel time-based view.
    function inRange(ts, from, to) {
        if (!ts) return false;
        const t = new Date(ts).getTime();
        if (from && t < new Date(from + 'T00:00:00').getTime()) return false;
        if (to   && t > new Date(to   + 'T23:59:59').getTime()) return false;
        return true;
    }
    const anyRange = (from, to) => from || to;

    const baseRequests = requestFilter === 'pending'
        ? pendingRequests
        : requestFilter === 'all'
            ? allRequests
            : allRequests.filter(r => r.status === requestFilter);
    const filteredRequests = anyRange(reqFrom, reqTo)
        ? baseRequests.filter(r => inRange(r.created_at, reqFrom, reqTo))
        : baseRequests;

    // Server already applied date/search filtering — just alias for the JSX below.
    const filteredActivity = activityLog;
    const activityHasRange = !!(logFrom || logTo);
    const activityMaxPage = Math.max(0, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE) - 1);

    // Events filter: when (all/upcoming/past) + optional event_date range.
    // Upcoming reads best chronologically (soonest first); past/all stay
    // newest-first since they're retrospective.
    const todayStr = new Date().toISOString().slice(0, 10);
    const filteredEvents = (events || []).filter(ev => {
        if (eventWhen === 'upcoming' && !(ev.event_date >= todayStr)) return false;
        if (eventWhen === 'past'     && !(ev.event_date <  todayStr)) return false;
        if (eventFrom && ev.event_date <  eventFrom) return false;
        if (eventTo   && ev.event_date >  eventTo)   return false;
        // Search matches title OR any assigned staff/animal name so the
        // manager can ask "which events is Sarah on?" or "where's Leo?"
        if (eventSearch.trim()) {
            const q = eventSearch.toLowerCase();
            const inTitle   = (ev.title || '').toLowerCase().includes(q);
            const inDesc    = (ev.description || '').toLowerCase().includes(q);
            const inVenue   = (ev.venue_name || '').toLowerCase().includes(q);
            const assigned  = ev.assignments || [];
            const inPerson  = assigned.some(a =>
                (`${a.first_name || ''} ${a.last_name || ''}`).toLowerCase().includes(q));
            const inAnimal  = assigned.some(a =>
                (a.animal_name || '').toLowerCase().includes(q));
            if (!(inTitle || inDesc || inVenue || inPerson || inAnimal)) return false;
        }
        return true;
    }).sort((a, b) => {
        if (eventWhen === 'upcoming') return a.event_date.localeCompare(b.event_date);
        return b.event_date.localeCompare(a.event_date);
    });

    // My Staff — case-insensitive match on name, role, dept, and
    // vet specialty / caretaker species. Self (is_self=1) always floats
    // to the top with a "(Me)" badge; everyone else sorts alphabetically
    // by last name so the list is stable and scannable.
    const filteredStaff = staff
        .filter(p => {
            if (!staffSearch.trim()) return true;
            const q = staffSearch.toLowerCase();
            return [
                p.first_name, p.last_name, p.dept_name, p.role,
                p.shift_timeframe, p.contact_info,
                p.specialty, p.specialization_species,
            ].some(v => (v || '').toString().toLowerCase().includes(q));
        })
        .sort((a, b) => {
            // Self always floats to the very top with the "(Me)" badge.
            if ((b.is_self || 0) - (a.is_self || 0) !== 0) {
                return (b.is_self || 0) - (a.is_self || 0);
            }
            // Then managers (admins are never returned here), then everyone
            // else — so team hierarchy is obvious at a glance.
            const priority = (p) =>
                p.role === 'admin'   ? 0
              : p.role === 'manager' ? 1
              :                        2;
            const pa = priority(a), pb = priority(b);
            if (pa !== pb) return pa - pb;
            const lastCmp = (a.last_name || '').localeCompare(b.last_name || '');
            return lastCmp !== 0 ? lastCmp : (a.first_name || '').localeCompare(b.first_name || '');
        });

    // Animal Assignments — alphabetical by name by default, with optional
    // zone filter and a search that matches animal name/species, zone, or
    // any currently-assigned vet/caretaker name.
    const zoneOptions = Array.from(new Set(
        (allAnimals || [])
            .map(a => a.zone_name)
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    const filteredAnimals = (allAnimals || [])
        .filter(a => zoneFilter === 'all' || a.zone_name === zoneFilter)
        .filter(a => {
            if (!animalSearch.trim()) return true;
            const q = animalSearch.toLowerCase();
            const hit = (v) => (v || '').toString().toLowerCase().includes(q);
            const vetHit = (a.vet_assignments || []).some(v => hit(`${v.first_name} ${v.last_name}`));
            const ctHit  = (a.caretaker_assignments || []).some(c => hit(`${c.first_name} ${c.last_name}`));
            return hit(a.name) || hit(a.species_common_name) || hit(a.species_binomial) || hit(a.zone_name) || vetHit || ctHit;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Manager Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Department Oversight & Supply Approvals</p>
                </div>
                {overviewStats.pendingRequests > 0 && (
                    <div className="glass-panel" style={{
                        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
                        border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)'
                    }}>
                        <AlertTriangle color="#f59e0b" size={20} />
                        <span style={{ fontWeight: 600 }}>{overviewStats.pendingRequests} Pending Request{overviewStats.pendingRequests !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* Tab Navigation — uses glass-button so we pick up the themed
                hover translateY + box-shadow (matches the Admin panel tabs). */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {TABS.map(tab => {
                    const active = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            className="glass-button"
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: active ? 'var(--color-primary)' : 'rgba(255, 245, 231, 0.65)',
                                color:      active ? 'white' : MGR_GREEN_DARK,
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: active ? 700 : 500,
                                position: 'relative',
                            }}
                        >
                            {tab}
                            {tab === 'Supply Requests' && overviewStats.pendingRequests > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    background: '#ef4444', color: 'white',
                                    borderRadius: '50%', width: '20px', height: '20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '11px', fontWeight: 'bold'
                                }}>
                                    {overviewStats.pendingRequests}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ═══════════ OVERVIEW TAB ═══════════ */}
            {activeTab === 'Overview' && (
                <div>
                    <div className="grid-cards" style={{ marginBottom: '30px' }}>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Department Staff</h3>
                                <Users size={20} color="var(--color-primary)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
                                {overviewLoading ? '...' : overviewStats.staffCount}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Pending Requests</h3>
                                <ClipboardList size={20} color="#f59e0b" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: overviewStats.pendingRequests > 0 ? '#f59e0b' : 'inherit' }}>
                                {overviewLoading ? '...' : overviewStats.pendingRequests}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Low Stock Items</h3>
                                <AlertTriangle size={20} color="var(--color-accent)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: overviewStats.lowStockCount > 0 ? 'var(--color-accent)' : 'inherit' }}>
                                {overviewLoading ? '...' : overviewStats.lowStockCount}
                            </p>
                        </div>
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Upcoming Events</h3>
                                <Calendar size={20} color="var(--color-secondary)" />
                            </div>
                            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
                                {overviewLoading ? '...' : overviewStats.upcomingEvents}
                            </p>
                        </div>
                    </div>

                    {/* Low Stock Supplies */}
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Package size={20} /> Low Stock Operational Supplies
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {allSupplies.filter(s => s.is_low_stock).length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)' }}>All supplies are well-stocked.</p>
                        ) : allSupplies.filter(s => s.is_low_stock).map(item => (
                            <div key={item.supply_id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'rgba(255, 245, 231, 0.78)', padding: '12px 15px', borderRadius: '10px',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                            }}>
                                <div>
                                    <span style={{ fontWeight: 700, color: 'var(--color-text-dark)' }}>{item.item_name}</span>
                                    <span style={{ fontSize: '12px', color: MGR_GREEN_DARK, marginLeft: '10px', fontWeight: 600 }}>
                                        {item.dept_name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 700, color: '#b91c1c' }}>{item.stock_count}</span>
                                    <span style={{ fontSize: '12px', color: MGR_GREEN_DARK }}>/ {item.restock_threshold} threshold</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════ SUPPLY REQUESTS TAB ═══════════ */}
            {activeTab === 'Supply Requests' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '14px' }}>
                        <h2 style={{ margin: 0 }}>Supply Requests</h2>
                        <StatusFilter
                            label="Status"
                            tabs={[
                                { key: 'pending',  label: 'Pending'  },
                                { key: 'approved', label: 'Approved' },
                                { key: 'denied',   label: 'Denied'   },
                                { key: 'all',      label: 'All'      },
                            ]}
                            value={requestFilter}
                            onChange={setRequestFilter}
                        />
                    </div>
                    <DateRangeFilter
                        label="Submitted between"
                        from={reqFrom} to={reqTo}
                        onFrom={setReqFrom} onTo={setReqTo}
                    />

                    {requestsLoading ? <p>Loading requests...</p> : filteredRequests.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <ClipboardList size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No {requestFilter !== 'all' ? requestFilter : ''} requests found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredRequests.map(req => (
                                <div key={req.request_id} className="glass-panel" style={{
                                    padding: '20px',
                                    background: 'rgba(255, 245, 231, 0.72)',
                                    border: req.status === 'pending' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(121,162,128,0.25)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 5px' }}>{req.item_name}</h3>
                                            <span style={{ fontSize: '13px', color: MGR_GREEN_DARK }}>
                                                Requested by: <strong>{req.requester?.first_name} {req.requester?.last_name}</strong>
                                                {req.requester?.departments?.dept_name && (
                                                    <span style={{
                                                        marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                                                        background: 'rgba(121,162,128,0.18)', color: MGR_GREEN_DARK, fontWeight: 600,
                                                    }}>
                                                        {req.requester.departments.dept_name}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {req.status === 'pending' ? <Clock size={16} color="#f59e0b" /> :
                                                req.status === 'approved' ? <CheckCircle size={16} color="#10b981" /> :
                                                    <XCircle size={16} color="#ef4444" />}
                                            <span style={{ color: statusColor(req.status), fontWeight: 700, textTransform: 'capitalize' }}>
                                                {req.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: MGR_GREEN_DARK, marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <span>Quantity: <strong style={{ color: 'var(--color-text-dark)' }}>{req.requested_quantity}</strong></span>
                                        <span>Type: <strong style={{ color: 'var(--color-text-dark)', textTransform: 'capitalize' }}>{req.supply_type}</strong></span>
                                        <span>Date: <strong style={{ color: 'var(--color-text-dark)' }}>{new Date(req.created_at).toLocaleDateString()}</strong></span>
                                    </div>

                                    {req.reason && (
                                        <p style={{ fontSize: '14px', color: 'var(--color-text-dark)', margin: '0 0 15px', fontWeight: 500 }}>
                                            <strong style={{ color: MGR_GREEN_DARK }}>Reason:</strong> {req.reason}
                                        </p>
                                    )}

                                    {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => handleReview(req.request_id, 'approved')}
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.18)', color: '#047857',
                                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                                    borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                                                    fontWeight: 700, fontSize: '13px',
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                }}
                                            >
                                                <CheckCircle size={16} /> Approve & Restock
                                            </button>
                                            <button
                                                onClick={() => handleReview(req.request_id, 'denied')}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)', color: '#b91c1c',
                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                    borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                                                    fontWeight: 700, fontSize: '13px',
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                }}
                                            >
                                                <XCircle size={16} /> Deny
                                            </button>
                                        </div>
                                    )}

                                    {req.reviewer && (
                                        <p style={{ fontSize: '12px', color: MGR_GREEN_DARK, margin: '10px 0 0', opacity: 0.85 }}>
                                            Reviewed by <strong>{req.reviewer.first_name} {req.reviewer.last_name}</strong>
                                            {req.reviewed_at && ` on ${new Date(req.reviewed_at).toLocaleDateString()}`}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MY STAFF TAB ═══════════ */}
            {activeTab === 'My Staff' && (
                <div>
                    <h2>Department Staff</h2>
                    <input
                        type="text"
                        placeholder="Search staff by name, role, specialty..."
                        className="glass-input"
                        value={staffSearch}
                        onChange={e => setStaffSearch(e.target.value)}
                        style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
                    />
                    {staffLoading ? <p>Loading staff...</p> : staff.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Users size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No staff in your department.</p>
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Users size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No staff match "{staffSearch}".</p>
                        </div>
                    ) : (
                        <div className="grid-cards">
                            {filteredStaff.map(person => {
                                const roleColor = person.role === 'vet' ? { bg: 'rgba(16,185,129,0.18)', fg: '#047857' }
                                    : person.role === 'caretaker' ? { bg: 'rgba(59,130,246,0.18)', fg: '#1d4ed8' }
                                    : person.role === 'security'  ? { bg: 'rgba(168,85,247,0.18)', fg: '#7e22ce' }
                                    : { bg: 'rgba(121,162,128,0.18)', fg: MGR_GREEN_DARK };
                                const isMe = !!person.is_self;
                                return (
                                    <div key={person.employee_id} className="glass-panel" style={{
                                        padding: '20px',
                                        background: isMe ? 'rgba(121,162,128,0.18)' : 'rgba(255, 245, 231, 0.78)',
                                        border: isMe ? '2px solid rgba(121,162,128,0.55)' : '1px solid rgba(121,162,128,0.25)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                            <div>
                                                <h3 style={{ margin: '0 0 5px', color: 'var(--color-text-dark)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                    {person.first_name} {person.last_name}
                                                    {isMe && (
                                                        <span style={{
                                                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                                                            background: MGR_GREEN, color: 'white',
                                                            fontWeight: 700, letterSpacing: '0.06em',
                                                        }}>(Me)</span>
                                                    )}
                                                </h3>
                                                <span style={{
                                                    fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
                                                    background: 'rgba(121,162,128,0.18)', color: MGR_GREEN_DARK, fontWeight: 600,
                                                }}>
                                                    {person.dept_name || 'Unassigned'}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
                                                background: roleColor.bg, color: roleColor.fg, fontWeight: 700,
                                                textTransform: 'capitalize'
                                            }}>
                                                {person.role}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '14px', color: MGR_GREEN_DARK, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <p style={{ margin: 0 }}>Shift: <strong style={{ color: 'var(--color-text-dark)' }}>{formatShiftTimeframe(person.shift_timeframe) || 'N/A'}</strong></p>
                                            <p style={{ margin: 0 }}>Contact: <strong style={{ color: 'var(--color-text-dark)' }}>{person.contact_info || 'N/A'}</strong></p>
                                            {person.license_no             && <p style={{ margin: 0 }}>Vet License: <strong style={{ color: 'var(--color-text-dark)' }}>{person.license_no}</strong></p>}
                                            {person.specialty              && <p style={{ margin: 0 }}>Specialty: <strong style={{ color: 'var(--color-text-dark)' }}>{person.specialty}</strong></p>}
                                            {person.specialization_species && <p style={{ margin: 0 }}>Species: <strong style={{ color: 'var(--color-text-dark)' }}>{person.specialization_species}</strong></p>}
                                            {person.office_location        && <p style={{ margin: 0 }}>Office: <strong style={{ color: 'var(--color-text-dark)' }}>{person.office_location}</strong></p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ ACTIVITY LOG TAB ═══════════ */}
            {activeTab === 'Activity Log' && (
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={24} /> Recent Activity
                    </h2>
                    <input
                        type="text"
                        placeholder="Search by description, action, or person..."
                        className="glass-input"
                        value={activitySearch}
                        onChange={e => setActivitySearch(e.target.value)}
                        style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
                    />
                    <DateRangeFilter
                        label="Happened between"
                        from={logFrom} to={logTo}
                        onFrom={setLogFrom} onTo={setLogTo}
                    />
                    {activityLoading ? <p>Loading activity...</p> : filteredActivity.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Activity size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>{activityTotal === 0 ? 'No activity recorded yet.' : 'No activity matches this search or date range.'}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredActivity.map(log => (
                                <div key={log.log_id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255, 245, 231, 0.78)',
                                    border: '1px solid rgba(121,162,128,0.25)',
                                    padding: '14px 18px', borderRadius: '10px',
                                    borderLeft: `3px solid ${
                                        log.action_type.includes('approved') ? '#10b981' :
                                        log.action_type.includes('denied') ? '#ef4444' :
                                        log.action_type.includes('created') ? '#3b82f6' :
                                        '#f59e0b'
                                    }`
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 700, color: 'var(--color-text-dark)' }}>{log.description}</span>
                                        <div style={{ fontSize: '12px', color: MGR_GREEN_DARK, marginTop: '4px' }}>
                                            {log.performer
                                                ? <>
                                                    <strong>{log.performer.first_name} {log.performer.last_name}</strong>
                                                    <span style={{ opacity: 0.75 }}> ({log.performer.role})</span>
                                                  </>
                                                : 'System'}
                                            <span style={{
                                                marginLeft: '10px', padding: '2px 8px', borderRadius: '6px',
                                                background: 'rgba(121,162,128,0.18)', color: MGR_GREEN_DARK,
                                                fontSize: '11px', fontWeight: 600,
                                            }}>
                                                {log.action_type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '12px', color: MGR_GREEN_DARK, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                                        <div style={{ opacity: 0.8 }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pager is always shown when there's more than one page,
                        regardless of whether a date range is active. Capped
                        at 25/page so the list never dumps everything at once. */}
                    {!activityLoading && (
                        <ZooPaginator
                            page={activityPage}
                            totalPages={activityMaxPage + 1}
                            onChange={(p) => setActivityPage(p)}
                        />
                    )}
                </div>
            )}

            {/* ═══════════ ANIMAL ASSIGNMENTS TAB ═══════════ */}
            {activeTab === 'Animal Assignments' && (
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Cat size={24} /> Animal Assignments
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                        Assign vets and caretakers to animals.
                    </p>

                    {/* Search + zone filter. Search matches animal, species, and
                        any currently-assigned vet/caretaker name so the manager
                        can quickly find every animal someone is caring for. */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
                        <input
                            type="text"
                            placeholder="Search by animal, species, or assigned vet/caretaker..."
                            className="glass-input"
                            value={animalSearch}
                            onChange={e => setAnimalSearch(e.target.value)}
                            style={{ maxWidth: '380px', flex: 1, minWidth: '240px' }}
                        />
                        <StatusFilter
                            label="Zone"
                            tabs={[
                                { key: 'all', label: 'All' },
                                ...zoneOptions.map(z => ({ key: z, label: z })),
                            ]}
                            value={zoneFilter}
                            onChange={setZoneFilter}
                        />
                    </div>

                    {animalsLoading ? <p>Loading animals...</p> : allAnimals.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Cat size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No animals found.</p>
                        </div>
                    ) : filteredAnimals.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Cat size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No animals match the current search/zone filter.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredAnimals.map(animal => {
                                const assignedVets = animal.vet_assignments || [];
                                const assignedVetIds = assignedVets.map(a => a.vet_id);
                                const assignedCts = animal.caretaker_assignments || [];
                                const assignedCtIds = assignedCts.map(a => a.caretaker_id);

                                return (
                                    <div key={animal.animal_id} className="glass-panel" style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '15px' }}>
                                            <div style={{ minWidth: '220px' }}>
                                                <h3 style={{ margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    {animal.name}
                                                    <HealthBadge status={animal.health_status} />
                                                </h3>
                                                <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: '0 0 3px' }}>
                                                    {animal.species_common_name}
                                                </p>
                                                {animal.species_binomial && (
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                                                        {animal.species_binomial}
                                                    </p>
                                                )}
                                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '5px 0 4px' }}>
                                                    Zone: {animal.zone_name || 'Unassigned'} | Age: {animal.age}
                                                </p>
                                                <select
                                                    className="glass-input"
                                                    value={animal.health_status || 'healthy'}
                                                    onChange={async (e) => {
                                                        try {
                                                            await setHealthStatus(animal.animal_id, e.target.value);
                                                            fetchAnimalsWithAssignments();
                                                        } catch (err) {
                                                            toast.error('Failed to update: ' + err.message);
                                                        }
                                                    }}
                                                    style={{ fontSize: '12px', padding: '6px 8px' }}
                                                >
                                                    <option value="healthy">Healthy</option>
                                                    <option value="under_observation">Under observation</option>
                                                    <option value="recovering">Recovering</option>
                                                    <option value="sick">Sick</option>
                                                    <option value="critical">Critical</option>
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                                {/* Vet Assignments (multiple) */}
                                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', minWidth: '220px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Assigned Vets</p>
                                                    {assignedVets.length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                                            {assignedVets.map(a => (
                                                                <div key={a.vet_id} style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '13px'
                                                                }}>
                                                                    <span>{a.first_name} {a.last_name}</span>
                                                                    <button
                                                                        onClick={() => handleRemoveVetAssignment(a.vet_id, animal.animal_id)}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                                        title="Remove"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <select
                                                        className="glass-input"
                                                        style={{ width: '100%', fontSize: '13px' }}
                                                        value=""
                                                        onChange={e => {
                                                            const vetId = parseInt(e.target.value);
                                                            if (vetId) handleAssignVet(animal.animal_id, vetId);
                                                        }}
                                                    >
                                                        <option value="">+ Add vet...</option>
                                                        {vets
                                                            .filter(v => !assignedVetIds.includes(v.employee_id))
                                                            .map(v => (
                                                                <option key={v.employee_id} value={v.employee_id}>
                                                                    {v.first_name} {v.last_name} — {v.specialty}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>

                                                {/* Caretaker Assignments (multiple) */}
                                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', minWidth: '220px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Assigned Caretakers</p>
                                                    {assignedCts.length > 0 && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                                            {assignedCts.map(a => (
                                                                <div key={a.caretaker_id} style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '13px'
                                                                }}>
                                                                    <span>{a.first_name} {a.last_name}</span>
                                                                    <button
                                                                        onClick={() => handleRemoveCaretakerAssignment(a.caretaker_id, animal.animal_id)}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                                        title="Remove"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <select
                                                        className="glass-input"
                                                        style={{ width: '100%', fontSize: '13px' }}
                                                        value=""
                                                        onChange={e => {
                                                            const ctId = parseInt(e.target.value);
                                                            if (ctId) handleAssignCaretaker(animal.animal_id, ctId);
                                                        }}
                                                    >
                                                        <option value="">+ Add caretaker...</option>
                                                        {caretakers
                                                            .filter(c => !assignedCtIds.includes(c.employee_id))
                                                            .map(c => (
                                                                <option key={c.employee_id} value={c.employee_id}>
                                                                    {c.first_name} {c.last_name} — {c.specialization_species}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Medical & Care expand */}
                                        <div style={{ marginTop: '12px', borderTop: '1px dashed rgba(121,162,128,0.3)', paddingTop: '10px' }}>
                                            <button
                                                onClick={() => setExpandedAnimalId(
                                                    expandedAnimalId === animal.animal_id ? null : animal.animal_id
                                                )}
                                                className="glass-button"
                                                style={{
                                                    fontSize: '12px', padding: '6px 12px',
                                                    background: 'rgba(123,144,79,0.15)', color: 'rgb(102,122,66)',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                }}
                                            >
                                                <Stethoscope size={14} />
                                                {expandedAnimalId === animal.animal_id
                                                    ? <>Hide medical &amp; care <ChevronUp size={12} /></>
                                                    : <>View medical &amp; care <ChevronDown size={12} /></>}
                                            </button>
                                            {expandedAnimalId === animal.animal_id && (
                                                <AnimalMedicalPanel
                                                    animalId={animal.animal_id}
                                                    canFileMedical={isAdmin || role === 'manager' || role === 'vet'}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ EVENTS TAB ═══════════ */}
            {activeTab === 'Events' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '14px' }}>
                        <h2 style={{ margin: 0 }}>Events</h2>
                        <StatusFilter
                            label="When"
                            tabs={[
                                { key: 'all',      label: 'All'      },
                                { key: 'upcoming', label: 'Upcoming' },
                                { key: 'past',     label: 'Past'     },
                            ]}
                            value={eventWhen}
                            onChange={setEventWhen}
                        />
                    </div>
                    {/* Search also matches the names of assigned staff and
                        animals, so the manager can track "which events is
                        Sarah on?" or "where's Leo this week?" */}
                    <input
                        type="text"
                        placeholder="Search by title, venue, animal, or assigned vet/caretaker..."
                        className="glass-input"
                        value={eventSearch}
                        onChange={e => setEventSearch(e.target.value)}
                        style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
                    />
                    <DateRangeFilter
                        label="Event date between"
                        from={eventFrom} to={eventTo}
                        onFrom={setEventFrom} onTo={setEventTo}
                    />
                    {eventsLoading ? <p>Loading events...</p> : filteredEvents.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Calendar size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>{events.length === 0 ? 'No events found.' : 'No events match this filter.'}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {filteredEvents.map(event => {
                                const assigned = event.assignments || [];
                                return (
                                    <div key={event.event_id} className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 245, 231, 0.78)', border: '1px solid rgba(121,162,128,0.25)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                    <Calendar color={MGR_GREEN} size={20} />
                                                    <h3 style={{ margin: 0, color: 'var(--color-text-dark)' }}>{event.title}</h3>
                                                </div>
                                                {event.description && (
                                                    <p style={{ fontSize: '14px', color: 'var(--color-text-dark)', margin: '5px 0', opacity: 0.85 }}>{event.description}</p>
                                                )}
                                                <p style={{ color: MGR_GREEN_DARK, fontWeight: 700, fontSize: '14px', margin: '5px 0' }}>
                                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                {event.start_time && event.end_time && (
                                                    <p style={{ fontSize: '13px', color: MGR_GREEN_DARK, margin: '4px 0', fontWeight: 500 }}>
                                                        <Clock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                        {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                                                    </p>
                                                )}
                                                {event.venue_id && (
                                                    <p style={{ fontSize: '13px', color: MGR_GREEN_DARK, margin: '4px 0', fontWeight: 500 }}>
                                                        📍 {event.venue_name || 'Unknown venue'}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '13px', color: MGR_GREEN_DARK, fontWeight: 600 }}>
                                                <strong style={{ color: 'var(--color-text-dark)' }}>{event.actual_attendance || 0}</strong> / {event.max_capacity}
                                                <div style={{ fontSize: '11px', opacity: 0.75, fontWeight: 500 }}>capacity</div>
                                            </div>
                                        </div>

                                        {/* Personnel & Animals */}
                                        <div style={{ borderTop: '1px solid rgba(121,162,128,0.25)', paddingTop: '12px', marginTop: '10px' }}>
                                            <p style={{ fontSize: '11px', color: MGR_GREEN_DARK, margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personnel</p>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                {assigned.filter(a => a.employee_id).length === 0 ? (
                                                    <span style={{ fontSize: '13px', color: MGR_GREEN_DARK, fontStyle: 'italic', opacity: 0.75 }}>No staff assigned</span>
                                                ) : assigned.filter(a => a.employee_id).map(a => (
                                                    <div key={a.assignment_id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'rgba(121,162,128,0.18)', color: MGR_GREEN_DARK, fontWeight: 600,
                                                        padding: '5px 10px', borderRadius: '8px', fontSize: '13px'
                                                    }}>
                                                        <Users size={14} />
                                                        <span>{a.first_name} {a.last_name}</span>
                                                        <button
                                                            onClick={() => handleRemoveEventAssignment(a.assignment_id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1 }}
                                                            title="Remove"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Animals:</p>
                                            <p style={{ fontSize: '11px', color: MGR_GREEN_DARK, margin: '10px 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Animals</p>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                {assigned.filter(a => a.animal_id).length === 0 ? (
                                                    <span style={{ fontSize: '13px', color: MGR_GREEN_DARK, fontStyle: 'italic', opacity: 0.75 }}>No animals assigned</span>
                                                ) : assigned.filter(a => a.animal_id).map(a => (
                                                    <div key={a.assignment_id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'rgba(121,162,128,0.18)', color: MGR_GREEN_DARK, fontWeight: 600,
                                                        padding: '5px 10px', borderRadius: '8px', fontSize: '13px'
                                                    }}>
                                                        <Cat size={14} />
                                                        <span>{a.animal_name}</span>
                                                        <button
                                                            onClick={() => handleRemoveEventAssignment(a.assignment_id)}
                                                            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: '0 2px', fontSize: '16px', lineHeight: 1, fontWeight: 700 }}
                                                            title="Remove"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Assign new employee */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <select
                                                    className="glass-input"
                                                    style={{ flex: 1, fontSize: '13px' }}
                                                    id={`event-assign-${event.event_id}`}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select employee to assign...</option>
                                                    {staff
                                                        .filter(s => !assigned.some(a => a.employee_id === s.employee_id))
                                                        .map(s => (
                                                            <option key={s.employee_id} value={s.employee_id}>
                                                                {s.first_name} {s.last_name} ({s.role})
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                                <button
                                                    className="glass-button"
                                                    style={{ background: 'var(--color-secondary)', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    onClick={() => {
                                                        const sel = document.getElementById(`event-assign-${event.event_id}`);
                                                        if (sel.value) {
                                                            handleAssignEmployeeToEvent(event.event_id, parseInt(sel.value));
                                                            sel.value = '';
                                                        }
                                                    }}
                                                >
                                                    <UserPlus size={14} /> Assign
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ActivityPager removed — replaced by ZooPaginator
// (src/components/ZooPaginator.jsx). The new paginator is Google-style
// with numbered pages + ellipsis, shared across every list view.

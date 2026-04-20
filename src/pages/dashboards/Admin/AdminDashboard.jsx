import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Ticket, ShoppingBag, DollarSign, Database, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../lib/api';
import LifecycleLogModal, { LifecycleLogButton } from '../../../components/LifecycleLogModal';
import { useToast, useConfirm } from '../../../components/Feedback';
import { defaultOfficeFor } from '../../../utils/staff';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
    getAdminDashboardStats,
    getEmployeesWithDepartments,
    getDepartments,
    createZooUser,
    getAnimalsWithZones,
    getFinancialRevenueBreakdown,
    getRecentTransactions,
    ROLE_DEPT_MAP,
} from '../../../api/dashboard';

export default function AdminDashboard() {
    const toast   = useToast();
    const [stats, setStats] = useState({
        totalRevenueCents: 0,
        ticketRevenueCents: 0,
        retailRevenueCents: 0,
        totalEmployees: 0,
        totalAnimals: 0,
        totalCustomers: 0,
    });
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [animals, setAnimals] = useState([]);
    const [revenueBreakdown, setRevenueBreakdown] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    
    // UI State
    const [activeTab, setActiveTab] = useState('Overview');
    const [showStaffData, setShowStaffData] = useState(false);
    const [showStaffRaw, setShowStaffRaw] = useState(false);
    const [showAnimalData, setShowAnimalData] = useState(false);
    const [showAnimalRaw, setShowAnimalRaw] = useState(false);
    const [showFinancialData, setShowFinancialData] = useState(false);
    const [showFinancialRaw, setShowFinancialRaw] = useState(false);

    // Create User State
    const [showCreateUser, setShowCreateUser] = useState(false);
    // Role defaults to '' so the dropdown shows the "Select Role..." placeholder
    // instead of silently pre-selecting Security. The form is fully reset any
    // time the modal closes via closeCreateUser() so reopening starts clean.
    //
    // Shift lives as two time strings (start / end); on submit we compose
    // them into "HH:MM-HH:MM" to match what the rest of the app reads.
    const emptyNewUser = {
        email: '', password: '', first_name: '', last_name: '',
        dept_id: '', role: '',
        shift_start: '09:00', shift_end: '17:00',
        pay_rate: '',          // dollars — converted to cents at submit
        contact_info: '',
        date_of_birth: '',
        // Role-specific:
        license_no: '', specialty: '',
        specialization_species: '',
        office_location: '',
        // Supervisor (required for non-admin / non-manager):
        manager_id: '',
    };
    const [newUser, setNewUser] = useState(emptyNewUser);
    // Confirm-password is local-only — never sent to the server.
    const [confirmPassword, setConfirmPassword] = useState('');
    const [departments, setDepartments] = useState([]);
    // Managers in the selected department — populates the supervisor picker.
    const [deptManagers, setDeptManagers] = useState([]);

    const closeCreateUser = () => {
        setShowCreateUser(false);
        setNewUser(emptyNewUser);
        setConfirmPassword('');
        setDeptManagers([]);
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    useEffect(() => {
        if (showCreateUser) {
            getDepartments().then(setDepartments).catch(console.error);
        }
    }, [showCreateUser]);

    // Reload the manager list whenever the target dept changes. Only fires
    // for roles that actually need a supervisor (admins/managers don't).
    useEffect(() => {
        if (!showCreateUser) return;
        if (!newUser.dept_id || newUser.role === 'admin' || newUser.role === 'manager') {
            setDeptManagers([]);
            return;
        }
        api.get(`/employees/managers?dept_id=${newUser.dept_id}`)
            .then(setDeptManagers)
            .catch(err => {
                console.error('Error loading managers:', err);
                setDeptManagers([]);
            });
    }, [showCreateUser, newUser.dept_id, newUser.role]);

    async function fetchAdminData() {
        try {
            const [dashStats, allEmployees, allAnimals, revBreakdown, transactions] = await Promise.all([
                getAdminDashboardStats(),
                getEmployeesWithDepartments(),
                getAnimalsWithZones(),
                getFinancialRevenueBreakdown(),
                getRecentTransactions(),
            ]);
            setStats(dashStats);
            setEmployees(allEmployees);
            setAnimals(allAnimals);
            setRevenueBreakdown(revBreakdown);
            setRecentTransactions(transactions);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    }

    // When role changes, auto-set department (except manager who picks their own)
    // and prefill the office based on the role/dept pair so admins don't have
    // to type canonical strings like "Veterinary Clinic, Head Office".
    const handleRoleChange = (role) => {
        const deptName = ROLE_DEPT_MAP[role];
        const matchedDept = departments.find(d => d.dept_name === deptName);
        const nextDeptName = matchedDept ? matchedDept.dept_name : '';
        setNewUser({
            ...newUser,
            role,
            dept_id: matchedDept ? String(matchedDept.dept_id) : '',
            office_location: defaultOfficeFor(role, nextDeptName),
            // Wipe role-specific fields so stale values don't leak between roles.
            license_no: '',
            specialty: '',
            specialization_species: '',
            manager_id: '',
        });
    };

    // Dept can be changed by hand for the `manager` role. When it changes,
    // recompute the office + clear the supervisor so the picker reloads.
    const handleDeptChange = (deptId) => {
        const deptName = (departments.find(d => String(d.dept_id) === String(deptId)) || {}).dept_name || '';
        setNewUser({
            ...newUser,
            dept_id: deptId,
            office_location: defaultOfficeFor(newUser.role, deptName),
            manager_id: '',
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (newUser.password !== confirmPassword) {
            toast.warn('Passwords do not match. Please re-enter.');
            return;
        }
        if (newUser.shift_start && newUser.shift_end
            && newUser.shift_start >= newUser.shift_end) {
            toast.warn('Shift end time must be after the start time.');
            return;
        }
        // Non-admin, non-manager needs a supervisor. The server will also
        // reject this, but catching here surfaces a friendly message.
        if (newUser.role !== 'admin' && newUser.role !== 'manager' && !newUser.manager_id) {
            toast.warn('Please pick a supervising manager for this employee.');
            return;
        }
        try {
            const payload = {
                email:        newUser.email,
                password:     newUser.password,
                first_name:   newUser.first_name,
                last_name:    newUser.last_name,
                dept_id:      newUser.dept_id,
                role:         newUser.role,
                contact_info: newUser.contact_info || newUser.email,
                date_of_birth: newUser.date_of_birth || null,
                shift_timeframe: newUser.shift_start && newUser.shift_end
                    ? `${newUser.shift_start}-${newUser.shift_end}`
                    : null,
                pay_rate_cents: newUser.pay_rate
                    ? Math.round(parseFloat(newUser.pay_rate) * 100)
                    : 2000,
                manager_id: (newUser.role === 'admin' || newUser.role === 'manager')
                    ? null
                    : parseInt(newUser.manager_id),
                // Role-specific — server only reads the one that matches.
                license_no:            newUser.license_no || null,
                specialty:             newUser.specialty || null,
                specialization_species: newUser.specialization_species || null,
                office_location:       newUser.office_location || null,
            };
            await createZooUser(payload);
            toast.success({ title: 'User created', message: `${newUser.first_name} ${newUser.last_name} can now sign in.` });
            closeCreateUser();
            fetchAdminData();
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error('Failed to create user: ' + error.message);
        }
    };

    const formatDollars = (cents) =>
        (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

    // Dept is auto-set for every role except manager and the empty placeholder.
    // When no role is picked yet the dept dropdown stays enabled so the
    // placeholder shows instead of a disabled blank.
    const isDeptAutoSet = newUser.role !== '' && newUser.role !== 'manager';

    // Aggregate data for charts
    const departmentCounts = employees.reduce((acc, emp) => {
        const deptName = emp.dept_name || 'Unassigned';
        if (!acc[deptName]) acc[deptName] = 0;
        acc[deptName]++;
        return acc;
    }, {});

    const staffChartData = Object.keys(departmentCounts).map(dept => ({
        name: dept,
        Employees: departmentCounts[dept]
    }));

    const zoneCounts = animals.reduce((acc, animal) => {
        const zoneName = animal.zone_name || 'Unassigned';
        if (!acc[zoneName]) acc[zoneName] = 0;
        acc[zoneName]++;
        return acc;
    }, {});

    const animalChartData = Object.keys(zoneCounts).map(zone => ({
        name: zone,
        Animals: zoneCounts[zone]
    }));

    const TABS = ['Overview', 'Staff Analytics', 'Animal Analytics', 'Financial Revenue', 'Reactivate'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Zoo Overview & Management</p>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button
                        className="glass-button"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                        onClick={() => setShowCreateUser(true)}
                    >
                        + Create User
                    </button>
                    <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DollarSign color="#6d8243" />
                        <div>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Revenue</span>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>${formatDollars(stats.totalRevenueCents)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateUser && (() => {
                const needsSupervisor = newUser.role && newUser.role !== 'admin' && newUser.role !== 'manager';
                const isVet        = newUser.role === 'vet';
                const isCaretaker  = newUser.role === 'caretaker';
                const isManager    = newUser.role === 'manager';
                // A manager whose department is Veterinary Services is still
                // a practising vet in-world, so they fill out the license
                // + specialty fields in addition to the office location.
                const selectedDeptName = (departments.find(d => String(d.dept_id) === String(newUser.dept_id)) || {}).dept_name || '';
                const isVetManager = isManager && /veterinary/i.test(selectedDeptName);
                const labelStyle = {
                    display: 'block', fontSize: '11px', color: 'rgb(102, 122, 66)',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    marginBottom: '4px',
                };
                return (
                <div
                    onClick={closeCreateUser}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
                    }}>
                    <div onClick={e => e.stopPropagation()} className="glass-panel" style={{ padding: '28px', width: '560px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
                            <h2 style={{ margin: 0, color: 'rgb(102, 122, 66)' }}>Create New User</h2>
                            <button onClick={closeCreateUser} style={{ background: 'none', border: 'none', color: 'rgb(102, 122, 66)', fontSize: '20px', cursor: 'pointer' }}>×</button>
                        </div>
                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>First Name</label>
                                <input required className="glass-input" value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Last Name</label>
                                <input required className="glass-input" value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Email</label>
                                <input required type="email" className="glass-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Password</label>
                                <input required type="password" className="glass-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Confirm Password</label>
                                <input required type="password" className="glass-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>

                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Role</label>
                                <select required className="glass-input" value={newUser.role} onChange={e => handleRoleChange(e.target.value)}>
                                    <option value="" disabled>Select Role...</option>
                                    <option value="security">Security</option>
                                    <option value="retail">Retail</option>
                                    <option value="caretaker">Caretaker</option>
                                    <option value="vet">Vet</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Department</label>
                                <select
                                    required
                                    className="glass-input"
                                    style={{ opacity: isDeptAutoSet ? 0.6 : 1 }}
                                    value={newUser.dept_id}
                                    onChange={e => handleDeptChange(e.target.value)}
                                    disabled={isDeptAutoSet}
                                >
                                    <option value="">Select Department...</option>
                                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                </select>
                            </div>

                            {/* Structured shift pickers — prevents garbage like "8-4pm". */}
                            <div>
                                <label style={labelStyle}>Shift Start</label>
                                <input required type="time" className="glass-input" value={newUser.shift_start}
                                    onChange={e => setNewUser({ ...newUser, shift_start: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Shift End</label>
                                <input required type="time" className="glass-input" value={newUser.shift_end}
                                    onChange={e => setNewUser({ ...newUser, shift_end: e.target.value })} />
                            </div>

                            <div>
                                <label style={labelStyle}>Hourly Rate ($)</label>
                                <input required type="number" step="0.01" min="0" className="glass-input"
                                    placeholder="20.00"
                                    value={newUser.pay_rate}
                                    onChange={e => setNewUser({ ...newUser, pay_rate: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Contact (phone / ext.)</label>
                                <input className="glass-input" placeholder="Defaults to email"
                                    value={newUser.contact_info}
                                    onChange={e => setNewUser({ ...newUser, contact_info: e.target.value })} />
                            </div>

                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Date of Birth</label>
                                <input required type="date" className="glass-input"
                                    max={new Date().toISOString().slice(0, 10)}
                                    value={newUser.date_of_birth}
                                    onChange={e => setNewUser({ ...newUser, date_of_birth: e.target.value })} />
                            </div>

                            {/* Supervisor — REQUIRED for every non-admin, non-manager role. */}
                            {needsSupervisor && (
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>Supervisor (manager in this dept)</label>
                                    <select required className="glass-input"
                                        value={newUser.manager_id}
                                        onChange={e => setNewUser({ ...newUser, manager_id: e.target.value })}>
                                        <option value="" disabled>
                                            {deptManagers.length === 0
                                                ? 'No managers in this department yet — create a manager first.'
                                                : 'Select supervisor...'}
                                        </option>
                                        {deptManagers.map(m => (
                                            <option key={m.employee_id} value={m.employee_id}>
                                                {m.first_name} {m.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Role-specific fields. */}
                            {(isVet || isVetManager) && (
                                <>
                                    <div>
                                        <label style={labelStyle}>Vet License #</label>
                                        <input required className="glass-input"
                                            value={newUser.license_no}
                                            onChange={e => setNewUser({ ...newUser, license_no: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Specialty</label>
                                        <input className="glass-input" placeholder="Large mammals, reptiles, …"
                                            value={newUser.specialty}
                                            onChange={e => setNewUser({ ...newUser, specialty: e.target.value })} />
                                    </div>
                                </>
                            )}
                            {isCaretaker && (
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>Specialization (species)</label>
                                    <input required className="glass-input" placeholder="Primates, penguins, …"
                                        value={newUser.specialization_species}
                                        onChange={e => setNewUser({ ...newUser, specialization_species: e.target.value })} />
                                </div>
                            )}

                            {/* Office location — auto-prefilled from role × dept.
                                Managers bookend their dept location with the
                                Head Office; everyone else gets the single
                                canonical spot. Kept editable so admins can
                                adjust for the odd one-off. */}
                            {newUser.role && (
                                <div style={{ gridColumn: '1/-1' }}>
                                    <label style={labelStyle}>
                                        Office Location {isManager ? '(dept + Head Office)' : ''}
                                    </label>
                                    <input required className="glass-input"
                                        value={newUser.office_location}
                                        onChange={e => setNewUser({ ...newUser, office_location: e.target.value })} />
                                </div>
                            )}

                            <button type="submit" className="glass-button" style={{ gridColumn: '1/-1', background: 'var(--color-secondary)', color: 'white', marginTop: '10px', fontWeight: 700 }}>Create Account</button>
                        </form>
                    </div>
                </div>
                );
            })()}

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

            {/* ═══════════ STAFF ANALYTICS TAB ═══════════ */}
            {activeTab === 'Staff Analytics' && (
                <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)',padding: '20px', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Users size={20} color="var(--color-primary)" />
                            Employees per Department
                        </h3>
                        <button 
                            className="glass-button" 
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 10px' }}
                            onClick={() => setShowStaffData(!showStaffData)}
                        >
                            <Database size={14} />
                            {showStaffData ? 'Hide Summary' : 'Show Summary'}
                            {showStaffData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {showStaffData && (
                        <div style={{ 
                            background: 'rgba(0,0,0,0.3)', 
                            padding: '15px', 
                            borderRadius: '8px', 
                            marginBottom: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Department</th>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Employees</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffChartData.map((data, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px 0' }}>{data.name}</td>
                                            <td style={{ padding: '8px 0', color: 'var(--color-primary)' }}>{data.Employees}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={staffChartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} />
                                <YAxis stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} allowDecimals={false} />
                                <Tooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                />
                                <Bar dataKey="Employees" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <button 
                        className="glass-button" 
                        style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '13px' }}
                        onClick={() => setShowStaffRaw(!showStaffRaw)}
                    >
                        <Database size={16} />
                        {showStaffRaw ? 'Hide Employee Directory' : 'View Employee Directory'}
                        {showStaffRaw ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showStaffRaw && (
                        <div style={{ marginTop: '15px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Name</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Department</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Role</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Pay Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp.employee_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '10px', color: 'var(--color-primary)' }}>{emp.first_name} {emp.last_name}</td>
                                            <td style={{ padding: '10px' }}>{emp.dept_name || 'N/A'}</td>
                                            <td style={{ padding: '10px', textTransform: 'capitalize' }}>{emp.role}</td>
                                            <td style={{ padding: '10px' }}>${(emp.pay_rate_cents / 100).toFixed(2)}/hr</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ ANIMAL ANALYTICS TAB ═══════════ */}
            {activeTab === 'Animal Analytics' && (
                <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)',padding: '20px', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Database size={20} color="var(--color-secondary)" />
                            Animal Distribution per Zone
                        </h3>
                        <button 
                            className="glass-button" 
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 10px' }}
                            onClick={() => setShowAnimalData(!showAnimalData)}
                        >
                            <Database size={14} />
                            {showAnimalData ? 'Hide Summary' : 'Show Summary'}
                            {showAnimalData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {showAnimalData && (
                        <div style={{ 
                            background: 'rgba(0,0,0,0.3)', 
                            padding: '15px', 
                            borderRadius: '8px', 
                            marginBottom: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Zone</th>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Animals</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {animalChartData.map((data, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px 0' }}>{data.name}</td>
                                            <td style={{ padding: '8px 0', color: 'var(--color-secondary)' }}>{data.Animals}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={animalChartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} />
                                <YAxis stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} allowDecimals={false} />
                                <Tooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                />
                                <Bar dataKey="Animals" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <button 
                        className="glass-button" 
                        style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '13px' }}
                        onClick={() => setShowAnimalRaw(!showAnimalRaw)}
                    >
                        <Database size={16} />
                        {showAnimalRaw ? 'Hide Animal Census' : 'View Animal Census'}
                        {showAnimalRaw ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showAnimalRaw && (
                        <div style={{ marginTop: '15px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Name</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Species</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Zone</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Age</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {animals.map(animal => (
                                        <tr key={animal.animal_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '10px', color: 'var(--color-secondary)' }}>{animal.name}</td>
                                            <td style={{ padding: '10px' }}>{animal.species_common_name}</td>
                                            <td style={{ padding: '10px' }}>{animal.zone_name || 'N/A'}</td>
                                            <td style={{ padding: '10px' }}>{animal.age} yrs</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ FINANCIAL REVENUE TAB ═══════════ */}
            {activeTab === 'Financial Revenue' && (
                <div className="glass-panel" style={{ background: 'rgba(255, 245, 231, 0.65)', padding: '20px', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <DollarSign size={20} color="#10b981" />
                            Revenue Breakdown
                        </h3>
                        <button 
                            className="glass-button" 
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 10px' }}
                            onClick={() => setShowFinancialData(!showFinancialData)}
                        >
                            <Database size={14} />
                            {showFinancialData ? 'Hide Summary' : 'Show Summary'}
                            {showFinancialData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {showFinancialData && (
                        <div style={{ 
                            background: 'rgba(0,0,0,0.3)', 
                            padding: '15px', 
                            borderRadius: '8px', 
                            marginBottom: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Category</th>
                                        <th style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenueBreakdown.map((data, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px 0' }}>{data.name}</td>
                                            <td style={{ padding: '8px 0', color: '#10b981' }}>${data.Revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueBreakdown} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} />
                                <YAxis stroke="rgba(255, 245, 231, 0.65)" tick={{fill: 'rgba(255, 245, 231, 0.65)', fontSize: 12}} />
                                <Tooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                    formatter={(val) => [`$${val.toLocaleString()}`, 'Revenue']}
                                />
                                <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>Total Calculated Revenue</p>
                        <h2 style={{ margin: '10px 0 0', color: '#10b981' }}>
                            ${(revenueBreakdown.reduce((sum, r) => sum + r.Revenue, 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h2>
                    </div>

                    <button 
                        className="glass-button" 
                        style={{ marginTop: '30px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '13px' }}
                        onClick={() => setShowFinancialRaw(!showFinancialRaw)}
                    >
                        <Database size={16} />
                        {showFinancialRaw ? 'Hide Transaction Log' : 'View Transaction Log'}
                        {showFinancialRaw ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showFinancialRaw && (
                        <div style={{ marginTop: '15px', overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>ID</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Date</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Amount</th>
                                        <th style={{ padding: '10px', color: 'var(--color-text-muted)' }}>Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransactions.map(txn => (
                                        <tr key={txn.transaction_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <td style={{ padding: '10px' }}>#{txn.transaction_id}</td>
                                            <td style={{ padding: '10px' }}>{new Date(txn.transaction_date).toLocaleDateString()}</td>
                                            <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>
                                                ${(txn.total_amount_cents / 100).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                {txn.donation_id ? 'Donation' : 'Purchase'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

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

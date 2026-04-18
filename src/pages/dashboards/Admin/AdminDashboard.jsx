import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Ticket, ShoppingBag, DollarSign, Database, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [newUser, setNewUser] = useState({
        email: '', password: '', first_name: '', last_name: '', dept_id: '', role: 'security'
    });
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        fetchAdminData();
    }, []);

    useEffect(() => {
        if (showCreateUser) {
            getDepartments().then(setDepartments).catch(console.error);
        }
    }, [showCreateUser]);

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
    const handleRoleChange = (role) => {
        const deptName = ROLE_DEPT_MAP[role];
        const matchedDept = departments.find(d => d.dept_name === deptName);
        setNewUser({
            ...newUser,
            role,
            dept_id: matchedDept ? String(matchedDept.dept_id) : '',
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await createZooUser(newUser);
            alert('User created successfully!');
            setShowCreateUser(false);
            setNewUser({ email: '', password: '', first_name: '', last_name: '', dept_id: '', role: 'security' });
            fetchAdminData();
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Failed to create user: ' + error.message);
        }
    };

    const formatDollars = (cents) =>
        (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

    // Whether dept is auto-set by role (non-manager roles)
    const isDeptAutoSet = newUser.role !== 'manager';

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
                        style={{ background: '#6d8243' }}
                        onClick={() => setShowCreateUser(true)}
                    >
                        + Create User
                    </button>
                    <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DollarSign color="#6d8243" />
                        <div>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Revenue</span>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>${formatDollars(stats.totalRevenueCents)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateUser && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ padding: '30px', width: '500px', maxWidth: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Create New User</h2>
                            <button onClick={() => setShowCreateUser(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
                        </div>
                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <input required placeholder="First Name" className="glass-input" value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} />
                            <input required placeholder="Last Name" className="glass-input" value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} />

                            <input required type="email" placeholder="Email" className="glass-input" style={{ gridColumn: '1/-1' }} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                            <input required type="password" placeholder="Password" className="glass-input" style={{ gridColumn: '1/-1' }} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />

                            <select className="glass-input" style={{ gridColumn: '1/-1' }} value={newUser.role} onChange={e => handleRoleChange(e.target.value)}>
                                <option value="security">Role: Security</option>
                                <option value="retail">Role: Retail</option>
                                <option value="caretaker">Role: Caretaker</option>
                                <option value="vet">Role: Vet</option>
                                <option value="manager">Role: Manager</option>
                                <option value="admin">Role: Admin</option>
                            </select>

                            <select
                                required
                                className="glass-input"
                                style={{ gridColumn: '1/-1', opacity: isDeptAutoSet ? 0.6 : 1 }}
                                value={newUser.dept_id}
                                onChange={e => setNewUser({ ...newUser, dept_id: e.target.value })}
                                disabled={isDeptAutoSet}
                            >
                                <option value="">Select Department...</option>
                                {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                            </select>

                            <button type="submit" className="glass-button" style={{ gridColumn: '1/-1', background: 'var(--color-secondary)', marginTop: '10px' }}>Create Account</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className="glass-button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: activeTab === tab ? '#6d8243' : 'rgba(255,255,255,0.5)',
                            color: activeTab === tab ? 'white' : 'var(--zoo-muted)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 400,
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
                        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Tickets</h3>
                                <Ticket size={20} color="var(--color-primary)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.ticketRevenueCents)}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)',padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Retail</h3>
                                <ShoppingBag size={20} color="var(--color-secondary)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.retailRevenueCents)}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Staff</h3>
                                <Users size={20} color="var(--color-accent)" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalEmployees}</p>
                        </div>
                        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)',padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <h3 style={{ margin: 0 }}>Animals</h3>
                                <Database size={20} color="#f59e0b" />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalAnimals}</p>
                        </div>
                    </div>

                    <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)', padding: '20px' }}>
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
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)',padding: '20px', marginBottom: '40px' }}>
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
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                                <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} allowDecimals={false} />
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
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)',padding: '20px', marginBottom: '40px' }}>
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
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                                <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} allowDecimals={false} />
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
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.5)', padding: '20px', marginBottom: '40px' }}>
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
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                                <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
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
    const [tab, setTab] = useState('customers');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const runSearch = async () => {
        setLoading(true);
        try {
            const qs = query.trim()
                ? (tab === 'animals' ? `?name=${encodeURIComponent(query)}` : `?email=${encodeURIComponent(query)}`)
                : '';
            const path = tab === 'customers' ? `/api/customers/deactivated${qs}`
                       : tab === 'staff'     ? `/api/employees/deactivated${qs}`
                       :                       `/api/animals/deactivated${qs}`;
            const res = await fetch(path, {
                headers: { Authorization: `Bearer ${localStorage.getItem('zoo_token') || ''}` },
            });
            const data = await res.json();
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            alert('Lookup failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Refresh when tab changes
    React.useEffect(() => { setRows([]); setQuery(''); }, [tab]);

    const reactivate = async (id) => {
        if (!window.confirm('Reactivate this account?')) return;
        const path = tab === 'customers' ? `/api/customers/${id}/reactivate`
                   : tab === 'staff'     ? `/api/employees/${id}/reactivate`
                   :                       `/api/animals/${id}/reactivate`;
        try {
            const res = await fetch(path, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('zoo_token') || ''}` },
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            await runSearch();
        } catch (err) {
            alert('Reactivate failed: ' + err.message);
        }
    };

    const label = (r) =>
        tab === 'customers' ? `${r.first_name} ${r.last_name} — ${r.email}`
      : tab === 'staff'     ? `${r.first_name} ${r.last_name} (${r.role}${r.dept_name ? ` · ${r.dept_name}` : ''})`
      :                       `${r.name} — ${r.species_common_name}${r.zone_name ? ` · ${r.zone_name}` : ''}`;

    const id = (r) =>
        tab === 'customers' ? r.customer_id
      : tab === 'staff'     ? r.employee_id
      :                       r.animal_id;

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
                            background: tab === t ? 'rgb(123, 144, 79)' : 'rgba(255,255,255,0.5)',
                            color: tab === t ? 'white' : 'rgb(102, 122, 66)',
                            textTransform: 'capitalize',
                        }}>{t}</button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                    className="glass-input"
                    placeholder={tab === 'animals' ? 'Search by name...' : 'Search by email...'}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                    style={{ flex: 1 }}
                />
                <button className="glass-button" onClick={runSearch}
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
                        <div key={id(r)} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 14px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.5)',
                            border: '1px solid rgba(121,162,128,0.25)',
                        }}>
                            <span>{label(r)}</span>
                            <button className="glass-button"
                                onClick={() => reactivate(id(r))}
                                style={{ background: 'rgb(123, 144, 79)', color: 'white', padding: '6px 14px', fontSize: '12px' }}>
                                Reactivate
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

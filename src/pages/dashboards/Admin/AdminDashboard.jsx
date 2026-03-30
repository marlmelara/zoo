import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Ticket, ShoppingBag, DollarSign } from 'lucide-react';
import {
    getAdminDashboardStats,
    getEmployeesWithDepartments,
    getDepartments,
    createZooUser,
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
            const [dashStats, allEmployees] = await Promise.all([
                getAdminDashboardStats(),
                getEmployeesWithDepartments(),
            ]);
            setStats(dashStats);
            setEmployees(allEmployees);
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
                        style={{ background: 'var(--color-primary)' }}
                        onClick={() => setShowCreateUser(true)}
                    >
                        + Create User
                    </button>
                    <div className="glass-panel" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DollarSign color="#10b981" />
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

            {/* Key Metrics Grid */}
            <div className="grid-cards" style={{ marginBottom: '40px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Tickets</h3>
                        <Ticket size={20} color="var(--color-primary)" />
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.ticketRevenueCents)}</p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Retail</h3>
                        <ShoppingBag size={20} color="var(--color-secondary)" />
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>${formatDollars(stats.retailRevenueCents)}</p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Staff</h3>
                        <Users size={20} color="var(--color-accent)" />
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalEmployees}</p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Visitors</h3>
                        <LayoutDashboard size={20} color="#f59e0b" />
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{stats.totalCustomers}</p>
                </div>
            </div>

            {/* Employee Directory + System Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>Employee Directory (Admin View)</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Name</th>
                                    <th style={{ padding: '10px' }}>Department</th>
                                    <th style={{ padding: '10px' }}>Role</th>
                                    <th style={{ padding: '10px' }}>Pay Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => (
                                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '10px' }}>{emp.first_name} {emp.last_name}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                                                background: 'rgba(255,255,255,0.1)'
                                            }}>
                                                {emp.departments?.dept_name}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                                                background: emp.role === 'admin' ? 'rgba(239,68,68,0.2)' :
                                                    emp.role === 'manager' ? 'rgba(245,158,11,0.2)' :
                                                    emp.role === 'vet' ? 'rgba(16,185,129,0.2)' :
                                                    emp.role === 'caretaker' ? 'rgba(59,130,246,0.2)' :
                                                    emp.role === 'security' ? 'rgba(168,85,247,0.2)' :
                                                    emp.role === 'retail' ? 'rgba(236,72,153,0.2)' :
                                                    'rgba(255,255,255,0.1)',
                                                textTransform: 'capitalize',
                                            }}>
                                                {emp.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>${(emp.pay_rate_cents / 100).toFixed(2)}/hr</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
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
                        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 10px' }}>Admin Actions</h4>
                            <button className="glass-button" style={{ width: '100%', marginBottom: '10px' }} onClick={() => setShowCreateUser(true)}>
                                Create System User
                            </button>
                            <button className="glass-button" style={{ width: '100%' }} onClick={() => alert("Feature coming: Generate financial report")}>
                                Download Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

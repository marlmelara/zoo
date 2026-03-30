import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard, Cat, Users, Ticket, Calendar,
    ShoppingBag, Shield, Stethoscope, Heart, Briefcase
} from 'lucide-react';

export default function Layout() {
    const location = useLocation();
    const { user, role, signOut } = useAuth();

    // Build nav items based on role
    const getNavItems = () => {
        const items = [
            { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
        ];

        // Role-specific dashboard link
        if (role === 'admin') {
            items.push({ name: 'Admin Panel', path: '/dashboard/admin', icon: <Shield size={20} /> });
            items.push({ name: 'Manager Panel', path: '/dashboard/manager', icon: <Briefcase size={20} /> });
        }
        if (role === 'manager') {
            items.push({ name: 'Manager Panel', path: '/dashboard/manager', icon: <Briefcase size={20} /> });
        }
        if (role === 'vet') {
            items.push({ name: 'Vet Portal', path: '/dashboard/vet', icon: <Stethoscope size={20} /> });
        }
        if (role === 'caretaker') {
            items.push({ name: 'Caretaker Portal', path: '/dashboard/caretaker', icon: <Heart size={20} /> });
        }
        if (role === 'security' || role === 'retail') {
            items.push({ name: 'My Portal', path: '/dashboard/employee', icon: <Users size={20} /> });
        }

        // Shared tabs (admin/manager get all, others get relevant ones)
        if (role === 'admin' || role === 'manager') {
            items.push(
                { name: 'Animals', path: '/dashboard/animals', icon: <Cat size={20} /> },
                { name: 'Staff', path: '/dashboard/staff', icon: <Users size={20} /> },
                { name: 'Tickets', path: '/dashboard/tickets', icon: <Ticket size={20} /> },
                { name: 'Events', path: '/dashboard/events', icon: <Calendar size={20} /> },
                { name: 'Inventory', path: '/dashboard/inventory', icon: <ShoppingBag size={20} /> },
            );
        } else if (role === 'vet' || role === 'caretaker') {
            items.push(
                { name: 'Animals', path: '/dashboard/animals', icon: <Cat size={20} /> },
                { name: 'Events', path: '/dashboard/events', icon: <Calendar size={20} /> },
            );
        } else {
            // security, retail
            items.push(
                { name: 'Events', path: '/dashboard/events', icon: <Calendar size={20} /> },
            );
            if (role === 'retail') {
                items.push(
                    { name: 'Inventory', path: '/dashboard/inventory', icon: <ShoppingBag size={20} /> },
                );
            }
        }

        return items;
    };

    const navItems = getNavItems();

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <aside
                className="glass-panel"
                style={{
                    width: '250px',
                    padding: '20px',
                    margin: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}
            >
                <div>
                    <div
                        style={{
                            marginBottom: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                background: 'var(--color-primary)',
                                borderRadius: '10px',
                            }}
                        />
                        <h2 style={{ fontSize: '24px', margin: 0 }}>
                            Zoo<span style={{ color: 'var(--color-primary)' }}>Manager</span>
                        </h2>
                    </div>

                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                        transition: 'all 0.3s ease',
                                        border: isActive
                                            ? '1px solid rgba(16, 185, 129, 0.3)'
                                            : '1px solid transparent',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {item.icon}
                                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div
                    style={{
                        padding: '20px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '12px',
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: '12px',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        Logged in as
                    </p>
                    <p
                        style={{
                            margin: '5px 0 0',
                            fontWeight: 600,
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {user?.email}
                    </p>
                    <p
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            color: 'var(--color-primary)',
                            textTransform: 'uppercase',
                        }}
                    >
                        {role || 'Staff'}
                    </p>
                    <button
                        onClick={signOut}
                        style={{
                            marginTop: '10px',
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '12px',
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </aside>

            <main style={{ flex: 1, padding: '20px 20px 20px 0', overflowY: 'auto' }}>
                <div className="glass-panel" style={{ minHeight: 'calc(100vh - 40px)', padding: '40px' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard, Cat, Users, Calendar,
    ShoppingBag, Shield, Stethoscope, Heart, Briefcase, LogOut, Clock
} from 'lucide-react';
import logo from '../images/logo_alt2.png';
import NotificationsBell from './NotificationsBell';

// Earthy green used across the header — reuse in the sidebar for visual cohesion.
const SIDEBAR_GREEN       = 'rgb(123, 144, 79)';
const SIDEBAR_GREEN_DARK  = 'rgb(102, 122, 66)';
const SIDEBAR_GREEN_LIGHT = 'rgba(255, 255, 255, 0.18)';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, role, signOut } = useAuth();
    const [hoveredPath, setHoveredPath] = React.useState(null);

    const handleSignOut = async () => {
        const isCustomer = role === 'customer';
        await signOut();
        navigate(isCustomer ? '/account' : '/login', { replace: true });
    };

    const getNavItems = () => {
        if (role === 'admin') {
            return [
                { name: 'Admin Panel',    path: '/dashboard/admin',    icon: <Shield size={18} /> },
                { name: 'Manager Panel',  path: '/dashboard/manager',  icon: <Briefcase size={18} /> },
                { name: 'Animals',        path: '/dashboard/animals',  icon: <Cat size={18} /> },
                { name: 'Staff',          path: '/dashboard/staff',    icon: <Users size={18} /> },
                { name: 'Events',         path: '/dashboard/events',   icon: <Calendar size={18} /> },
                { name: 'Inventory',      path: '/dashboard/inventory',icon: <ShoppingBag size={18} /> },
                { name: 'Hours',          path: '/dashboard/hours',    icon: <Clock size={18} /> },
            ];
        }
        if (role === 'manager') {
            return [
                { name: 'Manager Panel', path: '/dashboard/manager', icon: <Briefcase size={18} /> },
                { name: 'Hours',         path: '/dashboard/hours',   icon: <Clock size={18} /> },
            ];
        }
        if (role === 'vet') {
            return [
                { name: 'My Portal', path: '/dashboard/vet',   icon: <Stethoscope size={18} /> },
                { name: 'Hours',     path: '/dashboard/hours', icon: <Clock size={18} /> },
            ];
        }
        if (role === 'caretaker') {
            return [
                { name: 'My Portal', path: '/dashboard/caretaker', icon: <Heart size={18} /> },
                { name: 'Hours',     path: '/dashboard/hours',     icon: <Clock size={18} /> },
            ];
        }
        if (role === 'customer') {
            return [{ name: 'My Account', path: '/dashboard/customer', icon: <Users size={18} /> }];
        }
        // security, retail
        return [
            { name: 'My Portal', path: '/dashboard/employee', icon: <Users size={18} /> },
            { name: 'Hours',     path: '/dashboard/hours',    icon: <Clock size={18} /> },
        ];
    };

    const navItems = getNavItems();

    return (
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
            <aside
                style={{
                    position: 'sticky',
                    top: 20,
                    alignSelf: 'flex-start',
                    height: 'calc(100vh - 40px)',
                    width: '240px',
                    margin: '20px 0 20px 20px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: SIDEBAR_GREEN,
                    color: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(123, 144, 79, 0.25)',
                    // overflow: visible so the notifications dropdown
                    // (position:absolute, left: calc(100% + 10px)) isn't clipped.
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flex: 1 }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'white' }}>
                        <img src={logo} alt="Home" style={{ width: '150px', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    </Link>

                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', paddingRight: '4px' }}>
                        {navItems.map((item) => {
                            const isActive  = location.pathname === item.path;
                            const isHovered = hoveredPath === item.path && !isActive;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onMouseEnter={() => setHoveredPath(item.path)}
                                    onMouseLeave={() => setHoveredPath(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        textDecoration: 'none',
                                        background: isActive ? 'white'
                                                  : isHovered ? SIDEBAR_GREEN_LIGHT
                                                  : 'transparent',
                                        color: isActive ? SIDEBAR_GREEN_DARK : 'white',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '14px',
                                        transition: 'all 0.18s ease',
                                    }}
                                >
                                    {item.icon}
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div style={{
                    padding: '14px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    flexShrink: 0,
                }}>
                    {role && role !== 'customer' && (
                        <div style={{ marginBottom: '10px' }}>
                            <NotificationsBell />
                        </div>
                    )}
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Logged in
                    </p>
                    <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '13px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.email}
                    </p>
                    <p style={{ margin: '2px 0 10px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {role || 'staff'}
                    </p>
                    <button
                        onClick={handleSignOut}
                        style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '8px 10px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: '8px',
                            color: SIDEBAR_GREEN_DARK,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '12px',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'; }}
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </aside>

            <main style={{ flex: 1, padding: '20px', overflow: 'visible' }}>
                <div className="glass-panel" style={{ background: 'rgba(255, 255, 255, 0.5)', minHeight: 'calc(100vh - 40px)', padding: '40px' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

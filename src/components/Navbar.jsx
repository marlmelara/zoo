import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import logo from '../images/logo.png';

export default function Navbar() {
  const { user, role, customerId, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Determine dashboard path based on role
  const getDashboardPath = () => {
    if (role === 'admin') return '/dashboard/admin';
    if (role === 'manager') return '/dashboard/manager';
    if (role === 'vet') return '/dashboard/vet';
    if (role === 'caretaker') return '/dashboard/caretaker';
    if (role === 'employee') return '/dashboard/employee';
    if (role === 'security') return '/dashboard/employeee';
    if (customerId) return '/dashboard/customer';
    return '/account';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
          <img src={logo} alt="Coog Zoo" />
        </Link>
        <div className="navbar-links">
          <Link to="/tickets" className="navbar-link">Buy Tickets</Link>
          <Link to="/shop" className="navbar-link">Shop</Link>
          <Link to="/membership" className="navbar-link">Membership</Link>
          
          {user ? (
            // User is logged in - show dashboard icon
            <>
              <Link to={getDashboardPath()} className="navbar-link user-dashboard-link">
                <FaUserCircle className="user-icon" />
                Dashboard
              </Link>
              <button onClick={handleLogout} className="navbar-link logout-btn">
                <FaSignOutAlt className="user-icon" />
                Logout
              </button>
            </>
          ) : (
            // User is not logged in - show login links
            <>
              <Link to="/account" className="navbar-link">Customer Login</Link>
              <Link to="/login" className="navbar-link">Staff Portal</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import logo from '../images/logo.png';

export default function Navbar() {
  const { user, role, customerId, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Get the current page name based on the path
  const getPageName = () => {
    const path = location.pathname;
    
    // Dashboard pages
    if (path.includes('/dashboard/admin')) return 'Admin Dashboard';
    if (path.includes('/dashboard/manager')) return 'Manager Dashboard';
    if (path.includes('/dashboard/vet')) return 'Veterinarian Dashboard';
    if (path.includes('/dashboard/caretaker')) return 'Caretaker Dashboard';
    if (path.includes('/dashboard/employee')) return 'Employee Dashboard';
    if (path.includes('/dashboard/customer')) return 'My Account';
    
    // Other pages
    if (path === '/') return 'Home';
    if (path === '/tickets') return 'Tickets';
    if (path === '/shop') return 'Shop';
    if (path === '/membership') return 'Membership';
    if (path === '/account') return 'Customer Login';
    if (path === '/login') return 'Staff Portal';
    if (path === '/signup') return 'Sign Up';
    if (path === '/forgot-password') return 'Forgot Password';
    if (path === '/reset-password') return 'Reset Password';
    if (path.includes('/checkout')) return 'Checkout';
    if (path.includes('/donations')) return 'Donations';
    if (path === '/calendar') return 'Events';
    if (path === '/map') return 'Zoo Map';
    if (path === '/schedule') return 'Schedule';
    if (path === '/shop/gifts') return 'Gift Shop';
    if (path === '/shop/food') return 'Food & Snacks';
    if (path === '/animals') return 'Our Animals';

    return '';
  };

  const pageName = getPageName();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
          <img src={logo} alt="Coog Zoo" />
        </Link>
        
        {/* Page Name Display */}
        {pageName && (
          <div className="navbar-page-name">
            <span>{pageName}</span>
          </div>
        )}
        
        <div className="navbar-links">
          {/*
          Original navbar button logic for these pages. if we don't like how it looks, revert back to this
          <Link to="/tickets" className="navbar-link">Buy Tickets</Link>
          <Link to="/shop" className="navbar-link">Shop</Link>
          <Link to="/membership" className="navbar-link">Membership</Link>
          To revert to old navbar thing, keep upper 3 lines and remove all lines between here -->*/}

          {location.pathname !== '/tickets' && (
            <Link to="/tickets" className="navbar-link">Buy Tickets</Link>
          )}
          {location.pathname !== '/shop' && (
            <Link to="/shop" className="navbar-link">Shop</Link>
          )}
          {location.pathname !== '/membership' && (
            <Link to="/membership" className="navbar-link">Membership</Link>
          )}
          {location.pathname !== '/map' && (
            <Link to="/map" className="navbar-link">Zoo Map</Link>
          )}
          {/*
          and here <--
          and the linw below this
          */}
          
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
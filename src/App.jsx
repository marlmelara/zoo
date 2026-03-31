import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Home from './pages/public/Home/Home';
import PublicTickets from './pages/public/Tickets/Tickets';
import Shop from './pages/public/Shop/Shop';
import Schedule from './pages/public/Schedule/Schedule';
import Donations from './pages/public/Donations/Donations';
import Checkout from './pages/public/Checkout/checkout';

import GiftShop from './pages/public/Shop/GiftShop';
import FoodShop from './pages/public/Shop/FoodShop';

import Login from './pages/auth/Login';

import Dashboard from './pages/dashboards/Admin/Dashboard';
import AdminDashboard from './pages/dashboards/Admin/AdminDashboard';
import Animals from './pages/dashboards/Admin/tabs/Animals';
import Staff from './pages/dashboards/Admin/tabs/Staff';
import AdminTickets from './pages/dashboards/Admin/tabs/AdminTickets';
import Events from './pages/dashboards/Admin/tabs/Events';
import Inventory from './pages/dashboards/Admin/tabs/Inventory';

import ManagerDashboard from './pages/dashboards/Manager/ManagerDashboard';
import VetDashboard from './pages/dashboards/Vet/VetDashboard';
import CaretakerDashboard from './pages/dashboards/Caretaker/CaretakerDashboard';
import GenEmployeeDashboard from './pages/dashboards/GenEmployee/GenEmployeeDashboard';
import CustomerDashboard from './pages/dashboards/Customer/CustomerDashboard';

const loadingScreenStyle = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0f172a',
  color: 'white',
};

const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={loadingScreenStyle}>Loading...</div>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

// Role guard: only allows specified roles, redirects others to /dashboard
const RoleRoute = ({ allowed }) => {
  const { role, loading } = useAuth();

  if (loading) {
    return <div style={loadingScreenStyle}>Loading...</div>;
  }

  return allowed.includes(role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/tickets" element={<PublicTickets />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/donations" element={<Donations />} />
          <Route path="/checkout" element={<Checkout />} />

          <Route path="/shop/gifts" element={<GiftShop />} />
          <Route path="/shop/food" element={<FoodShop />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              {/* Dashboard redirector — sends everyone to their role-specific page */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Admin-only routes */}
              <Route element={<RoleRoute allowed={['admin']} />}>
                <Route path="/dashboard/admin" element={<AdminDashboard />} />
                <Route path="/dashboard/staff" element={<Staff />} />
                <Route path="/dashboard/tickets" element={<AdminTickets />} />
                <Route path="/dashboard/animals" element={<Animals />} />
              </Route>

              {/* Admin + Manager routes */}
              <Route element={<RoleRoute allowed={['admin', 'manager']} />}>
                <Route path="/dashboard/manager" element={<ManagerDashboard />} />
              </Route>

              {/* Admin-only: Inventory & Events pages */}
              <Route element={<RoleRoute allowed={['admin']} />}>
                <Route path="/dashboard/inventory" element={<Inventory />} />
                <Route path="/dashboard/events" element={<Events />} />
              </Route>

              {/* Role-specific portals */}
              <Route path="/dashboard/vet" element={<VetDashboard />} />
              <Route path="/dashboard/caretaker" element={<CaretakerDashboard />} />
              <Route path="/dashboard/employee" element={<GenEmployeeDashboard />} />
              <Route path="/dashboard/customer" element={<CustomerDashboard />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

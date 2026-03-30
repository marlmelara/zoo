import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

// This component simply redirects to the correct role-specific dashboard
export default function Dashboard() {
    const { role } = useAuth();

    switch (role) {
        case 'admin':
            return <Navigate to="/dashboard/admin" replace />;
        case 'manager':
            return <Navigate to="/dashboard/manager" replace />;
        case 'vet':
            return <Navigate to="/dashboard/vet" replace />;
        case 'caretaker':
            return <Navigate to="/dashboard/caretaker" replace />;
        case 'customer':
            return <Navigate to="/dashboard/customer" replace />;
        case 'security':
        case 'retail':
        default:
            return <Navigate to="/dashboard/employee" replace />;
    }
}

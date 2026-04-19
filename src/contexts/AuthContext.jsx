import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setToken, clearToken } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser]             = useState(null);
    const [role, setRole]             = useState(null);
    const [customerId, setCustomerId] = useState(null);
    const [employeeId, setEmployeeId] = useState(null);
    const [deptId, setDeptId]         = useState(null);
    const [deptName, setDeptName]     = useState(null);
    const [loading, setLoading]       = useState(true);

    const applyUser = useCallback((userData) => {
        setUser(userData);
        setRole(userData.role || null);
        setCustomerId(userData.customerId || null);
        setEmployeeId(userData.employeeId || null);
        setDeptId(userData.deptId || null);
        setDeptName(userData.deptName || null);
    }, []);

    const clearAuth = useCallback(() => {
        clearToken();
        setUser(null);
        setRole(null);
        setCustomerId(null);
        setEmployeeId(null);
        setDeptId(null);
        setDeptName(null);
    }, []);

    // ── Hydrate from localStorage on mount ──────────────────
    useEffect(() => {
        const stored = localStorage.getItem('zoo_user');
        const token  = localStorage.getItem('zoo_token');
        if (stored && token) {
            try {
                applyUser(JSON.parse(stored));
            } catch {
                clearAuth();
            }
        }
        setLoading(false);
    }, [applyUser, clearAuth]);

    // ── Sign Up ──────────────────────────────────────────────
    const signUp = useCallback(async ({ email, password, firstName, lastName,
                                        phone, dateOfBirth, address, city, state, zipCode }) => {
        const data = await api.post('/auth/signup', {
            email, password, firstName, lastName,
            phone, dateOfBirth, address, city, state, zipCode,
        });
        setToken(data.token);
        localStorage.setItem('zoo_user', JSON.stringify(data.user));
        applyUser(data.user);
        return { data, error: null };
    }, [applyUser]);

    // ── Sign In ──────────────────────────────────────────────
    const signIn = useCallback(async (email, password) => {
        const data = await api.post('/auth/login', { email, password });
        setToken(data.token);
        localStorage.setItem('zoo_user', JSON.stringify(data.user));
        applyUser(data.user);
        return { data, error: null };
    }, [applyUser]);

    // ── Sign Out ─────────────────────────────────────────────
    const signOut = useCallback(() => {
        clearAuth();
    }, [clearAuth]);

    const value = {
        user, role, customerId, employeeId, deptId, deptName, loading,
        signUp, signIn, signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

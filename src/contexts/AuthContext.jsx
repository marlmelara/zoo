import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState(null);
    const [employeeId, setEmployeeId] = useState(null);
    const [deptId, setDeptId] = useState(null);
    const [customerId, setCustomerId] = useState(null);

    const clearAuth = useCallback(() => {
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setDeptId(null);
        setCustomerId(null);
    }, []);

    const checkUserRole = useCallback(async (currentUser) => {
        // SUPER ADMIN FALLBACK
        const superAdmins = ['admin@zoo.com', 'pablovelazquezbremont@gmail.com'];
        if (superAdmins.includes(currentUser.email)) {
            setRole('admin');
            setEmployeeId(null);
            setDeptId(null);
            return;
        }

        try {
            // Check employees table first
            const { data, error } = await supabase
                .from('employees')
                .select('role, employee_id, dept_id')
                .eq('user_id', currentUser.id)
                .single();

            if (!error && data?.role) {
                setRole(data.role);
                setEmployeeId(data.employee_id);
                setDeptId(data.dept_id);
                setCustomerId(null);
                return;
            }

            // Not an employee — check customers table
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('customer_id')
                .eq('user_id', currentUser.id)
                .single();

            if (!custError && custData) {
                setRole('customer');
                setCustomerId(custData.customer_id);
                setEmployeeId(null);
                setDeptId(null);
                return;
            }

            // Not found in either table
            clearAuth();
        } catch (e) {
            console.error("Error fetching role:", e);
            clearAuth();
        }
    }, [clearAuth]);

    useEffect(() => {
        let mounted = true;

        // Load session on mount — guaranteed to set loading = false
        async function initSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (!mounted) return;

                if (error) {
                    console.error("Session error:", error);
                    clearAuth();
                    return;
                }

                if (session?.user) {
                    setUser(session.user);
                    await checkUserRole(session.user);
                } else {
                    clearAuth();
                }
            } catch (err) {
                console.error("Session init error:", err);
                if (mounted) clearAuth();
            } finally {
                if (mounted) setLoading(false);
            }
        }

        initSession();

        // Listen for future auth changes (sign in, sign out, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            // Ignore INITIAL_SESSION — already handled by initSession above
            if (event === 'INITIAL_SESSION') return;

            if (event === 'SIGNED_OUT') {
                clearAuth();
                return;
            }

            // On token refresh, just update user object — role hasn't changed
            if (event === 'TOKEN_REFRESHED') {
                if (session?.user) setUser(session.user);
                return;
            }

            // SIGNED_IN — full role reload
            if (event === 'SIGNED_IN' && session?.user) {
                setUser(session.user);
                await checkUserRole(session.user);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [checkUserRole, clearAuth]);

    const handleSignOut = useCallback(async () => {
        clearAuth();
        await supabase.auth.signOut();
    }, [clearAuth]);

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: handleSignOut,
        user,
        role,
        employeeId,
        deptId,
        customerId,
        loading
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState(null);
    const [employeeId, setEmployeeId] = useState(null);
    const [deptId, setDeptId] = useState(null);

    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                checkUserRole(session.user);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        }).catch(err => {
            console.error("Session init error:", err);
            setLoading(false);
        });

        // Auth State Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                setUser(session.user);
                await checkUserRole(session.user);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function checkUserRole(currentUser) {
        // SUPER ADMIN FALLBACK
        const superAdmins = ['admin@zoo.com', 'pablovelazquezbremont@gmail.com'];
        if (superAdmins.includes(currentUser.email)) {
            setRole('admin');
            setEmployeeId(null);
            setDeptId(null);
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('employees')
                .select('role, employee_id, dept_id')
                .eq('user_id', currentUser.id)
                .single();

            if (data?.role) {
                setRole(data.role);
                setEmployeeId(data.employee_id);
                setDeptId(data.dept_id);
            } else {
                setRole(null);
                setEmployeeId(null);
                setDeptId(null);
            }
        } catch (e) {
            console.error("Error fetching role", e);
            setRole(null);
            setEmployeeId(null);
            setDeptId(null);
        } finally {
            setLoading(false);
        }
    }

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => supabase.auth.signOut(),
        user,
        role,
        employeeId,
        deptId,
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

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

const SUPER_ADMINS = ['admin@zoo.com', 'pablovelazquezbremont@gmail.com'];

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            setLoading(true);

            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;

            const userId = authData.user?.id;
            const userEmail = authData.user?.email;

            // Super admins bypass the employee check
            if (!SUPER_ADMINS.includes(userEmail)) {
                const { data: empData } = await supabase
                    .from('employees')
                    .select('employee_id')
                    .eq('user_id', userId)
                    .single();

                if (!empData) {
                    await supabase.auth.signOut();
                    setError('This account is not a staff account. Please use the Customer Login.');
                    return;
                }
            }

            navigate('/dashboard');

        } catch (err) {
            setError(err.message || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white'
        }}>
            <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ background: 'var(--color-primary)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Lock size={30} color="white" />
                </div>
                <h2 style={{ marginBottom: '8px' }}>Staff Portal</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.85rem' }}>
                  Employee access only. Accounts are created by administrators.
                </p>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        fontSize: '0.85rem',
                        color: '#fca5a5',
                        textAlign: 'left',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <input
                        type="email"
                        placeholder="Email"
                        className="glass-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ padding: '15px' }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="glass-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ padding: '15px' }}
                    />

                    <button
                        type="submit"
                        className="glass-button"
                        disabled={loading}
                        style={{
                            padding: '15px',
                            background: 'var(--color-secondary)',
                            fontSize: '16px',
                            marginTop: '4px'
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                    Looking for the customer portal?{' '}
                    <Link to="/account" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                        Customer login
                    </Link>
                </p>
            </div>
        </div>
    );
}

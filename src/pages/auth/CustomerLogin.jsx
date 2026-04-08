import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Lock } from 'lucide-react';
import logo from '../../images/logo.png';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // If already logged in as customer, redirect to dashboard
  useEffect(() => {
    if (user && role === 'customer') {
      navigate('/dashboard/customer', { replace: true });
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);

      // Sign out any existing session first (enforce single session)
      if (user) await supabase.auth.signOut();

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const userId = authData.user?.id;

      // Check this user is a customer, not staff
      const { data: custData } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('user_id', userId)
        .single();

      if (!custData) {
        await supabase.auth.signOut();
        setError('This account is not a customer account. Please use the Staff Portal.');
        return;
      }

      navigate('/dashboard/customer');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
      padding: '2rem',
    }}>
      {/* Small logo symbol — top left */}
      <Link to="/" style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <img src={logo} alt="Home" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
      </Link>

      {/* Coog Zoo logo above panel */}
      <Link to="/" style={{ marginBottom: '24px' }}>
        <img src={logo} alt="Coog Zoo" style={{ maxWidth: '160px', height: 'auto' }} />
      </Link>

      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{
          background: 'var(--color-primary)', width: '60px', height: '60px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <Lock size={30} color="white" />
        </div>
        <h2 style={{ marginBottom: '8px' }}>Customer Sign In</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Sign in to manage your tickets, orders, and membership.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem',
            color: '#fca5a5', textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input type="email" placeholder="Email" className="glass-input" value={email}
            onChange={(e) => setEmail(e.target.value)} required style={{ padding: '15px' }} />
          <input type="password" placeholder="Password" className="glass-input" value={password}
            onChange={(e) => setPassword(e.target.value)} required style={{ padding: '15px' }} />

          <div style={{ textAlign: 'right', marginTop: '-10px' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="glass-button" disabled={loading}
            style={{ padding: '15px', background: 'var(--color-secondary)', fontSize: '16px', marginTop: '4px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Lock } from 'lucide-react';
import logo from '../../images/logo.png';

export default function CustomerLogin() {
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
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
      padding: '2rem',
    }}>
      {/* Home logo button */}
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

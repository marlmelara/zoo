import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock } from 'lucide-react';
import logo from '../../images/logo_alt2.png';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, role, signIn } = useAuth();

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
      const { data } = await signIn(email, password);

      if (data?.user?.role !== 'customer') {
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
      background: 'rgb(255, 245, 231)',
      color: 'white',
      padding: '2rem',
    }}>
      {/*Home button*/}
      <Link to="/" style={{ position: 'absolute', top: '24px', left: '24px', backgroundColor: 'rgb(123,144,79)', padding: '10px 20px', borderRadius: '5px', textDecoration: 'none' }}>
        <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>Home</button>
      </Link>

      {/* Coog Zoo logo above panel — click to go home */}
      <Link to="/" style={{ marginBottom: '24px', padding: '10px', borderRadius: '5px', display: 'inline-block' }} aria-label="Go to homepage">
        <img src={logo} alt="Coog Zoo" style={{ maxWidth: '240px', height: 'auto', cursor: 'pointer' }} />
      </Link>
      {/*Glass Panel*/}
      <div className="glass-panel" style={{padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)' }}>
        {/*Lock Icon*/}
        <div style={{
          background: 'rgb(123, 144, 79)', width: '60px', height: '60px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <Lock size={30} color="white" />
        </div>
        <h2 style={{ marginBottom: '8px', color: '#1f2937'}}>Customer Sign In</h2>
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
            style={{ padding: '15px', background: 'rgb(123, 144, 79)', color: 'white', fontSize: '16px', marginTop: '4px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#ffbf69', textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

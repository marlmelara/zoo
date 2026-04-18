import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { KeyRound } from 'lucide-react';
import logo from '../../images/logo_alt2.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      // Requires a reset token from the URL (set by forgot-password flow)
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (!token) throw new Error('Invalid or missing reset token. Please request a new reset link.');
      await api.post('/auth/reset-password', { token, password: form.password });

      setSuccess(true);
      setTimeout(() => navigate('/account'), 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
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
      {/* Home button */}
      <Link to="/" style={{ position: 'absolute', top: '24px', left: '24px', backgroundColor: 'rgb(123,144,79)', padding: '10px 20px', borderRadius: '5px', textDecoration: 'none' }}>
        <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>Home</button>
      </Link>

      {/* Coog Zoo logo above panel — click to go home */}
      <Link to="/" style={{ marginBottom: '24px', padding: '10px', borderRadius: '5px', display: 'inline-block' }} aria-label="Go to homepage">
        <img src={logo} alt="Coog Zoo" style={{ maxWidth: '240px', height: 'auto', cursor: 'pointer' }} />
      </Link>

      {/* Glass Panel */}
      <div className="glass-panel" style={{
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          background: 'rgb(123, 144, 79)',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <KeyRound size={30} color="white" />
        </div>

        {success ? (
          <>
            <h2 style={{ marginBottom: '12px', color: '#1f2937' }}>Password Updated</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Your password has been reset successfully. Redirecting you to sign in...
            </p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: '8px', color: '#1f2937' }}>Set New Password</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Enter your new password below.
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: '#1f2937',
                }}>
                  New Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  className="glass-input"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  required
                  style={{ padding: '15px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: '#1f2937',
                }}>
                  Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="glass-input"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  required
                  style={{ padding: '15px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                className="glass-button"
                disabled={loading}
                style={{
                  padding: '15px',
                  background: 'rgb(123, 144, 79)',
                  color: 'white',
                  fontSize: '16px',
                  marginTop: '4px',
                }}
              >
                {loading ? 'Updating...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          <Link to="/account" style={{ color: '#ffbf69', textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
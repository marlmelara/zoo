import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Mail } from 'lucide-react';
import logo from '../../images/logo_alt2.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      // Verify the email exists — server returns 200 whether or not it exists
      // (security best practice: don't confirm which emails are registered)
      await api.post('/auth/forgot-password', { email });

      setSent(true);
    } catch (err) {
      console.error('Password reset error:', err);
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
          <Mail size={30} color= "white" />
        </div>

        {sent ? (
          <>
            <h2 style={{ marginBottom: '12px', color: '#1f2937' }}>Check Your Email</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              We sent a password reset link to <strong style={{ color: '#1f2937' }}>{email}</strong>.
              Check your inbox and follow the link to reset your password.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => { setSent(false); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgb(123, 144, 79)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                try again
              </button>.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: '8px', color: 'var(--color-text-dark)' }}>Forgot Password?</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Enter the email address you used to create your account and we'll send you a reset link.
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="email"
                className="glass-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ padding: '15px' }}
              />
              <button
                type="submit"
                className="glass-button"
                disabled={loading}
                style={{
                  padding: '15px',
                  background: 'rgb(123, 144, 79)',
                  color: 'white',
                  fontSize: '16px',
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
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
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { UserPlus } from 'lucide-react';
import logo from '../../images/logo.png';

export default function SignUp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: 'Texas',
    zipCode: '',
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

      // 1. Create auth user in Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { first_name: form.firstName, last_name: form.lastName },
        },
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Account created but no user ID returned.');

      // 2. Insert customer record linked to auth user
      const { error: customerError } = await supabase
        .from('customers')
        .insert([{
          user_id: userId,
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone || null,
          date_of_birth: form.dateOfBirth || null,
          is_member: false,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zipCode || null,
        }]);

      if (customerError) throw customerError;

      // 3. Try to sign in — if email confirmation is required, show a message
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        // Email confirmation is likely required
        setSuccess(true);
        return;
      }

      navigate('/dashboard/customer');
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
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
      <Link to="/" style={{ marginBottom: '24px' }}>
        <img src={logo} alt="Coog Zoo" style={{ maxWidth: '160px', height: 'auto' }} />
      </Link>

      {success ? (
        <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '520px', textAlign: 'center' }}>
          <div style={{ background: 'var(--color-primary)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <UserPlus size={30} color="white" />
          </div>
          <h2 style={{ marginBottom: '8px' }}>Check Your Email</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Your account has been created! Please check your email to confirm your account before signing in.
          </p>
          <Link to="/account" className="glass-button" style={{ display: 'inline-block', padding: '14px 30px', background: 'var(--color-secondary)', fontSize: '16px', textDecoration: 'none' }}>
            Go to Sign In
          </Link>
        </div>
      ) : (
      <div className="glass-panel" style={{
        padding: '40px',
        width: '100%',
        maxWidth: '520px',
        textAlign: 'center',
      }}>
        <div style={{
          background: 'var(--color-primary)',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <UserPlus size={30} color="white" />
        </div>

        <h2 style={{ marginBottom: '8px' }}>Create Your Account</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Join Coog Zoo for faster checkout, order tracking, and membership perks.
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
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                name="firstName"
                className="glass-input"
                value={form.firstName}
                onChange={handleChange}
                placeholder="First name"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                name="lastName"
                className="glass-input"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Last name"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="email"
              name="email"
              className="glass-input"
              value={form.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Phone <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
            <input
              type="tel"
              name="phone"
              className="glass-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="(123) 456-7890"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Date of Birth <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
            <input
              type="date"
              name="dateOfBirth"
              className="glass-input"
              value={form.dateOfBirth}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Street Address <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
            <input
              type="text"
              name="address"
              className="glass-input"
              value={form.address}
              onChange={handleChange}
              placeholder="Street address"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>City <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
              <input
                type="text"
                name="city"
                className="glass-input"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
              <select
                name="state"
                className="glass-input"
                value={form.state}
                onChange={handleChange}
                style={inputStyle}
              >
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Zip Code <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
              <input
                type="text"
                name="zipCode"
                className="glass-input"
                value={form.zipCode}
                onChange={handleChange}
                placeholder="Zip code"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Password <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="password"
              name="password"
              className="glass-input"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="password"
              name="confirmPassword"
              className="glass-input"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            className="glass-button"
            disabled={loading}
            style={{
              padding: '14px',
              background: 'var(--color-secondary)',
              fontSize: '16px',
              marginTop: '8px',
              width: '100%',
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/account" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--color-text)',
};

const inputStyle = {
  padding: '12px',
  width: '100%',
  boxSizing: 'border-box',
};

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

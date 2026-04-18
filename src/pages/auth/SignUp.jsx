import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus } from 'lucide-react';
import logo from '../../images/logo_alt2.png';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    state: '',
    zipCode: '',
  });

  // Format 10 digits as (XXX) XXX-XXXX as the user types.
  const formatPhone = (v) => {
    const d = String(v).replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const digitsOnly = (v, max) => String(v).replace(/\D/g, '').slice(0, max);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = value;
    if (name === 'phone')   next = formatPhone(value);
    if (name === 'zipCode') next = digitsOnly(value, 5);
    setForm(prev => ({ ...prev, [name]: next }));
  };

  // Max DOB = today (no future dates). Min = 120 years ago.
  const today = new Date();
  const todayStr   = today.toISOString().split('T')[0];
  const minDob     = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
    .toISOString().split('T')[0];

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

    const requiredFields = {
      firstName: 'First name', lastName: 'Last name', email: 'Email',
      phone: 'Phone', dateOfBirth: 'Date of birth',
      address: 'Street address', city: 'City', state: 'State', zipCode: 'Zip code',
    };
    for (const [key, label] of Object.entries(requiredFields)) {
      if (!form[key] || !String(form[key]).trim()) {
        setError(`${label} is required.`);
        return;
      }
    }

    // Format-specific constraints
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    if (!/^\d{5}$/.test(form.zipCode)) {
      setError('Zip code must be exactly 5 digits.');
      return;
    }
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > today) {
      setError('Date of birth cannot be in the future.');
      return;
    }
    if (dob < new Date(minDob)) {
      setError('Please enter a valid date of birth.');
      return;
    }

    try {
      setLoading(true);

      await signUp({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        address: form.address,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
      });

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
        maxWidth: '520px',
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
          <UserPlus size={30} color="white" />
        </div>

        <h2 style={{ marginBottom: '8px', color: 'var(--color-text-dark)' }}>Create Your Account</h2>
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
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left'}}>
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
                maxLength={50}
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
                maxLength={50}
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
              maxLength={255}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Phone <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="tel"
              name="phone"
              className="glass-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="(123) 456-7890"
              required
              maxLength={14}
              inputMode="numeric"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="date"
              name="dateOfBirth"
              className="glass-input"
              value={form.dateOfBirth}
              onChange={handleChange}
              required
              min={minDob}
              max={todayStr}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Street Address <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              name="address"
              className="glass-input"
              value={form.address}
              onChange={handleChange}
              placeholder="Street address"
              required
              maxLength={200}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>City <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                name="city"
                className="glass-input"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                required
                maxLength={100}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                name="state"
                className="glass-input"
                value={form.state}
                onChange={handleChange}
                required
                style={inputStyle}
              >
                <option value="">Select a state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Zip Code <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                name="zipCode"
                className="glass-input"
                value={form.zipCode}
                onChange={handleChange}
                placeholder="12345"
                required
                maxLength={5}
                inputMode="numeric"
                pattern="\d{5}"
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
              minLength={6}
              maxLength={128}
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
              minLength={6}
              maxLength={128}
              style={inputStyle}
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
              width: '100%',
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/account" style={{ color: '#ffbf69', textDecoration: 'none'}}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--color-text-dark)'
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
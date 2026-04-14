import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../../images/logo.png';
import './donations.css';

const TABS = [
  { key: 'general', title: 'General Donations', image: '/images/donation-general.jpg' },
  { key: 'animal', title: 'Animal Wellbeing', image: '/images/donation-animal.jpg' },
  { key: 'conservation', title: 'Conservation Fund', image: '/images/donation-conservation.jpg' },
];

export default function Donations() {
  document.title = 'Donations - Coog Zoo';

  const navigate = useNavigate();
  const [active, setActive] = useState('general');
  const [form, setForm] = useState({
    amount: '',
  });
  const [status, setStatus] = useState(null);

  const presetAmounts = [10, 25, 50, 100, 150, 200, 500, 1000];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function handlePreset(amount) {
    setForm((p) => ({ ...p, amount: String(amount) }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setStatus('error');
      return;
    }
    // Navigate to checkout with donation data — checkout handles payment
    navigate('/checkout', {
      state: {
        donationData: {
          amount: form.amount,
          fund: active,
        },
      },
    });
  }

  const activeTab = TABS.find((t) => t.key === active);

  return (
    <div className="donations-page">
      <nav className="donations-navbar">
        <div className="donations-navbar-container">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          <div className="donations-navbar-links">
            <Link to="/tickets" className="donations-navbar-link">Buy Tickets</Link>
            <Link to="/shop" className="donations-navbar-link">Shop</Link>
            <Link to="/membership" className="donations-navbar-link">Membership</Link>
            <Link to="/account" className="donations-navbar-link">Customer Login</Link>
            <Link to="/login" className="donations-navbar-link">Staff Portal</Link>
          </div>
        </div>
      </nav>

      <div className="donations-page-inner">
        <section className="intro">
          <h1>Support Our Zoo!</h1>
          <p>
            Our zoo relies on generous donors to help us care and protect these animals. You can support the zoo generally, help the animal's wellbeing, or
            contribute to our conservation projects. We deeply appreciate your support - every gift makes a difference!
          </p>
        </section>

      <div className="glass-panel donations-panel">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', justifyContent: 'center' }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={tab.key === active ? 'glass-button' : 'glass-button glass-button-ghost'}
              style={{ padding: '10px 16px' , alignItems: 'center'}}
              aria-pressed={tab.key === active}
            >
              {tab.title}
            </button>
          ))}
        </div>

        
        {/* Centered image and description */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ borderRadius: '12px', overflow: 'hidden', margin: '0 auto', maxWidth: '640px' }}>
            <img
              src={activeTab.image}
              alt={activeTab.title}
              style={{ width: '100%', height: '340px', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <h3 style={{ marginTop: '12px' }}>{activeTab.title}</h3>
          <p style={{ color: 'var(--zoo-text)', maxWidth: '700px', margin: '8px auto 0' }}>
            {active === 'general' && 'Support the zoo where it’s needed most — care, operations, and programs.'}
            {active === 'animal' && 'Help fund medical care, nutrition, and enrichment for our animals.'}
            {active === 'conservation' && 'Contribute to on-site and field conservation projects.'}
          </p>
        </div>

        {/* Full-width form: donation amount only */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '24px', fontSize: '18px' }}>
          <div className="donation-presets">
            {presetAmounts.map((a) => {
              const isSelected = String(form.amount) === String(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => handlePreset(a)}
                  className={`donation-preset-button${isSelected ? ' active' : ''}`}
                >
                  ${a}
                </button>
              );
            })}
          </div>

          <div className="donations-input-group">
            <input
              className="glass-input"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              name="amount"
              placeholder="other"
              value={form.amount}
              onChange={handleChange}
            />
          </div>

          <div className="donations-submit">
            <button type="submit">
              Donate {form.amount ? `$${form.amount}` : ''}
            </button>
          </div>

          {status === 'submitting' && <p style={{ color: 'var(--color-text-muted)' }}>Submitting…</p>}
          {status === 'success' && <p style={{ color: 'lightgreen' }}>Thank you — your gift was received (demo).</p>}
          {status === 'error' && <p style={{ color: '#ff8b8b' }}>There was an error. Please try again.</p>}
        </form>
      </div>
    </div>
  </div>
  );
}
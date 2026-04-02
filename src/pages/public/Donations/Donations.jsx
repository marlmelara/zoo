import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createDonation } from '../../../api/donations';

const TABS = [
  { key: 'general', title: 'General Donations', image: '/images/donation-general.jpg' },
  { key: 'animal', title: 'Animal Wellbeing', image: '/images/donation-animal.jpg' },
  { key: 'conservation', title: 'Conservation Fund', image: '/images/donation-conservation.jpg' },
];

export default function Donations() {
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

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('submitting');
    try {
      await createDonation({ amount: form.amount, fund: active });
      setStatus('success');
      setForm({ amount: '' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  const activeTab = TABS.find((t) => t.key === active);

  return (
    <div
      style={{
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            display: 'inline-block',
          }}
          aria-label="Go to homepage"
        >
          <img
            src="/images/test.jpg"
            alt="Coog Zoo"
            style={{
              maxWidth: '200px',
              width: '100%',
              height: 'auto',
              cursor: 'pointer',
            }}
          />
        </Link>
      </div>
      <section style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '8px', textAlign: 'center' }}>Support Our Zoo!</h1>
        <p style={{ fontSize: '20px', color: 'var(--color-text-muted)', maxWidth: '800px', textAlign: 'center' }}>
          Our zoo relies on generous donors to help us care and protect these animals. You can support the zoo generally, help the animal's wellbeing, or
          contribute to our conservation projects. We deeply appriciate your support - every gift makes a difference!
        </p>
      </section>

      <div
        className="glass-panel"
        style={{ padding: '20px', borderRadius: '12px', maxWidth: '900px' }}
      >
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

        {/* Preset amounts moved next to amount input (inline) */}

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
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '700px', margin: '8px auto 0' }}>
            {active === 'general' && 'Support the zoo where it’s needed most — care, operations, and programs.'}
            {active === 'animal' && 'Help fund medical care, nutrition, and enrichment for our animals.'}
            {active === 'conservation' && 'Contribute to on-site and field conservation projects.'}
          </p>
        </div>

        {/* Full-width form: donation amount only */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '24px', fontSize: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(100px, 1fr))', gap: '14px', justifyContent: 'center', width: '100%', maxWidth: '560px', margin: '0 auto 12px' }}>
            {presetAmounts.map((a) => {
              const isSelected = String(form.amount) === String(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => handlePreset(a)}
                  className={isSelected ? 'glass-button' : 'glass-button glass-button-small'}
                  style={{
                    fontSize: '18px',
                    padding: '16px 14px',
                    minHeight: '64px',
                    borderRadius: '10px',
                    ...(isSelected ? { background: 'var(--color-accent, #2b8cff)', color: '#fff' } : {}),
                  }}
                >
                  ${a}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gap: '6px', minWidth: '220px', maxWidth: '420px', margin: '0 auto' }}>
            <input
              className="glass-input"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              name="amount"
              placeholder="other"
              value={form.amount}
              onChange={handleChange}
              style={{ width: '100%', padding: '12px', MozAppearance: 'textfield', WebkitAppearance: 'none', appearance: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" className="glass-button" style={{ width: '100%', padding: '14px' }}>
              Donate {form.amount ? `$${form.amount}` : ''}
            </button>
          </div>

          {status === 'submitting' && <p style={{ color: 'var(--color-text-muted)' }}>Submitting…</p>}
          {status === 'success' && <p style={{ color: 'lightgreen' }}>Thank you — your gift was received (demo).</p>}
          {status === 'error' && <p style={{ color: '#ff8b8b' }}>There was an error. Please try again.</p>}
        </form>
      </div>
    </div>
  );
}
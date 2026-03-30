import React, { useState } from 'react';
import { createDonation } from '../../../api/donations';

const TABS = [
  { key: 'general', title: 'General Donations', image: 'src/images/donation-general.jpg' },
  { key: 'animal', title: 'Animal Wellbeing', image: 'src/images/donation-animal.jpg' },
  { key: 'conservation', title: 'Conservation Fund', image: 'src/images/donation-conservation.jpg' },
];

export default function Donations() {
  const [active, setActive] = useState('general');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    amount: '',
    address1: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    cardFirstName: '',
    cardLastName: '',
    cardNumber: '',
    cardExp: '',
    cardCvc: '',
    billingCountry: '',
    billingZip: '',
    cardEmail: '',
  });
  const [status, setStatus] = useState(null);

  const presetAmounts = [10, 25, 50, 100];

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
      // createDonation is expected to exist; adapt payload to your backend shape
      await createDonation({ ...form, fund: active });
      setStatus('success');
      setForm({ firstName: '', lastName: '', email: '', amount: '' });
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

        {/* Full-width form: donation amount, donor info, mock card fields */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px', fontSize: '18px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '6px', minWidth: '220px', flex: '1 1 260px' }}>
              <label style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>Donation amount</label>
              <input
                className="glass-input"
                type="number"
                name="amount"
                placeholder="Donation amount"
                value={form.amount}
                onChange={handleChange}
                style={{ width: '100%', padding: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {presetAmounts.map((a) => {
                const isSelected = String(form.amount) === String(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => handlePreset(a)}
                    className={isSelected ? 'glass-button' : 'glass-button glass-button-small'}
                    style={{
                      padding: '10px 14px',
                      minWidth: '64px',
                      borderRadius: '8px',
                      ...(isSelected ? { background: 'var(--color-accent, #2b8cff)', color: '#fff' } : {}),
                    }}
                  >
                    ${a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Names moved into Donor Address section below */}

          <div style={{ marginTop: '6px' }}>
            <h4 style={{ margin: '6px 0', fontSize: '18px' }}>Donor Address</h4>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input
                  className="glass-input"
                  name="firstName"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={handleChange}
                />
                <input
                  className="glass-input"
                  name="lastName"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={handleChange}
                />
              </div>

              <input
                className="glass-input"
                name="address1"
                placeholder="Address"
                value={form.address1}
                onChange={handleChange}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <input className="glass-input" name="city" placeholder="City" value={form.city} onChange={handleChange} />
                <input className="glass-input" name="state" placeholder="State" value={form.state} onChange={handleChange} />
                <input className="glass-input" name="zip" placeholder="Postal code" value={form.zip} onChange={handleChange} />
              </div>

              <input className="glass-input" name="country" placeholder="Country" value={form.country} onChange={handleChange} />
            </div>
          </div>

          <input
            className="glass-input"
            type="email"
            name="email"
            placeholder="Contact email"
            value={form.email}
            onChange={handleChange}
            style={{ padding: '12px' }}
          />

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
            <p style={{ margin: '0 0 8px 0', color: 'var(--color-text-muted)', fontSize: '16px' }}>Payment information (demo only — no charges will be processed)</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input className="glass-input" name="cardFirstName" placeholder="Card first name" value={form.cardFirstName} onChange={handleChange} />
              <input className="glass-input" name="cardLastName" placeholder="Card last name" value={form.cardLastName} onChange={handleChange} />
            </div>

            <input className="glass-input" name="cardNumber" placeholder="Card number" value={form.cardNumber} onChange={handleChange} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input className="glass-input" name="cardExp" placeholder="MM/YY" value={form.cardExp} onChange={handleChange} />
              <input className="glass-input" name="cardCvc" placeholder="CVC" value={form.cardCvc} onChange={handleChange} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <input className="glass-input" name="billingCountry" placeholder="Billing country" value={form.billingCountry} onChange={handleChange} />
              <input className="glass-input" name="billingZip" placeholder="Billing postal code" value={form.billingZip} onChange={handleChange} />
            </div>

            <input className="glass-input" name="cardEmail" placeholder="Cardholder email" value={form.cardEmail} onChange={handleChange} style={{ marginTop: '12px' }} />
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
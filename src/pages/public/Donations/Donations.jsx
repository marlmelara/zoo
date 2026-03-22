import React, { useState } from 'react';
import { createDonation } from '../../../api/donations';

export default function Donations() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    amount: '',
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    alert('Donation form submitted. Backend hookup will be added next.');
  }

  return (
    <div style={{ color: 'white' }}>
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px' }}>Support Wildlife Conservation</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '700px' }}>
          Your donation helps support animal care, research, education, and conservation.
        </p>
      </section>

      <div
        className="glass-panel"
        style={{
          padding: '28px',
          borderRadius: '16px',
          maxWidth: '700px',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <input
              className="glass-input"
              type="text"
              name="firstName"
              placeholder="First Name"
              value={form.firstName}
              onChange={handleChange}
            />
            <input
              className="glass-input"
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={form.lastName}
              onChange={handleChange}
            />
          </div>

          <input
            className="glass-input"
            type="email"
            name="email"
            placeholder="Email Address"
            value={form.email}
            onChange={handleChange}
          />

          <input
            className="glass-input"
            type="number"
            name="amount"
            placeholder="Donation Amount"
            value={form.amount}
            onChange={handleChange}
          />

          <button type="submit" className="glass-button" style={{ width: '220px' }}>
            Donate Now
          </button>
        </form>
      </div>
    </div>
  );
}
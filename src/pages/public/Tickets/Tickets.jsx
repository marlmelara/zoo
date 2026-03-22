import React from 'react';
import { getPublicTicketTypes } from '../../../api/tickets';

const ticketOptions = [
  {
    title: 'General Admission',
    description: 'Standard zoo entry for one guest.',
    price: '$24.99',
  },
  {
    title: 'Child Admission',
    description: 'Discounted admission for children.',
    price: '$17.99',
  },
  {
    title: 'Membership',
    description: 'Unlimited visits plus member-exclusive benefits.',
    price: '$89.99 / year',
  },
  {
    title: 'VIP Experience',
    description: 'Premium access with special event and exhibit perks.',
    price: '$149.99',
  },
];

export default function Tickets() {
  return (
    <div style={{ color: 'white' }}>
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px' }}>Tickets & Membership</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '700px' }}>
          Plan your visit with admission options, family-friendly pricing, and membership packages.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
        }}
      >
        {ticketOptions.map((ticket) => (
          <div
            key={ticket.title}
            className="glass-panel"
            style={{ padding: '24px', borderRadius: '16px' }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>{ticket.title}</h2>
            <p style={{ color: 'var(--color-text-muted)', minHeight: '48px' }}>
              {ticket.description}
            </p>
            <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-primary)' }}>
              {ticket.price}
            </p>
            <button className="glass-button" style={{ marginTop: '12px' }}>
              Select
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
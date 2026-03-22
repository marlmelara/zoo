import React from 'react';
import { getShopItems } from '../../../api/inventory';

const shopSections = [
  {
    title: 'Gift Shop',
    description: 'Zoo-themed merchandise, plush animals, mugs, shirts, and souvenirs.',
  },
  {
    title: 'Food Shop',
    description: 'Quick bites, drinks, family meal combos, and seasonal snacks.',
  },
  {
    title: 'Best Sellers',
    description: 'Popular visitor favorites and featured items will appear here.',
  },
];

export default function Shop() {
  return (
    <div style={{ color: 'white' }}>
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px' }}>Gift Shop & Food Shop</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '700px' }}>
          Browse zoo souvenirs, gifts, food, and snacks during your visit.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}
      >
        {shopSections.map((section) => (
          <div
            key={section.title}
            className="glass-panel"
            style={{ padding: '24px', borderRadius: '16px' }}
          >
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>{section.description}</p>
            <button className="glass-button" style={{ marginTop: '16px' }}>
              Explore
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
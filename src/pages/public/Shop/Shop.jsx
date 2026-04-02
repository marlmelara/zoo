import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopItems } from '../../../api/inventory';

const shopSections = [
  {
    title: 'Gift Shop',
    description: 'Zoo-themed merchandise, plush animals, mugs, shirts, and souvenirs.',
    path: '/shop/gifts',
  },
  {
    title: 'Food Shop',
    description: 'Quick bites, drinks, family meal combos, and seasonal snacks.',
    path: '/shop/food',
  },
];

export default function Shop() {
  const navigate = useNavigate();
  return (
    <div style={{  textAlign: 'center', color: 'white', padding: '40px' }}>
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px' }}>Gift Shop & Food Shop</h1>
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Browse zoo souvenirs, gifts, food, and snacks during your visit.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 2fr))',
          gap: '60px',
        }}
      >
        {shopSections.map((section) => (
          <div
            key={section.title}
            className="glass-panel"
            style={{ padding: '24px', borderRadius: '32px' , minHeight: '320px'}}
          >
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>{section.description}</p>
            <button className="glass-button" style={{ marginTop: '192px' }} onClick={() => navigate(section.path)}>
              Browse
            </button>
          </div>
        ))}
      </section>
      <button
        className="glass-button"
        onClick={() => navigate('/')}
        style={{ position: 'absolute', top: '20px', left: '20px' }}
      >
        Home
      </button>
    </div>
  );
}
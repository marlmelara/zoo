import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaShoppingCart, FaGift, FaUtensils, FaArrowLeft } from 'react-icons/fa';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';

const shopSections = [
  { title: 'Gift Shop', description: 'Zoo-themed merchandise, plush animals, mugs, shirts, and souvenirs.', path: '/shop/gifts', icon: FaGift, color: '#10b981' },
  { title: 'Food & Snacks', description: 'Quick bites, drinks, family meal combos, and seasonal snacks.', path: '/shop/food', icon: FaUtensils, color: '#f59e0b' },
];

export default function Shop() {
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const cartHook = useZooCart();

  return (
    <div style={{ color: 'white', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => navigate('/')} className="glass-button" style={{ padding: '8px 14px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaArrowLeft size={12} /> Home</button>
        <button onClick={() => setCartOpen(true)} className="glass-button" style={{
          padding: '10px 18px', background: cartHook.totalItems > 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px',
        }}><FaShoppingCart /> Cart {cartHook.totalItems > 0 && `(${cartHook.totalItems})`}</button>
      </div>
      <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px' }}>Zoo Shop</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '40px' }}>Browse zoo souvenirs, gifts, food, and snacks during your visit.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {shopSections.map(section => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="glass-panel" onClick={() => navigate(section.path)} style={{ padding: '40px 30px', borderRadius: '20px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: `${section.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Icon size={30} color={section.color} />
                </div>
                <h2 style={{ marginTop: 0, marginBottom: '10px' }}>{section.title}</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>{section.description}</p>
                <button className="glass-button" style={{ background: section.color, padding: '12px 28px', fontSize: '15px' }}>Browse</button>
              </div>
            );
          })}
        </div>
      </div>
      <ShopCartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} {...cartHook} />
    </div>
  );
}

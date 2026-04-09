import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaShoppingCart, FaPlus, FaArrowLeft } from 'react-icons/fa';
import { getShopItems } from '../../../api/inventory';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';

export default function FoodShop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const cartHook = useZooCart();

  useEffect(() => { getShopItems(2).then(setItems); }, []);

  return (
    <div style={{ color: 'white', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div style={{
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0,
        background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/shop')} className="glass-button" style={{ padding: '8px 14px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaArrowLeft size={12} /> Shop
          </button>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Food & Snacks</h1>
        </div>
        <button onClick={() => setCartOpen(true)} className="glass-button" style={{
          padding: '10px 18px', background: cartHook.totalItems > 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px',
        }}>
          <FaShoppingCart /> Cart {cartHook.totalItems > 0 && `(${cartHook.totalItems})`}
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '30px' }}>Order snacks, meals, and drinks to enjoy during your visit!</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {items.map(item => (
            <div key={item.item_id} className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {item.image_url && (
                <div style={{ width: '100%', height: '200px', overflow: 'hidden' }}>
                  <img src={item.image_url} alt={item.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>{item.item_name}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 12px', flex: 1 }}>{item.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '18px' }}>${(item.price_cents / 100).toFixed(2)}</span>
                  <button onClick={() => { cartHook.addShopItem(item); setCartOpen(true); }} className="glass-button" style={{
                    padding: '8px 14px', background: 'var(--color-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <FaPlus size={10} /> Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {cartHook.totalItems > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '60px', height: '60px', borderRadius: '50%',
          background: 'var(--color-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '22px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(16,185,129,0.4)', zIndex: 100,
        }}>
          <FaShoppingCart />
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{cartHook.totalItems}</span>
        </button>
      )}

      <ShopCartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} {...cartHook} />
    </div>
  );
}

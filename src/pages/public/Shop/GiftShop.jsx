import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopItems } from '../../../api/inventory';

export default function GiftShop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState(() => {
    const saved = localStorage.getItem('shopCart');
    return saved ? JSON.parse(saved) : {};
  });

  const handleQuantityChange = (itemId, change) => {
    setQuantities(prev => {
      const updated = {
        ...prev,
        [itemId]: Math.max(0, (prev[itemId] || 0) + change)
      };
      localStorage.setItem('shopCart', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCheckout = () => {
    const selectedItems = items
      .filter(item => quantities[item.item_id] > 0)
      .map(item => ({ ...item, quantity: quantities[item.item_id] }));

    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }
    /*changed to tickets to avoid bug*/
    navigate('/tickets', { state: { shopData: { items: selectedItems } } });
  };

  useEffect(() => {
    getShopItems(1).then(setItems);
  }, []);

  return (
    <div style={{ color: 'white', padding: '20px', boxSizing: 'border-box' }}>
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', marginBottom: '12px', textAlign: 'center' }}>
          Gift Shop
        </h1>
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Browse our Catalogue of available souveniers and take-home trinkets!
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {items.map((item) => (
          <div
            key={item.item_id}
            className="glass-panel"
            style={{ padding: '16px', borderRadius: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {item.image_url && (
              <div style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', marginBottom: '12px' }}>
                <img
                  src={item.image_url}
                  alt={item.item_name}
                  style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}
            <h2 style={{ marginTop: 0 }}>{item.item_name}</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>{item.description}</p>
            <p style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              ${(item.price_cents / 100).toFixed(2)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
              <button className="glass-button" onClick={() => handleQuantityChange(item.item_id, -1)}>−</button>
              <span>{quantities[item.item_id] || 0}</span>
              <button className="glass-button" onClick={() => handleQuantityChange(item.item_id, 1)}>+</button>
            </div>
          </div>
        ))}
      </section>
      <button className="glass-button" onClick={handleCheckout}>
        Proceed to Checkout
      </button>
      <button
        className="glass-button"
        onClick={() => navigate('/shop')}
        style={{ position: 'absolute', top: '20px', left: '20px' }}
      >
        Back
      </button>
    </div>
  );
}
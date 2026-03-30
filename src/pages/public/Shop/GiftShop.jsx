import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShopItems } from '../../../api/inventory';

export default function GiftShop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

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
            <button className="glass-button" style={{ marginTop: 'auto', paddingTop: '16px' }}>
              Add to Cart
            </button>
          </div>
        ))}
      </section>

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
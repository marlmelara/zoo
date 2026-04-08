import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaShoppingCart, FaTimes, FaTimesCircle, FaMinus, FaPlus, FaTrash } from 'react-icons/fa';

const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

export function useShopCart() {
  const [cart, setCart] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('shopCart') || '{}');
    } catch { return {}; }
  });

  const updateCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('shopCart', JSON.stringify(newCart));
  };

  const addItem = (item) => {
    const newCart = { ...cart };
    if (!newCart[item.item_id]) {
      newCart[item.item_id] = { ...item, quantity: 1 };
    } else {
      newCart[item.item_id] = { ...newCart[item.item_id], quantity: newCart[item.item_id].quantity + 1 };
    }
    updateCart(newCart);
  };

  const removeItem = (itemId) => {
    const newCart = { ...cart };
    delete newCart[itemId];
    updateCart(newCart);
  };

  const updateQuantity = (itemId, delta) => {
    const newCart = { ...cart };
    if (!newCart[itemId]) return;
    const newQty = newCart[itemId].quantity + delta;
    if (newQty <= 0) {
      delete newCart[itemId];
    } else {
      newCart[itemId] = { ...newCart[itemId], quantity: newQty };
    }
    updateCart(newCart);
  };

  const clearCart = () => {
    updateCart({});
  };

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalCents = cartItems.reduce((sum, i) => sum + (i.price_cents * i.quantity), 0);

  return { cart, cartItems, totalItems, totalCents, addItem, removeItem, updateQuantity, clearCart };
}

export default function ShopCartPanel({ isOpen, onClose, cartItems, totalItems, totalCents, removeItem, updateQuantity, clearCart }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 998,
          }}
        />
      )}

      {/* Sliding Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '380px', maxWidth: '90vw',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        zIndex: 999,
        display: 'flex', flexDirection: 'column',
        color: 'white',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaShoppingCart /> Your Cart ({totalItems})
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px',
          }}>
            <FaTimes />
          </button>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
              <FaShoppingCart size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
              <p>Your cart is empty</p>
              <p style={{ fontSize: '13px' }}>Browse our shop to add items!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cartItems.map(item => (
                <div key={item.item_id} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '12px',
                  display: 'flex', gap: '12px',
                }}>
                  {/* Item image */}
                  {item.image_url && (
                    <img src={item.image_url} alt={item.item_name} style={{
                      width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover',
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.item_name}</div>
                      <button onClick={() => removeItem(item.item_id)} style={{
                        background: 'none', border: 'none', color: '#f87171',
                        cursor: 'pointer', padding: '0', fontSize: '14px', flexShrink: 0,
                      }}>
                        <FaTrash size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600, margin: '4px 0' }}>
                      {fmt(item.price_cents)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(item.item_id, -1)} style={{
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: 'white', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                      }}>
                        <FaMinus size={10} />
                      </button>
                      <span style={{ fontWeight: 600, fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button onClick={() => updateQuantity(item.item_id, 1)} style={{
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: 'white', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                      }}>
                        <FaPlus size={10} />
                      </button>
                      <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {fmt(item.price_cents * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div style={{
            padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '18px', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-primary)' }}>{fmt(totalCents)}</span>
            </div>
            <button
              onClick={() => { onClose(); navigate('/checkout'); }}
              className="glass-button"
              style={{
                width: '100%', padding: '14px', background: 'var(--color-primary)',
                fontSize: '16px', fontWeight: 700,
              }}
            >
              Proceed to Checkout
            </button>
            <button
              onClick={clearCart}
              style={{
                width: '100%', padding: '10px', marginTop: '8px',
                background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px', color: 'var(--color-text-muted)',
                cursor: 'pointer', fontSize: '13px',
              }}
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

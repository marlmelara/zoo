import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaShoppingCart, FaTimes, FaMinus, FaPlus, FaTrash,
  FaTicketAlt, FaCalendarAlt, FaUser, FaChild, FaMapMarkerAlt,
} from 'react-icons/fa';
import { FaPersonCane } from 'react-icons/fa6';

const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

const TICKET_PRICES = { adult: 2499, youth: 1799, senior: 1999 };
const TICKET_LABELS = {
  adult:  { name: 'Adult', icon: FaUser },
  youth:  { name: 'Youth', icon: FaChild },
  senior: { name: 'Senior', icon: FaPersonCane },
};

// ─── Read / write unified cart from localStorage ───
function readCart() {
  try {
    const raw = localStorage.getItem('zooCart');
    if (raw) return JSON.parse(raw);
  } catch {}

  // Migrate legacy shopCart if it exists
  try {
    const legacy = localStorage.getItem('shopCart');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const firstVal = Object.values(parsed)[0];
      const shop = {};
      if (firstVal && typeof firstVal === 'object' && firstVal.item_id) {
        Object.values(parsed).forEach(i => { if (i.quantity > 0) shop[i.item_id] = i; });
      }
      localStorage.removeItem('shopCart');
      const cart = { admission: null, events: {}, shop, membership: null };
      localStorage.setItem('zooCart', JSON.stringify(cart));
      return cart;
    }
  } catch {}

  return { admission: null, events: {}, shop: {}, membership: null };
}

function writeCart(cart) {
  localStorage.setItem('zooCart', JSON.stringify(cart));
}

// ─── Hook: useZooCart ───
export function useZooCart() {
  const [cart, setCart] = React.useState(readCart);

  const update = (newCart) => {
    setCart(newCart);
    writeCart(newCart);
  };

  // — Admission tickets —
  const setAdmission = (admission) => {
    update({ ...cart, admission });
  };
  const clearAdmission = () => update({ ...cart, admission: null });

  // — Event tickets —
  const addEvent = (event) => {
    const events = { ...cart.events };
    const key = event.event_id;
    if (events[key]) {
      events[key] = { ...events[key], quantity: events[key].quantity + 1 };
    } else {
      events[key] = { ...event, quantity: 1 };
    }
    update({ ...cart, events });
  };
  const removeEvent = (eventId) => {
    const events = { ...cart.events };
    delete events[eventId];
    update({ ...cart, events });
  };
  const updateEventQty = (eventId, delta) => {
    const events = { ...cart.events };
    if (!events[eventId]) return;
    const ev = events[eventId];
    const newQty = ev.quantity + delta;
    if (newQty <= 0) { delete events[eventId]; update({ ...cart, events }); return; }
    // Respect the capacity snapshot stored when the event was added. Server
    // still does the authoritative check atomically at checkout — this just
    // stops the user locally from bumping past what's known-available.
    if (ev.max_capacity != null) {
      const remaining = ev.max_capacity - (ev.actual_attendance || 0);
      if (newQty > remaining) return;
    }
    events[eventId] = { ...ev, quantity: newQty };
    update({ ...cart, events });
  };

  // — Shop items —
  const addShopItem = (item) => {
    const shop = { ...cart.shop };
    const key = item.item_id;
    const currentQty = shop[key]?.quantity || 0;
    if (currentQty >= Number(item.stock_count)) return;
    if (shop[key]) {
      shop[key] = { ...shop[key], quantity: shop[key].quantity + 1 };
    } else {
      shop[key] = { ...item, quantity: 1 };
    }
    update({ ...cart, shop });
  };
  const removeShopItem = (itemId) => {
    const shop = { ...cart.shop };
    delete shop[itemId];
    update({ ...cart, shop });
  };
  const updateShopQty = (itemId, delta) => {
    const shop = { ...cart.shop };
    if (!shop[itemId]) return;
    const newQty = shop[itemId].quantity + delta;
    if (newQty <= 0) delete shop[itemId];
    else if (newQty > Number(shop[itemId].stock_count)) return;
    else shop[itemId] = { ...shop[itemId], quantity: newQty };
    update({ ...cart, shop });
  };

  // — Membership —
  const setMembership = (plan) => update({ ...cart, membership: plan });
  const clearMembership = () => update({ ...cart, membership: null });

  const clearCart = () => update({ admission: null, events: {}, shop: {}, membership: null });

  // — Computed totals —
  const admissionCount = cart.admission
    ? Object.values(cart.admission.quantities).reduce((s, q) => s + q, 0)
    : 0;
  const admissionCents = cart.admission
    ? Object.entries(cart.admission.quantities).reduce((s, [type, qty]) => s + (TICKET_PRICES[type] || 0) * qty, 0)
    : 0;

  const eventItems = Object.values(cart.events);
  const eventCount = eventItems.reduce((s, e) => s + e.quantity, 0);
  const eventCents = eventItems.reduce((s, e) => s + e.price_cents * e.quantity, 0);

  const shopItems = Object.values(cart.shop);
  const shopCount = shopItems.reduce((s, i) => s + i.quantity, 0);
  const shopCents = shopItems.reduce((s, i) => s + i.price_cents * i.quantity, 0);

  const membershipCents = cart.membership?.price_cents || 0;

  const totalItems = admissionCount + eventCount + shopCount + (cart.membership ? 1 : 0);
  const totalCents = admissionCents + eventCents + shopCents + membershipCents;

  return {
    cart, totalItems, totalCents,
    // admission
    setAdmission, clearAdmission, admissionCount, admissionCents,
    // events
    addEvent, removeEvent, updateEventQty, eventItems, eventCount, eventCents,
    // shop
    addShopItem, removeShopItem, updateShopQty, shopItems, shopCount, shopCents,
    // membership
    setMembership, clearMembership, membershipCents,
    // global
    clearCart,
  };
}

// ─── Backward-compat alias ───
export const useShopCart = useZooCart;

// ─── Cart Panel Component ───
export default function ShopCartPanel({
  isOpen, onClose,
  cart, totalItems, totalCents,
  // admission
  clearAdmission, admissionCount,
  // events
  eventItems, removeEvent, updateEventQty,
  // shop
  shopItems, removeShopItem, updateShopQty,
  // membership
  clearMembership,
  // global
  clearCart,
}) {
  const navigate = useNavigate();
  const hasItems = totalItems > 0;

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 998,
        }} />
      )}
      {/* Cart Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '400px', maxWidth: '92vw',
        background: 'rgb(255, 245, 231)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        zIndex: 999, display: 'flex', flexDirection: 'column', color: 'white',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', background: 'rgba(255, 255, 255, 0.3)', borderBottom: '1px solid rgba(121, 162, 128, 0.35)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--zoo-muted)' }}>
            <FaShoppingCart /> Your Cart ({totalItems})
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--zoo-muted)', cursor: 'pointer', fontSize: '20px',
          }}><FaTimes /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          {!hasItems ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--zoo-muted)' }}>
              <FaShoppingCart size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
              <p>Your cart is empty</p>
              <p style={{ fontSize: '13px' }}>Add tickets or shop items to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/*Admission Tickets Panel*/}
              {cart.admission && admissionCount > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'rgb(123, 144, 79)', letterSpacing: '0.5px' }}>
                      <FaTicketAlt style={{ marginRight: '6px' }} />Admission Tickets
                    </h4>
                    <button onClick={clearAdmission} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>
                      <FaTrash size={10} /> Remove
                    </button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(121, 162, 128, 0.35)', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--zoo-muted)', marginBottom: '8px' }}>
                      <FaCalendarAlt style={{ marginRight: '4px' }} />
                      {cart.admission.date}{cart.admission.time ? ` at ${cart.admission.time}` : ''}
                    </div>
                    {Object.entries(cart.admission.quantities).map(([type, qty]) => {
                      if (qty <= 0) return null;
                      const label = TICKET_LABELS[type];
                      const Icon = label?.icon || FaUser;
                      return (
                        <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                          <span style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--zoo-muted)' }}>
                            <Icon size={12} /> {label?.name || type} x{qty}
                          </span>
                          <span style={{ fontWeight: 600, color: 'rgb(123, 144, 79)', fontSize: '14px' }}>
                            {fmt(TICKET_PRICES[type] * qty)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Event Tickets ── */}
              {eventItems.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', color: 'rgb(123, 144, 79)', letterSpacing: '0.5px' }}>
                    <FaCalendarAlt style={{ marginRight: '6px' }} />Event Tickets
                  </h4>
                  {eventItems.map(event => {
                    const cap = event.max_capacity;
                    const remaining = cap == null ? Infinity : Math.max(0, cap - (event.actual_attendance || 0));
                    const atMax = event.quantity >= remaining;
                    return (
                    <div key={event.event_id} style={{
                      background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(121, 162, 128, 0.35)',
                      borderRadius: '12px', padding: '12px', marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <div style={{ color: 'var(--zoo-muted)', fontWeight: 600, fontSize: '14px' }}>{event.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {event.date}
                            {event.venue && <span> &middot; {event.venue}</span>}
                          </div>
                        </div>
                        <button onClick={() => removeEvent(event.event_id)} style={{
                          background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', flexShrink: 0,
                        }}><FaTrash size={12} /></button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px'}}>
                        <button onClick={() => updateEventQty(event.event_id, -1)} style={{border: 'none',background: 'rgba(123, 144, 79, 0.15)', color: 'var(--color-secondary)'}}><FaMinus size={10} /></button>
                        <span style={{color: 'var(--color-secondary)', fontWeight: 600, fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{event.quantity}</span>
                        <button
                          onClick={() => updateEventQty(event.event_id, 1)}
                          disabled={atMax}
                          title={atMax ? `Only ${remaining} seats available for this event` : ''}
                          style={{
                            border: 'none', background: 'rgba(123, 144, 79, 0.15)', color: 'var(--color-secondary)',
                            opacity: atMax ? 0.4 : 1,
                            cursor: atMax ? 'not-allowed' : 'pointer',
                          }}>
                          <FaPlus size={10} />
                        </button>
                        <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'rgb(123, 144, 79)' }}>
                          {fmt(event.price_cents * event.quantity)}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* ── Shop Items ── */}
              {shopItems.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', color: '#7a5c3a', letterSpacing: '0.5px' }}>
                    <FaShoppingCart style={{ marginRight: '6px' }} />Shop Items
                  </h4>
                  {shopItems.map(item => (
                    <div key={item.item_id} style={{
                      background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(121, 162, 128, 0.35)',
                      borderRadius: '12px', padding: '12px', marginBottom: '8px',
                      display: 'flex', gap: '12px',
                    }}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.item_name} style={{
                          width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover',
                        }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#7a5c3a' }}>{item.item_name}</div>
                          <button onClick={() => removeShopItem(item.item_id)} style={{
                            background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', flexShrink: 0,
                          }}><FaTrash size={12} /></button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <button onClick={() => updateShopQty(item.item_id, -1)} style={{border: 'none',background: 'rgba(123, 144, 79, 0.15)', color: 'var(--zoo-muted)'}}><FaMinus size={10} /></button>
                          <span style={{color: 'var(--zoo-muted)', fontWeight: 600, fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateShopQty(item.item_id, 1)}
                            disabled={(item.quantity || 0) >= Number(item.stock_count)}
                            style={{
                              border: 'none',
                              background: 'rgba(123, 144, 79, 0.15)',
                              color: 'var(--zoo-muted)',
                              opacity: (item.quantity || 0) >= Number(item.stock_count) ? 0.4 : 1,
                              cursor: (item.quantity || 0) >= Number(item.stock_count) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <FaPlus size={10} />
                          </button>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--zoo-accent)' }}>
                            {fmt(item.price_cents * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Membership ── */}
              {cart.membership && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'rgb(123, 144, 79)', letterSpacing: '0.5px' }}>
                      <FaTicketAlt style={{ marginRight: '6px' }} />Membership
                    </h4>
                    <button onClick={clearMembership} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>
                      <FaTrash size={10} /> Remove
                    </button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(121, 162, 128, 0.35)', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: 'var(--zoo-muted)',fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{cart.membership.plan_name} Plan</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Annual - {Math.round(cart.membership.discount_rate * 100)}% discount on all purchases
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--zoo-accent)', fontSize: '14px' }}>
                        {fmt(cart.membership.price_cents)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasItems && (
          <div style={{ background: 'rgba(255,255,255,0.3)', padding: '20px', borderTop: '1px solid rgba(121, 162, 128, 0.35)' }}>
            <div style={{ color: 'var(--zoo-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '18px', fontWeight: 700 }}>
              <span>Subtotal</span>
              <span style={{ color: 'rgb(123, 144, 79)' }}>{fmt(totalCents)}</span>
            </div>
            <button
              onClick={() => { onClose(); navigate('/checkout'); }}
              className="glass-button"
              style={{ width: '100%', padding: '14px', background: 'rgb(123, 144, 79)', fontSize: '16px', fontWeight: 700, color: 'white' }}
            >
              Proceed to Checkout
            </button>
            <button onClick={clearCart} style={{
              width: '100%', padding: '10px', marginTop: '8px', background: 'rgba(230, 227, 223, 0.8)',
              border: '1px solid rgba(121, 162, 128, 0.35)', borderRadius: '10px',
              color: 'var(--zoo-muted)', cursor: 'pointer', fontSize: '13px',
            }}>
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const qtyBtnStyle = {
  width: '26px', height: '26px', borderRadius: '6px',
  background: 'rgba(255,255,255,0.1)', border: 'none',
  color: 'white', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: '12px',
};

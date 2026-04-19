import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FaShoppingCart, FaUser, FaChild, FaTrash,
  FaLock, FaCreditCard, FaEnvelope, FaCheckCircle, FaHeart,
  FaTag, FaCrown, FaTimesCircle, FaMapMarkerAlt, FaPhone,
} from 'react-icons/fa';
import { FaPersonCane } from 'react-icons/fa6';
import { useAuth } from '../../../contexts/AuthContext';
import { createTransaction } from '../../../api/transactions';
import api from '../../../lib/api';
import Navbar from '../../../components/Navbar';
import './checkout.css';
import logo from '../../../images/logo.png';

// ── Constants ──
const TICKET_PRICES = {
  adult:  2499,
  youth:  1799,
  senior: 1999,
};
const TICKET_LABELS = {
  adult:  { name: 'Adult (12-64)',  icon: FaUser },
  youth:  { name: 'Youth (3-11)',   icon: FaChild },
  senior: { name: 'Senior (65+)',   icon: FaPersonCane },
};
const TAX_RATE = 0.0825;

function readZooCart() {
  try { return JSON.parse(localStorage.getItem('zooCart') || 'null'); }
  catch { return null; }
}

export default function Checkout() {
  document.title = 'Checkout - Coog Zoo';

  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, customerId, signIn } = useAuth();

  // ── Load cart from unified localStorage ──
  const initialCart = readZooCart() || { admission: null, events: {}, shop: {}, membership: null };
  const [ticketData, setTicketData] = useState(initialCart.admission);
  const [eventTickets, setEventTickets] = useState(initialCart.events || {});
  const [shopItems, setShopItems] = useState(Object.values(initialCart.shop || {}));
  const [membershipPlan, setMembershipPlan] = useState(initialCart.membership || null);
  const donationData = location.state?.donationData || null;
  const isDonation = !!donationData;

  // ── Customer data (loaded if logged in) ──
  const [customer, setCustomer] = useState(null);
  const [memberDiscount, setMemberDiscount] = useState(0);

  // ── Auth mode on checkout ──
  const [authMode, setAuthMode] = useState(user ? 'logged-in' : null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Billing / Shipping ──
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billing, setBilling] = useState({
    firstName: '', lastName: '', email: '', confirmEmail: '',
    street: '', city: '', state: '', zip: '', phone: '',
  });
  const [shipping, setShipping] = useState({
    firstName: '', lastName: '',
    street: '', city: '', state: '', zip: '', phone: '',
  });

  // ── Payment ──
  const [payment, setPayment] = useState({ cardNumber: '', cardName: '', expiry: '', cvv: '' });

  // ── Order state ──
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderTransaction, setOrderTransaction] = useState(null);

  // ── Remove item handlers ──
  const removeTickets = () => setTicketData(null);
  const removeEventTicket = (eventId) => {
    setEventTickets(prev => { const next = { ...prev }; delete next[eventId]; return next; });
  };
  const removeShopItem = (itemId) => {
    setShopItems(prev => prev.filter(i => i.item_id !== itemId));
  };
  const removeMembership = () => setMembershipPlan(null);

  // ══════════════════════════════════════
  // Effects
  // ══════════════════════════════════════

  // Load customer profile if logged in
  useEffect(() => {
    if (!user || !customerId) return;
    setAuthMode('logged-in');

    (async () => {
      const data = await api.get('/customers/me').catch(() => null);

      if (data) {
        setCustomer(data);
        // Pre-fill billing from customer profile
        setBilling(prev => ({
          ...prev,
          firstName: data.first_name || '',
          lastName:  data.last_name || '',
          email:     data.email || user.email || '',
          confirmEmail: data.email || user.email || '',
          street:    data.billing_street || data.address || '',
          city:      data.billing_city || data.city || '',
          state:     data.billing_state || data.state || '',
          zip:       data.billing_zip || data.zip_code || '',
          phone:     data.billing_phone || data.phone || '',
        }));

        if (data.shipping_same_as_billing === false) {
          setSameAsBilling(false);
          setShipping({
            firstName: data.first_name || '',
            lastName:  data.last_name || '',
            street:    data.shipping_street || '',
            city:      data.shipping_city || '',
            state:     data.shipping_state || '',
            zip:       data.shipping_zip || '',
            phone:     data.shipping_phone || '',
          });
        }

        // Membership discount
        if (data.is_member && data.membership_end) {
          const endDate = new Date(data.membership_end);
          if (endDate >= new Date()) {
            const discountMap = { premium: 0.20, family: 0.15, explorer: 0.10 };
            setMemberDiscount(discountMap[data.membership_type] || 0.10);
          }
        }
      }
    })();
  }, [user, customerId]);



  // ══════════════════════════════════════
  // Handlers
  // ══════════════════════════════════════

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      setLoginLoading(true);
      await signIn(loginEmail, loginPassword);
      // Auth context updates user — page will re-render with user
    } catch (err) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBillingChange = (e) => {
    const { name, value } = e.target;
    setBilling(prev => ({ ...prev, [name]: value }));
  };

  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShipping(prev => ({ ...prev, [name]: value }));
  };

  const formatCardNumber = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handlePaymentChange = (e) => {
    let { name, value } = e.target;
    if (name === 'cardNumber') value = formatCardNumber(value);
    if (name === 'expiry')     value = formatExpiry(value);
    if (name === 'cvv')        value = value.replace(/\D/g, '').slice(0, 4);
    setPayment(prev => ({ ...prev, [name]: value }));
  };

  // ── Price calculations ──
  const calcTicketSubtotal = useCallback(() => {
    if (!ticketData) return 0;
    let total = 0;
    for (const [type, qty] of Object.entries(ticketData.quantities)) {
      const base = TICKET_PRICES[type] || 0;
      const discounted = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
      total += discounted * qty;
    }
    return total;
  }, [ticketData, memberDiscount]);

  const eventTicketList = Object.values(eventTickets);

  const calcEventTicketSubtotal = useCallback(() => {
    return eventTicketList.reduce((sum, evt) => {
      const base = evt.price_cents || 0;
      const discounted = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
      return sum + discounted * (evt.quantity || 1);
    }, 0);
  }, [eventTickets, memberDiscount]);

  const calcShopSubtotal = useCallback(() => {
    return shopItems.reduce((sum, i) => {
      const price = memberDiscount > 0 ? Math.round(i.price_cents * (1 - memberDiscount)) : i.price_cents;
      return sum + price * i.quantity;
    }, 0);
  }, [shopItems, memberDiscount]);

  const donationAmountCents = donationData ? Math.round(parseFloat(donationData.amount) * 100) : 0;

  const membershipCents = membershipPlan?.price_cents || 0;

  const subtotalCents = isDonation
    ? donationAmountCents
    : calcTicketSubtotal() + calcEventTicketSubtotal() + calcShopSubtotal() + membershipCents;

  const taxableCents = calcTicketSubtotal() + calcEventTicketSubtotal() + calcShopSubtotal();
  const taxCents = isDonation ? 0 : Math.round(taxableCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  // ══════════════════════════════════════
  // Place order
  // ══════════════════════════════════════

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    // Membership in cart requires a logged-in customer account.
    if (membershipPlan && !customerId) {
      alert('You must be signed in to purchase a membership. Please sign in or create an account.');
      navigate('/account');
      return;
    }

    // Validation
    if (!isDonation) {
      if (!billing.firstName || !billing.lastName) return alert('Please enter your name.');
      if (!billing.email || billing.email !== billing.confirmEmail) return alert('Emails do not match.');
      if (!payment.cardNumber || payment.cardNumber.replace(/\s/g, '').length < 16) return alert('Enter a valid card number.');
      if (!payment.cardName) return alert('Enter the name on card.');
      if (!payment.expiry || payment.expiry.length < 5) return alert('Enter a valid expiration date.');
      if (!payment.cvv || payment.cvv.length < 3) return alert('Enter a valid CVV.');
    } else {
      if (!billing.email) return alert('Please enter your email for the donation receipt.');
      if (!payment.cardNumber || payment.cardNumber.replace(/\s/g, '').length < 16) return alert('Enter a valid card number.');
      if (!payment.cardName) return alert('Enter the name on card.');
      if (!payment.expiry || payment.expiry.length < 5) return alert('Enter a valid expiration date.');
      if (!payment.cvv || payment.cvv.length < 3) return alert('Enter a valid CVV.');
    }

    try {
      setSubmitting(true);

      // 1. Create donation record if donation flow
      let donationId = null;
      if (isDonation) {
        const don = await api.post('/donations', {
            donor_name: billing.firstName ? `${billing.firstName} ${billing.lastName}` : payment.cardName,
            amount_cents: donationAmountCents,
            customer_id: customerId || null,
          });
        donationId = don.donation_id;
      }

      // 2. Build receipt line items up front so they're written atomically
      //    when the transaction + receipt are inserted on the server.
      const receiptItems = [];
      if (ticketData) {
        for (const [type, qty] of Object.entries(ticketData.quantities)) {
          if (qty <= 0) continue;
          const base = TICKET_PRICES[type];
          const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
          receiptItems.push({ description: `${TICKET_LABELS[type].name} Ticket`, quantity: qty, unitPriceCents: price });
        }
      }
      for (const evt of eventTicketList) {
        const base = evt.price_cents;
        const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
        receiptItems.push({
          description: `Event: ${evt.title}`,
          subtext: evt.description || evt.event_description || null,
          event_id: evt.event_id || null,
          quantity: evt.quantity || 1,
          unitPriceCents: price,
        });
      }
      for (const item of shopItems) {
        const price = memberDiscount > 0 ? Math.round(item.price_cents * (1 - memberDiscount)) : item.price_cents;
        receiptItems.push({ description: item.item_name, quantity: item.quantity, unitPriceCents: price });
      }
      if (membershipPlan) {
        receiptItems.push({ description: `${membershipPlan.plan_name.charAt(0).toUpperCase() + membershipPlan.plan_name.slice(1)} Membership (Annual)`, quantity: 1, unitPriceCents: membershipPlan.price_cents });
      }
      if (isDonation) {
        receiptItems.push({ description: `Donation — ${donationData.fund}`, quantity: 1, unitPriceCents: donationAmountCents });
      }

      // 3. Build sale_items up front so the transaction endpoint inserts them
      // and decrements inventory atomically in a single call. This matters
      // for guest checkout — the separate POST /sale-items + PATCH /decrement
      // endpoints are staff-only, so guests previously failed at step 5.
      const saleItemsPayload = shopItems.map(item => {
        const price = memberDiscount > 0 ? Math.round(item.price_cents * (1 - memberDiscount)) : item.price_cents;
        return {
          item_id: item.item_id,
          quantity: item.quantity,
          price_at_sale_cents: price,
        };
      });

      const transaction = await createTransaction({
        totalAmountCents: totalCents,
        customerId: customerId || null,
        guestEmail: authMode === 'guest' ? billing.email : null,
        isDonation,
        donationId,
        sale_items: saleItemsPayload,
        receipt: {
          email: billing.email || user?.email || '',
          customer_name: `${billing.firstName} ${billing.lastName}`.trim() || payment.cardName,
          line_items: receiptItems,
          subtotal_cents: subtotalCents,
          tax_cents: taxCents,
          total_cents: totalCents,
          is_donation: isDonation,
          donation_fund: donationData?.fund || null,
        },
      });

      // 3. Create tickets
      if (ticketData) {
        const ticketRows = [];
        for (const [type, qty] of Object.entries(ticketData.quantities)) {
          if (qty <= 0) continue;
          const base = TICKET_PRICES[type];
          const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
          for (let i = 0; i < qty; i++) {
            ticketRows.push({
              customer_id: customerId || null,
              type,
              price_cents: price,
              transaction_id: transaction.transaction_id,
              event_id: null, // admission only
            });
          }
        }
        if (ticketRows.length > 0) {
          await api.post('/tickets', { tickets: ticketRows });
        }
      }

      // 4. Create event tickets
      if (eventTicketList.length > 0) {
        const eventTicketRows = [];
        for (const evt of eventTicketList) {
          const base = evt.price_cents;
          const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
          const quantity = evt.quantity || 1;
          
          for (let i = 0; i < quantity; i++) {
            eventTicketRows.push({
              customer_id: customerId || null,
              type: 'event',
              price_cents: price,
              transaction_id: transaction.transaction_id,
              event_id: evt.event_id,
            });
          }
          
          // tickets_sold count is auto-incremented server-side in POST /api/tickets
        }
        await api.post('/tickets', { tickets: eventTicketRows });
      }

      // 5. Shop items + inventory decrement already handled atomically
      // inside createTransaction() via the sale_items payload above.

      // 5b+6: Membership + billing are "nice to have" after the money
      // already moved. If either fails, the user's tickets are already
      // valid — don't bail out of the whole checkout and show a scary
      // alert. Just log and continue to the receipt screen.
      if (membershipPlan && customerId) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (membershipPlan.duration_days || 365));
        try {
            await api.patch('/customers/me/membership', {
                is_member: 1,
                membership_type: membershipPlan.plan_name,
                membership_start: startDate.toISOString().split('T')[0],
                membership_end: endDate.toISOString().split('T')[0],
            });
        } catch (e) {
            console.warn('Non-fatal: membership update failed after checkout.', e);
        }
      }

      if (customerId) {
        try {
            await api.patch('/customers/me/billing', {
                billing_street: billing.street,
                billing_city:   billing.city,
                billing_state:  billing.state,
                billing_zip:    billing.zip,
                billing_phone:  billing.phone,
                shipping_same_as_billing: sameAsBilling,
                ...(sameAsBilling ? {} : {
                    shipping_street: shipping.street,
                    shipping_city:   shipping.city,
                    shipping_state:  shipping.state,
                    shipping_zip:    shipping.zip,
                    shipping_phone:  shipping.phone,
                }),
            });
        } catch (e) {
            console.warn('Non-fatal: billing save failed after checkout.', e);
        }
      }

      // Cleanup (receipt was written atomically with the transaction above)
      localStorage.removeItem('zooCart');

      setOrderTransaction(transaction);
      setOrderComplete(true);

    } catch (err) {
      console.error('Checkout failed:', err);
      alert('Checkout failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const CheckoutFooter = () => (
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-section footer-brand">
              <div className="footer-logo">
                <div className="logo-placeholder">
                  <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
                </div>
              </div>
              <p className="footer-description" style={{color:"white"}}>
                Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.
              </p>
            </div>

            <div className="footer-section">
              <h3 className="footer-title">Contact Us</h3>
              <div className="footer-contact-info">
                <div className="contact-item">
                  <FaMapMarkerAlt className="contact-icon" style={{color:"white"}} />
                  <div>
                    <p>4302 University Dr</p>
                    <p>Houston, TX 77004</p>
                  </div>
                </div>
                <div className="contact-item">
                  <FaPhone className="contact-icon" style={{color:"white"}} />
                  <a href="tel:5555555555">555-555-5555</a>
                </div>
                <div className="contact-item">
                  <FaEnvelope className="contact-icon" style={{color:"white"}}/>
                  <a href="mailto:info@coogzoo.org">info@coogzoo.org</a>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-bottom-content" style={{color:"white"}}>
              <p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>    
  );
  // ══════════════════════════════════════
  // Order complete screen
  // ══════════════════════════════════════
  if (orderComplete) {
    return (
      <div className="checkout-page">
        <div className="checkout-wrapper">
          <div className="checkout-success glass-panel">
            <FaCheckCircle size={64} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
            <h2>{isDonation ? 'Thank You for Your Donation!' : 'Order Confirmed!'}</h2>
            <p style={{ color: 'var(--color-text-muted)', margin: '12px 0 8px' }}>
              {isDonation
                ? `Your generous donation of ${fmt(donationAmountCents)} has been received.`
                : `Your order total was ${fmt(totalCents)}.`
              }
            </p>
            {billing.email && (
              <p style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>
                A confirmation receipt has been sent to <strong style={{ color: 'rgb(0, 0, 0)' }}>{billing.email}</strong>.
              </p>
            )}
            {orderTransaction && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                Transaction #{orderTransaction.transaction_id}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {user && (
                <button className="glass-button" onClick={() => navigate('/dashboard/customer')}>
                  Go to Dashboard
                </button>
              )}
              <button className="glass-button"
                      onClick={() => navigate('/')}>
                Return Home
              </button>
            </div>
          </div>
        </div>
        <CheckoutFooter />
      </div>
    );
  }

  // ══════════════════════════════════════
  // No items guard (non-donation)
  // ══════════════════════════════════════
  const hasCartItems = ticketData || eventTicketList.length > 0 || shopItems.length > 0 || membershipPlan;
  if (!isDonation && !hasCartItems) {
    return (
      <div className="checkout-page">
        <Navbar/>
        <div className="checkout-wrapper">
          <div className="checkout-empty glass-panel">
            <FaTimesCircle size={48} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <h2>Nothing to Check Out</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Select tickets or items before heading to checkout.
            </p>
            <button className="glass-button" style={{ marginTop: '16px' }} onClick={() => navigate('/tickets')}>
              Browse Tickets
            </button>
          </div>
        </div>
          <CheckoutFooter />
      </div>
    );
  }

  // ══════════════════════════════════════
  // Main checkout render
  // ══════════════════════════════════════
  return (
    <div className="checkout-page">
      <Navbar/>
      <div className="checkout-wrapper">
        {/* ── Left column: forms ── */}
        <div className="checkout-forms">
          {/* Header */}
          <div className="checkout-header">
            <h1>{isDonation ? <><FaHeart style={{ color: '#ef4444' }} /> Make a Donation</> : <><FaShoppingCart /> Checkout</>}</h1>
          </div>

          {/* Membership + other items — recommend buying membership first to unlock the discount */}
          {membershipPlan && (ticketData || eventTicketList.length > 0 || shopItems.length > 0) && memberDiscount === 0 && (
            <div className="glass-panel" style={{ padding: '14px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '10px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FaCrown style={{ color: '#f59e0b', flexShrink: 0, fontSize: '20px' }} />
              <div style={{ fontSize: '0.9rem', color: '#92400e' }}>
                <strong>Tip: check out your membership first.</strong> Your member discount (10-20% off tickets & shop) only applies once the membership is active — so buy the membership on its own, then come back for tickets and shop items to save.
              </div>
            </div>
          )}

          {/* Auth banner — only show if not logged in and not yet chosen */}
          {!user && authMode === null && (
            <div className="glass-panel auth-banner">
              <p>Have an account? Sign in for faster checkout{!isDonation && ' and member discounts'}.</p>
              <div className="auth-banner-actions">
                <button className="glass-button" onClick={() => setAuthMode('login')} style={{ background: 'rgb(123, 144, 79)', color:'white' }}>
                  Sign In
                </button>
                <button className="glass-button" onClick={() => setAuthMode('guest')} style={{ background: 'rgb(123, 144, 79)', color:'white' }}>
                  Continue as Guest
                </button>
              </div>
            </div>
          )}

          {/* Inline login form */}
          {authMode === 'login' && !user && (
            <div className="glass-panel auth-login-form">
              <h3>Sign in to your account</h3>
              {loginError && <div className="form-error">{loginError}</div>}
              <form onSubmit={handleLogin}>
                <div className="form-row-2col">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="your@email.com" required />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" required />
                  </div>
                </div>
                <div className="auth-login-actions">
                  <button type="submit" className="glass-button" disabled={loginLoading}>
                    {loginLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                  <Link to="/signup" className="glass-button ghost" style={{ textDecoration: 'none', textAlign: 'center' }}>
                    Create Account
                  </Link>
                  <button type="button" className="text-link" onClick={() => setAuthMode('guest')}>
                    Continue as guest instead
                  </button>
                </div>
                <Link to="/forgot-password" className="text-link" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Forgot password?
                </Link>
              </form>
            </div>
          )}

          {/* Logged in banner */}
          {user && customer && (
            <div className="glass-panel auth-logged-in">
              <p>Welcome back, <strong>{customer.first_name || 'Member'}</strong>!
                {!isDonation && memberDiscount > 0 && (
                  <span className="member-badge">
                    <FaCrown /> {Math.round(memberDiscount * 100)}% member discount applied
                  </span>
                )}
              </p>
            </div>
          )}

          {/* ── Billing ── */}
          {(authMode === 'guest' || authMode === 'logged-in' || user) && (
            <>
              <div className="glass-panel form-section">
                <h2><FaEnvelope style={{ marginRight: '8px' }} /> {isDonation ? 'Donor Information' : 'Billing Information'}</h2>
                <div className="form-row-2col">
                  <div className="form-group">
                    <label>First Name <span className="req">*</span></label>
                    <input name="firstName" value={billing.firstName} onChange={handleBillingChange} placeholder="First name" required />
                  </div>
                  <div className="form-group">
                    <label>Last Name <span className="req">*</span></label>
                    <input name="lastName" value={billing.lastName} onChange={handleBillingChange} placeholder="Last name" required />
                  </div>
                </div>
                <div className="form-group full">
                  <label>Email <span className="req">*</span></label>
                  <input type="email" name="email" value={billing.email} onChange={handleBillingChange} placeholder="your@email.com" required />
                </div>
                {!isDonation && (
                  <div className="form-group full">
                    <label>Confirm Email <span className="req">*</span></label>
                    <input type="email" name="confirmEmail" value={billing.confirmEmail} onChange={handleBillingChange} placeholder="Confirm email" required />
                  </div>
                )}
                {!isDonation && (
                  <>
                    <div className="form-group full">
                      <label>Street Address <span className="req">*</span></label>
                      <input name="street" value={billing.street} onChange={handleBillingChange} placeholder="Street address" required />
                    </div>
                    <div className="form-row-2col">
                      <div className="form-group">
                        <label>City <span className="req">*</span></label>
                        <input name="city" value={billing.city} onChange={handleBillingChange} placeholder="City" required />
                      </div>
                      <div className="form-group">
                        <label>State <span className="req">*</span></label>
                        <select name="state" value={billing.state} onChange={handleBillingChange}>
                          <option value="">Select a state</option>
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row-2col">
                      <div className="form-group">
                        <label>Zip Code <span className="req">*</span></label>
                        <input name="zip" value={billing.zip} onChange={handleBillingChange} placeholder="Zip code" required />
                      </div>
                      <div className="form-group">
                        <label>Phone <span className="req">*</span></label>
                        <input type="tel" name="phone" value={billing.phone} onChange={handleBillingChange} placeholder="(123) 456-7890" required />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── Shipping (non-donation only) ── */}
              {!isDonation && (
                <div className="glass-panel form-section">
                  <h2>Shipping Information</h2>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={sameAsBilling} onChange={() => setSameAsBilling(!sameAsBilling)} />
                    <span>Same as billing address</span>
                  </label>
                  {!sameAsBilling && (
                    <>
                      <div className="form-row-2col">
                        <div className="form-group">
                          <label>First Name <span className="req">*</span></label>
                          <input name="firstName" value={shipping.firstName} onChange={handleShippingChange} placeholder="First name" required />
                        </div>
                        <div className="glass-panel form-group">
                          <label>Last Name <span className="req">*</span></label>
                          <input name="lastName" value={shipping.lastName} onChange={handleShippingChange} placeholder="Last name" required />
                        </div>
                      </div>
                      <div className="form-group full">
                        <label>Street Address <span className="req">*</span></label>
                        <input name="street" value={shipping.street} onChange={handleShippingChange} placeholder="Street address" required />
                      </div>
                      <div className="form-row-2col">
                        <div className="form-group">
                          <label>City <span className="req">*</span></label>
                          <input name="city" value={shipping.city} onChange={handleShippingChange} placeholder="City" required />
                        </div>
                        <div className="form-group">
                          <label>State <span className="req">*</span></label>
                          <select name="state" value={shipping.state} onChange={handleShippingChange}>
                            <option value="">Select a state</option>
                            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-row-2col">
                        <div className="form-group">
                          <label>Zip Code <span className="req">*</span></label>
                          <input name="zip" value={shipping.zip} onChange={handleShippingChange} placeholder="Zip code" required />
                        </div>
                        <div className="form-group">
                          <label>Phone <span className="req">*</span></label>
                          <input type="tel" name="phone" value={shipping.phone} onChange={handleShippingChange} placeholder="(123) 456-7890" required />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Payment ── */}
              <div className="glass-panel form-section">
                <h2><FaCreditCard style={{ marginRight: '8px' }} /> Payment</h2>
                <div className="form-group full">
                  <label>Card Number <span className="req">*</span></label>
                  <input name="cardNumber" value={payment.cardNumber} onChange={handlePaymentChange} placeholder="1234 5678 9012 3456" maxLength={19} required />
                </div>
                <div className="form-group full">
                  <label>Name on Card <span className="req">*</span></label>
                  <input name="cardName" value={payment.cardName} onChange={handlePaymentChange} placeholder="As it appears on card" required />
                </div>
                <div className="form-row-2col">
                  <div className="form-group">
                    <label>Expiry <span className="req">*</span></label>
                    <input name="expiry" value={payment.expiry} onChange={handlePaymentChange} placeholder="MM/YY" maxLength={5} required />
                  </div>
                  <div className="form-group">
                    <label>CVV <span className="req">*</span></label>
                    <input type="password" name="cvv" value={payment.cvv} onChange={handlePaymentChange} placeholder="123" maxLength={4} required />
                  </div>
                </div>
                <div className="secure-note">
                  <FaLock /> Your payment information is secure and encrypted.
                </div>
              </div>

              {/* ── Place order (mobile) ── */}
              <button
                className="place-order-btn mobile-only"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : isDonation ? `Donate ${fmt(totalCents)}` : `Pay ${fmt(totalCents)}`}
              </button>
            </>
          )}
        </div>

        {/* ── Right column: order summary ── */}
        <div className="checkout-summary">
          <div className="glass-panel summary-panel">
            <h2 className="summary-title">
              {isDonation ? 'Donation Summary' : 'Order Summary'}
            </h2>

            {/* Donation amount */}
            {isDonation && (
              <div className="summary-section">
                <div className="summary-line">
                  <span><FaHeart style={{ color: '#ef4444', marginRight: '6px' }} />
                    {donationData.fund === 'general' && 'General Donation'}
                    {donationData.fund === 'animal' && 'Animal Wellbeing'}
                    {donationData.fund === 'conservation' && 'Conservation Fund'}
                  </span>
                  <span>{fmt(donationAmountCents)}</span>
                </div>
              </div>
            )}

            {/* Admission tickets */}
            {ticketData && (
              <div className="summary-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="summary-section-label" style={{ margin: 0 }}>Admission Tickets</h3>
                  <button onClick={removeTickets} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', fontSize: '14px' }} title="Remove tickets"><FaTimesCircle /></button>
                </div>
                {ticketData.date && (
                  <div className="summary-meta">
                    {typeof ticketData.date === 'string'
                      ? ticketData.date
                      : ticketData.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {ticketData.time && ` at ${ticketData.time}`}
                  </div>
                )}
                {Object.entries(ticketData.quantities).map(([type, qty]) => {
                  if (qty <= 0) return null;
                  const base = TICKET_PRICES[type];
                  const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
                  const label = TICKET_LABELS[type];
                  const Icon = label.icon;
                  return (
                    <div key={type} className="summary-line">
                      <span><Icon className="summary-icon" /> {label.name} x{qty}</span>
                      <span>
                        {memberDiscount > 0 && <span className="original-price">{fmt(base * qty)}</span>}
                        {fmt(price * qty)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Event tickets */}
            {eventTicketList.length > 0 && (
              <div className="summary-section">
                <h3 className="summary-section-label">Event Tickets</h3>
                {eventTicketList.map(evt => {
                  const base = evt.price_cents;
                  const price = memberDiscount > 0 ? Math.round(base * (1 - memberDiscount)) : base;
                  const qty = evt.quantity || 1;
                  return (
                    <div key={evt.event_id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div className="summary-meta" style={{ margin: 0 }}>{evt.title} — {evt.date}{evt.venue ? ` @ ${evt.venue}` : ''}</div>
                        <button onClick={() => removeEventTicket(evt.event_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', fontSize: '14px' }} title="Remove event ticket"><FaTimesCircle /></button>
                      </div>
                      <div className="summary-line">
                        <span><FaTag className="summary-icon" /> x{qty}</span>
                        <span>
                          {memberDiscount > 0 && <span className="original-price">{fmt(base * qty)}</span>}
                          {fmt(price * qty)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="summary-note">Includes zoo admission</div>
              </div>
            )}

            {/* Shop items */}
            {shopItems.length > 0 && (
              <div className="summary-section">
                <h3 className="summary-section-label">Gift Shop</h3>
                {shopItems.map(item => {
                  const price = memberDiscount > 0 ? Math.round(item.price_cents * (1 - memberDiscount)) : item.price_cents;
                  return (
                    <div key={item.item_id} className="summary-line">
                      <span>
                        <button onClick={() => removeShopItem(item.item_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 6px 0 0', fontSize: '12px' }} title="Remove item"><FaTimesCircle /></button>
                        {item.item_name} x{item.quantity}
                      </span>
                      <span>
                        {memberDiscount > 0 && <span className="original-price">{fmt(item.price_cents * item.quantity)}</span>}
                        {fmt(price * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Membership */}
            {membershipPlan && (
              <div className="summary-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="summary-section-label" style={{ margin: 0 }}>Membership</h3>
                  <button onClick={removeMembership} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', fontSize: '14px' }} title="Remove membership"><FaTimesCircle /></button>
                </div>
                <div className="summary-line">
                  <span><FaCrown className="summary-icon" /> {membershipPlan.plan_name.charAt(0).toUpperCase() + membershipPlan.plan_name.slice(1)} Plan (Annual)</span>
                  <span>{fmt(membershipPlan.price_cents)}</span>
                </div>
                <div className="summary-note">{Math.round((membershipPlan.discount_rate || 0) * 100)}% discount on future purchases</div>
              </div>
            )}

            {/* Totals */}
            <div className="summary-totals">
              {!isDonation && (
                <>
                  <div className="summary-line">
                    <span>Subtotal</span>
                    <span>{fmt(subtotalCents)}</span>
                  </div>
                  <div className="summary-line">
                    <span>Tax (8.25%)</span>
                    <span>{fmt(taxCents)}</span>
                  </div>
                </>
              )}
              {!isDonation && memberDiscount > 0 && (
                <div className="summary-line discount-line">
                  <span><FaCrown /> Member Discount ({Math.round(memberDiscount * 100)}%)</span>
                  <span>Applied</span>
                </div>
              )}
              <div className="summary-line grand-total">
                <span>Total</span>
                <span>{fmt(totalCents)}</span>
              </div>
            </div>

            {/* Place order button (desktop) */}
            {(authMode === 'guest' || authMode === 'logged-in' || user) && (
              <button
                className="place-order-btn"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : isDonation ? `Donate ${fmt(totalCents)}` : `Pay ${fmt(totalCents)}`}
              </button>
            )}
          </div>
        </div>
      </div>
      <CheckoutFooter />   
    </div>
  );
}

// ── US States list ──
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

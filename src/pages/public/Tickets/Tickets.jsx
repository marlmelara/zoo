import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaCalendarAlt, FaUser, FaChild, FaMapMarkerAlt, FaPhone, FaEnvelope, FaMinus, FaPlus, FaClock, FaTicketAlt, FaShoppingCart, FaStar, FaArrowLeft } from 'react-icons/fa';
import { FaPersonCane } from "react-icons/fa6";
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getUpcomingEvents } from '../../../api/public';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';
import './tickets.css';
import logo from '../../../images/logo.png';

let dayTime = new Date();

export default function Tickets() {
  document.title = 'Tickets - Coog Zoo';

  const navigate = useNavigate();
  const { user, role, customerId } = useAuth();
  const cartHook = useZooCart();
  const [cartOpen, setCartOpen] = useState(false);

  // Customer profile for welcome message
  const [customerName, setCustomerName] = useState('');
  const [membershipType, setMembershipType] = useState(null);

  useEffect(() => {
    if (!user || !customerId) return;
    supabase.from('customers').select('first_name, membership_type, membership_end')
      .eq('customer_id', customerId).single()
      .then(({ data }) => {
        if (data) {
          setCustomerName(data.first_name || '');
          if (data.membership_type && data.membership_end && new Date(data.membership_end) >= new Date()) {
            setMembershipType(data.membership_type);
          }
        }
      });
  }, [user, customerId]);

  useEffect(() => {
    const saved = localStorage.getItem('selectedMembership');
    if (saved) {
      const plan = JSON.parse(saved);
      cartHook.setMembership({
        plan_name: plan.type,
        price_cents: plan.price_cents,
        discount_rate: plan.discount,
        duration_days: plan.duration_days,
      });
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [quantities, setQuantities] = useState({ adult: 0, youth: 0, senior: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    getUpcomingEvents(20).then(events => {
      setUpcomingEvents(events.filter(e => e.ticket_price_cents > 0));
    }).catch(console.error).finally(() => setEventsLoading(false));
  }, []);

  const [currentYear, setCurrentYear] = useState(dayTime.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(dayTime.getMonth());

  const timeSlots = [
    '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
  ];

  const handleQuantityChange = (type, change) => {
    setQuantities(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + change)
    }));
  };

  const getTotalTickets = () => quantities.adult + quantities.youth + quantities.senior;

  const getTotalPrice = () => {
    const prices = { adult: 24.99, youth: 17.99, senior: 19.99 };
    return (quantities.adult * prices.adult) + (quantities.youth * prices.youth) + (quantities.senior * prices.senior);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonthIndex, 1);
    const lastDay = new Date(currentYear, currentMonthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonthIndex, i);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();
      const isPast = date < new Date() && date.toDateString() !== new Date().toDateString();
      days.push({ day: i, date, isToday, isSelected, isPast });
    }
    return days;
  };

  const handleDateSelect = (day) => {
    if (day && !day.isPast) { setSelectedDate(day.date); setSelectedTime(null); }
  };

  const handleTimeSelect = (time) => setSelectedTime(time);

  // Add admission tickets to unified cart
  const handleAddAdmissionToCart = () => {
    if (!selectedDate) return alert('Please select a date');
    if (!selectedTime) return alert('Please select a time');
    if (getTotalTickets() === 0) return alert('Please select at least one ticket');

    const dateLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    cartHook.setAdmission({ date: dateLabel, time: selectedTime, quantities: { ...quantities } });
    setCartOpen(true);
  };

  // Add event ticket to unified cart
  const handleAddEventToCart = (event) => {
    const formatTime = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':');
      const hr = parseInt(h);
      return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    };
    cartHook.addEvent({
      event_id: event.event_id,
      title: event.title || event.event_name,
      date: new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      venue: event.venues?.venue_name || null,
      time: event.start_time ? `${formatTime(event.start_time)}${event.end_time ? ` – ${formatTime(event.end_time)}` : ''}` : null,
      price_cents: event.ticket_price_cents,
    });
    setCartOpen(true);
  };

  // Membership plans
  const MEMBERSHIP_PLANS = [
    { type: 'explorer', name: 'Explorer', price_cents: 8999, discount: 0.10, duration_days: 365, featured: false },
    { type: 'family', name: 'Family', price_cents: 14999, discount: 0.15, duration_days: 365, featured: true },
    { type: 'premium', name: 'Premium', price_cents: 24999, discount: 0.20, duration_days: 365, featured: false },
  ];

  useEffect(() => {
    if (cartHook.cart.membership) {
      const matchingPlan = MEMBERSHIP_PLANS.find(
        (p) => p.type === cartHook.cart.membership.plan_name
      );

      if (matchingPlan) {
        localStorage.setItem('selectedMembership', JSON.stringify(matchingPlan));
      }
    } else {
      localStorage.removeItem('selectedMembership');
    }
  }, [cartHook.cart.membership]);

  const handleSelectMembership = (plan) => {
    localStorage.setItem('selectedMembership', JSON.stringify(plan));
    if (!user) {
      navigate('/account');
      return;
    }
    cartHook.setMembership({
      plan_name: plan.type,
      price_cents: plan.price_cents,
      discount_rate: plan.discount,
      duration_days: plan.duration_days,
    });
    setCartOpen(true);
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="tickets-page" style={{ margin: 0, padding: 0 }}>
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Tickets & Membership</h2>
          </div>
          <div className="navbar-links">
            <Link to="/shop" className="navbar-link">Shop</Link>
            <Link to="/membership" className="navbar-link">Membership</Link>
            <Link to="/account" className="navbar-link">Customer Login</Link>
            <Link to="/login" className="navbar-link">Staff Portal</Link>
          </div>
        </div>
      </nav>

      <div className="tickets-container">
        {/* Left Column */}
        <div className="tickets-left" style = {{padding: '2rem'}}>
          {/* Member / Welcome Banner */}
          {user && role === 'customer' ? (
            <div className="member-banner glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Welcome, {customerName || 'Member'}!</p>
                {membershipType ? (
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#e3d367' }}>
                    <FaStar style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    <span style={{ textTransform: 'capitalize' }}>{membershipType}</span> member — enjoy your discounts!
                  </p>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                    Become a member below for discounts on tickets and shop items!
                  </p>
                )}
              </div>
              <button className="glass-button" onClick={() => navigate('/dashboard/customer')} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                My Account
              </button>
            </div>
          ) : (
            <div className="member-banner glass-panel">
              <p>Coog Zoo Members log in now to reserve free admission and check out other great benefits!</p>
              <a href="/account" className="glass-button" style={{ fontSize: '0.9rem' }}>Log In</a>
            </div>
          )}

          {/* Ticket Pricing Table */}
          <div className="glass-panel tickets-table">
            <div className="table-header">
              <div className="header-cell ticket-type">Ticket Type</div>
              <div className="header-cell price">Price</div>
              <div className="header-cell quantity">Quantity</div>
            </div>
            {[
              { type: 'adult', label: 'Adult', age: '(Ages 12-64)', price: '$24.99', Icon: FaUser },
              { type: 'youth', label: 'Youth', age: '(Ages 3-11)', price: '$17.99', Icon: FaChild },
              { type: 'senior', label: 'Senior', age: '(Ages 65+)', price: '$19.99', Icon: FaPersonCane },
            ].map(({ type, label, age, price, Icon }) => (
              <div key={type} className="table-row">
                <div className="table-cell ticket-type">
                  <Icon className="ticket-icon" />
                  <div className="ticket-info">
                    <span className="ticket-name">{label}</span>
                    <span className="ticket-age">{age}</span>
                  </div>
                </div>
                <div className="table-cell price">{price}</div>
                <div className="table-cell quantity">
                  <div className="quantity-controls">
                    <button className="quantity-btn" onClick={() => handleQuantityChange(type, -1)} disabled={quantities[type] === 0} ><FaMinus /></button>
                    <span className="quantity-number">{quantities[type]}</span>
                    <button className="quantity-btn" onClick={() => handleQuantityChange(type, 1)}><FaPlus /></button>
                  </div>
                </div>
              </div>
            ))}
            <div className="table-footer">
              <div className="infant-note">Children 2 and under always get free admission - no ticket required!</div>
            </div>
          </div>

          {/* Membership Plans */}
          <div className="glass-panel membership-card">
            <div className="membership-header">
              <h2 className="membership-title">Annual Membership Plans</h2>
              <button className="glass-button" onClick={() => navigate('/membership')} style={{ background:'rgb(123, 144, 79)', color: 'white', marginLeft: 'auto'}}>
                Learn More
              </button>
            </div>
            <p className="membership-description">Unlimited visits, free parking, and discounts on tickets and shop items.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '16px 0' }}>
              {MEMBERSHIP_PLANS.map(plan => {
                const isSelected = cartHook.cart.membership?.plan_name === plan.type;
                const isCurrentPlan = membershipType === plan.type;
                return (
                  <div key={plan.type} style={{
                    background: plan.featured ? 'rgba(209, 146, 51, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: isSelected ? '2px solid rgba(121, 162, 128, 0.35)' : plan.featured ? '2px solid var(--color-secondary)' : '2px solid rgba(121, 162, 128, 0.35)',
                    borderRadius: '12px', padding: '16px', textAlign: 'center', position: 'relative',
                  }}>
                    {plan.featured && (
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-secondary)', color: 'white', padding: '2px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>Best Value</div>
                    )}
                    <h3 style={{ margin: '8px 0 4px', fontSize: '1.1rem', textTransform: 'capitalize' }}>{plan.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{Math.round(plan.discount * 100)}% off all purchases</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      ${(plan.price_cents / 100).toFixed(2)}
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>/yr</span>
                    </div>
                    {isCurrentPlan ? (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(16,185,129,0.15)', borderRadius: '8px', fontSize: '0.8rem', color: '#12714b', fontWeight: 600 }}>
                        Current Plan
                      </div>
                    ) : (
                      <button
                        className="glass-button"
                        onClick={() => handleSelectMembership(plan)}
                        style={{ color: 'white', marginTop: '12px', width: '100%', padding: '10px', background: isSelected ? 'var(--color-secondary)' : plan.featured ? 'rgb(123, 144, 79)' : 'rgb(123, 144, 79)', fontSize: '0.85rem' }}
                      >
                        {isSelected ? 'In Cart' : 'Select Plan'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'black', marginTop: '10px', textAlign: 'center' }}>
              {user ? 'Select a plan and proceed to checkout.' : 'You must be signed in or create an account to purchase a membership.'} Membership discounts (10-20% off) apply to future ticket and shop purchases.
            </p>
          </div>

          {/* Event Tickets */}
          <div className="glass-panel" style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.5)' }}>
            <h2 style={{ marginBottom: '4px' }}>Event Tickets</h2>
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Event tickets include zoo admission — no separate admission ticket needed.
            </p>
            {eventsLoading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading events...</p>
            ) : upcomingEvents.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No upcoming ticketed events at this time.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingEvents.map(event => {
                  const formatTime = (t) => {
                    if (!t) return '';
                    const [h, m] = t.split(':');
                    const hr = parseInt(h);
                    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                  };
                  const inCart = cartHook.cart.events[event.event_id];
                  return (
                    <div key={event.event_id} style={{
                      background: inCart ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                      border: inCart ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px', padding: '14px 16px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ color: 'var(--zoo-muted)', fontWeight: 600, marginBottom: '4px' }}>{event.title || event.event_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <span><FaCalendarAlt style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {event.start_time && event.end_time && (
                            <span><FaClock style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            </span>
                          )}
                          {event.venues?.venue_name && (
                            <span><FaMapMarkerAlt style={{ marginRight: '4px', verticalAlign: 'middle' }} />{event.venues.venue_name}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'rgb(123, 144, 79)', fontSize: '1rem' }}>
                          ${(event.ticket_price_cents / 100).toFixed(2)}
                        </span>
                        {inCart ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button className="glass-button" style={{ color: 'var(--color-secondary)', border: 'none', background: 'rgba(123, 144, 79, 0.15)', padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => cartHook.updateEventQty(event.event_id, -1)}>
                              <FaMinus size={10} />
                            </button>
                            <span style={{ color: 'var(--color-secondary)', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{inCart.quantity}</span>
                            <button className="glass-button" style={{ color: 'var(--color-secondary)', border: 'none', background: 'rgba(123, 144, 79, 0.15)', padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => cartHook.updateEventQty(event.event_id, 1)}>
                              <FaPlus size={10} />
                            </button>
                          </div>
                        ) : (
                          <button className="glass-button"
                            style={{ color: 'var(--color-secondary)', border: 'none', background: 'rgba(123, 144, 79, 0.15)', padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleAddEventToCart(event)}>
                            <FaPlus style={{ marginRight: '5px' }} /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Calendar */}
        <div className="tickets-right">
          <div className="glass-panel calendar-card">
            <h3 className="calendar-title"><FaCalendarAlt className="calendar-icon" /> Select Date & Time</h3>
            <div className="calendar-header">
              <button className="month-nav" onClick={() => { if (currentMonthIndex > 0) setCurrentMonthIndex(currentMonthIndex - 1); }} disabled={currentMonthIndex === 0}>←</button>
              <span className="current-month">{new Date(currentYear, currentMonthIndex).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
              <button className="month-nav" onClick={() => { if (currentMonthIndex < 11) setCurrentMonthIndex(currentMonthIndex + 1); }} disabled={currentMonthIndex === 11}>→</button>
            </div>
            <div className="calendar-grid">
              {weekDays.map(day => (<div key={day} className="calendar-weekday">{day}</div>))}
              {calendarDays.map((day, index) => (
                <div key={index}
                  className={`calendar-day ${day ? 'has-date' : 'empty'} ${day?.isSelected ? 'selected' : ''} ${day?.isToday ? 'today' : ''} ${day?.isPast ? 'past' : ''}`}
                  onClick={() => handleDateSelect(day)}>
                  {day && <span className="day-number">{day.day}</span>}
                </div>
              ))}
            </div>

            {selectedDate && (
              <div className="time-slots">
                <h4 className="time-slots-title">Select Time</h4>
                <div className="time-slots-grid">
                  {timeSlots.map(time => (
                    <button key={time} className={`time-slot ${selectedTime === time ? 'selected' : ''}`} onClick={() => handleTimeSelect(time)}>{time}</button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate && selectedTime && (
              <div className="selected-summary">
                <p className="selected-date"><strong>Selected:</strong> {formatDate(selectedDate)} at {selectedTime}</p>
              </div>
            )}

            <div className="checkout-section">
              <div className="total-tickets"><span>Total Tickets: </span><span className="total-number">{getTotalTickets()}</span></div>
              <div className="total-price"><span>Total Price: </span><span className="price-amount">${getTotalPrice().toFixed(2)}</span></div>
              <button className="checkout-button glass-button" onClick={handleAddAdmissionToCart}>
                <FaShoppingCart style={{ marginRight: '8px', color: '#1f2937' }} /> Add to Cart
              </button>
            </div>
          </div>

          {/* Cart summary mini-widget */}
          {cartHook.totalItems > 0 && (
            <div className="glass-panel" style={{ padding: '16px', marginTop: '16px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.5)' }} onClick={() => setCartOpen(true)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#ffbf69' }}>
                  <FaShoppingCart /> {cartHook.totalItems} item{cartHook.totalItems !== 1 ? 's' : ''} in cart
                </span>
                <span style={{ fontWeight: 700, color: 'rgb(123, 144, 79)' }}>
                  ${(cartHook.totalCents / 100).toFixed(2)}
                </span>
              </div>
              <button className="glass-button" style={{ color: 'white', width: '100%', marginTop: '10px', background: 'rgb(123, 144, 79)', padding: '10px', fontWeight: 600 }}>
                View Cart & Checkout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating cart button */}
      {cartHook.totalItems > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'rgb(123, 144, 79)', border: 'none',
          color: 'white', cursor: 'pointer', fontSize: '22px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(27, 27, 27, 0.4)', zIndex: 100,
        }}>
          <FaShoppingCart />
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', borderRadius: '50%',
            width: '22px', height: '22px', fontSize: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>{cartHook.totalItems}</span>
        </button>
      )}

      {/* Cart Panel */}
      <ShopCartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} {...cartHook} />

      {/* Footer */}
      <footer className="footer" style={{background: "rgb(123, 144, 79)"}}>
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-section footer-brand">
              <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
              <p className="footer-description" style={{color:"white"}}>Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.</p>
            </div>
            <div className="footer-section">
              <h3 className="footer-title">Contact Us</h3>
              <div className="footer-contact-info">
                <div className="contact-item" style={{color:"white"}}><FaMapMarkerAlt className="contact-icon" style={{color:"white"}} /><div><p>4302 University Dr</p><p>Houston, TX 77004</p></div></div>
                <div className="contact-item" style={{color:"white"}} ><FaPhone className="contact-icon" style={{color:"white"}} /><a href="tel:5555555555">555-555-5555</a></div>
                <div className="contact-item" style={{color:"white"}}><FaEnvelope className="contact-icon" style={{color:"white"}} /><a href="mailto:info@coogzoo.org">info@coogzoo.org</a></div>
              </div>
            </div>
          </div>
          <div className="footer-bottom"><div className="footer-bottom-content" style={{color:"white"}}><p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p></div></div>
        </div>
      </footer>
    </div>
  );
}

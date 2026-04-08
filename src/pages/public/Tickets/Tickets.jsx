import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaUser, FaChild, FaMapMarkerAlt, FaPhone, FaEnvelope, FaMinus, FaPlus, FaClock, FaTicketAlt } from 'react-icons/fa';
import { FaPersonCane } from "react-icons/fa6";
import { getUpcomingEvents } from '../../../api/public';
import './tickets.css';

let dayTime = new Date();

export default function Tickets() {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [quantities, setQuantities] = useState({
    adult: 0,
    youth: 0,
    senior: 0
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    getUpcomingEvents(20).then(events => {
      setUpcomingEvents(events.filter(e => e.ticket_price_cents > 0));
    }).catch(console.error).finally(() => setEventsLoading(false));
  }, []);

  // Generate calendar for March 2026
  const [currentYear, setCurrentYear] = useState(dayTime.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(dayTime.getMonth()); // 2 = March

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

  const getTotalTickets = () => {
    return quantities.adult + quantities.youth + quantities.senior;
  };

  const getTotalPrice = () => {
    const prices = {
      adult: 24.99,
      youth: 17.99,
      senior: 19.99
    };
    return (quantities.adult * prices.adult) + 
           (quantities.youth * prices.youth) + 
           (quantities.senior * prices.senior);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calendar generation
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonthIndex, 1);
    const lastDay = new Date(currentYear, currentMonthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonthIndex, i);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();
      const isPast = date < new Date() && date.toDateString() !== new Date().toDateString();
      
      days.push({
        day: i,
        date: date,
        isToday,
        isSelected,
        isPast
      });
    }
    
    return days;
  };

  const handleDateSelect = (day) => {
    if (day && !day.isPast) {
      setSelectedDate(day.date);
      setSelectedTime(null);
    }
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleCheckout = () => {
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }
    if (!selectedTime) {
      alert('Please select a time');
      return;
    }
    if (getTotalTickets() === 0) {
      alert('Please select at least one ticket');
      return;
    }
    
    // Prepare the ticket data to pass to checkout
    const ticketData = {
      date: selectedDate,
      time: selectedTime,
      quantities: quantities,
      totalTickets: getTotalTickets(),
      totalPrice: getTotalPrice(),
    };
    
    // Navigate to checkout page with the ticket data
    navigate('/checkout', { state: { ticketData } });
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="tickets-page">
      <div className="tickets-container">
        {/* Left Column - Ticket Options */}
        <div className="tickets-left">
          {/* Page Header */}
          <div className="page-header">
            <h1 className="page-title">Tickets & Membership</h1>
            <p className="page-description">
              Plan your visit with admission options, family-friendly pricing, and membership package.
            </p>
          </div>

          {/* Member Banner */}
          <div className="member-banner glass-panel">
            <p>Coog Zoo Members log in now to reserve free admission and check out other great benefits!</p>
            <a href="/account" className="glass-button" style={{ fontSize: '0.9rem' }}>Log In</a>
          </div>

          {/* Ticket Pricing Table */}
          <div className="glass-panel tickets-table">
            <div className="table-header">
              <div className="header-cell ticket-type">Ticket Type</div>
              <div className="header-cell price">Price</div>
              <div className="header-cell quantity">Quantity</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell ticket-type">
                <FaUser className="ticket-icon" />
                <div className="ticket-info">
                  <span className="ticket-name">Adult</span>
                  <span className="ticket-age">(Ages 12-64)</span>
                </div>
              </div>
              <div className="table-cell price">$24.99</div>
              <div className="table-cell quantity">
                <div className="quantity-controls">
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('adult', -1)}
                    disabled={quantities.adult === 0}
                  >
                    <FaMinus />
                  </button>
                  <span className="quantity-number">{quantities.adult}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('adult', 1)}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="table-row">
              <div className="table-cell ticket-type">
                <FaChild className="ticket-icon" />
                <div className="ticket-info">
                  <span className="ticket-name">Youth</span>
                  <span className="ticket-age">(Ages 3-11)</span>
                </div>
              </div>
              <div className="table-cell price">$17.99</div>
              <div className="table-cell quantity">
                <div className="quantity-controls">
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('youth', -1)}
                    disabled={quantities.youth === 0}
                  >
                    <FaMinus />
                  </button>
                  <span className="quantity-number">{quantities.youth}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('youth', 1)}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="table-row">
              <div className="table-cell ticket-type">
                <FaPersonCane className="ticket-icon" />
                <div className="ticket-info">
                  <span className="ticket-name">Senior</span>
                  <span className="ticket-age">(Ages 65+)</span>
                </div>
              </div>
              <div className="table-cell price">$19.99</div>
              <div className="table-cell quantity">
                <div className="quantity-controls">
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('senior', -1)}
                    disabled={quantities.senior === 0}
                  >
                    <FaMinus />
                  </button>
                  <span className="quantity-number">{quantities.senior}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange('senior', 1)}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="table-footer">
              <div className="infant-note">
                Children 2 and under always get free admission - no ticket required!
              </div>
            </div>
          </div>

          {/* Membership Option */}
          <div className="glass-panel membership-card">
            <div className="membership-header">
              <h2 className="membership-title">Annual Membership</h2>
              <div className="membership-badge">Best Value</div>
            </div>
            <p className="membership-description">
              Unlimited visits plus member-exclusive benefits, free parking, and access to special events.
            </p>
            <div className="membership-pricing">
              <span className="membership-price">$89.99</span>
              <span className="membership-period">/ year</span>
            </div>
            <button
              className="glass-button membership-button"
              onClick={() => navigate('/account')}
            >
              Become a Member
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '10px', textAlign: 'center' }}>
              You must be signed in or create an account to purchase a membership. Membership discounts (10–20% off) apply to future ticket and shop purchases.
            </p>
          </div>

          {/* Event Tickets */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '4px' }}>Event Tickets</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
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
                  return (
                    <div key={event.event_id} style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{event.title || event.event_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <span>
                            <FaCalendarAlt style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {event.start_time && event.end_time && (
                            <span>
                              <FaClock style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            </span>
                          )}
                          {event.venues?.venue_name && (
                            <span>
                              <FaMapMarkerAlt style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {event.venues.venue_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '1rem' }}>
                          ${(event.ticket_price_cents / 100).toFixed(2)}
                        </span>
                        <button
                          className="glass-button"
                          style={{ background: 'var(--color-secondary)', padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                          onClick={() => navigate('/checkout', {
                            state: {
                              eventTicket: {
                                event_id: event.event_id,
                                title: event.title || event.event_name,
                                date: new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                                venue: event.venues?.venue_name || null,
                                price_cents: event.ticket_price_cents,
                                quantity: 1,
                              }
                            }
                          })}
                        >
                          <FaTicketAlt style={{ marginRight: '5px' }} /> Buy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Calendar and Time Selection */}
        <div className="tickets-right">
          <div className="glass-panel calendar-card">
            <h3 className="calendar-title">
              <FaCalendarAlt className="calendar-icon" />
              Select Date & Time
            </h3>
            
            <div className="calendar-header">
              <button 
                className="month-nav"
                onClick={() => {
                  if (currentMonthIndex > 0) {
                    setCurrentMonthIndex(currentMonthIndex - 1);
                  }
                }}
                disabled={currentMonthIndex === 0}
              >
                ←
              </button>
              <span className="current-month">
                {new Date(currentYear, currentMonthIndex).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                className="month-nav"
                onClick={() => {
                  if (currentMonthIndex < 11) {
                    setCurrentMonthIndex(currentMonthIndex + 1);
                  }
                }}
                disabled={currentMonthIndex === 11}
              >
                →
              </button>
            </div>

            <div className="calendar-grid">
              {weekDays.map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${day ? 'has-date' : 'empty'} 
                    ${day?.isSelected ? 'selected' : ''} 
                    ${day?.isToday ? 'today' : ''}
                    ${day?.isPast ? 'past' : ''}`}
                  onClick={() => handleDateSelect(day)}
                >
                  {day && <span className="day-number">{day.day}</span>}
                </div>
              ))}
            </div>

            {selectedDate && (
              <div className="time-slots">
                <h4 className="time-slots-title">Select Time</h4>
                <div className="time-slots-grid">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => handleTimeSelect(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate && selectedTime && (
              <div className="selected-summary">
                <p className="selected-date">
                  <strong>Selected:</strong> {formatDate(selectedDate)} at {selectedTime}
                </p>
              </div>
            )}

            <div className="checkout-section">
              <div className="total-tickets">
                <span>Total Tickets: </span>
                <span className="total-number">{getTotalTickets()}</span>
              </div>
              <div className="total-price">
                <span>Total Price: </span>
                <span className="price-amount">${getTotalPrice().toFixed(2)}</span>
              </div>
              <button 
                className="checkout-button glass-button"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-section footer-brand">
                <div className="footer-logo">
                    <div className="logo-placeholder">
                      🦁 Coog Zoo
                    </div>
                </div>
                <p className="footer-description">
                  Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.
                </p>
                </div>
                {/* Contact Information */}
                <div className="footer-section">
                    <h3 className="footer-title">Contact Us</h3>
                      <div className="footer-contact-info">
                        <div className="contact-item">
                          <FaMapMarkerAlt className="contact-icon" />
                          <div>
                            <p>4302 University Dr</p>
                            <p>Houston, TX 77004</p>
                          </div>
                        </div>
                        <div className="contact-item">
                          <FaPhone className="contact-icon" />
                          <a href="tel:5555555555">555-555-5555</a>
                        </div>
                        <div className="contact-item">
                          <FaEnvelope className="contact-icon" />
                          <a href="mailto:info@coogzoo.org">info@coogzoo.org</a>
                        </div>
                      </div>
                  </div>
          </div>
        {/* Copyright Bar */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  </div>
  );
}
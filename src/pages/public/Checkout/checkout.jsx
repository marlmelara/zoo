import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClock, FaUser, FaChild, 
  FaExclamationTriangle, FaSignInAlt, FaUserPlus} from 'react-icons/fa';
import { FaPersonCane } from "react-icons/fa6";

import './checkout.css';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const ticketData = location.state?.ticketData;
  
  // State for login/guest mode
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [continueAsGuest, setContinueAsGuest] = useState(false);
  
  // Form state
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    country: 'United States',
    state: '',
    zipCode: '',
    phone: '',
    mobile: '',
    email: '',
    confirmEmail: ''
  });
  
  const [shippingInfo, setShippingInfo] = useState({
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    country: 'United States',
    state: '',
    zipCode: '',
    phone: '',
    mobile: ''
  });
  
  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    console.log('Logging in with:', loginEmail, loginPassword);
    
    setIsLoggedIn(true);
    setShowLoginForm(false);
    
    setBillingInfo({
      ...billingInfo,
      firstName: 'John',
      lastName: 'Doe',
      email: loginEmail,
      confirmEmail: loginEmail
    });
    
    alert('Logged in successfully!');
  };
  
  // Handle continue as guest
  const handleContinueAsGuest = () => {
    setContinueAsGuest(true);
    setShowLoginForm(false);
  };
  
  // Handle logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setContinueAsGuest(false);
    setBillingInfo({
      firstName: '',
      lastName: '',
      street: '',
      city: '',
      country: 'United States',
      state: '',
      zipCode: '',
      phone: '',
      mobile: '',
      email: '',
      confirmEmail: ''
    });
  };
  
  // Handle billing form changes
  const handleBillingChange = (e) => {
    const { name, value } = e.target;
    setBillingInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle shipping form changes
  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Sync shipping with billing
  const handleSameAsBillingChange = () => {
    if (!sameAsBilling) {
      setShippingInfo({
        firstName: billingInfo.firstName,
        lastName: billingInfo.lastName,
        street: billingInfo.street,
        city: billingInfo.city,
        country: billingInfo.country,
        state: billingInfo.state,
        zipCode: billingInfo.zipCode,
        phone: billingInfo.phone,
        mobile: billingInfo.mobile
      });
    }
    setSameAsBilling(!sameAsBilling);
  };
  
  // Handle form submission
  const handlePlaceOrder = (e) => {
    e.preventDefault();
    
    if (!billingInfo.firstName || !billingInfo.lastName) {
      alert('Please enter your name');
      return;
    }
    
    if (!billingInfo.email || billingInfo.email !== billingInfo.confirmEmail) {
      alert('Please ensure emails match');
      return;
    }
    
    console.log('Order placed:', {
      isLoggedIn,
      tickets: ticketData,
      billing: billingInfo,
      shipping: sameAsBilling ? billingInfo : shippingInfo
    });
    
    if (isLoggedIn) {
      alert('Order placed successfully! Redirecting to your dashboard...');
      navigate('/dashboard');
    } else {
      alert('Order placed successfully! You can create an account to track your orders.');
    }
  };
  
  // Handle case where user navigates directly to checkout
  if (!ticketData) {
    return (
      <div className="checkout-error">
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <h2>No Tickets Selected</h2>
          <p>Please select your tickets before proceeding to checkout.</p>
          <button onClick={() => navigate('/tickets')} className="back-button">
            Return to Tickets
          </button>
        </div>
      </div>
    );
  }
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  // Get ticket details
  const getTicketDetails = (type) => {
    const details = {
      adult: { name: 'Adult (12-64)', icon: FaUser, price: 24.99 },
      youth: { name: 'Youth (3-11)', icon: FaChild, price: 17.99 },
      senior: { name: 'Senior (65+)', icon: FaPersonCane, price: 19.99 }
    };
    return details[type];
  };
  
  const subtotal = ticketData.totalPrice;
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;
  
  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="page-header">
          <h1 className="page-title">Checkout</h1>
          <p className="page-description">
            Complete your purchase to secure your tickets
          </p>
        </div>
        
        {/* Account Banner */}
        {!isLoggedIn && !continueAsGuest && (
          <div className="member-banner glass-panel">
            <p>Have an account with us? Sign in now for faster checkout and to track your orders!</p>
            <div className="banner-buttons">
              <button 
                className="glass-button"
                onClick={() => setShowLoginForm(!showLoginForm)}
              >
                {showLoginForm ? 'Cancel' : 'Log In'}
              </button>
              <button 
                className="guest-button-banner"
                onClick={handleContinueAsGuest}
              >
                Continue as Guest
              </button>
            </div>
          </div>
        )}
        
        {/* Login Form (when expanded) */}
        {showLoginForm && !isLoggedIn && !continueAsGuest && (
          <div className="glass-panel login-expanded">
            <form onSubmit={handleLogin} className="login-form-expanded">
              <h3>Sign in to your account</h3>
              <div className="form-row-expanded">
                <div className="form-group-expanded">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="form-group-expanded">
                  <label>Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
              <div className="login-actions">
                <button type="submit" className="login-submit-button">
                  Sign In
                </button>
                <button 
                  type="button" 
                  className="create-account-button"
                  onClick={() => navigate('/signup')}
                >
                  <FaUserPlus /> Create an account
                </button>
              </div>
              <a href="/forgot-password" className="forgot-password">
                Forgot password?
              </a>
            </form>
          </div>
        )}
        
        {/* Logged In Banner */}
        {isLoggedIn && (
          <div className="member-banner logged-in-banner glass-panel">
            <p>Welcome back, <strong>{billingInfo.firstName || 'Valued Member'}</strong>! Your account information has been pre-filled.</p>
            <button className="glass-button" onClick={handleLogout}>
              Not you? Sign out
            </button>
          </div>
        )}
        
        {/* Order Summary Section */}
        <div className="glass-panel tickets-table">
          <h2 className="section-title-inline">Order Summary</h2>
          
          {/* Visit Details */}
          <div className="summary-card-simple">
            <div className="detail-row-simple">
              <FaCalendarAlt className="detail-icon" />
              <span><strong>Date:</strong> {formatDate(ticketData.date)}</span>
            </div>
            <div className="detail-row-simple">
              <FaClock className="detail-icon" />
              <span><strong>Time:</strong> {ticketData.time}</span>
            </div>
          </div>
          
          {/* Ticket Details */}
          <div className="ticket-items-simple">
            {Object.entries(ticketData.quantities).map(([type, quantity]) => {
              if (quantity > 0) {
                const details = getTicketDetails(type);
                const IconComponent = details.icon;
                const itemSubtotal = details.price * quantity;
                return (
                  <div key={type} className="ticket-item-simple">
                    <div className="ticket-info-simple">
                      <IconComponent className="ticket-icon" />
                      <div>
                        <div className="ticket-type-simple">{details.name}</div>
                        <div className="ticket-quantity-simple">Quantity: {quantity}</div>
                      </div>
                    </div>
                    <div className="ticket-price-simple">
                      ${itemSubtotal.toFixed(2)}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
          
          {/* Order Totals */}
          <div className="order-totals-simple">
            <div className="total-row-simple">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row-simple">
              <span>Tax (8.25%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="total-row-simple grand-total-simple">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Only show forms if user is logged in */}
        {(continueAsGuest || isLoggedIn) && (
          <>
            {/* Billing Information Section */}
            <div className="glass-panel">
              <h2 className="section-title-inline">Billing Contact</h2>
              
              <div className="form-grid-checkout">
                <div className="form-group-checkout">
                  <label>First Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    name="firstName" 
                    value={billingInfo.firstName}
                    onChange={handleBillingChange}
                    placeholder="First name"
                    required
                  />
                </div>
                
                <div className="form-group-checkout">
                  <label>Last Name <span className="required">*</span></label>
                  <input 
                    type="text" 
                    name="lastName" 
                    value={billingInfo.lastName}
                    onChange={handleBillingChange}
                    placeholder="Last name"
                    required
                  />
                </div>
                
                <div className="form-group-checkout full-width">
                  <label>Street Address <span className="required">*</span></label>
                  <input 
                    type="text" 
                    name="street" 
                    value={billingInfo.street}
                    onChange={handleBillingChange}
                    placeholder="Street address"
                    required
                  />
                </div>
                
                <div className="form-group-checkout">
                  <label>City <span className="required">*</span></label>
                  <input 
                    type="text" 
                    name="city" 
                    value={billingInfo.city}
                    onChange={handleBillingChange}
                    placeholder="City"
                    required
                  />
                </div>
                
                <div className="form-group-checkout">
                  <label>Country <span className="required">*</span></label>
                  <select name="country" value={billingInfo.country} onChange={handleBillingChange} required>
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="Mexico">Mexico</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="form-group-checkout">
                  <label>State <span className="required">*</span></label>
                  <select name="state" value={billingInfo.state} onChange={handleBillingChange} required>
                    <option value="Texas">Texas</option>
                    <option value="California">California</option>
                    <option value="New York">New York</option>
                    <option value="Florida">Florida</option>
                    <option value="Illinois">Illinois</option>
                  </select>
                </div>
                
                <div className="form-group-checkout">
                  <label>Zip Code <span className="required">*</span></label>
                  <input 
                    type="text" 
                    name="zipCode" 
                    value={billingInfo.zipCode}
                    onChange={handleBillingChange}
                    placeholder="Zip code"
                    required
                  />
                </div>
                
                <div className="form-group-checkout">
                  <label>Phone Number <span className="required">*</span></label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={billingInfo.phone}
                    onChange={handleBillingChange}
                    placeholder="(123) 456-7890"
                    required
                  />
                </div>
                
                <div className="form-group-checkout">
                  <label>Mobile <span className="optional">(Optional)</span></label>
                  <input 
                    type="tel" 
                    name="mobile" 
                    value={billingInfo.mobile}
                    onChange={handleBillingChange}
                    placeholder="Mobile number"
                  />
                </div>
                
                <div className="form-group-checkout full-width">
                  <label>Email Address <span className="required">*</span></label>
                  <input 
                    type="email" 
                    name="email" 
                    value={billingInfo.email}
                    onChange={handleBillingChange}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div className="form-group-checkout full-width">
                  <label>Confirm Email Address <span className="required">*</span></label>
                    <input 
                        type="email" 
                        name="confirmEmail" 
                        value={billingInfo.confirmEmail}
                        onChange={handleBillingChange}
                        placeholder="Confirm your email"
                        required
                    />
                        </div>
                    </div>
                </div>
            
                {/* Shipping Information Section - Complete Version */}
                <div className="glass-panel">
                    <h2 className="section-title-inline">Shipping Contact</h2>
                        <div className="same-as-billing-checkout">
                            <label className="checkbox-label-checkout">
                                <input 
                                    type="checkbox" 
                                    checked={sameAsBilling}
                                    onChange={handleSameAsBillingChange}
                                />
                                <span>Make shipping same as billing</span>
                            </label>
                </div>
  
            {!sameAsBilling && (
                <div className="shipping-form-checkout">
                    <div className="form-grid-checkout">
        
            <div className="form-group-checkout">
            <label>First Name <span className="required">*</span></label>
            <input 
                type="text" 
                name="firstName" 
                value={shippingInfo.firstName}
                onChange={handleShippingChange}
                placeholder="First name"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout">
            <label>Last Name <span className="required">*</span></label>
            <input 
                type="text" 
                name="lastName" 
                value={shippingInfo.lastName}
                onChange={handleShippingChange}
                placeholder="Last name"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout full-width">
            <label>Street Address <span className="required">*</span></label>
            <input 
                type="text" 
                name="street" 
                value={shippingInfo.street}
                onChange={handleShippingChange}
                placeholder="Street address"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout">
            <label>City <span className="required">*</span></label>
            <input 
                type="text" 
                name="city" 
                value={shippingInfo.city}
                onChange={handleShippingChange}
                placeholder="City"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout">
            <label>Country <span className="required">*</span></label>
            <select name="country" value={shippingInfo.country} onChange={handleShippingChange} required={!sameAsBilling}>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Mexico">Mexico</option>
                <option value="Other">Other</option>
            </select>
            </div>
        
            <div className="form-group-checkout">
            <label>State <span className="required">*</span></label>
            <select name="state" value={shippingInfo.state} onChange={handleShippingChange} required={!sameAsBilling}>
                <option value="Texas">Texas</option>
                <option value="California">California</option>
                <option value="New York">New York</option>
                <option value="Florida">Florida</option>
                <option value="Illinois">Illinois</option>
            </select>
            </div>
        
            <div className="form-group-checkout">
            <label>Zip Code <span className="required">*</span></label>
            <input 
                type="text" 
                name="zipCode" 
                value={shippingInfo.zipCode}
                onChange={handleShippingChange}
                placeholder="Zip code"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout">
            <label>Phone Number <span className="required">*</span></label>
            <input 
                type="tel" 
                name="phone" 
                value={shippingInfo.phone}
                onChange={handleShippingChange}
                placeholder="(123) 456-7890"
                required={!sameAsBilling}
            />
            </div>
        
            <div className="form-group-checkout">
                <label>Mobile <span className="optional">(Optional)</span></label>
                    <input 
                        type="tel" 
                        name="mobile" 
                        value={shippingInfo.mobile}
                        onChange={handleShippingChange}
                        placeholder="Mobile number"
                    />
                </div>
            </div>
        </div>
        )}
    </div>
            {/* Place Order Button */}
            <button className="checkout-button-final" onClick={handlePlaceOrder}>
              Place Order - ${total.toFixed(2)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
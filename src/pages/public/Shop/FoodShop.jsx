import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaShoppingCart, FaPlus, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import { getShopItems } from '../../../api/inventory';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';
import logo from '../../../images/logo.png';
import hotdogImg from '../../../images/bgui/background.png';

import './Shop.css';

export default function FoodShop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const cartHook = useZooCart();

  document.title = 'Food - Coog Zoo';

  useEffect(() => { getShopItems(2).then(setItems); }, []);

  return (
    <div className="shop-page shop-page--food" style={{ '--silhouette-img': `url(${hotdogImg})` }}>

      <nav className="shop-navbar">
        <div className="shop-navbar-left">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          <button onClick={() => navigate('/shop')} className="back-button">
            Back
          </button>
          <h1 className="shop-navbar-title">Food & Snacks</h1>
        </div>
        <div className="home-navbar-links">
          <Link to="/tickets" className="home-navbar-link">Buy Tickets</Link>
          <Link to="/membership" className="home-navbar-link">Memberships</Link>
          <Link to="/account" className="home-navbar-link">Customer Login</Link>
          <Link to="/login" className="home-navbar-link">Staff Portal</Link>
          <button
            className={`cart-button ${cartHook.totalItems > 0 ? 'cart-button-active' : ''}`}
            onClick={() => setCartOpen(true)}
          >
            <FaShoppingCart /> Cart {cartHook.totalItems > 0 && `(${cartHook.totalItems})`}
          </button>
        </div>
      </nav>

      <div className="shop-content">
        <p className="shop-subtitle">Order snacks, meals, and drinks to enjoy during your visit!</p>
        <div className="items-grid">
          {items.map(item => (
            <div key={item.item_id} className="item-card">
              {item.image_url && (
                <div className="item-card-image">
                  <img src={item.image_url} alt={item.item_name} />
                </div>
              )}
              <div className="item-card-body">
                <h3 className="item-card-name">{item.item_name}</h3>
                <p className="item-card-desc">{item.description}</p>
                <div className="item-card-footer">
                  <span className="item-card-price">${(item.price_cents / 100).toFixed(2)}</span>
                  <button
                    className="add-to-cart-btn"
                    onClick={() => { cartHook.addShopItem(item); setCartOpen(true); }}
                  >
                    <FaPlus size={10} /> Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {cartHook.totalItems > 0 && !cartOpen && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          <FaShoppingCart />
          <span className="cart-fab-badge">{cartHook.totalItems}</span>
        </button>
      )}

      <ShopCartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} {...cartHook} />
      {/* Footer */}
      <footer className="footer" style={{background: "rgb(123, 144, 79)"}}>
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
    </div>
  );
}

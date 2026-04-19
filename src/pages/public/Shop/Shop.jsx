import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';
import { FaShoppingCart, FaUtensils, FaCheck, FaStar, FaUsers, FaParking, FaTicketAlt, FaGift, FaClock, FaMap, FaMapMarkerAlt, FaPhone, FaEnvelope, FaArrowRight } from 'react-icons/fa';
import logo from '../../../images/logo.png';
import hotdogImg from '../../../images/bgui/background.png';
import Navbar from '../../../components/Navbar';
import './Shop.css';

const shopSections = [
  { title: 'Gift Shop', description: 'Zoo-themed merchandise, plush animals, mugs, shirts, and souvenirs.', path: '/shop/gifts', icon: FaGift, color: '#7b904f' },
  { title: 'Food & Snacks', description: 'Quick bites, drinks, family meal combos, and seasonal snacks.', path: '/shop/food', icon: FaUtensils, color: '#7b904f' },
];

export default function Shop() {
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const cartHook = useZooCart();

  document.title = 'Shop Home - Coog Zoo';

  return (
    <div className="shop-page" style={{ '--silhouette-img': `url(${hotdogImg})` }}>

      <Navbar className="shop-navbar">
        <div className="shop-navbar-left">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
        </div>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Food & Gift Shop</h2>
          </div>
        <div className="home-navbar-links">
          <Link to="/tickets" className="home-navbar-link">Buy Tickets</Link>
          <Link to="/membership" className="home-navbar-link">Memberships</Link>
          <Link to="/account" className="home-navbar-link">Customer Login</Link>
          <Link to="/login" className="shop-navbar-link">Staff Portal</Link>
          <button
            className={`cart-button ${cartHook.totalItems > 0 ? 'cart-button-active' : ''}`}
            onClick={() => setCartOpen(true)}
          >
            <FaShoppingCart /> Cart {cartHook.totalItems > 0 && `(${cartHook.totalItems})`}
          </button>
        </div>
      </Navbar>

      <div className="shop-content-centered">
        <div className="shop-sections-grid">
          {shopSections.map(section => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="shop-section-card" onClick={() => navigate(section.path)}>
                <div className="shop-section-icon" style={{ background: `${section.color}33` }}>
                  <Icon size={30} color={section.color} />
                </div>
                <h2 className="shop-section-title" style ={{color: 'white'}}>{section.title}</h2>
                <p className="shop-section-desc">{section.description}</p>
                <button className="shop-section-btn" style={{ background: section.color }}>Browse</button>
              </div>
            );
          })}
        </div>
      </div>

      <ShopCartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} {...cartHook} />
        {/* Footer */}
              <footer className="footer" style={{background: "rgb(123, 144, 79)"}}>
                <div className="footer-container">
                  <div className="footer-main">
                    <div className="footer-section footer-brand">
                      <div className="footer-logo">
                        <div className="logo-placeholder">
                          <img src={logo} alt="Coog Zoo" />
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

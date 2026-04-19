import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaShoppingCart, FaPlus, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import { getShopItems } from '../../../api/inventory';
import Navbar from '../../../components/Navbar';
import ShopCartPanel, { useZooCart } from '../../../components/ShopCart';
import logo from '../../../images/logo.png';
import hotdogImg from '../../../images/bgui/background.png';
import './Shop.css';

export default function GiftShop() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const cartHook = useZooCart();

  document.title = 'Gift Shop - Coog Zoo';

  // Pull shop items on mount and then poll every 15s so stock counts stay
  // roughly live (matches the Tickets page). The server does the
  // authoritative atomic check at checkout — this is just to keep the UI
  // honest for someone camped on the page.
  useEffect(() => {
    let cancelled = false;
    const load = () => getShopItems(1)
      .then(data => { if (!cancelled) setItems(data); })
      .catch(console.error);
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="shop-page shop-page--gifts" style={{ '--silhouette-img': `url(${hotdogImg})` }}>

      <Navbar className="shop-navbar">
        <div className="shop-navbar-left">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          
          <button onClick={() => navigate('/shop')} className="back-button">
            Back
          </button>
        </div>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Gift Shop</h2>
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
      </Navbar>

      <div className="shop-content">
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {item.stock_count <= item.restock_threshold && (
                      <span style={{ fontSize: '11px', color: '#e67e22', fontWeight: 600 }}>
                        Only {item.stock_count} left!
                      </span>
                    )}
                    {item.stock_count === 0 ? (
                      <button className="add-to-cart-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                        Out of Stock
                      </button>
                    ) : (
                      <button
                        className="add-to-cart-btn"
                        disabled={(cartHook.cart.shop[item.item_id]?.quantity || 0) >= Number(item.stock_count)}
                        style={{
                          opacity: (cartHook.cart.shop[item.item_id]?.quantity || 0) >= Number(item.stock_count) ? 0.5 : 1,
                          cursor: (cartHook.cart.shop[item.item_id]?.quantity || 0) >= Number(item.stock_count) ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => { cartHook.addShopItem(item); setCartOpen(true); }}
                      >
                        <FaPlus size={10} /> Add to Cart
                      </button>
                    )}
                  </div>
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

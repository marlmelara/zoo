import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './map.css';
import map from '../../../images/map.png';
import pdf from '../../../images/map.pdf';
import logo from '../../../images/logo.png';
import { FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';

export default function Maps() {
  const navigate = useNavigate();
  
  document.title = 'Zoo Grounds Map - Coog Zoo';
  
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdf;
    link.download = 'zoo-map.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="map-page-wrapper">
      {/* Navigation Bar */}
      <nav className="home-navbar">
        <div className="home-navbar-container">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Zoo Map</h2>
            <p className="page-description">
              Plan your visit with our zoo map!
            </p>
          </div>
          <div className="home-navbar-links">
            <Link to="/tickets" className="home-navbar-link">Buy Tickets</Link>
            <Link to="/shop" className="home-navbar-link">Shop</Link>
            <Link to="/membership" className="home-navbar-link">Membership</Link>
            <Link to="/account" className="home-navbar-link">Customer Login</Link>
            <Link to="/login" className="home-navbar-link">Staff Portal</Link>
          </div>
        </div>
      </nav>      
      
      <div className="map-container">
        <img src={map} alt="Zoo Map" className="map-image" />
        <button onClick={handleDownload} className="download-button">
          Download PDF
        </button>
      </div>
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

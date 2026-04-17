import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaClock, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import logo from '../../../images/logo.png';
import './schedule.css'; 

export default function Schedule() {
  document.title = 'Event Schedule - Coog Zoo';
  
  const navigate = useNavigate();

  // Static daily schedule - same for every day
  const dailySchedule = [
    {
      id: 1,
      time: '09:30:00',
      endTime: '10:00:00',
      location: 'Birds of the World',
      title: 'Birds of the World',
      description: 'Fly by the Birds of the World exhibit to learn more about one of our beautiful avian friends!'
    },
    {
      id: 2,
      time: '10:00:00',
      endTime: '10:30:00',
      location: 'Animals of Africa',
      title: 'African Safari Talk',
      description: 'Join us to learn about the magnificent animals that call the African savanna home!'
    },
    {
      id: 3,
      time: '10:30:00',
      endTime: '11:00:00',
      location: 'Big Cats Zone',
      title: 'Big Cats Feeding',
      description: 'Watch our majestic lions and tigers during feeding time!'
    },
    {
      id: 4,
      time: '11:00:00',
      endTime: '11:30:00',
      location: 'Galápagos Island',
      title: 'Galápagos Giants',
      description: 'Meet our giant tortoises and learn about the unique wildlife of the Galápagos Islands!'
    },
    {
      id: 5,
      time: '11:30:00',
      endTime: '12:00:00',
      location: 'World of Primates',
      title: 'Primate Playtime',
      description: 'Watch our playful primates swing, climb, and interact during enrichment time!'
    },
    {
      id: 6,
      time: '13:00:00',
      endTime: '13:30:00',
      location: 'Elephants of Asia',
      title: 'Elephant Encounter',
      description: 'Meet our Asian elephants and learn about conservation efforts to protect these gentle giants!'
    },
    {
      id: 7,
      time: '14:00:00',
      endTime: '14:30:00',
      location: 'Reptile Lair',
      title: 'Reptile Rendezvous',
      description: 'Get up close with snakes, lizards, and turtles in our Reptile Lair!'
    },
    {
      id: 8,
      time: '14:30:00',
      endTime: '15:00:00',
      location: 'Animals of Africa',
      title: 'Giraffe Feeding',
      description: 'Feed our gentle giraffes and learn about these amazing animals!'
    },
    {
      id: 9,
      time: '15:00:00',
      endTime: '15:30:00',
      location: 'Children\'s Zoo',
      title: 'Goat Yard',
      description: 'Visit and pet our friendly goats at the Children\'s Zoo petting yard!'
    },
    {
      id: 10,
      time: '15:30:00',
      endTime: '16:00:00',
      location: 'Birds of the World',
      title: 'Bird Show',
      description: 'Watch our amazing birds soar and show off their natural behaviors!'
    },
    {
      id: 11,
      time: '16:00:00',
      endTime: '16:30:00',
      location: 'Big Cats Zone',
      title: 'Big Cats Evening Enrichment',
      description: 'See our big cats become active as the day cools down!'
    }
  ];

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    }).toUpperCase();
  };

  // Sort events by time
  const sortedEvents = [...dailySchedule].sort((a, b) => {
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="schedule-page">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo-link" aria-label="Go to homepage">
            <img src={logo} alt="Coog Zoo" />
          </Link>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
            <h2 className="page-title" style={{ margin: 0, fontSize: '2.3rem' }}>Schedule of the Day</h2>
          </div>
          <div className="navbar-links">
            <Link to="/tickets" className="navbar-link">Buy Tickets</Link>
            <Link to="/shop" className="navbar-link">Shop</Link>
            <Link to="/membership" className="navbar-link">Membership</Link>
            <Link to="/account" className="navbar-link">Customer Login</Link>
            <Link to="/login" className="navbar-link">Staff Portal</Link>
          </div>
        </div>
      </nav>

      <div className="schedule-container">
        {/* Date Header */}
        <div className="date-header">
          <span className="updated-date">UPDATED {formatDate()}</span>
          <h2 className="schedule-title">🦁 The Daily Roar Guide 🦁</h2>
          <h2 className="schedule-subtitle">
            Schedule updated each morning before we open at 9:00 a.m.<br />
          </h2>
        </div>

        {/* Schedule Table */}
        <div className="schedule-table">
          {sortedEvents.map((event) => (
            <div key={event.id} className="schedule-row">
              <div className="schedule-time-cell">
                {event.endTime
                  ? `${formatTime(event.time)} – ${formatTime(event.endTime)}`
                  : formatTime(event.time)}
              </div>
              <div className="schedule-location-cell">
                @ {event.location}
              </div>
              <div className="schedule-event-cell">
                <div className="event-title">{event.title}</div>
                <div className="event-description">
                  {event.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note Section */}
        <div className="note-section">
          <p>
            Any and all events are subject to change. Please be sure to check this page for any updates or changes!
          </p>
        </div>
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
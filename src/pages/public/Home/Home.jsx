import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectFade } from 'swiper/modules';
import { getUpcomingEvents, getHomeStats } from '../../../api/public';
import "./home.css"; 
import logo from '../../../images/logo.png';

// Import React Icons
import { FaClock, FaTicketAlt, FaMap, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/effect-fade';

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [submitStatus, setSubmitStatus] = useState(null);

const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const events = await getUpcomingEvents();
        setUpcomingEvents(events);
        
        // Fetch today's schedule (filter events for today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaysEvents = events.filter(event => {
          const eventDate = new Date(event.event_date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() === today.getTime();
        });
        
        // Sort by time
        const sortedEvents = [...todaysEvents].sort((a, b) => {
          if (a.event_time && b.event_time) {
            return a.event_time.localeCompare(b.event_time);
          }
          return 0;
        });
        
        setTodaySchedule(sortedEvents);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingEvents();
  }, []);

  const formatTime = (timeString) => {
    if (!timeString) return 'Time TBD';
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
    });
  };
  
  const slides = [
    {
      image: '/images/elephant2.jpg',
      title: 'Stop by the Zoo!',
      subtitle: 'Experience over 20+ species from around the world',
      buttons: [{ text: 'Buy Tickets', link: '/tickets', variant: 'primary' }]
    },
    {
      image: '/images/giraffe.jpg',
      title: 'Daily Animal Encounters',
      subtitle: 'Get up close with our friendly animals',
      buttons: [{ text: 'View Schedule', link: '/schedule', variant: 'secondary' }]
    },
    {
      image: '/images/lion.jpg',
      title: 'New Lion Exhibit',
      subtitle: 'Now open! Visit our majestic lions',
      buttons: [{ text: 'Learn More', link: '/map', variant: 'primary' }]
    },
    {
      image: '/images/penguin.jpg',
      title: 'Lunch with the Zoo Keepers!',
      subtitle: 'Learn more about how you can support the zoo!',
      buttons: [{ text: 'RVSP for the lunch!', link: '/tickets', variant: 'secondary' }]
    }
  ];

  return (
    <div className="home" style = {{color: "white"}}>
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <a href="/tickets" className="navbar-link">
            🎟️ Buy Tickets
          </a>
          <a href="/membership" className="navbar-link">
            🐯 Membership
          </a>
          <a href="/calendar" className="navbar-link">
            📅 Events
          </a>
          <a href="/shop" className="navbar-link">
            🛍️ Shop
          </a>
          <a href="/dashboard" className="navbar-link">
            🔑 Login
          </a>
        </div>
      </nav>

      {/* Welcome Section */}
      <section className="welcome-section">
        <div className="container">
          <h1 className="welcome-title">Welcome to Coog Zoo</h1>
          <p className="welcome-subtitle">
            Discover amazing wildlife, attend exciting events, and support animal conservation.
          </p>
        </div>
      </section>

      {/* Slideshow Section */}
      <section className="slideshow-section">
        <div className="container">
        <Swiper
          modules={[Autoplay, Pagination, Navigation, EffectFade]}
          effect="fade"
          spaceBetween={0}
          slidesPerView={1}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
          }}
          navigation={true}
          loop={true}
          className="hero-swiper"
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={index}>
              <div className="hero-slide">
                <img 
                  src={slide.image}
                  alt={slide.title}
                  className="hero-image"
                />
                <div className="hero-overlay"></div>
                <div className="hero-content">
                    <h2 className="hero-title">{slide.title}</h2>
                    <p className="hero-subtitle" style = {{color: "white"}}>{slide.subtitle}</p>
                    <div className="hero-buttons">
                      {slide.buttons.map((button, btnIndex) => (
                        <a 
                          key={btnIndex}
                          href={button.link}
                          className={`hero-button hero-button-${button.variant}`}
                        >
                          {button.text}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      </section>

      {/* Today's Information Bar */}
      <section className="info-bar">
        <div className="container">
          <div className="info-grid">
            <a href="/hours" className="info-card">
              <FaClock className="info-icon" size={50} />
              <p className="info-label">Today's Hours</p>
              <p className="info-value">9am - 5pm</p>
            </a>
            
            <a href="/tickets" className="info-card">
              <FaTicketAlt className="info-icon" size={50} />
              <p className="info-label">Buy Tickets</p>
              <p className="info-value">Admission </p>
            </a>
            
            <a href="/map" className="info-card">
              <FaMap className="info-icon" size={50} />
              <p className="info-label">Zoo Map</p>
              <p className="info-value">View Map</p>
            </a>
          </div>
        </div>
      </section>

      <div className="container">
        {/* Today's Schedule */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Today's Schedule</h2>
            <span className="schedule-date">{formatDate()}</span>
          </div>
          
          <div className="schedule-card-home">
            <div className="schedule-note-home">
              Schedule updated each morning before we open at 9 a.m. 
            </div>
            
            {loading ? (
              <div className="loading-schedule">Loading schedule...</div>
            ) : todaySchedule.length === 0 ? (
              <div className="no-schedule">
                <p>No events scheduled for today.</p>
                <p className="no-schedule-sub">Check back later for animal encounters and more!</p>
              </div>
            ) : (
              <div className="schedule-table-home">
                <div className="schedule-table-header-home">
                  <div className="time-header-home">Time</div>
                  <div className="event-header-home">Event</div>
                </div>
                {todaySchedule.map((event, index) => (
                  <div key={event.event_id || index} className="schedule-table-row-home">
                    <div className="time-cell-home">
                      <FaClock className="time-icon-home" />
                      {formatTime(event.event_time)}
                    </div>
                    <div className="event-cell-home">
                      <div className="event-name-home">{event.event_name}</div>
                      {event.venue && (
                        <div className="event-location-home">📍 {event.venue}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="schedule-footer-home">
              <a href="/schedule" className="view-full-link">
                View Full Schedule →
              </a>
            </div>
          </div>
        </section>

        {/* Upcoming Events */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Upcoming Events</h2>
            <a href="/events" className="section-link">
              View all events → 
            </a>
          </div>
          <div className="card">
            <p className="card-placeholder">Event calendar will go here.</p>
          </div>
        </section>

        {/* Support Wildlife */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Support Wildlife</h2>
            <a href="/conservation" className="section-link">
              Learn more →
            </a>
          </div>
          <div className="card card-conservation">
            <p className="card-text">
              Donations help protect endangered animals and fund conservation programs.
            </p>
            <a href="/donations" className="button button-primary">
              Donate Now
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="footer">
          <div className="footer-container">
            {/* Main Footer Content */}
            <div className="footer-main">
              {/* Logo and About Section */}
              <div className="footer-section footer-brand">
                <div className="footer-logo">
                  <div className="logo-placeholder">
                    <img src={logo} style = {{maxWidth: '200px', width: '100%', height: 'auto'}} alt="Coog Zoo"></img>
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
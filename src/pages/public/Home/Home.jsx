import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectFade } from 'swiper/modules';
import { getUpcomingEvents } from '../../../api/public';
import "./home.css"; 
import logo from '../../../images/logo.png';

// Import React Icons
import { FaClock, FaTicketAlt, FaMap, FaMapMarkerAlt, FaPhone, FaEnvelope, FaArrowRight } from 'react-icons/fa';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/effect-fade';

export default function Home() {
  document.title = 'Welcome to Coog Zoo!';

  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsByDate, setEventsByDate] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDateEvents, setSelectedDateEvents] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const events = await getUpcomingEvents(100);
        
        const eventsMap = {};
        events.forEach(event => {
          if (!event.event_date) return;
          const [year, month, day] = event.event_date.split('-');
          const dateKey = new Date(Date.UTC(year, month - 1, day)).toDateString();
          if (!eventsMap[dateKey]) {
            eventsMap[dateKey] = [];
          }
          eventsMap[dateKey].push(event);
        });
        setEventsByDate(eventsMap);
        
        const todayUTC = new Date();
        const todayDate = new Date(Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), todayUTC.getDate()));
        const todayKey = todayDate.toDateString();
        const todaysEvents = eventsMap[todayKey] || [];
        
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

    fetchData();
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

  const generateCalendarDays = () => {
    const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1));
    const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
    const daysInMonth = lastDay.getUTCDate();
    const startingDayOfWeek = firstDay.getUTCDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(Date.UTC(currentYear, currentMonth, i));
      const dateKey = date.toDateString();
      const hasEvents = eventsByDate[dateKey] && eventsByDate[dateKey].length > 0;
      const events = eventsByDate[dateKey] || [];
      
      const todayUTC = new Date();
      const todayDate = new Date(Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), todayUTC.getDate()));
      const isToday = date.toDateString() === todayDate.toDateString();
      
      days.push({
        day: i,
        date: date,
        hasEvents,
        isToday,
        events: events
      });
    }
    return days;
  };

  const formatDisplayDate = (date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
    return `${monthNames[month]} ${day}, ${year}`;
  };

  const handleDateClick = (day) => {
    if (day && day.hasEvents) {
      if (selectedDateEvents && selectedDateEvents.date.toDateString() === day.date.toDateString()) {
        setSelectedDateEvents(null);
      } else {
        setSelectedDateEvents(day);
      }
    }
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
    setSelectedDateEvents(null);
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
      buttons: [{ text: 'RSVP for the lunch!', link: '/tickets', variant: 'secondary' }]
    }
  ];

  return (
    <div className="home" style={{ color: "white" }}>
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-container">
          <a href="/membership" className="navbar-link">ඞ Membership</a>
          <a href="/tickets" className="navbar-link">🎟️ Buy Tickets</a>
          <a href="/calendar" className="navbar-link">📅 Events</a>
          <a href="/shop" className="navbar-link">🛍️ Shop</a>
          <a href="/account" className="navbar-link">🔑 Customer Login</a>
          <a href="/login" className="navbar-link">🏢 Staff Portal</a>
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
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            pagination={{ clickable: true, dynamicBullets: true }}
            navigation={true}
            loop={true}
            className="hero-swiper"
          >
            {slides.map((slide, index) => (
              <SwiperSlide key={index}>
                <div className="hero-slide">
                  <img src={slide.image} alt={slide.title} className="hero-image" />
                  <div className="hero-overlay"></div>
                  <div className="hero-content">
                    <h2 className="hero-title">{slide.title}</h2>
                    <p className="hero-subtitle" style={{ color: "white" }}>{slide.subtitle}</p>
                    <div className="hero-buttons">
                      {slide.buttons.map((button, btnIndex) => (
                        <a key={btnIndex} href={button.link} className={`hero-button hero-button-${button.variant}`}>
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
            <a className="info-card">
              <FaClock className="info-icon" size={50} />
              <p className="info-label">Today's Hours</p>
              <p className="info-value">9am - 5pm</p>
            </a>
            <a href="/tickets" className="info-card">
              <FaTicketAlt className="info-icon" size={50} />
              <p className="info-label">Buy Tickets</p>
              <p className="info-value">Admission</p>
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
        {/* Two Column Layout */}
        <div className="home-two-columns">
          {/* Left Column - Today's Schedule */}
          <div className="home-left-column">
            <h2 className="section-title-home">Today's Schedule</h2>
            <div className="schedule-date-home">{formatDate()}</div>
            
            <div className="schedule-card-home">
              <div className="schedule-note-home">
                Schedule updated each morning before we open at 9 a.m.
              </div>
              
              {loading ? (
                <div className="loading-schedule">Loading schedule...</div>
              ) : todaySchedule.length === 0 ? (
                <div className="no-schedule">
                  <p>No events scheduled for today.</p>
                </div>
              ) : (
                <div className="schedule-table-home">
                  {todaySchedule.map((event, index) => (
                    <div key={event.event_id || index} className="schedule-row-home">
                      <div className="schedule-time-home">
                        {event.start_time && event.end_time
                          ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
                          : formatTime(event.event_time)}
                      </div>
                      <div className="schedule-event-home">
                        {event.event_name || event.title}
                        {event.venues?.venue_name && (
                          <span className="schedule-venue-home"> @ {event.venues.venue_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="schedule-footer-home">
                <a href="/schedule" className="view-full-link">View Full Schedule →</a>
              </div>
            </div>
          </div>

          {/* Right Column - Upcoming Events Calendar */}
          <div className="home-right-column">
            <div className="upcoming-header">
              <h2 className="section-title-home">Upcoming Events</h2>
              <a href="/calendar" className="all-events-link">ALL EVENTS →</a>
            </div>
            
            <div className="calendar-card-home">
              <div className="calendar-header-home">
                <button className="month-nav-home" onClick={() => changeMonth('prev')}>
                  ←
                </button>
                <div className="calendar-month-home">
                  {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button className="month-nav-home" onClick={() => changeMonth('next')}>
                  →
                </button>
              </div>
              
              <div className="calendar-grid-home">
                {weekDays.map(day => (
                  <div key={day} className="calendar-weekday-home">{day}</div>
                ))}
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    className={`calendar-day-home ${day ? 'has-date' : 'empty'} 
                      ${day?.isToday ? 'today' : ''}
                      ${day?.hasEvents ? 'has-events' : ''}
                      ${selectedDateEvents && day && selectedDateEvents.date.toDateString() === day.date.toDateString() ? 'selected' : ''}`}
                    onClick={() => handleDateClick(day)}
                    style={{ cursor: day?.hasEvents ? 'pointer' : 'default' }}
                  >
                    {day && <span className="day-number-home">{day.day}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Events List for Selected Date */}
            {selectedDateEvents && selectedDateEvents.hasEvents && (
              <div className="selected-events-card glass-panel">
                <div className="selected-events-header">
                  <h4 className="selected-events-date">
                    {formatDisplayDate(selectedDateEvents.date)}
                  </h4>
                </div>
                <div className="selected-events-list">
                  {selectedDateEvents.events.map((event, index) => (
                    <div key={event.event_id || index} className="selected-event-item">
                      {(event.start_time || event.event_time) && (
                        <div className="selected-event-time">
                          <FaClock className="selected-event-icon" />
                          {event.start_time && event.end_time
                            ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
                            : formatTime(event.event_time)}
                        </div>
                      )}
                      <div className="selected-event-title">{event.event_name || event.title}</div>
                      {event.description && (
                        <div className="selected-event-description">{event.description}</div>
                      )}
                      {event.venues?.venue_name && (
                        <div className="selected-event-location">
                          <FaMapMarkerAlt className="selected-event-icon" />
                          {event.venues.venue_name}{event.venues.location ? ` — ${event.venues.location}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div> {/* This closes the home-right-column div */}
        </div> {/* This closes the home-two-columns div */}

        {/* Support Wildlife Section */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title-home">Support Wildlife</h2>
            <a href="/conservation" className="section-link">Learn more →</a>
          </div>
          <div className="card card-conservation">
            <p className="card-text">
              With your generous donations, you can help fund our animal care programs and conservations efforts! 
            </p>
            <a href="/donations" className="button button-primary">Donate Now</a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-section footer-brand">
              <div className="footer-logo">
                <div className="logo-placeholder">
                  <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
                </div>
              </div>
              <p className="footer-description">
                Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.
              </p>
            </div>

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
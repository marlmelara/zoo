import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaCalendarAlt, FaTicketAlt, FaCheckCircle, 
  FaExclamationTriangle, FaMapMarkerAlt, FaClock, 
  FaPhone, FaEnvelope } from 'react-icons/fa';
import { getUpcomingEvents } from '../../../api/public';
import Navbar from '../../../components/Navbar';
import logo from '../../../images/logo.png';
import './calendar.css';

export default function Events() {
  document.title = 'Events Calendar - Coog Zoo';

  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getUpcomingEvents(100);
        console.log('Raw events from DB:', data);
        setEvents(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatTime = (timeString) => {
    if (!timeString) return '';
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

  const getEventTime = (event) => {
    return event.event_time || event.start_time || event.time;
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return { month: '???', day: '??', full: 'Date TBD', weekday: '???' };
    
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[date.getDay()];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthAbbr = months[date.getMonth()];
    
    const fullDate = `${weekday}, ${monthAbbr} ${parseInt(day)}, ${year}`;
    
    return {
      month: monthAbbr.toUpperCase(),
      day: parseInt(day),
      year: year,
      full: fullDate,
      weekday: weekday
    };
  };

  const handleEventClick = (event) => {
    const ticketStatus = getTicketStatus(event);
    if (ticketStatus.status === 'sold_out') return;
    
    navigate('/tickets', {
      state: {
        preselectedEvent: {
          id: event.event_id,
          title: event.title,
          date: event.event_date,
          venue: event.venues?.venue_name
        }
      }
    });
  };

  const getTicketStatus = (event) => {
    const maxCapacity = event.max_capacity;
    const ticketsSold = event.tickets_sold || 0;
    const remaining = maxCapacity - ticketsSold;
    
    if (!maxCapacity || maxCapacity === 0) {
      return { status: 'unlimited', text: 'Tickets Available', color: '#10b981', icon: FaCheckCircle };
    }
    
    if (remaining <= 0) {
      return { status: 'sold_out', text: 'Sold Out', color: '#ef4444', icon: FaExclamationTriangle };
    }
    
    if (remaining <= 10) {
      return { status: 'low', text: `Only ${remaining} left!`, color: '#f59e0b', icon: FaExclamationTriangle };
    }
    
    return { status: 'available', text: `${remaining} tickets left`, color: '#10b981', icon: FaCheckCircle };
  };

  const groupEventsByMonth = () => {
    const grouped = {};
    events.forEach(event => {
      if (!event.event_date) return;
      
      const [year, month] = event.event_date.split('-');
      const monthKey = `${year}-${month}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(event);
    });
    return grouped;
  };

  const groupedEvents = groupEventsByMonth();
  
  const sortedMonths = Object.keys(groupedEvents).sort((a, b) => {
    const [yearA, monthA] = a.split('-');
    const [yearB, monthB] = b.split('-');
    if (yearA !== yearB) return yearA - yearB;
    return monthA - monthB;
  });
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="events-page">
      {/* Navigation Bar */}
      <Navbar />

      <div className="events-container" style = {{padding: '2rem'}}>
        <div className="results-count">
          Showing {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>
        {loading ? (
          <div className="loading-state">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>No events scheduled.</p>
            <p className="empty-subtitle">Check back soon for exciting events!</p>
          </div>
        ) : (
          sortedMonths.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthEvents = groupedEvents[monthKey];
            
            return (
              <div key={monthKey} className="event-month-section">
                <h2 className="event-month-title">
                  {monthNames[parseInt(month) - 1]} {year}
                </h2>
                <div className="events-list">
                  {monthEvents.map((event, index) => {
                    const dateInfo = formatEventDate(event.event_date);
                    const ticketStatus = getTicketStatus(event);
                    const StatusIcon = ticketStatus.icon;
                    const isSoldOut = ticketStatus.status === 'sold_out';
                    const eventTime = getEventTime(event);
                    
                    return (
                      <div 
                        key={event.event_id || index} 
                        className={`event-item glass-panel ${isSoldOut ? 'sold-out-event' : 'clickable-event'}`}
                        onClick={() => handleEventClick(event)}
                        style={isSoldOut ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                      >
                        <div className="event-date-card">
                          <span className="event-date-month">{dateInfo.month}</span>
                          <span className="event-date-day">{dateInfo.day}</span>
                        </div>
                        
                        <div className="event-details">
                          <h3 className="event-item-title">{event.title}</h3>
                          
                          <div className="event-meta">
                            <div className="event-meta-item">
                              <FaCalendarAlt className="meta-icon" />
                              <span>{dateInfo.full}</span>
                            </div>
                            {eventTime && (
                              <div className="event-meta-item">
                                <FaClock className="meta-icon" />
                                <span>{formatTime(eventTime)}</span>
                              </div>
                            )}
                            {event.venues?.venue_name && (
                              <div className="event-meta-item">
                                <FaMapMarkerAlt className="meta-icon" />
                                <span>{event.venues.venue_name}</span>
                              </div>
                            )}
                          </div>
                          
                          {event.description && (
                            <p className="event-description">{event.description}</p>
                          )}
                          
                          <div className={`ticket-status ${ticketStatus.status}`}>
                            <StatusIcon className="status-icon" />
                            <span style={{ color: ticketStatus.color }}>{ticketStatus.text}</span>
                          </div>
                          
                          {!isSoldOut && (
                            <div className="event-ticket-button">
                              <FaTicketAlt className="ticket-icon" /> Get Tickets →
                            </div>
                          )}
                          
                          {isSoldOut && (
                            <div className="sold-out-message">
                              <FaExclamationTriangle className="sold-out-icon" />
                              Sold Out - Check back for future dates
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-section footer-brand">
              <img src={logo} style={{ maxWidth: '200px', width: '100%', height: 'auto' }} alt="Coog Zoo" />
              <p className="footer-description" style={{color:"white"}}>Discover amazing wildlife, attend exciting events, and support animal conservation at Coog Zoo.</p>
            </div>
            <div className="footer-section">
              <h3 className="footer-title">Contact Us</h3>
              <div className="footer-contact-info">
                <div className="contact-item"><FaMapMarkerAlt className="contact-icon" style={{color:"white"}} /><div><p>4302 University Dr</p><p>Houston, TX 77004</p></div></div>
                <div className="contact-item"><FaPhone className="contact-icon" style={{color:"white"}} /><a href="tel:5555555555">555-555-5555</a></div>
                <div className="contact-item"><FaEnvelope className="contact-icon" style={{color:"white"}} /><a href="mailto:info@coogzoo.org">info@coogzoo.org</a></div>
              </div>
            </div>
          </div>
          <div className="footer-bottom"><div className="footer-bottom-content" style={{color:"white"}}><p>&copy; {new Date().getFullYear()} Coog Zoo. All rights reserved.</p></div></div>
        </div>
      </footer>
    </div>
  );
}
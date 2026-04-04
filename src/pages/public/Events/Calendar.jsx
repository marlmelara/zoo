import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaStar, FaTicketAlt } from 'react-icons/fa';
import { getUpcomingEvents } from '../../../api/public';
import './calendar.css';

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' or 'members'

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getUpcomingEvents(100);
        console.log('Raw events from DB:', data);
        setEvents(data);
        setFilteredEvents(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Filter events when activeFilter changes
  useEffect(() => {
    if (activeFilter === 'members') {
      // Filter events that are for members only
      const memberEvents = events.filter(event => event.is_member_only === true);
      setFilteredEvents(memberEvents);
    } else {
      setFilteredEvents(events);
    }
  }, [activeFilter, events]);


  const parseDate = (dateString) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
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

  const groupEventsByMonth = () => {
    const grouped = {};
    filteredEvents.forEach(event => {
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
    <div className="events-page" style = {{minHeight: "100vh", paddingBottom: "4rem"}}>
      <div className="events-header-nav">
        <button className="back-button-events glass-button" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>

      <div className="events-container">
        <div className="events-hero">
          <h1 className="events-title">Don't Miss These Events</h1>
          <p className="events-subtitle">
            Discover exciting events, special programs, and unique experiences at Coog Zoo.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="filter-buttons-container">
          <button 
            className={`filter-button glass-button ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <FaTicketAlt className="filter-icon" />
            All Events
          </button>
          <button 
            className={`filter-button glass-button ${activeFilter === 'members' ? 'active' : ''}`}
            onClick={() => setActiveFilter('members')}
          >
            <FaStar className="filter-icon" />
            Members Only
          </button>
        </div>

        {/* Results Count */}
        <div className="results-count">
          Showing {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
        </div>

        {loading ? (
          <div className="loading-state">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No {activeFilter === 'members' ? 'members-only' : ''} events scheduled.</p>
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
                    return (
                      <div key={event.event_id || index} className="event-item glass-panel">
                        <div className="event-date-card">
                          <span className="event-date-month">{dateInfo.month}</span>
                          <span className="event-date-day">{dateInfo.day}</span>
                        </div>
                        
                        <div className="event-details">
                          <div className="event-header">
                            <h3 className="event-item-title">{event.title}</h3>
                            {event.is_member_only && (
                              <span className="member-badge">
                                <FaStar /> Members Only
                              </span>
                            )}
                          </div>
                          
                          <div className="event-meta">
                            <div className="event-meta-item">
                              <FaCalendarAlt className="meta-icon" style = {{ color: "var(--color-primary)", fontSize: "0.75rem"}} />
                              <span>{dateInfo.full}</span>
                            </div>
                          </div>
                          
                          {event.description && (
                            <p className="event-description">{event.description}</p>
                          )}
                          
                          {event.max_capacity && (
                            <div className="event-capacity">
                              🎟️ Max Capacity: {event.max_capacity} guests
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
    </div>
  );
}
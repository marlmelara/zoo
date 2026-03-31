import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaMapMarkerAlt } from 'react-icons/fa';
import { getUpcomingEvents } from '../../../api/public';
import './Schedule.css'; 

export default function Schedule() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getUpcomingEvents();
        // Filter events for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayEvents = data.filter(event => {
          const eventDate = new Date(event.event_date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() === today.getTime();
        });
        
        // Sort by time
        const sortedEvents = [...todayEvents].sort((a, b) => {
          if (a.event_time && b.event_time) {
            return a.event_time.localeCompare(b.event_time);
          }
          return 0;
        });
        
        setEvents(sortedEvents);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching events:', error);
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

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

  return (
    <div className="schedule-page">
      {/* Back Button */}
      <div className="schedule-header">
        <button
          className="back-button glass-button"
          onClick={() => navigate('/')}
        >
          ← Home
        </button>
      </div>

      <div className="schedule-container">
        {/* Hero Text */}
        <div className="hero-text">
          <h1 className="hero-title">Schedule of the Day</h1>
          <p className="hero-subtitle">
            Schedule updated each morning before we open at 9:00 a.m.<br />
          </p>
        </div>

        {/* Date Header */}
        <div className="date-header">
          <span className="updated-date">UPDATED {formatDate()}</span>
          <h2 className="schedule-title">🦁 The Daily Roar Guide 🦁</h2>
        </div>

        {/* Schedule Table */}
        {loading ? (
          <div className="loading-state">
            <p>Loading schedule...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled events for today.</p>
            <p className="empty-subtitle">Check back tomorrow for exciting animal encounters!</p>
          </div>
        ) : (
          <div className="schedule-table">
            {events.map((event, index) => (
              <div key={event.event_id || index} className="schedule-row">
                <div className="schedule-time-cell">
                  {formatTime(event.event_time)}
                </div>
                <div className="schedule-location-cell">
                  @ {event.venue || 'Zoo Exhibit'}
                </div>
                <div className="schedule-event-cell">
                  <div className="event-title">{event.event_name}</div>
                  <div className="event-description">
                    {event.event_description || 'Join us to learn more about our amazing animals!'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Note Section */}
        <div className="note-section">
          <p>
            Any and all events are subject to change. Please be sure to check this page for any updates or changes!
          </p>
        </div>
      </div>
    </div>
  );
}
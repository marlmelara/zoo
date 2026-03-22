import React, { useEffect, useState } from 'react';
import { getUpcomingEvents, getHomeStats } from '../../../api/public';

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [homeStats, setHomeStats] = useState(null);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const events = await getUpcomingEvents();
        setUpcomingEvents(events);
      } catch (error) {
        console.error('Error fetching upcoming events:', error);
      }
    };

    fetchUpcomingEvents();
  }, []);

  return (
    <div className="p-10 text-white">

      <section className="mb-16">
        <h1 className="text-5xl font-bold mb-4">Welcome to ZooManager</h1>
        <p className="text-lg text-gray-300">
          Discover amazing wildlife, attend exciting events, and support animal conservation.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-4">Upcoming Events</h2>
        <div className="bg-gray-800 p-6 rounded-lg">
          Event calendar will go here.
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-4">Today's Schedule</h2>
        <div className="bg-gray-800 p-6 rounded-lg">
          Animal shows and feeding times will appear here.
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-4">Support Wildlife</h2>
        <div className="bg-green-800 p-6 rounded-lg">
          Donations help protect endangered animals and fund conservation programs.
        </div>
      </section>

    </div>
  );
}
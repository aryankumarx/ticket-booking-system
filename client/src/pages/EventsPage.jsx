import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvents } from '../services/api';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, [typeFilter]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (search) params.search = search;
      const res = await getEvents(params);
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
    setLoading(false);
  }

  function handleSearch(e) {
    e.preventDefault();
    loadEvents();
  }

  function getMinPrice(event) {
    if (!event.pricing?.length) return 0;
    return Math.min(...event.pricing.map(p => p.price));
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <h1>Discover Events</h1>
        <p>Find and book tickets for movies and concerts near you</p>
      </div>

      {/* filters */}
      <div className="filters-bar">
        <form className="search-input" onSubmit={handleSearch}>
          <input
            type="text" placeholder="Search events..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </form>
        <button className={`filter-btn ${typeFilter === '' ? 'active' : ''}`}
          onClick={() => setTypeFilter('')}>All</button>
        <button className={`filter-btn ${typeFilter === 'movie' ? 'active' : ''}`}
          onClick={() => setTypeFilter('movie')}>🎬 Movies</button>
        <button className={`filter-btn ${typeFilter === 'concert' ? 'active' : ''}`}
          onClick={() => setTypeFilter('concert')}>🎵 Concerts</button>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎭</div>
          <h3>No events found</h3>
          <p>Check back later or try a different search</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div key={event._id} className="event-card" onClick={() => navigate(`/event/${event._id}`)}>
              <div className="event-card-image"
                style={{ background: event.type === 'movie'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                }}>
                <span>{event.type === 'movie' ? '🎬' : '🎵'}</span>
                <span className={`event-type-badge ${event.type}`}>{event.type}</span>
              </div>
              <div className="event-card-body">
                <h3 className="event-card-title">{event.title}</h3>
                <div className="event-card-meta">
                  <span>📅 {formatDate(event.date)}</span>
                  <span>🕐 {event.time}</span>
                  <span>📍 {event.venue?.name || 'TBA'}</span>
                </div>
                <div className="event-card-footer">
                  <span className="event-price">From ₹{getMinPrice(event)}</span>
                  <div className="event-availability">
                    <span className={`availability-dot ${
                      event.seatAvailability?.available === 0 ? 'sold-out' : ''}`}></span>
                    <span>{event.seatAvailability?.available || 0} seats left</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

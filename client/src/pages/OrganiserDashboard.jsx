import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getVenues, createEvent, getEvents, getEventSummary } from '../services/api';

export default function OrganiserDashboard() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // event form
  const [title, setTitle] = useState('');
  const [type, setType] = useState('movie');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [pricing, setPricing] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [venueRes, eventRes] = await Promise.all([getVenues(), getEvents()]);
      setVenues(venueRes.data);
      // only show events created by this organiser
      setMyEvents(eventRes.data.filter(e => e.organiser?._id === user._id || e.organiser === user._id));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  // when venue is selected, auto populate pricing categories
  function handleVenueSelect(venueId) {
    setVenue(venueId);
    const v = venues.find(v => v._id === venueId);
    if (v?.seatLayout?.categories) {
      setPricing(v.seatLayout.categories.map(c => ({ category: c.name, price: 0 })));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!venue) { setError('Select a venue'); return; }
    try {
      await createEvent({ title, type, description, venue, date, time, pricing });
      setShowForm(false);
      setTitle(''); setDescription(''); setDate(''); setTime('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event');
    }
  }

  async function viewSummary(eventId) {
    try {
      const res = await getEventSummary(eventId);
      setSelectedSummary(res.data);
    } catch (err) {
      alert('Could not load summary');
    }
  }

  if (loading) return <div className="main-content"><div className="spinner-container"><div className="spinner"></div></div></div>;

  return (
    <div className="main-content">
      <div className="page-header">
        <h1>Organiser Dashboard</h1>
        <p>Create events and track bookings</p>
      </div>

      <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 24 }}>
        {showForm ? 'Cancel' : '+ Create Event'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <form className="create-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label>Title</label>
              <input type="text" className="form-control" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="Event name" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                  <option value="movie">🎬 Movie</option>
                  <option value="concert">🎵 Concert</option>
                </select>
              </div>
              <div className="form-group">
                <label>Venue</label>
                <select className="form-control" value={venue} onChange={e => handleVenueSelect(e.target.value)} required>
                  <option value="">Pick a venue</option>
                  {venues.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" className="form-control" value={date}
                  onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" className="form-control" value={time}
                  onChange={e => setTime(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={description}
                onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description..." />
            </div>

            {pricing.length > 0 && (
              <div className="form-group">
                <label>Pricing by Category</label>
                {pricing.map((p, i) => (
                  <div key={i} className="pricing-row" style={{ marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: '0.8rem' }}>{p.category}</label>
                    </div>
                    <div>
                      <input type="number" className="form-control" placeholder="Price"
                        value={p.price} onChange={e => {
                          const updated = [...pricing];
                          updated[i].price = parseInt(e.target.value) || 0;
                          setPricing(updated);
                        }} min="0" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="btn btn-primary">Create Event</button>
          </form>
        </div>
      )}

      {/* summary modal */}
      {selectedSummary && (
        <div className="modal-overlay" onClick={() => setSelectedSummary(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '80vh', overflow: 'auto' }}>
            <h2>{selectedSummary.event.title} - Summary</h2>

            <div className="dashboard-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon">🎫</div>
                <div className="stat-value">{selectedSummary.summary.totalTickets}</div>
                <div className="stat-label">Tickets Sold</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">₹{selectedSummary.summary.totalRevenue}</div>
                <div className="stat-label">Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{selectedSummary.summary.totalBookings}</div>
                <div className="stat-label">Bookings</div>
              </div>
            </div>

            {/* revenue by category */}
            <h3 style={{ marginBottom: 12 }}>Revenue by Category</h3>
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead><tr><th>Category</th><th>Tickets</th><th>Revenue</th></tr></thead>
              <tbody>
                {Object.entries(selectedSummary.summary.revenueByCategory || {}).map(([cat, data]) => (
                  <tr key={cat}><td>{cat}</td><td>{data.tickets}</td><td>₹{data.revenue}</td></tr>
                ))}
              </tbody>
            </table>

            {/* recent bookings */}
            <h3 style={{ marginBottom: 12 }}>Bookings</h3>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Customer</th><th>Seats</th><th>Amount</th></tr></thead>
              <tbody>
                {selectedSummary.bookings.map((b, i) => (
                  <tr key={i}><td style={{ fontFamily: 'monospace' }}>{b.bookingRef}</td><td>{b.customer}</td><td>{b.seats}</td><td>₹{b.amount}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedSummary(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* my events list */}
      <h2 style={{ marginBottom: 16 }}>My Events</h2>
      {myEvents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎭</div>
          <h3>No events created yet</h3>
          <p>Create your first event above</p>
        </div>
      ) : (
        <div className="events-grid">
          {myEvents.map(ev => (
            <div key={ev._id} className="card">
              <h3 style={{ marginBottom: 8 }}>{ev.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                📅 {new Date(ev.date).toLocaleDateString('en-IN')} | 🕐 {ev.time}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
                📍 {ev.venue?.name} | Status: <strong>{ev.status}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="pricing-badge">
                  🟢 {ev.seatAvailability?.available || 0} available
                </span>
                <span className="pricing-badge">
                  🔴 {ev.seatAvailability?.booked || 0} booked
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => viewSummary(ev._id)}>
                View Summary
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

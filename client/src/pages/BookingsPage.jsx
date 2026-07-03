import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBookings, cancelBooking } from '../services/api';

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBookings(); }, []);

  async function loadBookings() {
    setLoading(true);
    try {
      const res = await getBookings();
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleCancel(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await cancelBooking(bookingId);
      loadBookings(); // refresh
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel failed');
    }
  }

  if (loading) return <div className="main-content"><div className="spinner-container"><div className="spinner"></div></div></div>;

  return (
    <div className="main-content">
      <div className="page-header">
        <h1>My Bookings</h1>
        <p>View and manage your ticket bookings</p>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h3>No bookings yet</h3>
          <p>Browse events and book your first ticket!</p>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map(b => (
            <div key={b._id} className="booking-item">
              <div className="booking-qr">
                {b.qrCode ? (
                  <img src={b.qrCode} alt="QR Code" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No QR</div>
                )}
              </div>

              <div className="booking-details">
                <h3>{b.event?.title || 'Event'}</h3>
                <div className="booking-ref">Ref: {b.bookingRef}</div>
                <div className="booking-meta">
                  <span>📅 {new Date(b.event?.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>🕐 {b.event?.time}</span>
                  <span>📍 {b.event?.venue?.name}</span>
                  <span>💺 {b.seats.map(s => s.label).join(', ')}</span>
                  <span>💰 ₹{b.totalAmount}</span>
                </div>
              </div>

              <div className="booking-actions">
                <span className={`booking-status ${b.status}`}>{b.status}</span>
                {b.status === 'confirmed' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b._id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

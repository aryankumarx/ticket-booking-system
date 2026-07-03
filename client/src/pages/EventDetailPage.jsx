import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getEvent, getEventSeats, holdSeats, confirmBooking, joinWaitlist, releaseHold } from '../services/api';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [venue, setVenue] = useState(null);
  const [selected, setSelected] = useState([]);
  const [heldSeats, setHeldSeats] = useState([]);
  const [holdExpiry, setHoldExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null); // set after successful booking
  const [error, setError] = useState('');
  const [step, setStep] = useState('select'); // select -> checkout -> done
  const [confirming, setConfirming] = useState(false);

  // load event and seats
  useEffect(() => {
    loadData();
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave:event', id);
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // real-time seat updates via socket
  useEffect(() => {
    const socket = io(window.location.origin);
    socketRef.current = socket;
    socket.emit('join:event', id);

    socket.on('seats:updated', (updatedSeats) => {
      setSeats(prev => {
        const map = new Map(prev.map(s => [s._id, s]));
        updatedSeats.forEach(us => {
          if (map.has(us._id)) {
            map.set(us._id, { ...map.get(us._id), ...us });
          }
        });
        return Array.from(map.values());
      });
    });

    return () => socket.disconnect();
  }, [id]);

  // countdown timer for seat hold
  useEffect(() => {
    if (!holdExpiry) return;
    const timer = setInterval(() => {
      const diff = new Date(holdExpiry) - Date.now();
      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        // hold expired, go back to select
        setStep('select');
        setHeldSeats([]);
        setSelected([]);
        setError('Your hold expired. Please select seats again.');
        loadData();
      } else {
        setTimeLeft(Math.ceil(diff / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [holdExpiry]);

  async function loadData() {
    setLoading(true);
    try {
      const [evRes, seatRes] = await Promise.all([getEvent(id), getEventSeats(id)]);
      setEvent(evRes.data);
      setSeats(seatRes.data.seats);
      setVenue(seatRes.data.venue);
    } catch (err) {
      setError('Failed to load event');
    }
    setLoading(false);
  }

  function toggleSeat(seat) {
    if (seat.status !== 'available') return;
    if (!user) { navigate('/login'); return; }

    setSelected(prev => {
      const exists = prev.find(s => s._id === seat._id);
      if (exists) return prev.filter(s => s._id !== seat._id);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, seat];
    });
  }

  async function handleHold() {
    setError('');
    try {
      const res = await holdSeats({ eventId: id, seatIds: selected.map(s => s._id) });
      setHeldSeats(res.data.seats);
      setHoldExpiry(res.data.holdExpiresAt);
      setStep('checkout');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not hold seats');
      loadData(); // refresh seat map
    }
  }

  async function handleConfirm() {
    setError('');
    setConfirming(true);
    try {
      const res = await confirmBooking({ eventId: id, seatIds: heldSeats.map(s => s._id) });
      setBooking(res.data.booking);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    }
    setConfirming(false);
  }

  async function handleCancelHold() {
    try {
      await releaseHold({ eventId: id, seatIds: heldSeats.map(s => s._id) });
    } catch (e) { /* ignore */ }
    setStep('select');
    setHeldSeats([]);
    setSelected([]);
    setHoldExpiry(null);
    loadData();
  }

  async function handleJoinWaitlist(category) {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await joinWaitlist({ eventId: id, category });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to join waitlist');
    }
  }

  function getPrice(category) {
    const p = event?.pricing?.find(p => p.category === category);
    return p ? p.price : 0;
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) return <div className="main-content"><div className="spinner-container"><div className="spinner"></div></div></div>;
  if (!event) return <div className="main-content"><div className="alert alert-error">Event not found</div></div>;

  // success screen
  if (step === 'done' && booking) {
    return (
      <div className="main-content">
        <div className="success-container">
          <div className="success-icon">🎉</div>
          <h2>Booking Confirmed!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{event.title}</p>
          <p style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)', fontSize: '1.1rem' }}>
            Ref: {booking.bookingRef}
          </p>

          {booking.qrCode && (
            <div className="success-qr">
              <img src={booking.qrCode} alt="QR Ticket" />
            </div>
          )}

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Seats: {booking.seats.map(s => s.label).join(', ')} | Total: ₹{booking.totalAmount}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            A confirmation email has been sent. Show the QR code at the venue.
          </p>

          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/bookings')}>View Bookings</button>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>Browse Events</button>
          </div>
        </div>
      </div>
    );
  }

  // group seats by row for rendering
  const seatsByRow = {};
  seats.forEach(s => {
    if (!seatsByRow[s.row]) seatsByRow[s.row] = [];
    seatsByRow[s.row].push(s);
  });
  const rowNumbers = Object.keys(seatsByRow).map(Number).sort((a, b) => a - b);

  return (
    <div className="main-content">
      {/* event header */}
      <div className="page-header">
        <h1>{event.title}</h1>
        <p>
          📅 {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' '} | 🕐 {event.time} | 📍 {event.venue?.name}
        </p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* pricing badges */}
      <div className="pricing-table">
        {event.pricing?.map(p => (
          <div key={p.category} className="pricing-badge">
            <span className="category-color" style={{
              backgroundColor: seats.find(s => s.category === p.category)?.categoryColor || '#4CAF50'
            }}></span>
            <span>{p.category}</span>
            <span className="category-price">₹{p.price}</span>
          </div>
        ))}
      </div>

      <div className="checkout-container" style={{ marginTop: 24 }}>
        {/* seat map */}
        <div className="seat-map-container">
          <div className="screen-indicator">
            <div className="screen-bar"></div>
            <div className="screen-label">Screen / Stage</div>
          </div>

          <div className="seat-grid">
            {rowNumbers.map(rowNum => {
              const rowSeats = seatsByRow[rowNum];
              const rowLetter = String.fromCharCode(64 + rowNum);
              return (
                <div key={rowNum} className="seat-row">
                  <span className="seat-row-label">{rowLetter}</span>
                  {rowSeats.map(seat => {
                    let cls = 'seat ';
                    if (selected.find(s => s._id === seat._id)) cls += 'selected';
                    else if (seat.status === 'held' && seat.heldBy === user?._id) cls += 'my-hold';
                    else cls += seat.status;

                    return (
                      <div
                        key={seat._id}
                        className={cls}
                        title={`${seat.label} - ${seat.category} (${seat.status})`}
                        onClick={() => step === 'select' && toggleSeat(seat)}
                        style={seat.status === 'available' ? { backgroundColor: seat.categoryColor } : {}}
                      >
                        {seat.number}
                      </div>
                    );
                  })}
                  <span className="seat-row-label">{rowLetter}</span>
                </div>
              );
            })}
          </div>

          <div className="seat-legend">
            <div className="seat-legend-item">
              <div className="seat-legend-dot" style={{ background: 'var(--seat-available)' }}></div>
              Available
            </div>
            <div className="seat-legend-item">
              <div className="seat-legend-dot" style={{ background: 'var(--seat-selected)' }}></div>
              Selected
            </div>
            <div className="seat-legend-item">
              <div className="seat-legend-dot" style={{ background: 'var(--seat-held)' }}></div>
              Held
            </div>
            <div className="seat-legend-item">
              <div className="seat-legend-dot" style={{ background: 'var(--seat-booked)' }}></div>
              Booked
            </div>
          </div>

          {/* sold out categories - show waitlist option */}
          {event.pricing?.map(p => {
            const catSeats = seats.filter(s => s.category === p.category);
            const allGone = catSeats.length > 0 && catSeats.every(s => s.status === 'booked');
            if (!allGone) return null;
            return (
              <div key={p.category} className="alert alert-warning" style={{ marginTop: 16 }}>
                {p.category} is sold out!
                <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }}
                  onClick={() => handleJoinWaitlist(p.category)}>
                  Join Waitlist
                </button>
              </div>
            );
          })}
        </div>

        {/* checkout sidebar */}
        <div className="checkout-summary">
          {step === 'checkout' && timeLeft !== null && (
            <div className={`checkout-timer ${timeLeft < 60 ? 'urgent' : ''}`}>
              <div className="timer-value">{formatTime(timeLeft)}</div>
              <div className="timer-label">Hold expires in</div>
            </div>
          )}

          <h3>🛒 {step === 'checkout' ? 'Confirm Booking' : 'Your Selection'}</h3>

          {(step === 'select' ? selected : heldSeats).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Click on available seats to select them
            </p>
          ) : (
            <>
              <div className="checkout-seats-list">
                {(step === 'select' ? selected : heldSeats).map(s => (
                  <div key={s._id} className="checkout-seat-item">
                    <div>
                      <div className="seat-label">{s.label}</div>
                      <div className="seat-category">{s.category}</div>
                    </div>
                    <div className="seat-price">₹{getPrice(s.category)}</div>
                  </div>
                ))}
              </div>

              <div className="checkout-total">
                <span className="total-label">Total</span>
                <span className="total-value">
                  ₹{(step === 'select' ? selected : heldSeats)
                    .reduce((sum, s) => sum + getPrice(s.category), 0)}
                </span>
              </div>

              {step === 'select' && (
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                  onClick={handleHold} disabled={selected.length === 0}>
                  Hold & Proceed ({selected.length} seats)
                </button>
              )}

              {step === 'checkout' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-primary btn-lg" onClick={handleConfirm} disabled={confirming}>
                    {confirming ? 'Processing...' : 'Confirm & Pay'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleCancelHold}>Cancel</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

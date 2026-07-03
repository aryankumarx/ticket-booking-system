const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const { holdSeats, confirmSeats, releaseSeats } = require('../services/seatService');
const { generateQR } = require('../services/qrService');
const { sendBookingConfirmation } = require('../services/emailService');
const { offerToNext } = require('../services/waitlistService');
const router = express.Router();

// hold seats - this is where concurrency protection happens
router.post('/hold', protect, async (req, res) => {
  try {
    const { eventId, seatIds } = req.body;
    if (!eventId || !seatIds?.length) return res.status(400).json({ message: 'Need eventId and seatIds' });
    if (seatIds.length > 10) return res.status(400).json({ message: 'Max 10 seats at a time' });

    const result = await holdSeats(eventId, seatIds, req.user._id);
    if (!result.success) {
      return res.status(409).json({ message: result.message, failedSeats: result.failedSeats });
    }

    // let other clients know these seats are now held
    const io = req.app.get('io');
    if (io) {
      io.to(`event:${eventId}`).emit('seats:updated',
        result.seats.map(s => ({ _id: s._id, row: s.row, number: s.number, status: 'held', heldBy: req.user._id }))
      );
    }

    res.json({
      message: 'Seats held',
      seats: result.seats,
      holdExpiresAt: result.holdExpiresAt,
      holdTTLMinutes: parseInt(process.env.SEAT_HOLD_TTL_MINUTES) || 10
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// confirm booking - generates qr code and sends email
router.post('/confirm', protect, async (req, res) => {
  try {
    const { eventId, seatIds } = req.body;
    if (!eventId || !seatIds?.length) return res.status(400).json({ message: 'Need eventId and seatIds' });

    // make sure these seats are actually held by this user
    const heldSeats = await Seat.find({
      _id: { $in: seatIds }, event: eventId,
      status: 'held', heldBy: req.user._id
    });
    if (heldSeats.length !== seatIds.length) {
      return res.status(409).json({ message: 'Some seats expired or are not held by you' });
    }

    const event = await Event.findById(eventId).populate('venue');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // build the booking
    const bookingRef = uuidv4().split('-')[0].toUpperCase();
    const priceMap = {};
    event.pricing.forEach(p => priceMap[p.category] = p.price);

    const seatDetails = heldSeats.map(s => ({
      seatId: s._id, label: s.label, row: s.row,
      number: s.number, category: s.category,
      price: priceMap[s.category] || 0
    }));
    const total = seatDetails.reduce((sum, s) => sum + s.price, 0);

    // actually mark them as booked
    const ok = await confirmSeats(seatIds, req.user._id, bookingRef);
    if (!ok) return res.status(409).json({ message: 'Could not confirm seats, please try again' });

    const qrCode = await generateQR(bookingRef);

    const booking = await Booking.create({
      bookingRef, event: eventId, user: req.user._id,
      seats: seatDetails, totalAmount: total, status: 'confirmed', qrCode
    });

    // send confirmation email (async, wont block if it fails)
    sendBookingConfirmation(req.user, booking, event, qrCode);

    // update seat map for everyone
    const io = req.app.get('io');
    if (io) {
      io.to(`event:${eventId}`).emit('seats:updated',
        heldSeats.map(s => ({ _id: s._id, row: s.row, number: s.number, status: 'booked' }))
      );
    }

    // check if event is now fully sold out
    const remaining = await Seat.countDocuments({ event: eventId, status: 'available' });
    if (remaining === 0) await Event.findByIdAndUpdate(eventId, { status: 'soldout' });

    res.status(201).json({
      message: 'Booking confirmed!',
      booking: {
        bookingRef: booking.bookingRef, seats: booking.seats,
        totalAmount: booking.totalAmount, qrCode: booking.qrCode,
        event: { title: event.title, date: event.date, time: event.time, venue: event.venue?.name }
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// booking history for logged in user
router.get('/', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate({ path: 'event', select: 'title type date time posterUrl', populate: { path: 'venue', select: 'name' } })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// cancel a booking - releases seats and triggers waitlist
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('event');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your booking' });
    if (booking.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });

    booking.status = 'cancelled';
    await booking.save();

    // free the seats
    const seatIds = booking.seats.map(s => s.seatId);
    const io = req.app.get('io');
    await releaseSeats(seatIds, io, booking.event._id.toString());

    // un-soldout the event if it was
    await Event.findByIdAndUpdate(booking.event._id, { status: 'upcoming' });

    // offer freed seats to waitlisted users
    const categories = [...new Set(booking.seats.map(s => s.category))];
    for (let cat of categories) {
      await offerToNext(booking.event._id, cat);
    }

    res.json({ message: 'Booking cancelled, seats released' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// manually release held seats (user clicks "cancel" during checkout)
router.post('/release', protect, async (req, res) => {
  try {
    const { eventId, seatIds } = req.body;
    await Seat.updateMany(
      { _id: { $in: seatIds }, event: eventId, status: 'held', heldBy: req.user._id },
      { $set: { status: 'available', heldBy: null, heldAt: null, holdExpiresAt: null } }
    );

    const io = req.app.get('io');
    if (io) {
      const updated = await Seat.find({ _id: { $in: seatIds } });
      io.to(`event:${eventId}`).emit('seats:updated', updated);
    }
    res.json({ message: 'Seats released' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

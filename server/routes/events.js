const express = require('express');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const { protect, requireRole } = require('../middleware/auth');
const router = express.Router();

// create event - organiser creates it, seats get auto-generated from venue layout
router.post('/', protect, requireRole('organiser'), async (req, res) => {
  try {
    const { title, type, description, posterUrl, venue, date, time, pricing } = req.body;
    if (!title || !type || !venue || !date || !time || !pricing?.length) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const venueDoc = await Venue.findById(venue);
    if (!venueDoc) return res.status(404).json({ message: 'Venue not found' });

    const event = await Event.create({
      title, type, venue, date, time, pricing,
      description: description || '', posterUrl: posterUrl || '',
      organiser: req.user._id
    });

    // generate all seats based on venue layout
    const { rows, seatsPerRow, categories } = venueDoc.seatLayout;
    const seats = [];

    for (let r = 1; r <= rows; r++) {
      const cat = categories.find(c => r >= c.rowStart && r <= c.rowEnd);
      const catName = cat ? cat.name : 'Standard';
      const catColor = cat ? cat.color : '#4CAF50';
      const rowLetter = String.fromCharCode(64 + r); // A, B, C...

      for (let n = 1; n <= seatsPerRow; n++) {
        seats.push({
          event: event._id, row: r, number: n,
          label: `${rowLetter}${n}`,
          category: catName, categoryColor: catColor,
          status: 'available'
        });
      }
    }
    await Seat.insertMany(seats);

    const populated = await Event.findById(event._id)
      .populate('venue', 'name address seatLayout')
      .populate('organiser', 'name email');

    res.status(201).json({ ...populated.toObject(), totalSeats: seats.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// browse events - supports search, type filter, date filter
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
    if (req.query.date) {
      const d = new Date(req.query.date);
      const next = new Date(req.query.date);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    }

    const events = await Event.find(filter)
      .populate('venue', 'name address')
      .populate('organiser', 'name')
      .sort({ date: 1 });

    // attach seat availability counts
    const result = await Promise.all(events.map(async ev => {
      const counts = await Seat.aggregate([
        { $match: { event: ev._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const avail = { available: 0, held: 0, booked: 0 };
      counts.forEach(c => avail[c._id] = c.count);

      return {
        ...ev.toObject(),
        seatAvailability: avail,
        totalSeats: avail.available + avail.held + avail.booked
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// single event details
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('venue', 'name address seatLayout')
      .populate('organiser', 'name email');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // also get category-wise seat counts
    const catCounts = await Seat.aggregate([
      { $match: { event: event._id } },
      { $group: { _id: { category: '$category', status: '$status' }, count: { $sum: 1 } } }
    ]);

    res.json({ ...event.toObject(), categoryCounts: catCounts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// get all seats for the seat map
router.get('/:id/seats', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('venue');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // also release any expired holds while we're at it
    await Seat.updateMany(
      { event: event._id, status: 'held', holdExpiresAt: { $lt: new Date() } },
      { $set: { status: 'available', heldBy: null, heldAt: null, holdExpiresAt: null } }
    );

    const seats = await Seat.find({ event: req.params.id })
      .select('row number label category categoryColor status heldBy holdExpiresAt')
      .sort({ row: 1, number: 1 });

    res.json({ venue: event.venue, seats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// organiser dashboard - booking summary and revenue for their event
router.get('/:id/summary', protect, requireRole('organiser', 'admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('venue', 'name');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // only let the organiser who created it (or admin) see this
    if (req.user.role === 'organiser' && event.organiser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your event' });
    }

    const bookings = await Booking.find({ event: req.params.id, status: 'confirmed' })
      .populate('user', 'name email');

    let totalRevenue = 0;
    let totalTickets = 0;
    const revenueByCategory = {};

    bookings.forEach(b => {
      totalRevenue += b.totalAmount;
      totalTickets += b.seats.length;
      b.seats.forEach(s => {
        if (!revenueByCategory[s.category]) revenueByCategory[s.category] = { tickets: 0, revenue: 0 };
        revenueByCategory[s.category].tickets++;
        revenueByCategory[s.category].revenue += s.price;
      });
    });

    const seatStatus = await Seat.aggregate([
      { $match: { event: event._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      event: { title: event.title, date: event.date, time: event.time, venue: event.venue?.name },
      summary: {
        totalBookings: bookings.length, totalTickets, totalRevenue, revenueByCategory,
        seatStatus: Object.fromEntries(seatStatus.map(s => [s._id, s.count]))
      },
      bookings: bookings.map(b => ({
        bookingRef: b.bookingRef, customer: b.user?.name, email: b.user?.email,
        seats: b.seats.map(s => s.label).join(', '), amount: b.totalAmount, bookedAt: b.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

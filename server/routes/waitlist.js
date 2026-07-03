const express = require('express');
const mongoose = require('mongoose');
const Waitlist = require('../models/Waitlist');
const { protect } = require('../middleware/auth');
const { joinWaitlist, acceptOffer } = require('../services/waitlistService');
const { isCategorySoldOut } = require('../services/seatService');
const router = express.Router();

// join waitlist for a sold-out category
router.post('/join', protect, async (req, res) => {
  try {
    const { eventId, category, seatsRequested } = req.body;
    if (!eventId || !category) return res.status(400).json({ message: 'Need eventId and category' });

    // only allow joining if actually sold out
    const soldOut = await isCategorySoldOut(eventId, category);
    if (!soldOut) return res.status(400).json({ message: 'Seats still available, no need for waitlist' });

    const entry = await joinWaitlist(eventId, req.user._id, category, seatsRequested || 1);
    res.status(201).json({ message: `You're #${entry.position} on the waitlist`, waitlist: entry });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// check your waitlist status for an event
router.get('/status/:eventId', protect, async (req, res) => {
  try {
    const entries = await Waitlist.find({
      event: req.params.eventId, user: req.user._id,
      status: { $in: ['waiting', 'offered'] }
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// accept a waitlist offer (from email link)
router.post('/accept/:token', protect, async (req, res) => {
  try {
    const entry = await acceptOffer(req.params.token, req.user._id.toString());
    res.json({
      message: 'Offer accepted! Go ahead and pick your seats.',
      eventId: entry.event._id || entry.event,
      category: entry.category
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// leave the waitlist
router.delete('/:id', protect, async (req, res) => {
  try {
    const entry = await Waitlist.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Not found' });
    if (entry.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not yours' });

    entry.status = 'cancelled';
    await entry.save();
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// get waitlist counts for an event (how many ppl waiting per category)
router.get('/event/:eventId', async (req, res) => {
  try {
    const counts = await Waitlist.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(req.params.eventId), status: 'waiting' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const Venue = require('../models/Venue');
const { protect, requireRole } = require('../middleware/auth');
const router = express.Router();

// create a new venue - admin only
router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, address, seatLayout } = req.body;
    if (!name || !address || !seatLayout || !seatLayout.categories?.length) {
      return res.status(400).json({ message: 'Need name, address and seat layout with categories' });
    }
    const venue = await Venue.create({ name, address, seatLayout, createdBy: req.user._id });
    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// list all venues
router.get('/', protect, async (req, res) => {
  try {
    const venues = await Venue.find().populate('createdBy', 'name email');
    res.json(venues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// get single venue
router.get('/:id', protect, async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id).populate('createdBy', 'name');
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    res.json(venue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// update venue
router.put('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found' });

    if (req.body.name) venue.name = req.body.name;
    if (req.body.address) venue.address = req.body.address;
    if (req.body.seatLayout) venue.seatLayout = req.body.seatLayout;
    
    await venue.save();
    res.json(venue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// delete venue
router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const venue = await Venue.findByIdAndDelete(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    res.json({ message: 'Venue deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

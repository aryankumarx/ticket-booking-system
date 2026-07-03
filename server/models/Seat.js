const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  row: { type: Number, required: true },
  number: { type: Number, required: true },
  label: { type: String, required: true }, // like "A1", "B5" etc
  category: { type: String, required: true },
  categoryColor: { type: String, default: '#4CAF50' },
  status: {
    type: String,
    enum: ['available', 'held', 'booked'],
    default: 'available'
  },
  // hold info - gets cleared when hold expires or seat is booked
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  heldAt: { type: Date, default: null },
  holdExpiresAt: { type: Date, default: null },
  // booking info
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  bookingRef: { type: String, default: null }
}, { timestamps: true });

// indexes for quick lookups
seatSchema.index({ event: 1, row: 1, number: 1 }, { unique: true });
seatSchema.index({ status: 1, holdExpiresAt: 1 });

module.exports = mongoose.model('Seat', seatSchema);

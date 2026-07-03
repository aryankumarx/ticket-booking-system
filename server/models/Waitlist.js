const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  seatsRequested: { type: Number, default: 1, min: 1 },
  position: { type: Number, required: true }, // queue position
  status: {
    type: String,
    enum: ['waiting', 'offered', 'expired', 'converted', 'cancelled'],
    default: 'waiting'
  },
  // when a seat opens up, we "offer" it to next in line with a time limit
  offeredAt: { type: Date, default: null },
  offerExpiresAt: { type: Date, default: null },
  offerToken: { type: String, default: null }
}, { timestamps: true });

waitlistSchema.index({ event: 1, category: 1, status: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);

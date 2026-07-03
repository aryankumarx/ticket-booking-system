const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingRef: { type: String, required: true, unique: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seats: [{
    seatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat' },
    label: String,
    row: Number,
    number: Number,
    category: String,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  },
  qrCode: { type: String, default: null } // stored as base64 data url
}, { timestamps: true });

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ event: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

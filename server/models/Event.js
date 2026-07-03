const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['movie', 'concert'], required: true },
  description: { type: String, default: '' },
  posterUrl: { type: String, default: '' },
  venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  organiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  // pricing varies by seat category
  pricing: [{
    category: String,
    price: { type: Number, min: 0 }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'soldout', 'cancelled', 'completed'],
    default: 'upcoming'
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);

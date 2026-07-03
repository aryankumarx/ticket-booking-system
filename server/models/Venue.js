const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  seatLayout: {
    rows: { type: Number, required: true, min: 1, max: 30 },
    seatsPerRow: { type: Number, required: true, min: 1, max: 50 },
    // each category covers a range of rows, e.g. rows 1-3 = Premium
    categories: [{
      name: String,
      rowStart: Number,
      rowEnd: Number,
      color: { type: String, default: '#4CAF50' }
    }]
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Venue', venueSchema);

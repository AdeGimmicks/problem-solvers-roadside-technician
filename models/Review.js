const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  quote: { type: String, required: true, trim: true },
  source: { type: String, default: 'Google' },
  visible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);

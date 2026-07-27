const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  serviceName: { type: String, required: true, trim: true },
  startingPrice: { type: Number, required: true },
  description: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Pricing', pricingSchema);
